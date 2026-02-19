import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  pending_review: 'bg-amber-500',
  approved: 'bg-blue-500',
  in_progress: 'bg-violet-500',
  done: 'bg-emerald-500',
  accepted: 'bg-green-700',
};

export const STATUS_BORDER_COLORS: Record<string, string> = {
  draft: 'border-gray-300',
  pending_review: 'border-amber-300',
  approved: 'border-blue-300',
  in_progress: 'border-violet-300',
  done: 'border-emerald-300',
  accepted: 'border-green-300',
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  in_progress: 'In Progress',
  done: 'Done',
  accepted: 'Accepted',
};
