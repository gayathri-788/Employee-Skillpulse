from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ─────────────────────────────────────────────
# Auth schemas
# ─────────────────────────────────────────────
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

# ─────────────────────────────────────────────
# Employee schemas
# ─────────────────────────────────────────────
class EmployeeBase(BaseModel):
    
    employee_id: str
    name: str
    email: Optional[str] = None
    contact_number: Optional[str] = None
    joining_date: Optional[str] = None
    
    primary_skill: Optional[str] = None
    primary_rating: Optional[float] = 0.0
    secondary_skill: Optional[str] = None
    secondary_rating: Optional[float] = 0.0
    third_skill: Optional[str] = None
    third_rating: Optional[float] = 0.0
    
    previous_exp: Optional[str] = None
    arohak_exp: Optional[str] = None
    total_exp: Optional[str] = None
    
    certifications: Optional[str] = None
    cert_start_date: Optional[str] = None
    cert_end_date: Optional[str] = None
    expiry_date: Optional[str] = None
    
    project_name: Optional[str] = None
    project_assignment_date: Optional[str] = None
    project_end_date: Optional[str] = None
    
    # Assets Info
    has_laptop: Optional[str] = "No"
    laptop_details: Optional[str] = None
    has_headset: Optional[str] = "No"
    headset_details: Optional[str] = None
    
    work_exp_skills_rating: Optional[float] = 0.0
    overall_rating: Optional[float] = 0.0
    resume_path: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: str
    email: Optional[str] = None
    contact_number: Optional[str] = None
    joining_date: Optional[str] = None
    total_exp: Optional[str] = None
    
    primary_skill: Optional[str] = None
    primary_rating: Optional[float] = Field(0.0, ge=0.0, le=5.0)
    secondary_skill: Optional[str] = None
    secondary_rating: Optional[float] = Field(0.0, ge=0.0, le=5.0)
    third_skill: Optional[str] = None
    third_rating: Optional[float] = Field(0.0, ge=0.0, le=5.0)
    
    previous_exp: Optional[str] = None
    arohak_exp: Optional[str] = None
    
    certifications: Optional[str] = None
    cert_start_date: Optional[str] = None
    cert_end_date: Optional[str] = None
    expiry_date: Optional[str] = None
    
    project_name: Optional[str] = None
    project_assignment_date: Optional[str] = None
    project_end_date: Optional[str] = None
    
    # Assets Info
    has_laptop: Optional[str] = "No"
    laptop_details: Optional[str] = None
    has_headset: Optional[str] = "No"
    headset_details: Optional[str] = None
    
    work_exp_skills_rating: Optional[float] = Field(0.0, ge=0.0, le=5.0)
    overall_rating: Optional[float] = Field(0.0, ge=0.0, le=5.0)
    score: Optional[int] = Field(100, ge=0, le=100)

class EmployeeResponse(EmployeeBase):
    score: int
    last_updated: datetime
    last_skill_update: datetime
    
    class Config:
        from_attributes = True

class EmployeeRestrictedResponse(BaseModel):
    employee_id: str
    name: str
    
    primary_skill: Optional[str] = None
    secondary_skill: Optional[str] = None
    third_skill: Optional[str] = None
    
    previous_exp: Optional[str] = None
    arohak_exp: Optional[str] = None
    certifications: Optional[str] = None
    project_name: Optional[str] = None
    resume_path: Optional[str] = None
    
    # Assets Info
    has_laptop: Optional[str] = "No"
    laptop_details: Optional[str] = None
    has_headset: Optional[str] = "No"
    
    class Config:
        from_attributes = True

class AssetUpdate(BaseModel):
    has_laptop: str
    laptop_details: Optional[str] = None
    has_headset: str
    headset_details: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# ─────────────────────────────────────────────
# Employee Schedule schemas
# ─────────────────────────────────────────────
class ScheduleResponse(BaseModel):
    employee_id: str
    manager_name: Optional[str] = None
    monday: str = "Working"
    tuesday: str = "Working"
    wednesday: str = "Working"
    thursday: str = "Working"
    friday: str = "Working"
    shift: str = "Day Shift"
    
    monday_tasks: Optional[str] = None
    tuesday_tasks: Optional[str] = None
    wednesday_tasks: Optional[str] = None
    thursday_tasks: Optional[str] = None
    friday_tasks: Optional[str] = None
    
    notes: Optional[str] = None
    last_updated: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ScheduleUpdate(BaseModel):
    manager_name: Optional[str] = None
    monday: str = Field("Working", pattern="^(Working|Off)$")
    tuesday: str = Field("Working", pattern="^(Working|Off)$")
    wednesday: str = Field("Working", pattern="^(Working|Off)$")
    thursday: str = Field("Working", pattern="^(Working|Off)$")
    friday: str = Field("Working", pattern="^(Working|Off)$")
    shift: Optional[str] = "Day Shift"
    
    monday_tasks: Optional[str] = None
    tuesday_tasks: Optional[str] = None
    wednesday_tasks: Optional[str] = None
    thursday_tasks: Optional[str] = None
    friday_tasks: Optional[str] = None
    
    notes: Optional[str] = None

