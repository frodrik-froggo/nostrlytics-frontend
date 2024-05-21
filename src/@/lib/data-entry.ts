import { NostrlyticsData } from '@/lib/nostrlytics-data';

export type DataEntry = {
  dateBucket: number;
  timestamp: number;
  data: NostrlyticsData;
};
