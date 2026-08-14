# Graph Report - Employee-Skillpulse  (2026-08-13)

## Corpus Check
- 58 files · ~56,819 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 382 nodes · 1166 edges · 16 communities detected
- Extraction: 47% EXTRACTED · 53% INFERRED · 0% AMBIGUOUS · INFERRED: 616 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `showToast()` - 54 edges
2. `apiFetch()` - 35 edges
3. `Return existing schedule or create a default Mon-Fri Working one.` - 35 edges
4. `Auto-generate the last 30 days of attendance if records are missing.     Status` - 35 edges
5. `Sync timesheet with attendance updates.     If the status is "Ab", "L", or "H" (` - 35 edges
6. `Admin-only: create or update a single day's attendance record.` - 35 edges
7. `Returns True if the timesheet week belongs to a past calendar month (month has e` - 35 edges
8. `Returns all Arohak Client Accounts with sub-projects, project managers, team lea` - 35 edges
9. `Returns today's attendance snapshot for all employees.` - 35 edges
10. `Background check that runs daily to send automated email updates.` - 35 edges

## Surprising Connections (you probably didn't know these)
- `showToast()` --calls--> `toggleNotifications()`  [INFERRED]
  frontend/js/app.js → frontend-next/src/app/(app)/settings/page.tsx
- `showToast()` --calls--> `handlePasswordChange()`  [INFERRED]
  frontend/js/app.js → frontend-next/src/app/(app)/settings/page.tsx
- `showToast()` --calls--> `handleSave()`  [INFERRED]
  frontend/js/app.js → frontend-next/src/app/(app)/schedule/page.tsx
- `showToast()` --calls--> `handleSubmit()`  [INFERRED]
  frontend/js/app.js → frontend-next/src/app/(app)/skilltargets/page.tsx
- `showToast()` --calls--> `handleDelete()`  [INFERRED]
  frontend/js/app.js → frontend-next/src/app/(app)/skilltargets/page.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (83): handleSendReminders(), handleRevoke(), addTimesheetRow(), animateScoreCircle(), apiFetch(), calculateTimesheetTotals(), checkSixMonthsUpdate(), clearUserSessionState() (+75 more)

### Community 1 - "Community 1"
Cohesion: 0.32
Nodes (61): Returns True if the timesheet week belongs to a past calendar month (month has e, Returns True if the timesheet week belongs to a past calendar month (month has e, Returns all Arohak Client Accounts with sub-projects, project managers, team lea, Returns all Arohak Client Accounts with sub-projects, project managers, team lea, Returns today's attendance snapshot for all employees., Returns today's attendance snapshot for all employees., Background check that runs daily to send automated email updates., Background check that runs daily to send automated email updates. (+53 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (42): Sends a profile update reminder email to an employee.     If SMTP_SERVER is not, send_profile_update_email(), admin_attendance_overview(), _auto_generate_attendance(), calculate_current_score(), check_and_send_scheduled_reminders(), compute_employee_experience(), copy_previous_week_timesheet() (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (10): RootPage(), CertSkillsPage(), ResumePreviewModal(), AuthProvider(), useAuth(), useToast(), useApiData(), LoginPage() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (11): handleDownloadUploaded(), handleClear(), handleExport(), runSearch(), downloadFile(), formFromProfile(), handleAvatarFileChange(), handleResumeDelete() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (11): currentWeekMonday(), formatMinutes(), isLeaveTaskOption(), mondayOf(), dayCellMode(), emptyRow(), handleCopyPrevious(), handleRelease() (+3 more)

### Community 6 - "Community 6"
Cohesion: 0.19
Nodes (8): create_access_token(), get_password_hash(), verify_password(), change_password(), login(), clean_float(), clean_val(), seed_db()

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (6): formatShiftSummary(), normalizeShiftValue(), parseShiftData(), editStateFromSchedule(), handleSave(), startEdit()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (4): applyTheme(), chooseTheme(), handlePasswordChange(), toggleNotifications()

### Community 9 - "Community 9"
Cohesion: 0.38
Nodes (4): formatDecimalYears(), monthsToString(), parseExpToMonths(), parseExpToYears()

### Community 10 - "Community 10"
Cohesion: 0.33
Nodes (2): handleDelete(), handleSubmit()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (2): StatusBadge(), statusBadgeInfo()

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (3): handleSubmit(), refreshDetail(), viewDetail()

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (1): handleSubmit()

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (1): ApiError

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (1): handleReview()

## Knowledge Gaps
- **9 isolated node(s):** `Generates a professional PDF resume using the exact single-column WPS document l`, `Weekly work schedule for an employee (Mon-Fri), tied to their project and manage`, `Daily attendance record per employee. Designed to be populated by an external sy`, `Yearly skill targets/goals set by an employee for the current year.`, `Leave requests submitted by employees.` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 10`** (6 nodes): `page.tsx`, `handleDelete()`, `handleSubmit()`, `openAdd()`, `openEdit()`, `set()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (6 nodes): `StatusBadge()`, `status-badge.tsx`, `status.ts`, `statusBadgeInfo()`, `statusClass()`, `targetStatusClass()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (4 nodes): `handleClear()`, `handleSubmit()`, `openEdit()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (4 nodes): `api.ts`, `ApiError`, `.constructor()`, `apiFetch()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (3 nodes): `page.tsx`, `attendanceColor()`, `handleReview()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `showToast()` connect `Community 0` to `Community 4`, `Community 5`, `Community 7`, `Community 8`, `Community 10`, `Community 12`, `Community 13`, `Community 16`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `handleSave()` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `handleSave()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `showToast()` (e.g. with `chooseTheme()` and `toggleNotifications()`) actually correct?**
  _`showToast()` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `Return existing schedule or create a default Mon-Fri Working one.` (e.g. with `User` and `Employee`) actually correct?**
  _`Return existing schedule or create a default Mon-Fri Working one.` has 34 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `Auto-generate the last 30 days of attendance if records are missing.     Status` (e.g. with `User` and `Employee`) actually correct?**
  _`Auto-generate the last 30 days of attendance if records are missing.     Status` has 34 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `Sync timesheet with attendance updates.     If the status is "Ab", "L", or "H" (` (e.g. with `User` and `Employee`) actually correct?**
  _`Sync timesheet with attendance updates.     If the status is "Ab", "L", or "H" (` has 34 INFERRED edges - model-reasoned connections that need verification._