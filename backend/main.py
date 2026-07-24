import os
import random
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Response, Request, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import get_db, engine, Base
from backend.models import User, Employee, EmployeeSchedule, Attendance, SkillTarget, LeaveRequest, TimesheetRow
from backend.schemas import (
    UserLogin, Token, EmployeeResponse,
    EmployeeRestrictedResponse, EmployeeUpdate, PasswordChange,
    ScheduleResponse, ScheduleUpdate,
    AttendanceRecord, AttendanceUpsert, AttendanceResponse,
    CertSkillsResponse,
    SkillTargetCreate, SkillTargetUpdate, SkillTargetResponse,
    LeaveRequestCreate, LeaveRequestResponse, LeaveRequestUpdateStatus,
    TimesheetRowSchema, TimesheetSaveRequest, TimesheetResponse,
    AssetUpdate, CustomResumeRequest,
)
from backend.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin
)

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


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

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


def _auto_generate_attendance(employee_id: str, schedule: EmployeeSchedule, db: Session):
    """
    Auto-generate the last 30 days of attendance if records are missing.
    This is a placeholder/seed logic — a real system will populate from an external source.
    Status logic:
      - Weekends: skipped entirely (no record)
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

        if day_status == "Off":
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Auth Endpoints
# ─────────────────────────────────────────────

@app.post("/api/auth/login", response_model=Token)
def login(login_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    username = login_data.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
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

    employee.name = data.name.strip()
    if data.email:
        employee.email = data.email.strip()
    employee.primary_skill = data.primary_skill.strip() if data.primary_skill else None
    employee.primary_rating = data.primary_rating
    employee.secondary_skill = data.secondary_skill.strip() if data.secondary_skill else None
    employee.secondary_rating = data.secondary_rating
    employee.third_skill = data.third_skill.strip() if data.third_skill else None
    employee.third_rating = data.third_rating
    employee.previous_exp = data.previous_exp.strip() if data.previous_exp else None
    employee.arohak_exp = data.arohak_exp.strip() if data.arohak_exp else None
    employee.certifications = data.certifications.strip() if data.certifications else None
    employee.cert_start_date = data.cert_start_date
    employee.cert_end_date = data.cert_end_date
    employee.expiry_date = data.expiry_date
    employee.project_name = data.project_name.strip() if data.project_name else None
    employee.project_assignment_date = data.project_assignment_date
    employee.work_exp_skills_rating = data.work_exp_skills_rating

    ratings = [data.primary_rating, data.secondary_rating, data.third_rating, data.work_exp_skills_rating]
    non_zero = [r for r in ratings if r and r > 0]
    employee.overall_rating = round(sum(non_zero) / len(non_zero), 2) if non_zero else 0.0
    employee.last_updated = datetime.datetime.utcnow()

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

def _get_timesheet_data(employee_id: str, week_start_str: str, db: Session) -> dict:
    rows = db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee_id,
        TimesheetRow.week_start == week_start_str
    ).all()
    
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
        attendance_status[day_name] = att_map.get(d_str, "P") # default to P
        
    return {
        "week_start": week_start_str,
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
        
    # Calculate weekly total minutes across all rows
    total_minutes = 0
    for r in data.rows:
        total_minutes += (r.monday or 0) + (r.tuesday or 0) + (r.wednesday or 0) + (r.thursday or 0) + (r.friday or 0)
        
    if total_minutes > 2700:  # 45 hours * 60 minutes
        raise HTTPException(status_code=400, detail="Total weekly hours cannot exceed 45:00.")
        
    # Fetch weekly attendance to check non-working days
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
    
    # Process rows: update or insert
    db_rows = db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee.employee_id,
        TimesheetRow.week_start == data.week_start
    ).all()
    db_rows_map = { r.id: r for r in db_rows }
    
    for row_schema in data.rows:
        # Force 0 hours for non-working days (Absent, Leave, Holiday)
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
            
    # Delete removed rows
    for db_row in db_rows_map.values():
        db.delete(db_row)
        
    db.commit()
    
    return _get_timesheet_data(employee.employee_id, data.week_start, db)


@app.post("/api/timesheet/me/copy-previous", response_model=TimesheetResponse)
def copy_previous_week_timesheet(
    week_start: str,  # target week
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Admin accounts do not have personal timesheets.")
    employee = db.query(Employee).filter(Employee.username == current_user.username).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
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
        
    # Clear target week rows
    db.query(TimesheetRow).filter(
        TimesheetRow.employee_id == employee.employee_id,
        TimesheetRow.week_start == week_start
    ).delete()
    
    # Copy structure with 0 hours
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


# ─────────────────────────────────────────────
# Admin – list all employees' attendance (overview)
# ─────────────────────────────────────────────

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
        elif on_leave:
            status = "L"
        else:
            # If no record and today is a weekday, check schedule
            if weekday_num < 5:
                day_attr = day_map.get(weekday_num, "monday")
                day_status = getattr(sched, day_attr, "Working")
                if day_status == "Off":
                    status = "H"
                else:
                    status = "—"
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
# Static Files & SPA Fallback
# ─────────────────────────────────────────────

frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

if os.path.exists(frontend_path):
    css_path = os.path.join(frontend_path, "css")
    if os.path.exists(css_path):
        app.mount("/css", StaticFiles(directory=css_path), name="css")

    js_path = os.path.join(frontend_path, "js")
    if os.path.exists(js_path):
        app.mount("/js", StaticFiles(directory=js_path), name="js")

    @app.get("/logo.png")
    def get_logo():
        return FileResponse(os.path.join(frontend_path, "logo.png"))

    @app.get("/")
    def read_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    @app.get("/")
    def read_index():
        return {"detail": "Frontend folder not found. Running API-only server."}
