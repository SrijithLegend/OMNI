/**
 * Notification Slice — Reactive state for notifications.
 */

export interface NotificationSlice {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  mutedUntil: number | null;
}

export interface AppNotification {
  id: string;
  level: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    type: string;
    payload: Record<string, unknown>;
  };
}

export const initialNotificationSlice: NotificationSlice = {
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  mutedUntil: null,
};
