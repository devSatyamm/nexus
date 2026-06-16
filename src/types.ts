/**
 * Project NEXUS Shared Types & Schemas
 */

export interface UserProfile {
  id: string; // auth UUID
  full_name: string;
  role: 'student' | 'admin';
  application_number?: string;
  accommodations: {
    extra_time?: number; // e.g., 1.5 for 1.5x time
    high_contrast?: boolean;
    screen_reader?: boolean;
    extended_breaks?: boolean;
  };
  created_at: string;
}

export interface Shift {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_open: boolean;
}

export type ItemType = 'numerical' | 'conceptual' | 'ethical';

export interface ItemTemplate {
  text: string;
  params: Record<string, [number, number]>; // range: [min, max]
  formula: string; // e.g. "a*t"
}

export interface Item {
  id: string;
  type: ItemType;
  language: string;
  question_text: string;
  template?: ItemTemplate; // For numerical items
  options: string[]; // Options list
  correct_option: string; // SERVER-ONLY, hidden from student client
  concept: string;
  // IRT (Item Response Theory) parameters:
  irt_a: number; // Discrimination (typical 0.5 to 2.5)
  irt_b: number; // Difficulty (typical -3.0 to 3.0)
  irt_c: number; // Guessing parameter (typical 0.0 to 0.3)
  exposure_count: number;
  status: 'draft' | 'review' | 'live' | 'retired';
  version: number;
  author_id?: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'flagged' | 'voided';

export interface ExamAttempt {
  id: string;
  user_id: string;
  shift_id: string;
  assigned_item_ids: string[];
  numeric_values: Record<string, Record<string, number>>; // itemId -> dynamic parameter values
  watermark: string; // per-candidate watermark (fingerprint)
  started_at: string;
  submitted_at: string | null;
  time_limit_seconds: number;
  raw_score: number | null;
  ability_estimate: number | null; // IRT theta
  normalized_percentile: number | null;
  status: AttemptStatus;
}

export interface ExamResponse {
  id: string;
  attempt_id: string;
  item_id: string;
  selected_option: string | null;
  is_correct: boolean | null;
  response_time_ms: number;
  answered_at: string;
}

export type AuditCategory = 
  | 'focus_blur'
  | 'keystroke_flag'
  | 'identity_check'
  | 'biometric_check'
  | 'cognitive_check'
  | 'stress_flag'
  | 'assemble'
  | 'submit'
  | 'anomaly';

export interface AuditLogEntry {
  id: number;
  attempt_id: string | null;
  user_id: string | null;
  category: AuditCategory;
  detail: Record<string, any>;
  created_at: string;
  prev_hash: string;
  row_hash: string;
}

export interface ReviewFlag {
  id: string;
  attempt_id: string;
  reason: 'response_time_anomaly' | 'collusion_suspect' | 'focus_pattern' | 'biometric_anomaly';
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'reviewed_clear' | 'reviewed_action';
  reviewer_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  camera_consent: boolean;
  consent_text_version: string;
  created_at: string;
}

// Client-safe version of an Item (NO correct_option)
export interface ClientItem {
  id: string;
  type: ItemType;
  language: string;
  question_text: string;
  options: string[];
  concept: string;
}

export interface ClientAttemptState {
  attempt: ExamAttempt;
  questions: ClientItem[];
  savedResponses: Record<string, string>; // itemId -> selectedOption
  currentTimeLeft: number;
}
