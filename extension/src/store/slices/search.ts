/**
 * Search Slice — Reactive state for the Search Engine.
 */

export interface SearchSlice {
  query: string;
  isSearching: boolean;
  results: SearchResult[];
  filters: SearchFilters;
  suggestions: string[];
  history: string[];
  total: number;
  duration: number;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  projectId: string | null;
  timestamp: number;
  score: number;
}

export interface SearchFilters {
  types: string[];
  projectId: string | null;
  from: number | null;
  to: number | null;
}

export const initialSearchSlice: SearchSlice = {
  query: "",
  isSearching: false,
  results: [],
  filters: {
    types: [],
    projectId: null,
    from: null,
    to: null,
  },
  suggestions: [],
  history: [],
  total: 0,
  duration: 0,
};
