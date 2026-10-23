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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      className="relative flex items-center w-full max-w-xs sm:max-w-sm md:max-w-md transition-all"
    >
      <div
        className={`flex items-center w-full px-3 h-9 text-[12.5px] rounded-[6px] transition-colors border ${
          hasActiveFilters
            ? 'bg-[#FFFCF6] border-[#596D56]'
            : 'bg-[#F3EFE5] hover:bg-[#EDE7DA] border-[#DED8CB] focus-within:bg-[#FFFCF6] focus-within:border-[#596D56]'
        }`}
      >
        <Search className="w-3.5 h-3.5 text-[#70786D] shrink-0 mr-2" />

        <input
          id="global-task-search-input"
          ref={inputRef}
          type="text"
          value={searchQuery}
          onFocus={() => onSearchFocus?.()}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            onSearchFocus?.();
          }}
          placeholder="Search tasks (⌘K)..."
          className="w-full bg-transparent text-[#33382F] placeholder-[#70786D] focus:outline-hidden text-[12.5px] truncate font-medium"
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              inputRef.current?.focus();
            }}
            className="p-0.5 text-[#70786D] hover:text-[#33382F] rounded-[4px] transition-colors mr-1 cursor-pointer"
            title="Clear text filter"
            aria-label="Clear text filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowFilterMenu((prev) => !prev)}
          className={`flex items-center gap-1.5 ml-1.5 pl-2 border-l border-[#DED8CB] transition-colors cursor-pointer text-[12px] font-medium py-0.5 ${
            selectedAssignee !== 'all' || selectedPriority !== 'all' || onlyBlocked
              ? 'text-[#596D56] font-semibold'
              : 'text-[#5D655A] hover:text-[#33382F]'
          }`}
          title="Filter by Assignee, Priority, or Blocked status"
          aria-label="Toggle filters menu"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-[4px] bg-[#E3EBDD] text-[#33382F] text-[11px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilterMenu && (
        <div className="absolute right-0 top-11 z-50 w-72 motion-popover p-4 text-[12.5px] space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#EAE4D8]">
            <span className="font-semibold text-[#33382F] text-[13px]">Filter Tasks</span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11.5px] text-[#985C51] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all</span>
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="header-priority-filter" className="block text-[12px] font-medium text-[#5D655A]">
              Priority
            </label>
            <select
              id="header-priority-filter"
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                onSearchFocus?.();
              }}
              className="w-full motion-input px-2.5 py-1.5 text-[12.5px] cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="header-assignee-filter" className="block text-[12px] font-medium text-[#5D655A]">
              Assignee
            </label>
            <select
              id="header-assignee-filter"
              value={selectedAssignee}
              onChange={(e) => {
                setSelectedAssignee(e.target.value);
                onSearchFocus?.();
              }}
              className="w-full motion-input px-2.5 py-1.5 text-[12.5px] cursor-pointer"
            >
              <option value="all">All Assignees</option>
              {workspaceMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-[#EAE4D8] flex items-center justify-between">
            <label htmlFor="header-blocked-filter" className="text-[12px] text-[#A46F5C] flex items-center gap-1.5 font-medium cursor-pointer">
              <AlertTriangle className="w-3.5 h-3.5 text-[#A46F5C]" />
              <span>Only Blocked Tasks</span>
            </label>
            <input
              type="checkbox"
              id="header-blocked-filter"
              checked={onlyBlocked}
              onChange={(e) => {
                setOnlyBlocked(e.target.checked);
                onSearchFocus?.();
              }}
              className="rounded-[4px] border-[#DED8CB] text-[#596D56] focus:ring-[#596D56] cursor-pointer h-4 w-4 accent-[#596D56]"
            />
          </div>

          <div className="pt-2.5 border-t border-[#EAE4D8] flex items-center justify-between text-[11.5px] text-[#70786D]">
            <span>Applies across project views</span>
            <button
              type="button"
              onClick={() => setShowFilterMenu(false)}
              className="px-3 py-1 btn-primary cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
