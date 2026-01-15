import { useState, useEffect, useCallback } from 'react';

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  timestamp: number;
}

const HISTORY_KEY = 'shipments_search_history';
const SAVED_KEY = 'shipments_saved_searches';
const MAX_HISTORY = 10;

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(HISTORY_KEY);
      const storedSaved = localStorage.getItem(SAVED_KEY);
      
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
      if (storedSaved) {
        setSavedSearches(JSON.parse(storedSaved));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Add to history
  const addToHistory = useCallback((query: string) => {
    if (!query || query.trim() === '') return;

    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // Remove duplicates
      const filtered = prev.filter(item => item.query !== newItem.query);
      // Add to front and limit to MAX_HISTORY
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY);
      
      // Save to localStorage
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
      
      return updated;
    });
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  // Remove specific history item
  const removeHistoryItem = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to update search history:', error);
      }
      return updated;
    });
  }, []);

  // Save a search with custom name
  const saveSearch = useCallback((query: string, name: string) => {
    if (!query || !name || query.trim() === '' || name.trim() === '') return;

    const newSaved: SavedSearch = {
      id: Date.now().toString(),
      name: name.trim(),
      query: query.trim(),
      timestamp: Date.now(),
    };

    setSavedSearches((prev) => {
      // Add to front
      const updated = [newSaved, ...prev];
      
      // Save to localStorage
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save search:', error);
      }
      
      return updated;
    });
  }, []);

  // Remove saved search
  const removeSavedSearch = useCallback((id: string) => {
    setSavedSearches((prev) => {
      const updated = prev.filter(item => item.id !== id);
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to update saved searches:', error);
      }
      return updated;
    });
  }, []);

  // Update saved search name
  const updateSavedSearchName = useCallback((id: string, newName: string) => {
    setSavedSearches((prev) => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, name: newName.trim() } : item
      );
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to update saved search:', error);
      }
      return updated;
    });
  }, []);

  return {
    history,
    savedSearches,
    addToHistory,
    clearHistory,
    removeHistoryItem,
    saveSearch,
    removeSavedSearch,
    updateSavedSearchName,
  };
}

