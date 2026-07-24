from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    
    username = Column(String, primary_key=True, index=True)  # Employee ID or "admin"
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="employee")  # "admin" or "employee"
    
    # Relationship to employee profile
    employee_profile = relationship("Employee", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Employee(Base):
    __tablename__ = "employees"
    
    employee_id = Column(String, primary_key=True, index=True)
    username = Column(String, ForeignKey("users.username"), unique=True, nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    
    # Skills
    primary_skill = Column(String, nullable=True)
    primary_rating = Column(Float, default=0.0)
    secondary_skill = Column(String, nullable=True)
    secondary_rating = Column(Float, default=0.0)
    third_skill = Column(String, nullable=True)
    third_rating = Column(Float, default=0.0)
    
    # Experience
    previous_exp = Column(String, nullable=True)
    arohak_exp = Column(String, nullable=True)
    
    # Certifications
    certifications = Column(String, nullable=True)
    cert_start_date = Column(String, nullable=True)
    cert_end_date = Column(String, nullable=True)
    expiry_date = Column(String, nullable=True)
    
    # Project Info
    project_name = Column(String, nullable=True)
    project_assignment_date = Column(String, nullable=True)
    
    # Assets Info
    has_laptop = Column(String, default="No")
    laptop_details = Column(String, nullable=True)
    has_headset = Column(String, default="No")
    
    # Ratings and Score
    work_exp_skills_rating = Column(Float, default=0.0)
    overall_rating = Column(Float, default=0.0)
    score = Column(Integer, default=100)
    last_skill_update = Column(DateTime, default=datetime.utcnow)
    
    # Update tracking
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Resume Info
    resume_path = Column(String, nullable=True)
    last_reminder_sent = Column(DateTime, nullable=True)
    
    # Relationship back to User
    user = relationship("User", back_populates="employee_profile")
    
    # Relationships for new modules
    schedule = relationship("EmployeeSchedule", back_populates="employee", uselist=False, cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan", order_by="Attendance.date")
    skill_targets = relationship("SkillTarget", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="employee", cascade="all, delete-orphan")
    timesheet_rows = relationship("TimesheetRow", back_populates="employee", cascade="all, delete-orphan")



class EmployeeSchedule(Base):
    """Weekly work schedule for an employee (Mon-Fri), tied to their project and manager."""
    __tablename__ = "employee_schedules"
    
    employee_id = Column(String, ForeignKey("employees.employee_id", ondelete="CASCADE"), primary_key=True)
    manager_name = Column(String, nullable=True)
    monday = Column(String, default="Working")    # "Working" or "Off"
    tuesday = Column(String, default="Working")
    wednesday = Column(String, default="Working")
    thursday = Column(String, default="Working")
    friday = Column(String, default="Working")
    shift = Column(String, default="Day Shift")   # "Day Shift", "Night Shift", "Rotational Shift"
    
    # Daily work tasks
    monday_tasks = Column(Text, nullable=True)
    tuesday_tasks = Column(Text, nullable=True)
    wednesday_tasks = Column(Text, nullable=True)
    thursday_tasks = Column(Text, nullable=True)
    friday_tasks = Column(Text, nullable=True)
    
    notes = Column(Text, nullable=True)  # optional schedule notes
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("Employee", back_populates="schedule")


class Attendance(Base):
    """Daily attendance record per employee. Designed to be populated by an external system."""
    __tablename__ = "attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.employee_id", ondelete="CASCADE"), index=True)
    date = Column(String, index=True)           # YYYY-MM-DD
    status = Column(String, nullable=False)     # P, Ab, H, L, WFH
    source = Column(String, default="manual")  # "manual" | "auto" | "system" — ready for future integration
    notes = Column(String, nullable=True)
    
    employee = relationship("Employee", back_populates="attendances")


class SkillTarget(Base):
    """Yearly skill targets/goals set by an employee for the current year."""
    __tablename__ = "skill_targets"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.employee_id", ondelete="CASCADE"), index=True)
    year = Column(Integer, nullable=False, index=True)
    skill_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    target_level = Column(String, nullable=True)       # e.g. "Beginner", "Intermediate", "Expert"
    status = Column(String, default="Planned")         # "Planned", "In Progress", "Completed"
    target_completion_date = Column(String, nullable=True)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("Employee", back_populates="skill_targets")


class LeaveRequest(Base):
    """Leave requests submitted by employees."""
    __tablename__ = "leave_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.employee_id", ondelete="CASCADE"), index=True)
    start_date = Column(String, nullable=False)  # YYYY-MM-DD
    end_date = Column(String, nullable=False)    # YYYY-MM-DD
    reason = Column(Text, nullable=True)
    status = Column(String, default="Pending")   # "Pending", "Approved", "Rejected"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    employee = relationship("Employee", back_populates="leave_requests")


class TimesheetRow(Base):
    """Weekly timesheet row for client, project, and task hours billing (Mon-Fri)."""
    __tablename__ = "timesheet_rows"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, ForeignKey("employees.employee_id", ondelete="CASCADE"), index=True)
    week_start = Column(String, index=True)           # YYYY-MM-DD (date of the Monday)
    client_project = Column(String, nullable=True)
    task = Column(String, nullable=True)
    monday = Column(Integer, default=0)                # minutes
    tuesday = Column(Integer, default=0)               # minutes
    wednesday = Column(Integer, default=0)             # minutes
    thursday = Column(Integer, default=0)              # minutes
    friday = Column(Integer, default=0)                # minutes
    
    employee = relationship("Employee", back_populates="timesheet_rows")

