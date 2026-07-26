import React from 'react';

interface BrandMarkProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * The CreditTrack mark: a tracking path with milestones.
 * The path is the statement being tracked; the dots are the milestones
 * (upload, categorise, remind). This is the only mark in the system —
 * never substitute a stock icon for it.
 */
export function BrandMark({ className, strokeWidth = 1.5 }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3 19 L9 13 L13 16 L21 5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="13" r="1.5" fill="currentColor" />
      <circle cx="13" cy="16" r="1.5" fill="currentColor" />
      <circle cx="21" cy="5" r="1.5" fill="currentColor" />
    </svg>
  );
}
