export interface Employee {
  employee_id: string;
  name: string;
  email?: string | null;
  contact_number?: string | null;
  joining_date?: string | null;

  primary_skill?: string | null;
  primary_rating?: number | null;
  secondary_skill?: string | null;
  secondary_rating?: number | null;
  third_skill?: string | null;
  third_rating?: number | null;

  previous_exp?: string | null;
  arohak_exp?: string | null;
  total_exp?: string | null;

  certifications?: string | null;
  cert_start_date?: string | null;
  cert_end_date?: string | null;
  expiry_date?: string | null;

  project_name?: string | null;
  project_assignment_date?: string | null;
  project_end_date?: string | null;

  has_laptop?: string | null;
  laptop_details?: string | null;
  has_headset?: string | null;
  headset_details?: string | null;

  email_notifications_enabled?: string | null;

  work_exp_skills_rating?: number | null;
  overall_rating?: number | null;
  resume_path?: string | null;

  score: number;
  last_updated: string;
  last_skill_update: string;
}

export interface EmployeeUpdatePayload {
  name: string;
  email?: string | null;
  contact_number?: string | null;
  joining_date?: string | null;
  total_exp?: string | null;

  primary_skill?: string | null;
  primary_rating?: number;
  secondary_skill?: string | null;
  secondary_rating?: number;
  third_skill?: string | null;
  third_rating?: number;

  previous_exp?: string | null;
  arohak_exp?: string | null;

  certifications?: string | null;
  cert_start_date?: string | null;
  cert_end_date?: string | null;
  expiry_date?: string | null;

  project_name?: string | null;
  project_assignment_date?: string | null;
  project_end_date?: string | null;

  has_laptop?: string;
  laptop_details?: string | null;
  has_headset?: string;
  headset_details?: string | null;

  work_exp_skills_rating?: number;
  overall_rating?: number;
  score?: number;
}

export interface EmployeeRestricted {
  employee_id: string;
  name: string;
  primary_skill?: string | null;
  secondary_skill?: string | null;
  third_skill?: string | null;
  previous_exp?: string | null;
  arohak_exp?: string | null;
  certifications?: string | null;
  project_name?: string | null;
  resume_path?: string | null;
  has_laptop?: string | null;
  laptop_details?: string | null;
  has_headset?: string | null;
}

export interface AssetUpdatePayload {
  has_laptop: string;
  laptop_details?: string | null;
  has_headset: string;
  headset_details?: string | null;
}

export type ShiftType = 'Day Shift' | 'Night Shift' | 'Rotational Shift';
export type DayStatus = 'Working' | 'Off';

export interface Schedule {
  employee_id: string;
  manager_name?: string | null;
  monday: DayStatus;
  tuesday: DayStatus;
  wednesday: DayStatus;
  thursday: DayStatus;
  friday: DayStatus;
  shift: string;
  monday_tasks?: string | null;
  tuesday_tasks?: string | null;
  wednesday_tasks?: string | null;
  thursday_tasks?: string | null;
  friday_tasks?: string | null;
  notes?: string | null;
  last_updated?: string | null;
}

export interface ScheduleUpdatePayload {
  manager_name?: string | null;
  monday: DayStatus;
  tuesday: DayStatus;
  wednesday: DayStatus;
  thursday: DayStatus;
  friday: DayStatus;
  shift?: string;
  monday_tasks?: string | null;
  tuesday_tasks?: string | null;
  wednesday_tasks?: string | null;
  thursday_tasks?: string | null;
  friday_tasks?: string | null;
  notes?: string | null;
}

export type AttendanceStatus = 'P' | 'Ab' | 'H' | 'L' | 'WFH';

export interface AttendanceRecordItem {
  id: number;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  source?: string | null;
  notes?: string | null;
}

export interface AttendanceUpsertPayload {
  date: string;
  status: AttendanceStatus;
  notes?: string | null;
  source?: string;
}

export interface AttendanceData {
  employee_id: string;
  employee_name: string;
  records: AttendanceRecordItem[];
  schedule?: Schedule | null;
}

export interface CertSkills {
  employee_id: string;
  name: string;
  primary_skill?: string | null;
  primary_rating?: number | null;
  secondary_skill?: string | null;
  secondary_rating?: number | null;
  third_skill?: string | null;
  third_rating?: number | null;
  work_exp_skills_rating?: number | null;
  overall_rating?: number | null;
  certifications?: string | null;
  cert_start_date?: string | null;
  cert_end_date?: string | null;
  expiry_date?: string | null;
  previous_exp?: string | null;
  arohak_exp?: string | null;
}

export type SkillTargetStatus = 'Planned' | 'In Progress' | 'Completed';

export interface SkillTarget {
  id: number;
  employee_id: string;
  year: number;
  skill_name: string;
  description?: string | null;
  target_level?: string | null;
  status: SkillTargetStatus;
  target_completion_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillTargetPayload {
  skill_name: string;
  description?: string | null;
  target_level?: string | null;
  status?: SkillTargetStatus;
  target_completion_date?: string | null;
  year?: number;
}

export interface AdminSkillTargetOverviewItem {
  employee_id: string;
  name: string;
  project_name?: string | null;
  targets_status: string;
  targets: SkillTarget[];
}

export type TalentCategory = 'Sport' | 'Cultural' | 'Hobby' | 'Other';

export interface Talent {
  id: number;
  employee_id: string;
  category: TalentCategory;
  name: string;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalentPayload {
  category: TalentCategory;
  name: string;
  note?: string | null;
}

export interface TimesheetRow {
  id?: number;
  client_project?: string | null;
  task?: string | null;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
}

export interface TimesheetData {
  week_start: string;
  status: 'Draft' | 'Released' | 'Approved' | 'Rejected';
  released_at?: string | null;
  can_edit: boolean;
  is_past_month: boolean;
  rows: TimesheetRow[];
  attendance: Record<string, AttendanceStatus | undefined>;
}

export interface AdminTimesheetListItem {
  employee_id: string;
  name: string;
  project_name?: string | null;
  week_start: string;
  status: string;
  released_at?: string | null;
  total_minutes: number;
  total_formatted: string;
  can_accept: boolean;
  can_reject: boolean;
  is_past_month: boolean;
}

export interface ProjectMember {
  employee_id: string;
  name: string;
  email?: string | null;
  contact_number?: string | null;
  task_details: string;
  project_assignment_date: string;
  overall_rating: number;
}

export interface ProjectItem {
  project_name: string;
  project_manager: string;
  team_lead: string;
  total_members: number;
  members: ProjectMember[];
}

export interface ClientAccount {
  client_account: string;
  account_manager: string;
  total_account_members: number;
  projects: ProjectItem[];
}

export interface LeaveRequest {
  id: number;
  employee_id: string;
  employee_name?: string | null;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}
