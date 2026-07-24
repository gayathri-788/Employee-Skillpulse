# Arohak SkillPulse - Employee Skills & Details Portal

Arohak SkillPulse is a premium, secure, and responsive web application designed for managing employee profiles, technical skillsets, certifications, and project allocations. 

The portal features role-based access control (RBAC), a real-time rating visualizer, automated scoring rules with a gentler 1% per week decay after 6 months of inactivity, and search directories for both employees and administrators.

---

## 🛠️ Technology Stack
- **Backend**: FastAPI (Python)
- **Database**: SQLite3 with SQLAlchemy ORM
- **Frontend**: Single Page Application (SPA) built with Vanilla HTML5, custom CSS (featuring dark/light themes), and Vanilla ES6 JavaScript
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
│   └── config.py          # Application configuration settings
│
├── frontend/
│   ├── index.html         # Single Page Application HTML shell
│   ├── css/
│   │   └── styles.css     # UI themes (light/dark) and responsive layout rules
│   └── js/
│       └── app.js         # Frontend controller, API fetcher, and score animations
│
├── .gitignore             # Configured to ignore virtual environments, databases, and caches
├── database.db            # Generated SQLite database file (created by seed.py)
├── Emp Details.xlsx       # Source Excel sheet for seeding profiles
└── requirements.txt       # Python package dependencies
```

---

## 🚀 Setup & Execution Guide

Follow these steps to set up and run the application locally:

### 1. Create a Virtual Environment (`venv`)

Navigate to the project root directory in your terminal and create a virtual environment:

* **Windows**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\activate
  ```

* **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 2. Install Dependencies

Install the required Python packages into your activated virtual environment:
```bash
pip install -r requirements.txt
```

### 3. Initialize and Seed the Database

Seed the SQLite database using the spreadsheet data from `Emp Details.xlsx`:
```bash
python backend/seed.py
```
*Note: This creates/overwrites `database.db` and populates it with user accounts (password: `Password@123` by default) and an administrator account.*

### 4. Run the Backend Server

Start the development server with hot-reloading using `uvicorn`:
```bash
python -m uvicorn backend.main:app --reload
```

The application will be served at **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**.

---

## 🔑 Login Accounts

- **Employee Account**:
  - **Username**: Employee ID (e.g., `at0123`, case-insensitive)
  - **Password**: `Password@123`
- **Admin Account**:
  - **Username**: `admin`
  - **Password**: `adminpassword123`
