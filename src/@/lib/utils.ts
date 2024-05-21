import type { ClassValue } from 'clsx';

import { clsx } from 'clsx';
import moment from 'moment';
import { twMerge } from 'tailwind-merge';

export const utcOffsetMinutes = new Date().getTimezoneOffset();

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function countDataByDay(dataEntries: { timestamp: number }[]) {
  const buckets: { [key: string]: { x: string; y: number } } = {};

  for (const dataEntry of dataEntries) {
    const date = dateBucket(dataEntry.timestamp * 1000);

    if (!buckets[date]) {
      buckets[date] = { x: date, y: 0 };
    }
    buckets[date].y++;
  }
  return Object.values(buckets).sort().reverse();
}

export function dateBucket(timestampMillis: number): string {
  // datebucket in current timezone
  return moment(new Date(timestampMillis)).utcOffset(utcOffsetMinutes).format('YYYY-MM-DD');
}

export function dateBucketMillis(timestampMillis: number): number {
  return Math.trunc(timestampMillis / 1000 / 60 / 60 / 24) * 24 * 60 * 60 * 1000;
}
