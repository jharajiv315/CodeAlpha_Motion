import React from 'react';
import type { PriorityLevel } from '../../types/index.ts';

interface PriorityBadgeProps {
  priority: PriorityLevel | string;
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({ priority, showLabel = true, className = '' }: PriorityBadgeProps) {
  const normalized = (priority || 'MEDIUM').toUpperCase();
  const level = normalized === 'URGENT' ? 'HIGH' : normalized === 'NONE' ? 'LOW' : normalized;

  if (level === 'HIGH') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FEE2E2] px-2 py-0.5 rounded-md ${className}`}
        title="High Priority"
      >
        <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
          <span className="w-0.5 h-1.5 bg-[#DC2626] rounded-xs" />
          <span className="w-0.5 h-2.5 bg-[#DC2626] rounded-xs" />
          <span className="w-0.5 h-3 bg-[#DC2626] rounded-xs" />
        </span>
        {showLabel && <span>High</span>}
      </span>
    );
  }

  if (level === 'MEDIUM') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-[#92400E] bg-[#FEF3C7]/60 border border-[#FDE68A] px-2 py-0.5 rounded-md ${className}`}
        title="Medium Priority"
      >
        <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
          <span className="w-0.5 h-1.5 bg-[#D97706] rounded-xs" />
          <span className="w-0.5 h-2.5 bg-[#D97706] rounded-xs" />
          <span className="w-0.5 h-3 bg-[#D97706]/30 rounded-xs" />
        </span>
        {showLabel && <span>Medium</span>}
      </span>
    );
  }

  // Low
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-[#4B5563] bg-[#F3F4F6] border border-[#E5E7EB] px-2 py-0.5 rounded-md ${className}`}
      title="Low Priority"
    >
      <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
        <span className="w-0.5 h-1.5 bg-[#6B7280] rounded-xs" />
        <span className="w-0.5 h-2.5 bg-[#6B7280]/30 rounded-xs" />
        <span className="w-0.5 h-3 bg-[#6B7280]/30 rounded-xs" />
      </span>
      {showLabel && <span>Low</span>}
    </span>
  );
}

export function getPriorityBorderColor(priority: PriorityLevel | string): string {
  const normalized = (priority || 'MEDIUM').toUpperCase();
  if (normalized === 'HIGH' || normalized === 'URGENT') return 'border-l-rose-500';
  if (normalized === 'MEDIUM') return 'border-l-amber-500';
  return 'border-l-slate-400';
}

export function getPriorityDotColor(priority: PriorityLevel | string): string {
  const normalized = (priority || 'MEDIUM').toUpperCase();
  if (normalized === 'HIGH' || normalized === 'URGENT') return 'bg-rose-500';
  if (normalized === 'MEDIUM') return 'bg-amber-500';
  return 'bg-slate-400';
}

