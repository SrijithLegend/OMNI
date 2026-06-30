/**
 * Omni Messaging Types — All messages typed, never string-based.
 *
 * Every communication between background, content, popup, and sidepanel
 * must use these typed message contracts.
 */

export type MessageTarget = "background" | "content" | "popup" | "sidepanel" | "options";

export type MessageDirection =
  | "background->content"
  | "background->popup"
  | "background->sidepanel"
  | "content->background"
  | "popup->background"
  | "sidepanel->background"
  | "popup->sidepanel"
  | "sidepanel->popup";

export type MessageType =
  // Workspace
  | "WORKSPACE_LOAD"
  | "WORKSPACE_SAVE"
  | "WORKSPACE_UPDATE"
  | "WORKSPACE_ACTIVE_PROJECT"
  // Project
  | "PROJECT_CREATE"
  | "PROJECT_UPDATE"
  | "PROJECT_DELETE"
  | "PROJECT_LIST"
  | "PROJECT_GET"
  | "PROJECT_SET_ACTIVE"
  // Conversation
  | "CONVERSATION_CAPTURE"
  | "CONVERSATION_CAPTURED"
  | "CONVERSATION_GET"
  | "CONVERSATION_LIST"
  | "CONVERSATION_DELETE"
  | "CONVERSATION_TRANSFER"
  | "CONVERSATION_TRANSFERRED"
  // Transfer
  | "TRANSFER_REQUEST"
  | "TRANSFER_RESPONSE"
  | "TRANSFER_ERROR"
  // Settings
  | "SETTINGS_LOAD"
  | "SETTINGS_SAVE"
  | "SETTINGS_UPDATE"
  | "SETTINGS_RESET"
  // Theme
  | "THEME_CHANGE"
  | "THEME_GET"
  // Storage
  | "STORAGE_GET"
  | "STORAGE_SET"
  | "STORAGE_REMOVE"
  | "STORAGE_CLEAR"
  | "STORAGE_EXPORT"
  | "STORAGE_IMPORT"
  // Timeline
  | "TIMELINE_ADD"
  | "TIMELINE_LIST"
  | "TIMELINE_FILTER"
  // Search
  | "SEARCH_QUERY"
  | "SEARCH_RESULTS"
  // Export
  | "EXPORT_REQUEST"
  | "EXPORT_COMPLETE"
  // Connector
  | "CONNECTOR_LIST"
  | "CONNECTOR_CONNECT"
  | "CONNECTOR_DISCONNECT"
  | "CONNECTOR_SYNC"
  // UI
  | "UI_SHOW_TOAST"
  | "UI_SHOW_MODAL"
  | "UI_NAVIGATE"
  | "UI_GET_STATE"
  // Page
  | "PAGE_GET_INFO"
  | "PAGE_CAPTURE"
  | "PAGE_PASTE"
  // Auth
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_GET_USER"
  // System
  | "SYSTEM_HEALTH"
  | "SYSTEM_PING"
  | "SYSTEM_ERROR"
  | "SYSTEM_LOG"
  // Engine
  | "ENGINE_START"
  | "ENGINE_STOP"
  | "ENGINE_HEALTH"
  | "ENGINE_STATUS";

export interface OmniMessage<TPayload = unknown> {
  type: MessageType;
  payload: TPayload;
  sender: MessageTarget;
  recipient: MessageTarget;
  id: string;
  timestamp: number;
  traceId?: string;
  requiresResponse?: boolean;
}

export interface OmniResponse<TData = unknown> {
  id: string;
  type: MessageType;
  success: boolean;
  data?: TData;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: number;
}

export type MessageHandler<TPayload = unknown, TResult = unknown> = (
  message: OmniMessage<TPayload>,
  reply: (response: OmniResponse<TResult>) => void,
) => void | Promise<void>;

export interface MessageQueueEntry {
  message: OmniMessage;
  resolve: (response: OmniResponse) => void;
  reject: (error: Error) => void;
  sentAt: number;
  timeoutId: number;
}
