import React, { createContext, useContext, useState, useMemo } from 'react';

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedAssignee: string;
  setSelectedAssignee: (assigneeId: string) => void;
  selectedPriority: string;
  setSelectedPriority: (priority: string) => void;
  onlyBlocked: boolean;
  setOnlyBlocked: React.Dispatch<React.SetStateAction<boolean>>;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      selectedAssignee !== 'all' ||
      selectedPriority !== 'all' ||
      onlyBlocked
    );
  }, [searchQuery, selectedAssignee, selectedPriority, onlyBlocked]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim().length > 0) count++;
    if (selectedAssignee !== 'all') count++;
    if (selectedPriority !== 'all') count++;
    if (onlyBlocked) count++;
    return count;
  }, [searchQuery, selectedAssignee, selectedPriority, onlyBlocked]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedAssignee('all');
    setSelectedPriority('all');
    setOnlyBlocked(false);
  };

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        selectedAssignee,
        setSelectedAssignee,
        selectedPriority,
        setSelectedPriority,
        onlyBlocked,
        setOnlyBlocked,
        resetFilters,
        hasActiveFilters,
        activeFilterCount,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextType {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
