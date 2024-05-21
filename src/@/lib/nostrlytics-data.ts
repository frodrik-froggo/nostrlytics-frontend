export type NostrlyticsData = {
  kind: 'nstrly-event';
  type: 'page-impression' | 'click-out';
  userAgent: string;
  language: string;
  location: string;
  clickOutUrl?: string;
  referrer?: string;
};