# ─────────────────────────────────────────────
# Attendance schemas
# ─────────────────────────────────────────────
class AttendanceRecord(BaseModel):
    id: int
    employee_id: str
    date: str
    status: str   # P, Ab, H, L, WFH
    source: Optional[str] = "manual"
    notes: Optional[str] = None
    
    class Config:
        from_attributes = True

class AttendanceUpsert(BaseModel):
    date: str  # YYYY-MM-DD
    status: str = Field(..., pattern="^(P|Ab|H|L|WFH)$")
    notes: Optional[str] = None
    source: Optional[str] = "manual"

class AttendanceResponse(BaseModel):
    employee_id: str
    employee_name: str
    records: List[AttendanceRecord] = []
    schedule: Optional[ScheduleResponse] = None

# ─────────────────────────────────────────────
# Leave Request schemas
# ─────────────────────────────────────────────
class LeaveRequestCreate(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    reason: Optional[str] = None

class LeaveRequestUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(Pending|Approved|Rejected)$")

class LeaveRequestResponse(BaseModel):
    id: int
    employee_id: str
    employee_name: Optional[str] = None
    start_date: str
    end_date: str
    reason: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# ─────────────────────────────────────────────
# Certifications & Skills schemas (read-only view, editing done via EmployeeUpdate)
# ─────────────────────────────────────────────
class CertSkillsResponse(BaseModel):
    employee_id: str
    name: str
    primary_skill: Optional[str] = None
    primary_rating: Optional[float] = 0.0
    secondary_skill: Optional[str] = None
    secondary_rating: Optional[float] = 0.0
    third_skill: Optional[str] = None
    third_rating: Optional[float] = 0.0
    work_exp_skills_rating: Optional[float] = 0.0
    overall_rating: Optional[float] = 0.0
    certifications: Optional[str] = None
    cert_start_date: Optional[str] = None
    cert_end_date: Optional[str] = None
    expiry_date: Optional[str] = None
    previous_exp: Optional[str] = None
    arohak_exp: Optional[str] = None
    
    class Config:
        from_attributes = True

# ─────────────────────────────────────────────
# Yearly Skill Target schemas
# ─────────────────────────────────────────────
class SkillTargetBase(BaseModel):
    skill_name: str
    description: Optional[str] = None
    target_level: Optional[str] = None
    status: str = "Planned"
    target_completion_date: Optional[str] = None
    year: Optional[int] = None   # defaults to current year server-side if not provided

class SkillTargetCreate(SkillTargetBase):
    pass

class SkillTargetUpdate(BaseModel):
    skill_name: Optional[str] = None
    description: Optional[str] = None
    target_level: Optional[str] = None
    status: Optional[str] = None
    target_completion_date: Optional[str] = None

class SkillTargetResponse(SkillTargetBase):
    id: int
    employee_id: str
    year: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Timesheet schemas
# ─────────────────────────────────────────────

class TimesheetRowSchema(BaseModel):
    id: Optional[int] = None
    client_project: Optional[str] = None
    task: Optional[str] = None
    monday: int = 0
    tuesday: int = 0
    wednesday: int = 0
    thursday: int = 0
    friday: int = 0

    class Config:
        from_attributes = True


class TimesheetSaveRequest(BaseModel):
    week_start: str  # YYYY-MM-DD
    rows: List[TimesheetRowSchema]


class TimesheetResponse(BaseModel):
    week_start: str
    status: str = "Draft"
    released_at: Optional[datetime] = None
    can_edit: bool = True
    is_past_month: bool = False
    rows: List[TimesheetRowSchema]
    attendance: dict  # e.g. {"monday": "P", "tuesday": "Ab", ...}


class TimesheetReviewRequest(BaseModel):
    week_start: str
    action: str  # "accept" or "reject"
    notes: Optional[str] = None


class AdminTimesheetListItem(BaseModel):
    employee_id: str
    name: str
    project_name: Optional[str] = None
    week_start: str
    status: str
    released_at: Optional[datetime] = None
    total_minutes: int = 0
    total_formatted: str = "0:00"
    can_accept: bool = False
    can_reject: bool = False
    is_past_month: bool = False



class CustomResumeRequest(BaseModel):
    name: str
    job_title: Optional[str] = None
    linkedin: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    
    executive_summary: Optional[str] = None
    core_competencies: Optional[str] = None
    key_clients: Optional[str] = None
    
    arohak_title: Optional[str] = None
    arohak_start: Optional[str] = None
    arohak_resp: Optional[str] = None
    
    prev_company: Optional[str] = None
    prev_location: Optional[str] = None
    prev_title: Optional[str] = None
    prev_tenure: Optional[str] = None
    prev_resp: Optional[str] = None
    
    achievements: Optional[str] = None
    education: Optional[str] = None
    industry_experience: Optional[str] = None
    certifications: Optional[str] = None
    tools_technologies: Optional[str] = None


class AdminSkillTargetOverviewItem(BaseModel):
    employee_id: str
    name: str
    project_name: Optional[str] = None
    targets_status: str
    targets: List[SkillTargetResponse] = []




