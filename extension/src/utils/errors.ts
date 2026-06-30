/**
 * Omni Error System — Typed errors, boundaries, and graceful failures.
 */

export enum OmniErrorCode {
  // Storage
  STORAGE_READ_ERROR = "STORAGE_READ_ERROR",
  STORAGE_WRITE_ERROR = "STORAGE_WRITE_ERROR",
  STORAGE_MIGRATION_ERROR = "STORAGE_MIGRATION_ERROR",
  STORAGE_QUOTA_EXCEEDED = "STORAGE_QUOTA_EXCEEDED",

  // Messaging
  MESSAGE_TIMEOUT = "MESSAGE_TIMEOUT",
  MESSAGE_INVALID_TYPE = "MESSAGE_INVALID_TYPE",
  MESSAGE_DELIVERY_FAILED = "MESSAGE_DELIVERY_FAILED",

  // Engine
  ENGINE_NOT_FOUND = "ENGINE_NOT_FOUND",
  ENGINE_START_FAILED = "ENGINE_START_FAILED",
  ENGINE_DEPENDENCY_MISSING = "ENGINE_DEPENDENCY_MISSING",
  ENGINE_HEALTH_FAILED = "ENGINE_HEALTH_FAILED",

  // Project
  PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND",
  PROJECT_CREATE_FAILED = "PROJECT_CREATE_FAILED",
  PROJECT_UPDATE_FAILED = "PROJECT_UPDATE_FAILED",

  // Workspace
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  WORKSPACE_CORRUPTED = "WORKSPACE_CORRUPTED",

  // Context / Capture
  CAPTURE_FAILED = "CAPTURE_FAILED",
  PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED",
  NO_CONVERSATION_FOUND = "NO_CONVERSATION_FOUND",

  // Transfer
  TRANSFER_FAILED = "TRANSFER_FAILED",
  API_ERROR = "API_ERROR",
  INVALID_API_KEY = "INVALID_API_KEY",
  RATE_LIMITED = "RATE_LIMITED",

  // Connector
  CONNECTOR_NOT_FOUND = "CONNECTOR_NOT_FOUND",
  CONNECTOR_CONNECT_FAILED = "CONNECTOR_CONNECT_FAILED",
  CONNECTOR_SYNC_FAILED = "CONNECTOR_SYNC_FAILED",

  // Auth
  AUTH_FAILED = "AUTH_FAILED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  UNAUTHORIZED = "UNAUTHORIZED",

  // UI
  RENDER_ERROR = "RENDER_ERROR",
  INVALID_STATE = "INVALID_STATE",

  // Network
  NETWORK_ERROR = "NETWORK_ERROR",
  OFFLINE = "OFFLINE",

  // General
  UNKNOWN = "UNKNOWN",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

export interface OmniError {
  code: OmniErrorCode;
  message: string;
  context?: Record<string, unknown>;
  cause?: Error;
  timestamp: number;
  recoverable: boolean;
}

export class OmniErrorClass extends Error {
  readonly code: OmniErrorCode;
  readonly context?: Record<string, unknown>;
  readonly recoverable: boolean;
  readonly timestamp: number;

  constructor(
    code: OmniErrorCode,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
      recoverable?: boolean;
    },
  ) {
    super(message);
    this.name = "OmniError";
    this.code = code;
    this.context = options?.context;
    this.recoverable = options?.recoverable ?? false;
    this.timestamp = Date.now();
  }

  toJSON(): OmniError {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
    };
  }
}

export function createError(
  code: OmniErrorCode,
  message: string,
  options?: { context?: Record<string, unknown>; cause?: Error; recoverable?: boolean },
): OmniErrorClass {
  return new OmniErrorClass(code, message, options);
}

export function isOmniError(error: unknown): error is OmniErrorClass {
  return error instanceof OmniErrorClass;
}

export function handleError(error: unknown): OmniError {
  if (isOmniError(error)) {
    return error.toJSON();
  }
  if (error instanceof Error) {
    return {
      code: OmniErrorCode.UNKNOWN,
      message: error.message,
      cause: error,
      timestamp: Date.now(),
      recoverable: false,
    };
  }
  return {
    code: OmniErrorCode.UNKNOWN,
    message: String(error),
    timestamp: Date.now(),
    recoverable: false,
  };
}

export function assert<T>(
  condition: T,
  code: OmniErrorCode,
  message: string,
): asserts condition {
  if (!condition) {
    throw createError(code, message);
  }
}
