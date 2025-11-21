import { useState, useEffect } from 'react';

const STORAGE_KEY = 'calendarFilters';

const defaultFilters = {
  showGoogleEvents: true,
  showNantesEvents: true,
  nantesCategories: null // null = show all categories, [] = show none, [cat1, cat2] = show specific
};

// Load filters synchronously on first render
function loadFiltersFromStorage() {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultFilters, ...parsed };
      }
    }
  } catch (error) {
    console.warn('Failed to load calendar filters from localStorage:', error);
  }
  return defaultFilters;
}

export function useCalendarFilters() {
  // Load filters synchronously on first render to avoid delay
  const [filters, setFilters] = useState(loadFiltersFromStorage);

  // Save filters to localStorage whenever they change
  const updateFilters = (newFilters) => {
    setFilters(newFilters);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFilters));
    } catch (error) {
      console.warn('Failed to save calendar filters to localStorage:', error);
    }
  };

  const toggleGoogleEvents = () => {
    updateFilters({ ...filters, showGoogleEvents: !filters.showGoogleEvents });
  };

  const toggleNantesEvents = () => {
    updateFilters({ ...filters, showNantesEvents: !filters.showNantesEvents });
  };

  const setNantesCategories = (categories) => {
    // Always create a new object to ensure React detects the change
    // For arrays, create a new array reference
    // For null, keep it as is (primitive value)
    const newCategories = Array.isArray(categories) ? [...categories] : categories;
    const newFilters = { ...filters, nantesCategories: newCategories };
    console.log('[useCalendarFilters] setNantesCategories called:', { 
      old: filters.nantesCategories, 
      new: newCategories,
      oldType: typeof filters.nantesCategories,
      newType: typeof newCategories,
      isArray: Array.isArray(newCategories)
    });
    updateFilters(newFilters);
  };

  const toggleNantesCategory = (category, availableCategories = null) => {
    // If null, it means all categories are selected
    // When toggling from null state, we need to create an array with all categories except the one being toggled
    if (filters.nantesCategories === null) {
      if (availableCategories && availableCategories.length > 0) {
        // Remove the toggled category from all available categories
        const newCategories = availableCategories.filter(c => c !== category);
        updateFilters({ ...filters, nantesCategories: newCategories });
      } else {
        // If we don't have availableCategories, just create empty array and add all except this one
        // This is a fallback, but ideally availableCategories should be provided
        updateFilters({ ...filters, nantesCategories: [] });
      }
    } else {
      // Normal toggle: add or remove the category
      const currentCategories = filters.nantesCategories || [];
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      // If all categories are selected, set to null (show all)
      if (availableCategories && newCategories.length === availableCategories.length) {
        updateFilters({ ...filters, nantesCategories: null });
      } else {
        updateFilters({ ...filters, nantesCategories: newCategories });
      }
    }
  };

  return {
    filters,
    showGoogleEvents: filters.showGoogleEvents,
    showNantesEvents: filters.showNantesEvents,
    nantesCategories: filters.nantesCategories === undefined ? null : filters.nantesCategories,
    toggleGoogleEvents,
    toggleNantesEvents,
    setNantesCategories,
    toggleNantesCategory
  };
}

