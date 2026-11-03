import type { Decimal } from './types';
import { currencySymbols } from './theme';

export const toNumber = (value: Decimal | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function formatMoney(
  value: Decimal | null | undefined,
  currency = 'LSL',
  compact = false,
): string {
  const amount = toNumber(value);
  const normalizedCurrency = currency.toUpperCase();
  const symbol = currencySymbols[normalizedCurrency] ?? normalizedCurrency;
  try {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: compact ? 0 : 2,
    }).format(amount);
    return `${symbol} ${formattedAmount}`;
  } catch {
    return `${symbol} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(value: Decimal | null | undefined, digits = 0): string {
  const amount = toNumber(value);
  try {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return amount.toFixed(digits);
  }
}

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function daysAgoISO(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

export function startOfMonthISO(): string {
  const date = new Date();
  date.setDate(1);
  return toISODate(date);
}

export function formatDate(value: string | Date, withYear = false): string {
  const date = parseDate(value);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatTime(value: string | Date): string {
  return parseDate(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(value: string | Date): string {
  const date = parseDate(value);
  return `${formatDate(date, true)} · ${formatTime(date)}`;
}

export function relativeDay(value: string | Date): string {
  const date = parseDate(value);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((target - start) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0 && diff > -7) return formatDate(date);
  return formatDate(date, date.getFullYear() !== now.getFullYear());
}

export function relativeTime(value: string | Date): string {
  const date = parseDate(value);
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let text: string;
  if (minutes < 1) text = 'just now';
  else if (minutes < 60) text = `${minutes}m`;
  else if (hours < 24) text = `${hours}h`;
  else text = `${days}d`;
  if (text === 'just now') return text;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}

export function dueLabel(value: string | Date): string {
  const date = parseDate(value);
  if (date.getTime() < Date.now()) {
    const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    return days < 1 ? 'Due now' : `${days}d overdue`;
  }
  return relativeTime(date);
}

export function initials(name: string | null | undefined): string {
  if (!name) return 'K';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'K';
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? 'there';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
