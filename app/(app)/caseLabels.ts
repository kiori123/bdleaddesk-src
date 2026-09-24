// Hang so dung chung cho case.
//
// KHONG de trong caseActions.ts: file do la 'use server', va Next chi cho phep
// file server action export ham async. Moi export khac bi bien thanh proxy, va
// tu Next 16 thi no bao loi thang luc chay.

export const CASE_STATUS = [
  'in_progress', 'waiting_brand', 'stuck', 'won', 'lost',
] as const;
export type CaseStatus = typeof CASE_STATUS[number];

export const STATUS_LABEL: Record<CaseStatus, string> = {
  in_progress: 'In progress',
  waiting_brand: 'Waiting for brand',
  stuck: 'Stuck',
  won: 'Won',
  lost: 'Lost',
};

export const STUCK_REASON = [
  'no_response', 'waiting_bdm', 'waiting_brand', 'contact_not_relevant',
  'need_more_info', 'negotiation', 'internal_approval', 'other',
] as const;
export type StuckReason = typeof STUCK_REASON[number];

export const REASON_LABEL: Record<StuckReason, string> = {
  no_response: 'No response',
  waiting_bdm: 'Waiting for BDM',
  waiting_brand: 'Waiting for brand',
  contact_not_relevant: 'Contact not relevant',
  need_more_info: 'Need more information',
  negotiation: 'Negotiation',
  internal_approval: 'Internal approval',
  other: 'Other',
};

export type CaseState = {
  status: CaseStatus;
  stuck_reason: StuckReason | null;
  next_action: string | null;
  next_follow_up: string | null;
  owner_id: string | null;
  owner_name: string | null;
  last_update_at: string | null;
  last_note: string | null;
  days_since_update: number;
};
