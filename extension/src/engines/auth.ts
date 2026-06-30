/**
 * Authentication Engine — Abstraction for user authentication.
 *
 * Supports future: Google, GitHub, Email, Local, OAuth.
 */

import { BaseEngine } from "./base";
import type { User, AuthProvider, AuthSession, UserCredentials } from "../models/user";
import { createUser } from "../models/user";

export class AuthEngine extends BaseEngine {
  private user: User | null = null;
  private session: AuthSession | null = null;
  private provider: AuthProvider = "local";

  constructor() {
    super({ name: "AuthEngine", version: "1.0.0", debug: false });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit("ready", { authenticated: false });
  }

  async stop(): Promise<void> {
    this.user = null;
    this.session = null;
    this.isRunning = false;
  }

  async health(): Promise<import("./base").HealthStatus> {
    return {
      ok: true,
      message: this.user ? `Authenticated: ${this.user.email}` : "Not authenticated",
      timestamp: Date.now(),
    };
  }

  async login(credentials: UserCredentials): Promise<User> {
    const user = createUser(credentials.email, credentials.email.split("@")[0], credentials.provider);
    this.user = user;
    this.provider = credentials.provider;
    this.session = {
      token: "mock-token",
      refreshToken: "mock-refresh",
      expiresAt: Date.now() + 3600000,
      provider: credentials.provider,
    };
    this.emit("login", user);
    return user;
  }

  async logout(): Promise<void> {
    this.user = null;
    this.session = null;
    this.emit("logout");
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return !!this.user;
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  async refreshSession(): Promise<void> {
    if (this.session) {
      this.session.expiresAt = Date.now() + 3600000;
    }
  }
}
