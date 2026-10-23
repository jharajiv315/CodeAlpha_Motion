import React from 'react';

interface PrismLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withGlow?: boolean;
}

export function PrismLogo({ className = '', size = 'md' }: PrismLogoProps) {
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  const dim = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${dim} ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" fill="#596D56" />
        <path
          d="M8.5 22V10L16 17.5L23.5 10V22"
          stroke="#FFFCF6"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="22" r="1.8" fill="#E7D6B2" />
      </svg>
    </div>
  );
}
