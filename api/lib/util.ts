// Small, dependency-free helpers shared across the backend.

/**
 * Escape user-controlled text before interpolating it into HTML emails — prevents
 * HTML/script injection and email-based phishing via attacker-controlled values.
 */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mask long digit runs in a card name, leaving the last 4 visible. */
export function maskCardName(name: string): string {
  const hasNumbers = /\d{4,}/.test(name);
  return hasNumbers ? name.replace(/\d(?=\d{4})/g, "*") : name;
}

/** Whole days from today (local midnight) until the given due date. Negative = overdue. */
export function getDaysRemaining(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
