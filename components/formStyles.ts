/**
 * Shared form styling for the brass+marine system.
 * Kept in one place so inputs across modals, the admin panel, and settings
 * cannot drift apart. Touch targets stay at or above 44px.
 */

export const fieldClass =
  'w-full px-3 py-3 bg-marine-800 border border-brass-500/20 text-ink text-sm placeholder:text-ink-mute focus:border-brass-500 focus:outline-none transition-colors duration-150 min-h-[48px]';

export const labelClass =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-2';

export const primaryButtonClass =
  'flex items-center justify-center gap-2 bg-brass-500 text-marine-900 px-6 py-3 hover:bg-brass-400 font-medium text-sm transition-colors duration-150 min-h-[48px]';

export const ghostButtonClass =
  'px-4 py-3 text-sm text-ink-soft hover:text-ink font-medium transition-colors duration-150 min-h-[48px]';
