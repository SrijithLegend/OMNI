import type { UUID, Timestamp } from "../types/omni";

/**
 * User — Authentication and profile data.
 */

export interface User {
  id: UUID;
  email: string;
  name: string;
  avatar?: string;
  authProvider: AuthProvider;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  workspaces: UUID[];
  activeWorkspaceId: UUID;
  preferences: UserPreferences;
}

export type AuthProvider = "local" | "google" | "github" | "email" | "oauth";

export interface UserPreferences {
  locale: string;
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  expiresAt: Timestamp;
  provider: AuthProvider;
}

export interface UserCredentials {
  email: string;
  password?: string;
  token?: string;
  provider: AuthProvider;
}

export function createUser(email: string, name: string, provider: AuthProvider): User {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    email,
    name,
    authProvider: provider,
    createdAt: now,
    lastLoginAt: now,
    workspaces: [],
    activeWorkspaceId: "",
    preferences: {
      locale: "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
    },
  };
}
