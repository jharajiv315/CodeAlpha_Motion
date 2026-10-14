import React, { useState, useRef, useEffect } from 'react';
import { useSearch } from '../../contexts/SearchContext.tsx';
import { useWorkspace } from '../../contexts/WorkspaceContext.tsx';
import {
  Search,
  X,
  SlidersHorizontal,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface HeaderSearchBarProps {
  onSearchFocus?: () => void;
}

export function HeaderSearchBar({ onSearchFocus }: HeaderSearchBarProps) {
  const {
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
  } = useSearch();

  const { workspaceMembers } = useWorkspace();
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut to focus search: Cmd+K / Ctrl+K or '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in another input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape' && document.activeElement === inputRef.current) {
          inputRef.current?.blur();
          setShowFilterMenu(false);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        onSearchFocus?.();
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
        onSearchFocus?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchFocus]);

  // Click outside to close filter menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowFilterMenu(false);
      }
    };

    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg transition-all"
    >
      {/* Search Input Box */}
      <div
        className={`flex items-center w-full bg-[#F8F9FB] hover:bg-[#F3F4F6] focus-within:bg-white border rounded-lg px-2.5 py-1 text-xs transition-all duration-150 ${
          hasActiveFilters
            ? 'border-[#5965D8]/50 ring-1 ring-[#5965D8]/20 bg-white'
            : 'border-[#E7E9ED] focus-within:border-[#5965D8] focus-within:ring-2 focus-within:ring-[#5965D8]/20'
        }`}
      >
        <Search className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0 mr-2" />

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onFocus={() => onSearchFocus?.()}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onSearchFocus?.();
          }}
          placeholder="Filter tasks by keyword, assignee, or priority..."
          className="w-full bg-transparent text-[#20242B] placeholder-[#9CA3AF] focus:outline-hidden text-xs truncate"
        />

        {/* Clear query icon */}
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            className="p-0.5 text-[#9CA3AF] hover:text-[#20242B] rounded transition-colors mr-1 cursor-pointer"
            title="Clear text filter"
            aria-label="Clear text filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Keyboard shortcut hint */}
        {!searchQuery && !hasActiveFilters && (
          <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono text-[#9CA3AF] bg-white border border-[#E7E9ED] rounded shadow-2xs shrink-0 select-none">
            /
          </kbd>
        )}

        {/* Filter Toggle Button */}
        <button
          type="button"
          onClick={() => setShowFilterMenu((prev) => !prev)}
          className={`flex items-center gap-1 ml-1.5 pl-1.5 border-l border-[#E7E9ED] transition-colors cursor-pointer text-[11px] font-medium py-0.5 ${
            selectedAssignee !== 'all' || selectedPriority !== 'all' || onlyBlocked
              ? 'text-[#5965D8]'
              : 'text-[#6D7480] hover:text-[#20242B]'
          }`}
          title="Filter by Assignee, Priority, or Blocked status"
          aria-label="Toggle filters menu"
        >
          <SlidersHorizontal className="w-3 h-3 shrink-0" />
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#5965D8] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Popover Dropdown */}
      {showFilterMenu && (
        <div className="absolute right-0 top-10 z-50 w-72 bg-white border border-[#E7E9ED] rounded-xl shadow-lg p-3 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#F4F5F7]">
            <span className="font-semibold text-[#20242B] text-xs">Filter Tasks</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-[#C54D4D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset all</span>
              </button>
            )}
          </div>

          {/* Priority Filter */}
          <div className="space-y-1">
            <label htmlFor="header-priority-filter" className="block text-[11px] font-medium text-[#6D7480]">
              Priority
            </label>
            <select
              id="header-priority-filter"
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                onSearchFocus?.();
              }}
              className="w-full bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-2 py-1.5 text-xs text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
            >
              <option value="all">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="space-y-1">
            <label htmlFor="header-assignee-filter" className="block text-[11px] font-medium text-[#6D7480]">
              Assignee
            </label>
            <select
              id="header-assignee-filter"
              value={selectedAssignee}
              onChange={(e) => {
                setSelectedAssignee(e.target.value);
                onSearchFocus?.();
              }}
              className="w-full bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-2 py-1.5 text-xs text-[#20242B] focus:outline-hidden focus:border-[#5965D8]"
            >
              <option value="all">All Assignees</option>
              {workspaceMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Blocker Filter Toggle */}
          <div className="pt-1 border-t border-[#F4F5F7] flex items-center justify-between">
            <span className="text-[11px] text-[#6D7480] flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-[#B97828]" />
              <span>Only Blocked Tasks</span>
            </span>
            <input
              type="checkbox"
              id="header-blocked-filter"
              checked={onlyBlocked}
              onChange={(e) => {
                setOnlyBlocked(e.target.checked);
                onSearchFocus?.();
              }}
              className="rounded border-[#E7E9ED] text-[#5965D8] focus:ring-[#5965D8] cursor-pointer"
            />
          </div>

          {/* Active summary helper */}
          <div className="pt-2 border-t border-[#F4F5F7] flex items-center justify-between text-[10px] text-[#9CA3AF]">
            <span>Tip: type keyword, assignee, or priority in search</span>
            <button
              type="button"
              onClick={() => setShowFilterMenu(false)}
              className="px-2 py-0.5 bg-[#20242B] text-white rounded font-medium cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
