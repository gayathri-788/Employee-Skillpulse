import os
import sys
import random
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Ensure sys.path includes backend and root directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from database import get_db, engine, Base, SessionLocal
    from models import User, Employee, EmployeeSchedule, Attendance, SkillTarget, LeaveRequest, TimesheetRow, WeeklyTimesheetStatus
    from schemas import (
        UserLogin, Token, EmployeeResponse,
        EmployeeRestrictedResponse, EmployeeUpdate, PasswordChange,
        ScheduleResponse, ScheduleUpdate,
        AttendanceRecord, AttendanceUpsert, AttendanceResponse,
        CertSkillsResponse,
        SkillTargetCreate, SkillTargetUpdate, SkillTargetResponse,
        LeaveRequestCreate, LeaveRequestResponse, LeaveRequestUpdateStatus,
        TimesheetRowSchema, TimesheetSaveRequest, TimesheetResponse,
        AssetUpdate, CustomResumeRequest, AdminSkillTargetOverviewItem,
        TimesheetReviewRequest, AdminTimesheetListItem
    )
    from auth import (
        verify_password, get_password_hash, create_access_token,
        get_current_user, require_admin
    )
    import config
except ModuleNotFoundError:
    from backend.database import get_db, engine, Base, SessionLocal
    from backend.models import User, Employee, EmployeeSchedule, Attendance, SkillTarget, LeaveRequest, TimesheetRow, WeeklyTimesheetStatus
    from backend.schemas import (
        UserLogin, Token, EmployeeResponse,
        EmployeeRestrictedResponse, EmployeeUpdate, PasswordChange,
        ScheduleResponse, ScheduleUpdate,
        AttendanceRecord, AttendanceUpsert, AttendanceResponse,
        CertSkillsResponse,
        SkillTargetCreate, SkillTargetUpdate, SkillTargetResponse,
        LeaveRequestCreate, LeaveRequestResponse, LeaveRequestUpdateStatus,
        TimesheetRowSchema, TimesheetSaveRequest, TimesheetResponse,
        AssetUpdate, CustomResumeRequest, AdminSkillTargetOverviewItem,
        TimesheetReviewRequest, AdminTimesheetListItem
    )
    from backend.auth import (
        verify_password, get_password_hash, create_access_token,
        get_current_user, require_admin
    )
    from backend import config

# Ensure database tables are created
Base.metadata.create_all(bind=engine)

# SQLite migration check for resume_path and last_reminder_sent
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("SELECT resume_path FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN resume_path TEXT"))
            conn.commit()
            print("Successfully added resume_path column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding resume_path): {e}")

    try:
        conn.execute(text("SELECT last_reminder_sent FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN last_reminder_sent DATETIME"))
            conn.commit()
            print("Successfully added last_reminder_sent column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding last_reminder_sent): {e}")

    try:
        conn.execute(text("SELECT contact_number FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN contact_number TEXT"))
            conn.commit()
            print("Successfully added contact_number column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding contact_number): {e}")

    try:
        conn.execute(text("SELECT project_end_date FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN project_end_date TEXT"))
            conn.commit()
            print("Successfully added project_end_date column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding project_end_date): {e}")

    try:
        conn.execute(text("SELECT joining_date FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN joining_date TEXT"))
            conn.commit()
            print("Successfully added joining_date column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding joining_date): {e}")

    try:
        conn.execute(text("SELECT total_exp FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN total_exp TEXT"))
            conn.commit()
            print("Successfully added total_exp column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding total_exp): {e}")

    try:
        conn.execute(text("SELECT headset_details FROM employees LIMIT 1"))
    except Exception:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN headset_details TEXT"))
            conn.commit()
            print("Successfully added headset_details column to employees table.")
        except Exception as e:
            print(f"Error migrating database (adding headset_details): {e}")

# Automatic database seeding check (if database is empty on server startup)
try:
    with SessionLocal() as db:
        if db.query(User).count() == 0:
            print("Database has 0 users. Automatically running seed_db()...")
            try:
                from seed import seed_db
            except ModuleNotFoundError:
                from backend.seed import seed_db
            seed_db()
except Exception as e:
    print(f"Automatic seed check notice: {e}")



# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def compute_employee_experience(emp: Employee, db: Optional[Session] = None) -> Employee:
    import datetime as dt
    import re

    today = dt.date.today()
    start_date = None

    if emp.joining_date:
        try:
            raw_date = str(emp.joining_date).split("(")[0].strip()
            start_date = dt.datetime.strptime(raw_date, "%Y-%m-%d").date()
        except Exception:
            pass

    if not start_date and db:
        try:
            earliest_att = db.query(Attendance).filter(Attendance.employee_id == emp.employee_id).order_by(Attendance.date.asc()).first()
            if earliest_att and earliest_att.date:
                start_date = dt.datetime.strptime(earliest_att.date, "%Y-%m-%d").date()
        except Exception:
            pass

    if start_date and today >= start_date:
        total_days = (today - start_date).days
        
        # Calculate full completed months from joining date
        total_months = (today.year - start_date.year) * 12 + (today.month - start_date.month)
        if today.day < start_date.day:
            total_months -= 1
        if total_months < 0:
            total_months = 0

        years = total_months // 12
        rem_months = total_months % 12

        if total_months < 1:
            emp.arohak_exp = f"0 Months ({total_days} days)"
        elif years > 0:
            if rem_months > 0:
                emp.arohak_exp = f"{years} Yr {rem_months} Mo"
            else:
                emp.arohak_exp = f"{years} Yr" if years == 1 else f"{years} Yrs"
        else:
            emp.arohak_exp = f"{total_months} Month" if total_months == 1 else f"{total_months} Months"

    # Calculate Total Experience = Previous Exp + Arohak Exp
    def parse_months(val_str: Optional[str]) -> int:
        if not val_str:
            return 0
        s = str(val_str).strip()
        y_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y)', s, re.IGNORECASE)
        m_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:months?|mos?|m)', s, re.IGNORECASE)
        tot_m = 0
        if y_match:
            tot_m += int(float(y_match[1]) * 12)
        if m_match:
            tot_m += int(float(m_match[1]))
        if not y_match and not m_match:
            try:
                tot_m = int(float(s) * 12)
            except ValueError:
                pass
        return tot_m

    prev_m = parse_months(emp.previous_exp)
    arohak_m = parse_months(emp.arohak_exp)
    total_m = prev_m + arohak_m

    tot_years = total_m // 12
    tot_rem = total_m % 12
    if total_m > 0:
        if tot_years > 0:
            emp.total_exp = f"{tot_years} Yr {tot_rem} Mo" if tot_rem > 0 else (f"{tot_years} Yr" if tot_years == 1 else f"{tot_years} Yrs")
        else:
            emp.total_exp = f"{total_m} Months"
    else:
        emp.total_exp = "0 Months"

    return emp


