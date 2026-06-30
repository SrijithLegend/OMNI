/**
 * Timeline Slice — Reactive state for the Timeline Engine.
 */

export interface TimelineSlice {
  events: TimelineEvent[];
  isLoading: boolean;
  hasMore: boolean;
  total: number;
  filter: TimelineFilter;
  selectedEventId: string | null;
}

export interface TimelineEvent {
  id: string;
  type: string;
  category: string;
  projectId: string | null;
  conversationId: string | null;
  title: string;
  description: string;
  timestamp: number;
  icon: string;
  color: string;
}

export interface TimelineFilter {
  categories: string[];
  types: string[];
  projectId: string | null;
  from: number | null;
  to: number | null;
  limit: number;
  offset: number;
}

export const initialTimelineSlice: TimelineSlice = {
  events: [],
  isLoading: false,
  hasMore: false,
  total: 0,
  filter: {
    categories: [],
    types: [],
    projectId: null,
    from: null,
    to: null,
    limit: 50,
    offset: 0,
  },
  selectedEventId: null,
};
