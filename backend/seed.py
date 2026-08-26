import os
import re
import sys
import random
import pandas as pd
from datetime import datetime, date, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from database import engine, Base, SessionLocal
    from models import User, Employee, EmployeeSchedule, Attendance, SkillTarget, LeaveRequest
    from auth import get_password_hash
    from config import DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, DEFAULT_EMPLOYEE_PASSWORD
except ModuleNotFoundError:
    from backend.database import engine, Base, SessionLocal
    from backend.models import User, Employee, EmployeeSchedule, Attendance, SkillTarget, LeaveRequest
    from backend.auth import get_password_hash
    from backend.config import DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, DEFAULT_EMPLOYEE_PASSWORD



def clean_val(val):
    if pd.isna(val) or val is None:
        return None
    val_str = str(val).strip()
    if val_str == '_' or val_str.lower() == 'nan' or val_str == '':
        return None
    return val_str


def clean_float(val, default=0.0):
    if pd.isna(val) or val is None:
        return default
    try:
        return float(val)
    except ValueError:
        return default


def parse_excel_date(val):
    if val is None or pd.isna(val):
        return None
    try:
        if isinstance(val, datetime):
            return val.strftime('%Y-%m-%d')
        return pd.to_datetime(val).strftime('%Y-%m-%d')
    except Exception:
        return str(val).strip()


SAMPLE_MANAGERS = [
    "Priya Mehta", "Rajan Nair", "Anand Krishnan",
    "Sunita Sharma", "Deepak Patel", "Lakshmi Iyer",
]

SAMPLE_SHIFTS = [
    "Day Shift (9 AM - 6 PM)",
    "Night Shift (10 PM - 7 AM)",
    "Rotational Shift",
]

SAMPLE_TARGETS = [
    ("AWS Solutions Architect", "Achieve cloud certification", "Intermediate"),
    ("Kubernetes", "Learn container orchestration", "Beginner"),
    ("React", "Build modern UIs with React", "Intermediate"),
    ("Python Advanced", "Master async, typing, and testing", "Expert"),
    ("Azure DevOps", "CI/CD pipeline expertise", "Intermediate"),
    ("Machine Learning Basics", "Understand ML fundamentals", "Beginner"),
    ("Java Spring Boot", "Build microservices with Spring", "Intermediate"),
    ("Cybersecurity Fundamentals", "ITIL/Security awareness", "Beginner"),
]


SAMPLE_LAPTOPS = [
    "Dell Latitude 5420",
    "Lenovo ThinkPad T14",
    "HP EliteBook 840",
    "MacBook Pro 14\"",
    "ASUS ExpertBook B5"
]


