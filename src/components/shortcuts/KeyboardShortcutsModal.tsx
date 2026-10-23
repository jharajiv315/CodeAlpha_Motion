import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Keyboard,
  Search,
  Plus,
  Kanban,
  CheckSquare,
  AlertTriangle,
  FileCheck,
  Users,
  Mail,
  RotateCcw,
  FolderPlus,
  CornerDownLeft,
} from 'lucide-react';

export interface ShortcutCommand {
  id: string;
  title: string;
  description: string;
  category: 'Quick Actions' | 'Navigation' | 'Filtering & Search' | 'General';
  keys: string[];
  aliases?: string[];
  icon: React.ReactNode;
  action: () => void;
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: ShortcutCommand[];
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  commands,
}: KeyboardShortcutsModalProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedCategory('ALL');
      setActiveIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    }
  }, [isOpen]);

  const categories = ['ALL', 'Quick Actions', 'Navigation', 'Filtering & Search', 'General'] as const;

  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) => {
      if (selectedCategory !== 'ALL' && cmd.category !== selectedCategory) {
        return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase().trim();
      const matchesTitle = cmd.title.toLowerCase().includes(q);
      const matchesDesc = cmd.description.toLowerCase().includes(q);
      const matchesCategory = cmd.category.toLowerCase().includes(q);
      const matchesKeys = cmd.keys.join(' ').toLowerCase().includes(q);
      const matchesAliases = cmd.aliases?.some((a) => a.toLowerCase().includes(q));
      return matchesTitle || matchesDesc || matchesCategory || matchesKeys || matchesAliases;
    });
  }, [commands, query, selectedCategory]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filteredCommands.length > 0
            ? (prev - 1 + filteredCommands.length) % filteredCommands.length
            : 0
        );
      } else if (e.key === 'Enter' && filteredCommands[activeIndex]) {
        e.preventDefault();
        const target = filteredCommands[activeIndex];
        onClose();
        target.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, activeIndex, onClose]);

  if (!isOpen) return null;

  // Group filtered commands by category for display
  const groupedCommands = filteredCommands.reduce<Record<string, ShortcutCommand[]>>(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {}
  );

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#33382F]/25 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="motion-modal rounded-[12px] max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE4D8] bg-[#FFFCF6] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[9px] bg-[#E3EBDD] border border-[#C8D8C1] text-[#596D56] flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-[16px] font-semibold text-[#33382F]"
              >
                Keyboard Shortcuts &amp; Commands
              </h2>
              <p className="text-[12px] text-[#70786D]">
                Press a shortcut anywhere or select a command below to execute it immediately
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#70786D] hover:text-[#33382F] p-1.5 rounded-[6px] hover:bg-[#EDE7DA] transition-colors cursor-pointer"
            aria-label="Close keyboard shortcuts modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="px-6 py-3.5 bg-[#F3EFE5] border-b border-[#DED8CB] space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#70786D] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands or keys (e.g. CMD+K, CMD+N, new note, blockers)..."
              className="w-full text-[13px] motion-input rounded-[9px] pl-9 pr-8 py-2 bg-[#FFFCF6]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#70786D] hover:text-[#33382F] p-1 cursor-pointer"
                aria-label="Clear command search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Segmented Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#596D56] text-[#FFFCF6] font-semibold'
                      : 'bg-[#FFFCF6] text-[#5D655A] border border-[#DED8CB] hover:bg-[#EDE7DA] hover:text-[#33382F]'
                  }`}
                >
                  {cat === 'ALL' ? 'All Commands' : cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#FFFDF9]">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-[13.5px] font-semibold text-[#33382F]">
                No matching keyboard shortcuts found
              </p>
              <p className="text-[12.5px] text-[#70786D]">
                Try searching for &ldquo;search&rdquo;, &ldquo;note&rdquo;, &ldquo;task&rdquo;, or &ldquo;CMD&rdquo;.
              </p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#70786D]">
                    {category}
                  </h3>
                  <span className="text-[11px] text-[#70786D]" data-tabular-nums="true">
                    {items.length} {items.length === 1 ? 'shortcut' : 'shortcuts'}
                  </span>
                </div>

                <div className="motion-surface rounded-[9px] divide-y divide-[#EAE4D8] overflow-hidden">
                  {items.map((cmd) => {
                    runningIndex += 1;
                    const itemIdx = runningIndex;
                    const isFocused = itemIdx === activeIndex;

                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(itemIdx)}
                        onClick={() => {
                          onClose();
                          cmd.action();
                        }}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                          isFocused ? 'bg-[#E3EBDD]/65' : 'hover:bg-[#F7F4EC]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 border ${
                              isFocused
                                ? 'bg-[#FFFCF6] border-[#596D56]/40 text-[#596D56]'
                                : 'bg-[#F3EFE5] border-[#DED8CB] text-[#5D655A]'
                            }`}
                          >
                            {cmd.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-[#33382F] truncate">
                              {cmd.title}
                            </p>
                            <p className="text-[12px] text-[#70786D] truncate">
                              {cmd.description}
                            </p>
                          </div>
                        </div>

                        {/* Keybind Caps */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {cmd.keys.map((k, idx) => (
                            <React.Fragment key={idx}>
                              <kbd
                                className="px-2 py-1 text-[11.5px] font-mono font-semibold text-[#33382F] bg-[#F3EFE5] border border-[#DED8CB] rounded-[6px] shadow-[0_1px_0_#DED8CB]"
                                data-tabular-nums="true"
                              >
                                {k}
                              </kbd>
                              {idx < cmd.keys.length - 1 && (
                                <span className="text-[11px] text-[#70786D] font-medium">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#EAE4D8] bg-[#FFFCF6] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#70786D] shrink-0">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[#33382F] bg-[#F3EFE5] border border-[#DED8CB] rounded-[4px]">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[#33382F] bg-[#F3EFE5] border border-[#DED8CB] rounded-[4px]">
                ↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[#33382F] bg-[#F3EFE5] border border-[#DED8CB] rounded-[4px] inline-flex items-center">
                <CornerDownLeft className="w-3 h-3" />
              </kbd>
              <span>Run command</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[#33382F] bg-[#F3EFE5] border border-[#DED8CB] rounded-[4px]">
                Esc
              </kbd>
              <span>Close</span>
            </span>
          </div>

          <span className="text-[11.5px] text-[#5D655A]">
            Tip: Press <strong className="text-[#33382F] font-semibold">?</strong> or{' '}
            <strong className="text-[#33382F] font-semibold">⌘/</strong> anytime to open
          </span>
        </div>
      </div>
    </div>
  );
}