def calculate_current_score(employee: Employee) -> int:
    import datetime as dt
    now = dt.datetime.utcnow()
    last_update = employee.last_skill_update or employee.last_updated or now
    if isinstance(last_update, dt.date) and not isinstance(last_update, dt.datetime):
        last_update = dt.datetime.combine(last_update, dt.time.min)
    days_since_update = (now - last_update).days
    if days_since_update > 180:
        overdue_days = days_since_update - 180
        # 1.5% weekly decay (1.5 / 7.0 per day)
        decay_rate = 1.5 / 7.0
        penalty = overdue_days * decay_rate
        return max(0, int(100 - penalty))
    return 100


def _get_or_create_schedule(employee_id: str, db: Session) -> EmployeeSchedule:
    """Return existing schedule or create a default Mon-Fri Working one."""
    sched = db.query(EmployeeSchedule).filter(EmployeeSchedule.employee_id == employee_id).first()
    if not sched:
        sched = EmployeeSchedule(employee_id=employee_id)
        db.add(sched)
        db.commit()
        db.refresh(sched)
    return sched


OFFICE_HOLIDAYS_CALENDAR = {
    "2026-01-01": "New Year's Day",
    "2026-01-26": "Republic Day",
    "2026-03-25": "Holi",
    "2026-04-14": "Dr. Ambedkar Jayanti",
    "2026-05-01": "May Day / Labor Day",
    "2026-08-15": "Independence Day",
    "2026-10-02": "Gandhi Jayanti",
    "2026-11-08": "Diwali",
    "2026-12-25": "Christmas Day"
}

def is_office_holiday(date_str: str) -> bool:
    return date_str in OFFICE_HOLIDAYS_CALENDAR


def _auto_generate_attendance(employee_id: str, schedule: EmployeeSchedule, db: Session):
    """
    Auto-generate the last 30 days of attendance if records are missing.
    Status logic:
      - Weekends & Office Calendar Holidays → H
      - Weekday mapped to 'Off' in schedule → H
      - Weekday mapped to 'Working' → P (90%), Ab (5%), L (5%)
    """
    today = datetime.date.today()
    day_map = {0: "monday", 1: "tuesday", 2: "wednesday", 3: "thursday", 4: "friday"}

    existing_dates = {
        r.date for r in db.query(Attendance.date).filter(Attendance.employee_id == employee_id).all()
    }

    new_records = []
    for delta in range(30, 0, -1):
        target_date = today - datetime.timedelta(days=delta)
        weekday = target_date.weekday()  # 0=Mon … 4=Fri, 5=Sat, 6=Sun
        date_str = target_date.strftime("%Y-%m-%d")

        if weekday >= 5:  # Skip weekends
            continue
        if date_str in existing_dates:
            continue

        day_attr = day_map.get(weekday, "monday")
        day_status = getattr(schedule, day_attr, "Working")

        if is_office_holiday(date_str) or day_status == "Off":
            att_status = "H"
        else:
            roll = random.random()
            if roll < 0.90:
                att_status = "P"
            elif roll < 0.95:
                att_status = "Ab"
            else:
                att_status = "L"

        new_records.append(Attendance(
            employee_id=employee_id,
            date=date_str,
            status=att_status,
            source="auto",
        ))

    if new_records:
        db.add_all(new_records)
        db.commit()


def sync_timesheet_with_attendance(employee_id: str, date_str: str, status: str, db: Session):
    """
    Sync timesheet with attendance updates.
    If the status is "Ab", "L", or "H" (non-working),
    we automatically set the timesheet minutes for that day to 0.
    """
    if status in ["Ab", "L", "H"]:
        try:
            dt = datetime.date.fromisoformat(date_str)
            if dt.weekday() < 5:  # Monday to Friday
                day_map = {0: "monday", 1: "tuesday", 2: "wednesday", 3: "thursday", 4: "friday"}
                day_field = day_map[dt.weekday()]
                
                # Find Monday of that week
                monday = dt - datetime.timedelta(days=dt.weekday())
                monday_str = monday.strftime("%Y-%m-%d")
                
                # Get all timesheet rows for this employee and week
                rows = db.query(TimesheetRow).filter(
                    TimesheetRow.employee_id == employee_id,
                    TimesheetRow.week_start == monday_str
                ).all()
                
                for row in rows:
                    setattr(row, day_field, 0)
                db.commit()
        except Exception as e:
            print(f"Error syncing timesheet with attendance for {employee_id} on {date_str}: {e}")



# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(title="Arohak Employee Skills & Details Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_path_middleware(request: Request, call_next):
    if "//" in request.scope["path"]:
        request.scope["path"] = "/" + "/".join(filter(None, request.scope["path"].split("/")))
    response = await call_next(request)
    return response



# ─────────────────────────────────────────────
# Auth Endpoints
# ─────────────────────────────────────────────

@app.post("/api/auth/login", response_model=Token)
def login(login_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    username = login_data.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()

    password_ok = user is not None and verify_password(login_data.password, user.hashed_password)

    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=60 * 24 * 60,
        expires=60 * 24 * 60,
        samesite="lax",
        secure=False,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username,
    }


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"detail": "Successfully logged out"}


@app.post("/api/auth/change-password")
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"detail": "Password changed successfully"}


# ─────────────────────────────────────────────
# Employee Profile Endpoints  (existing — unchanged)
# ─────────────────────────────────────────────

@app.get("/api/employees/me", response_model=EmployeeResponse)
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have an employee profile.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    compute_employee_experience(employee, db)
    employee.score = calculate_current_score(employee)
    return employee