def seed_db():
    print("Recreating database tables…")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Admin user ──────────────────────────────────────────────
        print("Creating admin user…")
        admin_user = User(
            username=DEFAULT_ADMIN_USERNAME,
            hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin_user)

        # ── Read employee data (xlsx or csv) ───────────────────────────
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        candidate_names = ["emp data.csv", "emp data.xlsx", "Emp Details.xlsx"]
        data_path = None
        for name in candidate_names:
            for candidate in (name, os.path.join(repo_root, name)):
                if os.path.exists(candidate):
                    data_path = candidate
                    break
            if data_path:
                break

        if not data_path:
            print(f"No employee data file found (looked for: {', '.join(candidate_names)})")
            db.commit()
            return

        print(f"Reading employee data file: {data_path}")
        df = pd.read_csv(data_path) if data_path.lower().endswith(".csv") else pd.read_excel(data_path)
        df.columns = [re.sub(r'\s+', ' ', str(c)).strip() for c in df.columns]

        seen_usernames = {DEFAULT_ADMIN_USERNAME.lower()}
        employees_dict = {}
        employee_count = 0
        today = date.today()
        current_year = today.year
        day_map = {0: "monday", 1: "tuesday", 2: "wednesday", 3: "thursday", 4: "friday"}

        for index, row in df.iterrows():
            emp_id = clean_val(row.get('Emp ID'))
            emp_name = clean_val(row.get('Emp Name'))
            if not emp_id or not emp_name:
                continue

            username = emp_id.strip().lower()

            if username not in seen_usernames:
                user = User(
                    username=username,
                    hashed_password=get_password_hash(DEFAULT_EMPLOYEE_PASSWORD),
                    role="employee",
                )
                db.add(user)
                seen_usernames.add(username)

            proj_date_str = parse_excel_date(row.get('Date of Project Assignment') if row.get('Date of Project Assignment') is not None else row.get('Start Date'))
            proj_end_str = parse_excel_date(row.get('End Date'))

            client = clean_val(row.get('Client'))
            proj_name = clean_val(row.get('Project Name'))
            if client and proj_name and not proj_name.lower().startswith(client.lower()):
                proj_name = f"{client} - {proj_name}"
            else:
                proj_name = proj_name or client
            cert = clean_val(row.get('Certification'))
            cert_year = clean_val(row.get('Year of Completion'))

            if emp_id in employees_dict:
                emp = employees_dict[emp_id]
                if proj_name and proj_name not in (emp.project_name or ""):
                    emp.project_name = f"{emp.project_name}, {proj_name}" if emp.project_name else proj_name
                if cert and cert not in (emp.certifications or ""):
                    emp.certifications = f"{emp.certifications}, {cert}" if emp.certifications else cert
                    if cert_year and cert_year not in (emp.cert_start_date or ""):
                        emp.cert_start_date = f"{emp.cert_start_date}, {cert_year}" if emp.cert_start_date else cert_year
            else:
                r1 = clean_float(row.get('Rating (1-5)'))
                r2 = clean_float(row.get('Rating (1-5).1'))
                r3 = clean_float(row.get('Rating (1-5).2'))
                w_exp_rating = 4.0
                ratings = [r1, r2, r3, w_exp_rating]
                non_zero_ratings = [r for r in ratings if r > 0]
                overall_rating = sum(non_zero_ratings) / len(non_zero_ratings) if non_zero_ratings else 4.0

                has_lap = "Yes" if random.random() < 0.7 else "No"
                lap_details = random.choice(SAMPLE_LAPTOPS) if has_lap == "Yes" else None
                has_head = "Yes" if random.random() < 0.6 else "No"

                emp = Employee(
                    employee_id=emp_id,
                    username=username,
                    name=emp_name,
                    email=f"{username}@arohak.com",
                    primary_skill=clean_val(row.get('Primary Skill')),
                    primary_rating=r1,
                    secondary_skill=clean_val(row.get('Secondary SkillSet')),
                    secondary_rating=r2,
                    third_skill=clean_val(row.get('Third Skillset')),
                    third_rating=r3,
                    previous_exp=clean_val(row.get('Previous Experience')),
                    arohak_exp=clean_val(row.get('Arohak Experience')),
                    certifications=cert,
                    cert_start_date=cert_year,
                    cert_end_date=None,
                    expiry_date=None,
                    project_name=proj_name,
                    project_assignment_date=proj_date_str,
                    project_end_date=proj_end_str,
                    has_laptop=has_lap,
                    laptop_details=lap_details,
                    has_headset=has_head,
                    work_exp_skills_rating=w_exp_rating,
                    overall_rating=round(overall_rating, 2),
                    score=100,
                    last_skill_update=datetime.utcnow(),
                    last_updated=datetime.utcnow(),
                )
                employees_dict[emp_id] = emp
                db.add(emp)
                employee_count += 1

        # Flush to get employee PKs before adding related records
        db.flush()

        # ── Seed schedules, attendance, and skill targets ────────────
        for emp_id, emp in employees_dict.items():
            manager = random.choice(SAMPLE_MANAGERS)
            shift = random.choice(SAMPLE_SHIFTS)
            # Randomly give ~20% of employees a Friday off
            friday_status = "Off" if random.random() < 0.2 else "Working"
            
            sched = EmployeeSchedule(
                employee_id=emp_id,
                manager_name=manager,
                monday="Working",
                tuesday="Working",
                wednesday="Working",
                thursday="Working",
                friday=friday_status,
                shift=shift,
                monday_tasks="Analyze project requirements and structure task board.",
                tuesday_tasks="Implement database schema migration and write model tests.",
                wednesday_tasks="Develop REST API endpoints and integrate auth validators.",
                thursday_tasks="Deploy to staging workspace and run manual verification.",
                friday_tasks="Prepare weekly status reports and fill timesheets.",
                notes=f"Schedule managed by {manager}",
            )
            db.add(sched)

            # 30 days of attendance
            for delta in range(30, -1, -1):  # Seed up to today (delta=0)
                att_date = today - timedelta(days=delta)
                weekday = att_date.weekday()
                if weekday >= 5:  # skip weekends
                    continue
                day_attr = day_map.get(weekday, "monday")
                day_status = getattr(sched, day_attr, "Working")
                if day_status == "Off":
                    att_status = "H"
                else:
                    roll = random.random()
                    if roll < 0.55:
                        att_status = "P"     # Present In-Office
                    elif roll < 0.85:
                        att_status = "WFH"   # Working from Home
                    elif roll < 0.93:
                        att_status = "L"     # Leave
                    else:
                        att_status = "Ab"    # Absent
                db.add(Attendance(
                    employee_id=emp_id,
                    date=att_date.strftime("%Y-%m-%d"),
                    status=att_status,
                    source="auto",
                ))

            # 1-3 yearly skill targets for the current year
            num_targets = random.randint(1, 3)
            chosen_targets = random.sample(SAMPLE_TARGETS, min(num_targets, len(SAMPLE_TARGETS)))
            statuses = ["Planned", "In Progress", "Completed"]
            for skill_name, desc, level in chosen_targets:
                db.add(SkillTarget(
                    employee_id=emp_id,
                    year=current_year,
                    skill_name=skill_name,
                    description=desc,
                    target_level=level,
                    status=random.choice(statuses),
                    target_completion_date=f"{current_year}-12-31",
                ))

        # Seed sample leave requests
        print("Creating sample leave requests…")
        sample_emp_ids = list(employees_dict.keys())
        for i in range(min(5, len(sample_emp_ids))):
            emp_id = sample_emp_ids[i]
            # Create a leave request
            db.add(LeaveRequest(
                employee_id=emp_id,
                start_date=(today + timedelta(days=2)).strftime("%Y-%m-%d"),
                end_date=(today + timedelta(days=4)).strftime("%Y-%m-%d"),
                reason="Personal emergency / out of town" if i % 2 == 0 else "Annual medical checkout",
                status="Pending" if i % 2 == 0 else "Approved",
            ))

        db.commit()
        print(f"Successfully seeded {employee_count} employees with schedules, attendance, and skill targets.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
