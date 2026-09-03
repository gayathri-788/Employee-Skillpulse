# Arohak SkillPulse - Employee Skills & Details Portal

Arohak SkillPulse is a premium, secure, and responsive web application designed for managing employee profiles, technical skillsets, certifications, and project allocations. 

The portal features role-based access control (RBAC), a real-time rating visualizer, automated scoring rules with a gentler 1% per week decay after 6 months of inactivity, and search directories for both employees and administrators.

---

## 🛠️ Technology Stack
- **Backend**: FastAPI (Python), dependencies managed with [uv](https://docs.astral.sh/uv/)
- **Database**: SQLite3 with SQLAlchemy ORM
- **Frontend**: [Next.js](https://nextjs.org/) (App Router, TypeScript) with Framer Motion, deployed separately (e.g. Vercel) and talking to the backend over REST
- **Seeding**: Automatically processes and aggregates profile spreadsheets from `Emp Details.xlsx`

---

## 📂 Project Directory Structure

```text
Employee_details/
│
├── backend/
│   ├── main.py            # FastAPI main entrypoint & REST API endpoints
│   ├── database.py        # SQLite SQLAlchemy engine & SessionLocal configuration
│   ├── models.py          # SQLAlchemy models for User & Employee tables
│   ├── schemas.py         # Pydantic schemas for request validation & serialization
│   ├── auth.py            # JWT token creation and direct bcrypt hashing utilities
│   ├── seed.py            # Seed script parsing 'Emp Details.xlsx' to sqlite
│   ├── config.py          # Application configuration settings
│   ├── database.db        # Generated SQLite database file (created by seed.py)
│   ├── pyproject.toml     # Project metadata & dependencies (uv)
│   └── uv.lock            # Locked dependency versions (uv)
│
├── frontend/
│   ├── src/app/            # Routes (App Router) — one folder per page, (app)/ group is auth-gated
│   ├── src/components/     # Shared UI: app shell, modals, charts, calendars
│   ├── src/lib/            # API client, auth/toast/theme contexts, formatting & domain helpers
│   └── public/             # Static assets (logo, favicon)
│
├── .gitignore             # Configured to ignore virtual environments, databases, and caches
└── Emp Details.xlsx       # Source Excel sheet for seeding profiles
```

---

## 🚀 Setup & Execution Guide

Requires [uv](https://docs.astral.sh/uv/getting-started/installation/) installed. The uv project (`pyproject.toml`/`uv.lock`/`.venv`) lives in `backend/`, and every command below is run **from `backend/`** — that's where `database.db` lives (`DATABASE_URL` in `config.py` is a path relative to the process's working directory, so running from anywhere else creates/reads a different `database.db` file).

### 1. Install Dependencies

```bash
cd backend
uv sync
```

### 2. Initialize and Seed the Database

Seed the SQLite database using the spreadsheet data from `../Emp Details.xlsx`:
```bash
uv run python seed.py
```
*Note: This creates/overwrites `backend/database.db` and populates it with user accounts (password: `Password@123` by default) and an administrator account.*

### 3. Run the Backend Server

Start the development server with hot-reloading using `uvicorn`:
```bash
uv run uvicorn main:app --reload
```

The API will be served at **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)** (interactive docs at `/docs`).

### 4. Run the Frontend

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```

The portal will be served at **[http://localhost:3000/](http://localhost:3000/)**. It reads the backend URL from `NEXT_PUBLIC_API_BASE_URL` (see `frontend/.env.local`, defaults to `http://127.0.0.1:8000` for local dev — see `.env.example` for the production equivalent).

---

## 🔑 Login Accounts

- **Employee Account**:
  - **Username**: Employee ID (e.g., `at0123`, case-insensitive)
  - **Password**: `Password@123`
- **Admin Account**:
  - **Username**: `admin`
  - **Password**: `adminpassword123`