@app.put("/api/employees/me", response_model=EmployeeResponse)
def update_my_profile(
    data: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admins cannot edit employee profiles.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    skillset_changed = (
        employee.primary_skill != (data.primary_skill.strip() if data.primary_skill else None)
        or employee.primary_rating != data.primary_rating
        or employee.secondary_skill != (data.secondary_skill.strip() if data.secondary_skill else None)
        or employee.secondary_rating != data.secondary_rating
        or employee.third_skill != (data.third_skill.strip() if data.third_skill else None)
        or employee.third_rating != data.third_rating
        or employee.work_exp_skills_rating != data.work_exp_skills_rating
    )

    employee.score = 100
    employee.last_skill_update = datetime.datetime.utcnow()

    employee.name = data.name.strip() if data.name else employee.name
    employee.email = data.email.strip() if data.email else employee.email
    employee.contact_number = data.contact_number.strip() if data.contact_number else employee.contact_number
    employee.joining_date = data.joining_date.strip() if data.joining_date else employee.joining_date
    employee.primary_skill = data.primary_skill.strip() if data.primary_skill else employee.primary_skill
    employee.primary_rating = data.primary_rating if data.primary_rating is not None else employee.primary_rating
    employee.secondary_skill = data.secondary_skill.strip() if data.secondary_skill else employee.secondary_skill
    employee.secondary_rating = data.secondary_rating if data.secondary_rating is not None else employee.secondary_rating
    employee.third_skill = data.third_skill.strip() if data.third_skill else employee.third_skill
    employee.third_rating = data.third_rating if data.third_rating is not None else employee.third_rating
    employee.previous_exp = data.previous_exp.strip() if data.previous_exp else employee.previous_exp
    employee.arohak_exp = data.arohak_exp.strip() if data.arohak_exp else employee.arohak_exp
    employee.certifications = data.certifications.strip() if data.certifications else employee.certifications
    employee.cert_start_date = data.cert_start_date.strip() if data.cert_start_date else employee.cert_start_date
    employee.cert_end_date = data.cert_end_date.strip() if data.cert_end_date else employee.cert_end_date
    employee.expiry_date = data.expiry_date.strip() if data.expiry_date else employee.expiry_date
    employee.project_name = data.project_name.strip() if data.project_name else employee.project_name
    employee.project_assignment_date = data.project_assignment_date.strip() if data.project_assignment_date else employee.project_assignment_date
    employee.project_end_date = data.project_end_date.strip() if data.project_end_date else employee.project_end_date
    employee.work_exp_skills_rating = data.work_exp_skills_rating if data.work_exp_skills_rating is not None else employee.work_exp_skills_rating
    employee.has_laptop = data.has_laptop if data.has_laptop else employee.has_laptop
    employee.laptop_details = data.laptop_details.strip() if data.laptop_details else employee.laptop_details
    employee.has_headset = data.has_headset if data.has_headset else employee.has_headset
    employee.headset_details = data.headset_details.strip() if data.headset_details else employee.headset_details


    ratings = [data.primary_rating, data.secondary_rating, data.third_rating, data.work_exp_skills_rating]
    non_zero = [r for r in ratings if r and r > 0]
    employee.overall_rating = round(sum(non_zero) / len(non_zero), 2) if non_zero else 0.0
    employee.last_updated = datetime.datetime.utcnow()

    compute_employee_experience(employee, db)

    print(f"[MAIL SIMULATION] Profile updated for {employee.email or employee.employee_id}")
    db.commit()
    db.refresh(employee)
    employee.score = calculate_current_score(employee)
    return employee


@app.get("/api/employees")
def get_employees(
    skill: Optional[str] = None,
    project: Optional[str] = None,
    experience: Optional[str] = None,
    min_rating: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Employee)
    if skill:
        skill_clean = f"%{skill.strip()}%"
        query = query.filter(
            (Employee.primary_skill.ilike(skill_clean))
            | (Employee.secondary_skill.ilike(skill_clean))
            | (Employee.third_skill.ilike(skill_clean))
        )
    if project:
        query = query.filter(Employee.project_name.ilike(f"%{project.strip()}%"))
    if experience:
        exp_clean = f"%{experience.strip()}%"
        query = query.filter(
            (Employee.previous_exp.ilike(exp_clean)) | (Employee.arohak_exp.ilike(exp_clean))
        )
    if min_rating is not None:
        query = query.filter(Employee.overall_rating >= min_rating)

    employees = query.all()
    for emp in employees:
        compute_employee_experience(emp, db)
        emp.score = calculate_current_score(emp)

    if current_user.role == "admin":
        return [EmployeeResponse.model_validate(emp) for emp in employees]
    else:
        result = []
        for emp in employees:
            if emp.username == current_user.username:
                result.append(EmployeeResponse.model_validate(emp))
            else:
                result.append(EmployeeRestrictedResponse.model_validate(emp))
        return result


@app.get("/api/employees/{employee_id}")
def get_employee_by_id(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    compute_employee_experience(employee, db)
    employee.score = calculate_current_score(employee)
    if current_user.role == "admin" or employee.username == current_user.username:
        return EmployeeResponse.model_validate(employee)
    else:
        return EmployeeRestrictedResponse.model_validate(employee)


@app.put("/api/employees/{employee_id}/assets", response_model=EmployeeResponse)
def update_employee_assets(
    employee_id: str,
    data: AssetUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.has_laptop = data.has_laptop
    employee.laptop_details = data.laptop_details.strip() if (data.laptop_details and data.has_laptop == "Yes") else None
    employee.has_headset = data.has_headset
    employee.headset_details = data.headset_details.strip() if (data.headset_details and data.has_headset == "Yes") else None
    employee.last_updated = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(employee)
    employee.score = calculate_current_score(employee)
    return employee


# ─────────────────────────────────────────────
# Resume Endpoints
# ─────────────────────────────────────────────
import shutil

UPLOAD_DIR = os.path.join("backend", "uploaded_resumes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/employees/{employee_id}/resume/upload")
def upload_resume(
    employee_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Check if admin or self
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".pdf", ".doc", ".docx"]:
        raise HTTPException(status_code=400, detail="Only PDF, DOC, and DOCX files are allowed.")

    # Save file
    filename = f"{employee_id}_resume{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    employee.resume_path = file_path
    employee.last_updated = datetime.datetime.utcnow()
    db.commit()
    db.refresh(employee)
    
    return {"detail": "Resume uploaded successfully", "resume_path": file_path}


@app.delete("/api/employees/{employee_id}/resume")
def delete_resume(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Check if admin or self
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    if employee.resume_path and os.path.exists(employee.resume_path):
        try:
            os.remove(employee.resume_path)
        except Exception:
            pass
            
    employee.resume_path = None
    employee.last_updated = datetime.datetime.utcnow()
    db.commit()
    db.refresh(employee)
    
    return {"detail": "Resume deleted successfully"}


@app.get("/api/employees/{employee_id}/resume/download-uploaded")
def download_uploaded_resume(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Check if admin or self
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    if not employee.resume_path or not os.path.exists(employee.resume_path):
        raise HTTPException(status_code=404, detail="No custom resume uploaded.")

    # Return as attachment
    filename = os.path.basename(employee.resume_path)
    return FileResponse(
        path=employee.resume_path,
        media_type="application/octet-stream",
        filename=filename
    )


@app.get("/api/employees/{employee_id}/resume/download-generated")
def download_generated_resume(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        from resume_generator import generate_resume_pdf
    except ModuleNotFoundError:
        from backend.resume_generator import generate_resume_pdf
    
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Check if admin or self
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    # Always recalculate score before generating
    employee.score = calculate_current_score(employee)

    # Map Employee database object properties to the resume fields
    skills_list = []
    if employee.primary_skill:
        skills_list.append(f"{employee.primary_skill}: expert in application engineering and support")
    if employee.secondary_skill:
        skills_list.append(f"{employee.secondary_skill}: proficient developer and administrator")
    if employee.third_skill:
        skills_list.append(f"{employee.third_skill}: knowledgeable technical support specialist")
    core_competencies = "\n".join(skills_list) if skills_list else "Technical operations and development support"
    
    executive_summary = (
        f"A dedicated professional with experience in technical execution, system configuration, "
        f"and software application processes. Proven capabilities in {employee.primary_skill or 'key technology areas'}, "
        f"focused on driving efficiency and high-quality deliverables."
    )
    if employee.project_name:
        executive_summary += f" Currently assigned to the {employee.project_name} project at Arohak Technologies."

    certs = employee.certifications or "No certifications declared."

    resume_data = CustomResumeRequest(
        name=employee.name,
        job_title=employee.primary_skill or "Technical Associate",
        linkedin=f"www.linkedin.com/in/{employee.username}",
        email=employee.email or f"{employee.username}@arohak.com",
        phone="+91-0000000000",
        location="HYDERABAD, INDIA",
        
        executive_summary=executive_summary,
        core_competencies=core_competencies,
        key_clients="Internal and client-assigned development projects",
        
        arohak_title=f"Technical Associate - {employee.primary_skill or 'Developer'}",
        arohak_start="Dec 2025 – Present",
        arohak_resp=employee.arohak_exp or "Active team member participating in project delivery and system execution matching primary skills.",
        
        prev_company="Previous Company Name",
        prev_location="Location",
        prev_title="Job Title",
        prev_tenure="Start Date – End Date",
        prev_resp=employee.previous_exp or "Summaries your Job role in your company , Roles & Responsibilities",
        
        achievements="List your achievements throughout your career",
        education="List your educational achievements with details about your college and pass out year (MM/YYYY)",
        industry_experience="Banking & Financial Services | Manufacturing | Retail & Consumer Goods | Energy & Utilities | Enterprise Technology Services | Infrastructure & Managed Services",
        certifications=certs,
        tools_technologies=f"{employee.primary_skill or ''}, {employee.secondary_skill or ''}, {employee.third_skill or ''}".strip(", ") or "ServiceNow, SAP"
    )

    try:
        pdf_bytes = generate_resume_pdf(resume_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate resume: {str(e)}")

    filename = f"{employee_id}_generated_resume.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )


@app.post("/api/employees/{employee_id}/resume/download-generated-custom")
def download_generated_resume_custom(
    employee_id: str,
    data: CustomResumeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Check if admin or self
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        from resume_generator import generate_resume_pdf
    except ModuleNotFoundError:
        from backend.resume_generator import generate_resume_pdf

    try:
        pdf_bytes = generate_resume_pdf(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate custom resume: {str(e)}")

    filename = f"{employee_id}_custom_generated_resume.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )



# ─────────────────────────────────────────────
# Weekly Schedule Endpoints
# ─────────────────────────────────────────────

@app.get("/api/schedule/me", response_model=ScheduleResponse)
def get_my_schedule(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have a personal schedule.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    sched = _get_or_create_schedule(employee.employee_id, db)
    return sched


@app.get("/api/schedule/{employee_id}", response_model=ScheduleResponse)
def get_employee_schedule(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    # Access control: employees can only view their own schedule
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")
    sched = _get_or_create_schedule(employee_id, db)
    return sched


@app.put("/api/schedule/{employee_id}", response_model=ScheduleResponse)
def update_employee_schedule(
    employee_id: str,
    data: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if admin or self
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Only admins or the employee themselves can update this schedule.")
        
    sched = _get_or_create_schedule(employee_id, db)
    
    # Only admins can update the manager name
    if current_user.role == "admin" and data.manager_name is not None:
        sched.manager_name = data.manager_name
        
    sched.monday = data.monday
    sched.tuesday = data.tuesday
    sched.wednesday = data.wednesday
    sched.thursday = data.thursday
    sched.friday = data.friday
    sched.shift = data.shift or "Day Shift"
    
    # Tasks
    sched.monday_tasks = data.monday_tasks
    sched.tuesday_tasks = data.tuesday_tasks
    sched.wednesday_tasks = data.wednesday_tasks
    sched.thursday_tasks = data.thursday_tasks
    sched.friday_tasks = data.friday_tasks
    
    sched.notes = data.notes
    sched.last_updated = datetime.datetime.utcnow()
    db.commit()
    db.refresh(sched)
    return sched


# ─────────────────────────────────────────────
# Attendance Endpoints
# ─────────────────────────────────────────────

@app.get("/api/attendance/me", response_model=AttendanceResponse)
def get_my_attendance(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal attendance.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    sched = _get_or_create_schedule(employee.employee_id, db)
    _auto_generate_attendance(employee.employee_id, sched, db)

    records = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee.employee_id)
        .order_by(Attendance.date.desc())
        .all()
    )
    return AttendanceResponse(
        employee_id=employee.employee_id,
        employee_name=employee.name,
        records=[AttendanceRecord.model_validate(r) for r in records],
        schedule=ScheduleResponse.model_validate(sched),
    )


@app.get("/api/attendance/{employee_id}", response_model=AttendanceResponse)
def get_employee_attendance(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")

    sched = _get_or_create_schedule(employee_id, db)
    _auto_generate_attendance(employee_id, sched, db)

    records = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee_id)
        .order_by(Attendance.date.desc())
        .all()
    )
    return AttendanceResponse(
        employee_id=employee.employee_id,
        employee_name=employee.name,
        records=[AttendanceRecord.model_validate(r) for r in records],
        schedule=ScheduleResponse.model_validate(sched),
    )


@app.post("/api/attendance/{employee_id}/record", response_model=AttendanceRecord)
def upsert_attendance_record(
    employee_id: str,
    data: AttendanceUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: create or update a single day's attendance record."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update attendance records.")
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    record = (
        db.query(Attendance)
        .filter(Attendance.employee_id == employee_id, Attendance.date == data.date)
        .first()
    )
    if record:
        record.status = data.status
        record.notes = data.notes
        record.source = data.source or "manual"
    else:
        record = Attendance(
            employee_id=employee_id,
            date=data.date,
            status=data.status,
            notes=data.notes,
            source=data.source or "manual",
        )
        db.add(record)
    db.commit()
    db.refresh(record)
    
    # Sync with timesheet if employee status is now non-working
    sync_timesheet_with_attendance(employee_id, record.date, record.status, db)
    
    return record


# ─────────────────────────────────────────────
# Timesheet Endpoints
# ─────────────────────────────────────────────

def is_past_month_week(week_start_str: str) -> bool:
    """
    Returns True if the timesheet week belongs to a past calendar month (month has ended).
    Timesheets for ended months are locked and cannot be edited by employees or rejected by admin.
    """
    try:
        ws_date = datetime.date.fromisoformat(week_start_str)
        friday_date = ws_date + datetime.timedelta(days=4)
        today = datetime.date.today()

        if friday_date.year < today.year:
            return True
        if friday_date.year == today.year and friday_date.month < today.month:
            return True
    except Exception:
        pass
    return False


def _get_timesheet_data(employee_id: str, week_start_str: str, db: Session) -> dict:
    rows = db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee_id,
        TimesheetRow.week_start == week_start_str
    ).all()
    
    ts_status = db.query(WeeklyTimesheetStatus).filter(
        WeeklyTimesheetStatus.employee_id == employee_id,
        WeeklyTimesheetStatus.week_start == week_start_str
    ).first()
    
    status_val = ts_status.status if ts_status else "Draft"
    released_at_val = ts_status.released_at if ts_status else None
    past_month = is_past_month_week(week_start_str)
    can_edit_val = (status_val in ["Draft", "Rejected"]) and not past_month
    
    try:
        start_date = datetime.date.fromisoformat(week_start_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format for week_start")
        
    week_dates = [ (start_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(5) ]
    
    att_records = db.query(Attendance).filter(
        Attendance.employee_id == employee_id,
        Attendance.date.in_(week_dates)
    ).all()
    att_map = { r.date: r.status for r in att_records }
    
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    attendance_status = {}
    for i, day_name in enumerate(day_names):
        d_str = week_dates[i]
        attendance_status[day_name] = att_map.get(d_str, "P")
        
    return {
        "week_start": week_start_str,
        "status": status_val,
        "released_at": released_at_val,
        "can_edit": can_edit_val,
        "is_past_month": past_month,
        "rows": rows,
        "attendance": attendance_status
    }


@app.get("/api/timesheet/me", response_model=TimesheetResponse)
def get_my_timesheet(
    week_start: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal timesheets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    if not week_start:
        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday())
        week_start = monday.strftime("%Y-%m-%d")
        
    sched = _get_or_create_schedule(employee.employee_id, db)
    _auto_generate_attendance(employee.employee_id, sched, db)
    
    return _get_timesheet_data(employee.employee_id, week_start, db)


@app.post("/api/timesheet/me/save", response_model=TimesheetResponse)
def save_my_timesheet(
    data: TimesheetSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal timesheets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    ts_status = db.query(WeeklyTimesheetStatus).filter(
        WeeklyTimesheetStatus.employee_id == employee.employee_id,
        WeeklyTimesheetStatus.week_start == data.week_start
    ).first()
    
    if is_past_month_week(data.week_start):
        raise HTTPException(status_code=400, detail="Cannot edit timesheets from past months. The month has ended and past timesheets are locked.")

    if ts_status and ts_status.status in ["Released", "Approved"]:
        raise HTTPException(status_code=400, detail="Timesheet is released and locked. Contact Admin to request changes.")
        
    total_minutes = 0
    for r in data.rows:
        total_minutes += (r.monday or 0) + (r.tuesday or 0) + (r.wednesday or 0) + (r.thursday or 0) + (r.friday or 0)
        
    if total_minutes > 2700:
        raise HTTPException(status_code=400, detail="Total weekly hours cannot exceed 45:00.")
        
    try:
        start_date = datetime.date.fromisoformat(data.week_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format for week_start")
        
    week_dates = [ (start_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(5) ]
    att_records = db.query(Attendance).filter(
        Attendance.employee_id == employee.employee_id,
        Attendance.date.in_(week_dates)
    ).all()
    att_map = { r.date: r.status for r in att_records }
    
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    
    db_rows = db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee.employee_id,
        TimesheetRow.week_start == data.week_start
    ).all()
    db_rows_map = { r.id: r for r in db_rows }
    
    for row_schema in data.rows:
        for i, day_name in enumerate(day_names):
            status = att_map.get(week_dates[i], "P")
            if status in ["Ab", "L", "H"]:
                setattr(row_schema, day_name, 0)
                
        if row_schema.id and row_schema.id in db_rows_map:
            db_row = db_rows_map[row_schema.id]
            db_row.client_project = row_schema.client_project
            db_row.task = row_schema.task
            db_row.monday = row_schema.monday
            db_row.tuesday = row_schema.tuesday
            db_row.wednesday = row_schema.wednesday
            db_row.thursday = row_schema.thursday
            db_row.friday = row_schema.friday
            del db_rows_map[row_schema.id]
        else:
            new_row = TimesheetRow(
                employee_id=employee.employee_id,
                week_start=data.week_start,
                client_project=row_schema.client_project,
                task=row_schema.task,
                monday=row_schema.monday,
                tuesday=row_schema.tuesday,
                wednesday=row_schema.wednesday,
                thursday=row_schema.thursday,
                friday=row_schema.friday,
            )
            db.add(new_row)
            
    for db_row in db_rows_map.values():
        db.delete(db_row)
        
    db.commit()
    return _get_timesheet_data(employee.employee_id, data.week_start, db)


@app.post("/api/timesheet/me/release", response_model=TimesheetResponse)
def release_my_timesheet(
    week_start: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal timesheets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    ts_status = db.query(WeeklyTimesheetStatus).filter(
        WeeklyTimesheetStatus.employee_id == employee.employee_id,
        WeeklyTimesheetStatus.week_start == week_start
    ).first()
    
    if not ts_status:
        ts_status = WeeklyTimesheetStatus(
            employee_id=employee.employee_id,
            week_start=week_start,
            status="Released",
            released_at=datetime.datetime.utcnow()
        )
        db.add(ts_status)
    else:
        ts_status.status = "Released"
        ts_status.released_at = datetime.datetime.utcnow()
        
    db.commit()
    return _get_timesheet_data(employee.employee_id, week_start, db)


@app.post("/api/timesheet/me/copy-previous", response_model=TimesheetResponse)
def copy_previous_week_timesheet(
    week_start: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal timesheets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    ts_status = db.query(WeeklyTimesheetStatus).filter(
        WeeklyTimesheetStatus.employee_id == employee.employee_id,
        WeeklyTimesheetStatus.week_start == week_start
    ).first()
    if ts_status and ts_status.status in ["Released", "Approved"]:
        raise HTTPException(status_code=400, detail="Timesheet is released and locked.")
        
    try:
        curr_monday = datetime.date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format for week_start")
        
    prev_monday = curr_monday - datetime.timedelta(days=7)
    prev_monday_str = prev_monday.strftime("%Y-%m-%d")
    
    prev_rows = db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee.employee_id,
        TimesheetRow.week_start == prev_monday_str
    ).all()
    
    if not prev_rows:
        raise HTTPException(status_code=400, detail="No timesheet rows found in the previous week to copy.")
        
    db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee.employee_id,
        TimesheetRow.week_start == week_start
    ).delete()
    
    for prow in prev_rows:
        new_row = TimesheetRow(
            employee_id=employee.employee_id,
            week_start=week_start,
            client_project=prow.client_project,
            task=prow.task,
            monday=0,
            tuesday=0,
            wednesday=0,
            thursday=0,
            friday=0,
        )
        db.add(new_row)
        
    db.commit()
    return _get_timesheet_data(employee.employee_id, week_start, db)


@app.get("/api/admin/timesheets", response_model=List[AdminTimesheetListItem])
def get_admin_timesheets_overview(
    week_start: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not week_start:
        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday())
        week_start = monday.strftime("%Y-%m-%d")
        
    employees = db.query(Employee).order_by(Employee.employee_id.asc()).all()
    statuses = db.query(WeeklyTimesheetStatus).filter(WeeklyTimesheetStatus.week_start == week_start).all()
    status_map = { s.employee_id: s for s in statuses }
    
    rows = db.query(TimesheetRow).filter(TimesheetRow.week_start == week_start).all()
    minutes_map = {}
    for r in rows:
        tot = (r.monday or 0) + (r.tuesday or 0) + (r.wednesday or 0) + (r.thursday or 0) + (r.friday or 0)
        minutes_map[r.employee_id] = minutes_map.get(r.employee_id, 0) + tot
        
    past_month = is_past_month_week(week_start)
    results = []
    for emp in employees:
        st_obj = status_map.get(emp.employee_id)
        st_val = st_obj.status if st_obj else "Not Released"
        rel_at = st_obj.released_at if st_obj else None
        tot_mins = minutes_map.get(emp.employee_id, 0)
        
        hrs = tot_mins // 60
        mins = tot_mins % 60
        formatted = f"{hrs}:{mins:02d}"
        
        results.append(AdminTimesheetListItem(
            employee_id=emp.employee_id,
            name=emp.name,
            project_name=emp.project_name or "Bench",
            week_start=week_start,
            status=st_val,
            released_at=rel_at,
            total_minutes=tot_mins,
            total_formatted=formatted,
            can_accept=(st_val == "Released"),
            can_reject=(st_val in ["Released", "Approved"]) and not past_month,
            is_past_month=past_month
        ))
    return results


@app.put("/api/admin/timesheets/{employee_id}/review")
def review_employee_timesheet(
    employee_id: str,
    req: TimesheetReviewRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    past_month = is_past_month_week(req.week_start)
    if req.action == "reject" and past_month:
        raise HTTPException(status_code=400, detail="Cannot reject timesheets from past months. The month has ended and past timesheets are locked.")
        
    ts_status = db.query(WeeklyTimesheetStatus).filter(
        WeeklyTimesheetStatus.employee_id == employee_id,
        WeeklyTimesheetStatus.week_start == req.week_start
    ).first()
    
    new_status = "Approved" if req.action == "accept" else "Rejected"
    
    if not ts_status:
        ts_status = WeeklyTimesheetStatus(
            employee_id=employee_id,
            week_start=req.week_start,
            status=new_status,
            reviewed_at=datetime.datetime.utcnow(),
            admin_notes=req.notes
        )
        db.add(ts_status)
    else:
        ts_status.status = new_status
        ts_status.reviewed_at = datetime.datetime.utcnow()
        ts_status.admin_notes = req.notes
        
    db.commit()
    return {"detail": f"Timesheet for {employee.name} set to {new_status}."}


@app.get("/api/admin/timesheets/{employee_id}", response_model=TimesheetResponse)
def get_admin_employee_timesheet_detail(
    employee_id: str,
    week_start: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    if not week_start:
        today = datetime.date.today()
        monday = today - datetime.timedelta(days=today.weekday())
        week_start = monday.strftime("%Y-%m-%d")
        
    return _get_timesheet_data(employee.employee_id, week_start, db)




# ─────────────────────────────────────────────
# Certifications & Skills Endpoints
# ─────────────────────────────────────────────

@app.get("/api/certskills/me", response_model=CertSkillsResponse)
def get_my_cert_skills(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have a personal certifications page.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return CertSkillsResponse.model_validate(employee)


@app.get("/api/certskills/{employee_id}", response_model=CertSkillsResponse)
def get_employee_cert_skills(
    employee_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")
    return CertSkillsResponse.model_validate(employee)


# ─────────────────────────────────────────────
# Yearly Skill Target Endpoints
# ─────────────────────────────────────────────

@app.get("/api/skilltargets/me", response_model=List[SkillTargetResponse])
def get_my_skill_targets(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal skill targets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    q = db.query(SkillTarget).filter(SkillTarget.employee_id == employee.employee_id)
    if year:
        q = q.filter(SkillTarget.year == year)
    return q.order_by(SkillTarget.year.desc(), SkillTarget.created_at.desc()).all()


@app.post("/api/skilltargets/me", response_model=SkillTargetResponse)
def create_skill_target(
    data: SkillTargetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts cannot create skill targets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    target_year = data.year if data.year else datetime.datetime.utcnow().year
    target = SkillTarget(
        employee_id=employee.employee_id,
        year=target_year,
        skill_name=data.skill_name.strip(),
        description=data.description,
        target_level=data.target_level,
        status=data.status,
        target_completion_date=data.target_completion_date,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@app.put("/api/skilltargets/me/{target_id}", response_model=SkillTargetResponse)
def update_skill_target(
    target_id: int,
    data: SkillTargetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts cannot update skill targets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    target = db.query(SkillTarget).filter(
        SkillTarget.id == target_id, SkillTarget.employee_id == employee.employee_id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Skill target not found")
    if data.skill_name:
        target.skill_name = data.skill_name.strip()
    if data.description is not None:
        target.description = data.description
    if data.target_level is not None:
        target.target_level = data.target_level
    if data.status is not None:
        target.status = data.status
    if data.target_completion_date is not None:
        target.target_completion_date = data.target_completion_date
    target.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(target)
    return target


@app.delete("/api/skilltargets/me/{target_id}")
def delete_skill_target(
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts cannot delete skill targets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    target = db.query(SkillTarget).filter(
        SkillTarget.id == target_id, SkillTarget.employee_id == employee.employee_id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Skill target not found")
    db.delete(target)
    db.commit()
    return {"detail": "Skill target deleted"}


@app.get("/api/skilltargets/{employee_id}", response_model=List[SkillTargetResponse])
def get_employee_skill_targets(
    employee_id: str,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if current_user.role != "admin" and employee.username != current_user.username:
        raise HTTPException(status_code=403, detail="Access denied")
    q = db.query(SkillTarget).filter(SkillTarget.employee_id == employee_id)
    if year:
        q = q.filter(SkillTarget.year == year)
    return q.order_by(SkillTarget.year.desc(), SkillTarget.created_at.desc()).all()


@app.get("/api/admin/skilltargets-overview", response_model=List[AdminSkillTargetOverviewItem])
def get_admin_skilltargets_overview(
    year: Optional[int] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not year:
        year = datetime.datetime.utcnow().year
        
    employees = db.query(Employee).all()
    result = []
    
    for emp in employees:
        targets = db.query(SkillTarget).filter(
            SkillTarget.employee_id == emp.employee_id,
            SkillTarget.year == year
        ).order_by(SkillTarget.created_at.desc()).all()
        
        if not targets:
            status = "No Targets Set"
        else:
            all_completed = all(t.status == "Completed" for t in targets)
            if all_completed:
                status = "Target Completed"
            else:
                status = "In-Progress"
                
        result.append(AdminSkillTargetOverviewItem(
            employee_id=emp.employee_id,
            name=emp.name,
            project_name=emp.project_name or "Bench",
            targets_status=status,
            targets=targets
        ))
        
    return result


# ─────────────────────────────────────────────
# Admin – list all employees' attendance (overview)
# ─────────────────────────────────────────────

def get_client_account_for_project(proj_name: str) -> str:
    pn = proj_name.lower().strip()
    if "crenma" in pn or "kenvue" in pn or "edi" in pn or "aspac" in pn:
        return "Crenma Account"
    elif "j&j" in pn or "johnson" in pn or "secure" in pn or "transfer" in pn:
        return "Johnson & Johnson Account"
    elif "bench" in pn or "internal" in pn or "arohak" in pn or not pn:
        return "Arohak Internal Operations"
    else:
        return f"{proj_name.title()} Account"


@app.get("/api/admin/projects-overview")
def get_admin_projects_overview(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Returns all Arohak Client Accounts with sub-projects, project managers, team leads, and team members dynamically from DB."""
    employees = db.query(Employee).all()
    accounts_map = {}

    default_hierarchy = {
        "Kenvue": {"manager": "Rajesh Kumar", "lead": "Anita Sharma", "display_name": "Kenvue E-Commerce Platform"},
        "ASPAC EDI": {"manager": "Sanjay Verma", "lead": "Praveen Rao", "display_name": "Crenma ASPAC EDI Integration"},
        "Johnson & Johnson": {"manager": "Meera Nair", "lead": "Vikram Patel", "display_name": "J&J Enterprise Portal"},
        "Secure Transfers": {"manager": "Anand Joshi", "lead": "Ramesh Gupta", "display_name": "Secure Transfers Gateway"},
        "Bench": {"manager": "HR Operations", "lead": "Resource Pool Lead", "display_name": "Bench & Talent Pool"},
    }

    for emp in employees:
        raw_pname = emp.project_name.strip() if emp.project_name and emp.project_name.strip() else "Bench"
        def_info = default_hierarchy.get(raw_pname, {
            "manager": "Project Delivery Head",
            "lead": "Lead Architect",
            "display_name": raw_pname
        })

        client_account = get_client_account_for_project(raw_pname)
        sub_project_name = def_info["display_name"]

        if client_account not in accounts_map:
            accounts_map[client_account] = {
                "client_account": client_account,
                "account_manager": def_info["manager"],
                "projects_map": {}
            }

        acc = accounts_map[client_account]
        if sub_project_name not in acc["projects_map"]:
            sched = _get_or_create_schedule(emp.employee_id, db)
            pm = (sched.manager_name if sched and sched.manager_name else None) or def_info["manager"]
            
            acc["projects_map"][sub_project_name] = {
                "project_name": sub_project_name,
                "project_manager": pm,
                "team_lead": def_info["lead"],
                "members": []
            }

        p_skill = (emp.primary_skill or "").lower()
        if "lead" in p_skill or "mgr" in p_skill or "manager" in p_skill:
            role = "Tech Lead"
        elif "qa" in p_skill or "test" in p_skill or "automation" in p_skill:
            role = "QA Engineer"
        elif "devops" in p_skill or "cloud" in p_skill or "azure" in p_skill or "aws" in p_skill or "docker" in p_skill:
            role = "DevOps Engineer"
        elif "data" in p_skill or "sql" in p_skill or "db" in p_skill:
            role = "Data Engineer"
        elif "frontend" in p_skill or "react" in p_skill or "angular" in p_skill or "ui" in p_skill:
            role = "Frontend Developer"
        elif "backend" in p_skill or "python" in p_skill or "java" in p_skill or "node" in p_skill or "c#" in p_skill:
            role = "Backend Developer"
        elif raw_pname == "Bench":
            role = "Resource Pool Member"
        else:
            role = "Software Developer"

        acc["projects_map"][sub_project_name]["members"].append({
            "employee_id": emp.employee_id,
            "name": emp.name,
            "email": emp.email,
            "contact_number": emp.contact_number,
            "task_details": role,
            "project_assignment_date": emp.project_assignment_date or emp.joining_date or "—",
            "overall_rating": emp.overall_rating or 0.0,
        })

    result = []
    for acc_name, acc_data in accounts_map.items():
        projects_list = []
        tot_acc_members = 0
        for p_name, p_data in acc_data["projects_map"].items():
            tot_acc_members += len(p_data["members"])
            projects_list.append({
                "project_name": p_data["project_name"],
                "project_manager": p_data["project_manager"],
                "team_lead": p_data["team_lead"],
                "total_members": len(p_data["members"]),
                "members": p_data["members"]
            })

        result.append({
            "client_account": acc_name,
            "account_manager": acc_data["account_manager"],
            "total_account_members": tot_acc_members,
            "projects": projects_list
        })

    result.sort(key=lambda x: ("Internal" in x["client_account"], x["client_account"]))
    return result


@app.get("/api/admin/attendance-overview")
def admin_attendance_overview(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Returns today's attendance snapshot for all employees."""
    today_dt = datetime.date.today()
    today_str = today_dt.strftime("%Y-%m-%d")
    weekday_num = today_dt.weekday()
    day_map = {0: "monday", 1: "tuesday", 2: "wednesday", 3: "thursday", 4: "friday"}
    day_attr = day_map.get(weekday_num, "monday")

    employees = db.query(Employee).all()
    result = []
    for emp in employees:
        sched = _get_or_create_schedule(emp.employee_id, db)
        
        # Check if there is an approved leave covering today
        on_leave = False
        leave_active = db.query(LeaveRequest).filter(
            LeaveRequest.employee_id == emp.employee_id,
            LeaveRequest.status == "Approved",
            LeaveRequest.start_date <= today_str,
            LeaveRequest.end_date >= today_str
        ).first()
        if leave_active:
            on_leave = True
            
        record = db.query(Attendance).filter(
            Attendance.employee_id == emp.employee_id,
            Attendance.date == today_str,
        ).first()

        if record:
            status = record.status
        elif is_office_holiday(today_str):
            status = "H"
        elif on_leave:
            status = "L"
        else:
            # Check project schedule and weekend status
            if weekday_num < 5:
                day_status = getattr(sched, day_attr, "Working")
                if day_status == "Off":
                    status = "H"
                else:
                    status = "Ab"
            else:
                status = "H"
                
        result.append({
            "employee_id": emp.employee_id,
            "name": emp.name,
            "project": emp.project_name or "Bench",
            "today_status": status,
            "schedule_manager": sched.manager_name,
            "shift": sched.shift or "Day Shift",
            "on_leave": on_leave,
            "leave_reason": leave_active.reason if leave_active else None
        })
    return result


# ─────────────────────────────────────────────
# Leave Requests Endpoints
# ─────────────────────────────────────────────

@app.post("/api/leaves", response_model=LeaveRequestResponse)
def create_leave_request(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admins cannot submit leave requests.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    req = LeaveRequest(
        employee_id=employee.employee_id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        status="Pending"
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    req.employee_name = employee.name
    return req

@app.get("/api/leaves/me", response_model=List[LeaveRequestResponse])
def get_my_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admins do not have leave requests.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    reqs = db.query(LeaveRequest).filter(LeaveRequest.employee_id == employee.employee_id).order_by(LeaveRequest.created_at.desc()).all()
    for r in reqs:
        r.employee_name = employee.name
    return reqs

@app.get("/api/admin/leaves", response_model=List[LeaveRequestResponse])
def get_all_leave_requests(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    reqs = db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()
    for r in reqs:
        emp = db.query(Employee).filter(Employee.employee_id == r.employee_id).first()
        r.employee_name = emp.name if emp else "Unknown"
    return reqs

@app.put("/api/admin/leaves/{leave_id}", response_model=LeaveRequestResponse)
def update_leave_request_status(
    leave_id: int,
    data: LeaveRequestUpdateStatus,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    req.status = data.status
    db.commit()
    db.refresh(req)
    
    if req.status == "Approved":
        start = datetime.datetime.strptime(req.start_date, "%Y-%m-%d").date()
        end = datetime.datetime.strptime(req.end_date, "%Y-%m-%d").date()
        curr = start
        while curr <= end:
            if curr.weekday() < 5:
                date_str = curr.strftime("%Y-%m-%d")
                att = db.query(Attendance).filter(Attendance.employee_id == req.employee_id, Attendance.date == date_str).first()
                if att:
                    att.status = "L"
                    att.notes = f"Approved Leave: {req.reason or ''}"
                else:
                    att = Attendance(
                        employee_id=req.employee_id,
                        date=date_str,
                        status="L",
                        source="manual",
                        notes=f"Approved Leave: {req.reason or ''}"
                    )
                    db.add(att)
                sync_timesheet_with_attendance(req.employee_id, date_str, "L", db)
            curr += datetime.timedelta(days=1)
        db.commit()
        db.refresh(req)
        
    emp = db.query(Employee).filter(Employee.employee_id == req.employee_id).first()
    req.employee_name = emp.name if emp else "Unknown"
    return req


# ─────────────────────────────────────────────
# Excel Export & Profile Update Reminders
# ─────────────────────────────────────────────
import io
import threading
import time
import pandas as pd
from fastapi.responses import StreamingResponse
try:
    from email_service import send_profile_update_email
    from database import SessionLocal
except ModuleNotFoundError:
    from backend.email_service import send_profile_update_email
    from backend.database import SessionLocal

@app.get("/api/admin/employees/export-excel")
def export_employees_excel(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    employees = db.query(Employee).all()
    
    data = []
    for emp in employees:
        emp.score = calculate_current_score(emp)
        data.append({
            "Employee ID": emp.employee_id,
            "Name": emp.name,
            "Email": emp.email or "",
            "Contact Number": emp.contact_number or "",
            "Joining Date": emp.joining_date or "",
            "Primary Skill": emp.primary_skill or "",
            "Primary Rating": emp.primary_rating or 0.0,
            "Secondary Skill": emp.secondary_skill or "",
            "Secondary Rating": emp.secondary_rating or 0.0,
            "Third Skill": emp.third_skill or "",
            "Third Rating": emp.third_rating or 0.0,
            "Previous Experience": emp.previous_exp or "",
            "Arohak Experience": emp.arohak_exp or "",
            "Certifications": emp.certifications or "",
            "Year of Completion": emp.cert_start_date or "",
            "Project Name": emp.project_name or "",
            "Project Assignment Date": emp.project_assignment_date or "",
            "Project End Date": emp.project_end_date or "",
            "Laptop Details": emp.laptop_details or "",
            "Has Headset": emp.has_headset or "No",
            "Score": emp.score,
            "Last Updated": emp.last_updated.strftime("%Y-%m-%d %H:%M:%S") if emp.last_updated else "",
            "Last Skill Update": emp.last_skill_update.strftime("%Y-%m-%d %H:%M:%S") if emp.last_skill_update else "",
            "Last Reminder Sent": emp.last_reminder_sent.strftime("%Y-%m-%d %H:%M:%S") if emp.last_reminder_sent else "Never"
        })
        
    df = pd.DataFrame(data)
    
    # Save dataframe to buffer using openpyxl
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Employees')
        
    output.seek(0)
    
    filename = f"Arohak_Employees_{datetime.date.today().strftime('%Y-%m-%d')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/admin/employees/send-reminders")
def send_profile_update_reminders(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    employees = db.query(Employee).all()
    
    emails_sent_count = 0
    for emp in employees:
        last_update = emp.last_skill_update or emp.last_updated or now
        if isinstance(last_update, datetime.date) and not isinstance(last_update, datetime.datetime):
            last_update = datetime.datetime.combine(last_update, datetime.time.min)
            
        days_since_update = (now - last_update).days
        
        # If overdue (more than 180 days)
        if days_since_update >= 180:
            # Check if reminder has not been sent, or was sent more than 180 days ago
            last_sent = emp.last_reminder_sent
            if last_sent is None or (now - last_sent).days >= 180:
                score = calculate_current_score(emp)
                email = emp.email or f"{emp.employee_id.lower()}@arohak.com"
                success = send_profile_update_email(emp.name, email, emp.employee_id, score)
                if success:
                    emp.last_reminder_sent = now
                    emails_sent_count += 1
                    
    if emails_sent_count > 0:
        db.commit()
        
    return {"detail": f"Sent {emails_sent_count} reminder emails.", "emails_sent": emails_sent_count}


def check_and_send_scheduled_reminders():
    """
    Background check that runs daily to send automated email updates.
    """
    # Sleep on startup to let server fully initialize
    time.sleep(10)
    while True:
        db = SessionLocal()
        try:
            now = datetime.datetime.utcnow()
            employees = db.query(Employee).all()
            
            emails_sent_count = 0
            for emp in employees:
                last_update = emp.last_skill_update or emp.last_updated or now
                if isinstance(last_update, datetime.date) and not isinstance(last_update, datetime.datetime):
                    last_update = datetime.datetime.combine(last_update, datetime.time.min)
                    
                days_since_update = (now - last_update).days
                
                # If overdue (more than 180 days)
                if days_since_update >= 180:
                    # Check if reminder has not been sent, or was sent more than 180 days ago
                    last_sent = emp.last_reminder_sent
                    if last_sent is None or (now - last_sent).days >= 180:
                        score = calculate_current_score(emp)
                        email = emp.email or f"{emp.employee_id.lower()}@arohak.com"
                        success = send_profile_update_email(emp.name, email, emp.employee_id, score)
                        if success:
                            emp.last_reminder_sent = now
                            emails_sent_count += 1
                            
            if emails_sent_count > 0:
                db.commit()
                print(f"[BACKGROUND TASK] Sent {emails_sent_count} automated profile update reminders.")
        except Exception as e:
            print(f"[BACKGROUND TASK ERROR] Failed to run automated reminders check: {e}")
        finally:
            db.close()
            
        # Sleep for 24 hours (86400 seconds)
        time.sleep(86400)


@app.on_event("startup")
def startup_event():
    # Start the automated reminder background thread
    threading.Thread(target=check_and_send_scheduled_reminders, daemon=True).start()


# ─────────────────────────────────────────────
# API root
# ─────────────────────────────────────────────
# The frontend (frontend/) is deployed separately on Vercel; this backend is API-only.

@app.get("/")
def read_index():
    return {"detail": "Arohak SkillPulse API — see /docs for the interactive API reference."}
