/**
 * Authentication Engine — Production-grade authentication with Supabase Auth.
 *
 * Supports: Google OAuth, GitHub OAuth, Email/Password, Magic Link
 * Features: Registration, Login, Logout, Session Management, Password Reset
 */

import { BaseEngine } from "./base";
import { createClient, SupabaseClient, AuthChangeEvent, Session, User } from "@supabase/supabase-js";

// ============== TYPES ==============

export type AuthProvider = 'google' | 'github' | 'email' | 'magic_link';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailVerified: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  session: AuthSession | null;
  error: string | null;
}

export interface SignInOptions {
  provider: AuthProvider;
  email?: string;
  password?: string;
  redirectTo?: string;
  rememberMe?: boolean;
}

export interface SignUpOptions {
  email: string;
  password: string;
  displayName?: string;
  redirectTo?: string;
}

export interface ResetPasswordOptions {
  email: string;
  redirectTo?: string;
}

export interface UpdatePasswordOptions {
  currentPassword: string;
  newPassword: string;
}

export interface AuthEvent {
  type: AuthChangeEvent;
  session: Session | null;
  user: User | null;
}

export type AuthEventHandler = (event: AuthEvent) => void;

// ============== ENGINE ==============

export class AuthEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private authState: AuthState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    session: null,
    error: null,
  };
  private authHandlers: Set<AuthEventHandler> = new Set();
  private sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ name: "AuthEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });

      // Listen for auth state changes
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
        this.handleAuthStateChange.bind(this)
      );

      // Get initial session
      await this.refreshSession();

      // Start periodic session check
      this.startSessionCheck();
    }

    this.isRunning = true;
    this.emit("ready", this.authState);
  }

  async stop(): Promise<void> {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }

    this.supabase = null;
    this.authHandlers.clear();
    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    return {
      ok: true,
      message: `Auth: ${this.authState.isAuthenticated ? "Authenticated" : "Not authenticated"}`,
      timestamp: Date.now(),
    };
  }

  // ============== AUTHENTICATION ==============

  /**
   * Sign in with provider
   */
  async signIn(options: SignInOptions): Promise<AuthUser> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    this.authState.isLoading = true;
    this.authState.error = null;
    this.emit("loading", true);

    try {
      if (options.provider === 'google' || options.provider === 'github') {
        return await this.signInWithOAuth(options as { provider: 'google' | 'github'; redirectTo?: string });
      } else if (options.provider === 'email' && options.email && options.password) {
        return await this.signInWithEmail(options.email, options.password, options.rememberMe);
      } else if (options.provider === 'magic_link' && options.email) {
        return await this.signInWithMagicLink(options.email, options.redirectTo);
      } else {
        throw new Error("Invalid sign-in options");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign-in failed";
      this.authState.error = message;
      this.authState.isLoading = false;
      this.emit("error", message);
      throw error;
    }
  }

  /**
   * Sign in with OAuth provider
   */
  private async signInWithOAuth(options: { provider: 'google' | 'github'; redirectTo?: string }): Promise<AuthUser> {
    const { error } = await this.supabase!.auth.signInWithOAuth({
      provider: options.provider,
      options: {
        redirectTo: options.redirectTo || window.location.origin,
      },
    });

    if (error) throw error;

    // OAuth will redirect, so we return a placeholder
    // The actual user will be available after the redirect
    return {} as AuthUser;
  }

  /**
   * Sign in with email and password
   */
  private async signInWithEmail(email: string, password: string, _rememberMe?: boolean): Promise<AuthUser> {
    const { data, error } = await this.supabase!.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    this.authState.isLoading = false;
    return this.mapUser(data.user);
  }

  /**
   * Sign in with magic link
   */
  private async signInWithMagicLink(email: string, redirectTo?: string): Promise<AuthUser> {
    const { error } = await this.supabase!.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo || window.location.origin,
      },
    });

    if (error) throw error;

    this.authState.isLoading = false;
    this.emit("magic-link-sent", email);
    return {} as AuthUser;
  }

  /**
   * Sign up with email and password
   */
  async signUp(options: SignUpOptions): Promise<AuthUser> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    this.authState.isLoading = true;
    this.authState.error = null;

    const { data, error } = await this.supabase.auth.signUp({
      email: options.email,
      password: options.password,
      options: {
        data: {
          display_name: options.displayName || null,
        },
        emailRedirectTo: options.redirectTo || window.location.origin,
      },
    });

    if (error) {
      this.authState.error = error.message;
      this.authState.isLoading = false;
      throw error;
    }

    this.authState.isLoading = false;

    // Check if email confirmation is required
    if (!data.session) {
      this.emit("confirmation-required", options.email);
    }

    return this.mapUser(data.user!);
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase.auth.signOut();

    if (error) {
      this.authState.error = error.message;
      throw error;
    }

    this.authState = {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      session: null,
      error: null,
    };

    this.emit("signed-out");
  }

  /**
   * Send password reset email
   */
  async resetPassword(options: ResetPasswordOptions): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await this.supabase.auth.resetPasswordForEmail(options.email, {
      redirectTo: options.redirectTo || `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    this.emit("password-reset-sent", options.email);
  }

  /**
   * Update password
   */
  async updatePassword(options: UpdatePasswordOptions): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await this.supabase.auth.updateUser({
      password: options.newPassword,
    });

    if (error) throw error;

    this.emit("password-updated");
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) throw error;

    this.emit("verification-sent", email);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string, type: 'signup' | 'recovery' = 'signup'): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await this.supabase.auth.verifyOtp({
      token_hash: token,
      type,
    });

    if (error) throw error;

    this.emit("email-verified");
  }

  // ============== SESSION MANAGEMENT ==============

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<AuthSession | null> {
    if (!this.supabase) return null;

    const { data: { session }, error } = await this.supabase.auth.refreshSession();

    if (error) {
      this.log("warn", "Failed to refresh session", error);
      return null;
    }

    if (session) {
      this.updateAuthState(session);
      return this.mapSession(session);
    }

    return null;
  }

  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    if (!this.supabase) return null;

    const { data: { session } } = await this.supabase.auth.getSession();

    if (session) {
      return this.mapSession(session);
    }

    return null;
  }

  /**
   * Get current user
   */
  async getUser(): Promise<AuthUser | null> {
    if (!this.supabase) return null;

    const { data: { user } } = await this.supabase.auth.getUser();

    if (user) {
      return this.mapUser(user);
    }

    return null;
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    if (!this.authState.session) return false;
    return this.authState.session.expiresAt > Date.now() / 1000;
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(): Promise<AuthUser | null> {
    if (!this.supabase) return null;

    const { data: { session }, error } = await this.supabase.auth.getSession();

    if (error) {
      this.authState.error = error.message;
      throw error;
    }

    if (session) {
      this.updateAuthState(session);
      return this.mapUser(session.user);
    }

    return null;
  }

  // ============== STATE MANAGEMENT ==============

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.authState.user;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(handler: AuthEventHandler): () => void {
    this.authHandlers.add(handler);
    return () => {
      this.authHandlers.delete(handler);
    };
  }

  // ============== PROFILE MANAGEMENT ==============

  /**
   * Update user profile
   */
  async updateProfile(updates: { displayName?: string; avatarUrl?: string }): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await this.supabase.auth.updateUser({
      data: {
        display_name: updates.displayName,
        avatar_url: updates.avatarUrl,
      },
    });

    if (error) throw error;

    // Update local state
    if (this.authState.user) {
      this.authState.user = {
        ...this.authState.user,
        displayName: updates.displayName ?? this.authState.user.displayName,
        avatarUrl: updates.avatarUrl ?? this.authState.user.avatarUrl,
      };
      this.emit("user-updated", this.authState.user);
    }
  }

  /**
   * Get user profile from database
   */
  async getUserProfile(): Promise<Record<string, unknown> | null> {
    if (!this.supabase || !this.authState.user) return null;

    const userId = this.supabase.auth.getUser();

    const { data, error } = await this.supabase
      .from("omni_user_profiles")
      .select("*")
      .eq("user_id", (await userId).data.user?.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  }

  // ============== INTERNAL ==============

  private handleAuthStateChange(event: AuthChangeEvent, session: Session | null): void {
    this.log("debug", "Auth state changed", event);

    if (session) {
      this.updateAuthState(session);
    } else {
      this.authState = {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        session: null,
        error: null,
      };
    }

    // Notify handlers
    for (const handler of this.authHandlers) {
      try {
        handler({
          type: event,
          session,
          user: session?.user ?? null,
        });
      } catch (error) {
        this.log("error", "Auth handler error", error);
      }
    }

    this.emit(event, this.authState);
  }

  private updateAuthState(session: Session): void {
    this.authState = {
      isAuthenticated: true,
      isLoading: false,
      user: this.mapUser(session.user),
      session: this.mapSession(session),
      error: null,
    };
  }

  private mapUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.display_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
      emailVerified: user.email_confirmed_at !== null,
    };
  }

  private mapSession(session: Session): AuthSession {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at || 0,
      user: this.mapUser(session.user),
    };
  }

  private startSessionCheck(): void {
    // Check session every 5 minutes
    this.sessionCheckInterval = setInterval(() => {
      if (this.authState.isAuthenticated) {
        this.refreshSession().catch((error) => {
          this.log("error", "Session refresh failed", error);
        });
      }
    }, 5 * 60 * 1000);
  }
}

// ============== SINGLETON ==============

let _instance: AuthEngine | null = null;

export function getAuthEngine(): AuthEngine {
  if (!_instance) {
    _instance = new AuthEngine();
  }
  return _instance;
}

// ============== REACT HOOK ==============

import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    session: null,
    error: null,
  });

  const engine = getAuthEngine();

  useEffect(() => {
    // Initial state
    setState(engine.getAuthState());

    // Subscribe to changes
    const unsubscribe = engine.onAuthStateChange(() => {
      setState(engine.getAuthState());
    });

    return unsubscribe;
  }, [engine]);

  const signIn = useCallback((options: SignInOptions) => engine.signIn(options), [engine]);
  const signUp = useCallback((options: SignUpOptions) => engine.signUp(options), [engine]);
  const signOut = useCallback(() => engine.signOut(), [engine]);
  const resetPassword = useCallback((options: ResetPasswordOptions) => engine.resetPassword(options), [engine]);
  const updatePassword = useCallback((options: UpdatePasswordOptions) => engine.updatePassword(options), [engine]);
  const updateProfile = useCallback((updates: { displayName?: string; avatarUrl?: string }) => engine.updateProfile(updates), [engine]);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
  };
}
