export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function removeEmojis(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(name: string): string {
  // Warm, muted tactile palette matching design.md tokens
  const colors = [
    'bg-[#E3EBDD] text-[#33382F] border border-[#CAD7C2]',
    'bg-[#F1E9DB] text-[#5C4B35] border border-[#E0D3BC]',
    'bg-[#F3E7DD] text-[#6E4435] border border-[#E4CFC0]',
    'bg-[#ECE8F0] text-[#4E4357] border border-[#D8D1DF]',
    'bg-[#E6EEE4] text-[#364B3A] border border-[#CADBC7]',
    'bg-[#EDE7DA] text-[#33382F] border border-[#DED8CB]',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getColumnSemanticStyle(columnName: string): {
  dotColor: string;
  chipBg: string;
  chipText: string;
} {
  const lower = (columnName || '').toLowerCase();
  if (lower.includes('done') || lower.includes('complete')) {
    return {
      dotColor: '#62866B',
      chipBg: '#E7F0E5',
      chipText: '#334C39',
    };
  }
  if (lower.includes('review') || lower.includes('qa')) {
    return {
      dotColor: '#95839D',
      chipBg: '#F0EBF1',
      chipText: '#514358',
    };
  }
  if (lower.includes('progress') || lower.includes('doing') || lower.includes('active')) {
    return {
      dotColor: '#78906F',
      chipBg: '#E9EFE4',
      chipText: '#3E4F38',
    };
  }
  // Default: To Do / Backlog
  return {
    dotColor: '#B9A27C',
    chipBg: '#F1E9DB',
    chipText: '#5E4D33',
  };
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(d);
}

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function isOverdue(dueDateString?: string | null, isDone = false): boolean {
  if (!dueDateString || isDone) return false;
  const d = new Date(dueDateString);
  return d.getTime() < Date.now();
}

export function getBlockerAgeDays(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const diffHours = Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h active`;
  const days = Math.floor(diffHours / 24);
  return `${days}d active`;
}
