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
        className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#7B4B3A] bg-[#F3E7DD] px-1.5 py-0.5 rounded-[5px] ${className}`}
        title="High Priority"
      >
        <span className="flex items-end gap-[2px] h-2.5" aria-hidden="true">
          <span className="w-[2px] h-1 bg-[#A46F5C] rounded-full" />
          <span className="w-[2px] h-1.5 bg-[#A46F5C] rounded-full" />
          <span className="w-[2px] h-2.5 bg-[#A46F5C] rounded-full" />
        </span>
        {showLabel && <span>High</span>}
      </span>
    );
  }

  if (level === 'MEDIUM') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#5E4D33] bg-[#F1E9DB] px-1.5 py-0.5 rounded-[5px] ${className}`}
        title="Medium Priority"
      >
        <span className="flex items-end gap-[2px] h-2.5" aria-hidden="true">
          <span className="w-[2px] h-1 bg-[#B9A27C] rounded-full" />
          <span className="w-[2px] h-1.5 bg-[#B9A27C] rounded-full" />
          <span className="w-[2px] h-2.5 bg-[#DFD2BA] rounded-full" />
        </span>
        {showLabel && <span>Medium</span>}
      </span>
    );
  }

  // Low
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#5D655A] bg-[#F3EFE5] px-1.5 py-0.5 rounded-[5px] ${className}`}
      title="Low Priority"
    >
      <span className="flex items-end gap-[2px] h-2.5" aria-hidden="true">
        <span className="w-[2px] h-1 bg-[#70786D] rounded-full" />
        <span className="w-[2px] h-1.5 bg-[#D4CFC2] rounded-full" />
        <span className="w-[2px] h-2.5 bg-[#D4CFC2] rounded-full" />
      </span>
      {showLabel && <span>Low</span>}
    </span>
  );
}

export function getPriorityBorderColor(_priority: PriorityLevel | string): string {
  return 'border-[#EAE4D8]';
}

export function getPriorityDotColor(priority: PriorityLevel | string): string {
  const normalized = (priority || 'MEDIUM').toUpperCase();
  if (normalized === 'HIGH' || normalized === 'URGENT') return 'bg-[#A46F5C]';
  if (normalized === 'MEDIUM') return 'bg-[#B9A27C]';
  return 'bg-[#70786D]';
}
