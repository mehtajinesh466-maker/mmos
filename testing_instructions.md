# Master Moves OS — Portal-by-Portal Testing & Verification Guide

This document is organized by user role/portal. To verify a feature, log in with the corresponding credentials and follow the verification steps.

---

## 1. Owner Portal (`owner@mastermoves.com` / `mastermoves@$`)

The Owner has global administrative and financial privileges. Use this portal to monitor academy health, audit systems, run manual syncs, and check detailed raw registers.

### A. Dashboard & Metrics (`/analytics`)
* **Description**: Visualizes enrollment ratios, centers, revenue performance, and student statuses.
* **Testing Steps**:
  1. Click the **Centre Focus** selector buttons (Bay Avenue, JLT, All Centres) at the bottom left.
  2. Go to the **Report Builder** tab, select parameters, and generate a report.
* **How to Verify**:
  - Check that the metrics boxes (Active Students, Monthly Revenue, etc.) update dynamically when switching centers.
  - Verify that the charts (line graphs/pie charts) populate and reflect active database records.

### B. Executive Finance Console (`/executive`)
* **Description**: Core business-level monitoring, highlighting recurring revenues and outstanding/unbilled metrics.
* **Testing Steps**:
  1. Navigate to `/executive`.
  2. Check the active package valuation summaries.
* **How to Verify**:
  - Cross-verify these numbers against the totals in `/payment-unbilled` (they must match).
  - Try logging in with a coach account and manually typing `/executive` in the browser URL. You must be automatically redirected back to your coach home (`/schedule`) due to middleware enforcement.

### C. Explorer Database View (`/explorer`)
* **Description**: A direct, visual database query tool for technical troubleshooting.
* **Testing Steps**:
  1. Navigate to `/explorer`.
  2. Select a database table from the dropdown (e.g., `students`, `packages`, `invoices`).
  3. Apply custom query filters.
* **How to Verify**:
  - Verify the table displays matching database records instantly.
  - Check that query filters correctly isolate matching rows.

### D. Audit Log & Backups (`/audit`)
* **Description**: Tracks all actions (updates, creates, deletes) done on the platform with "before" and "after" state snapshots.
* **Testing Steps**:
  1. Go to any input screen (like CRM or Registration) and modify a record.
  2. Navigate back to `/audit` as Owner.
* **How to Verify**:
  - Ensure a new entry appears at the top of the audit log detailing your name, action, and the exact state changes.
  - Verify the **Database Backup** button generates a downloadable JSON dump of the state.

---

## 2. Front Desk Portal (`sara@mastermoves.com` / `mastermoves@front@123`)

The Front Desk operates the day-to-day administration for a specific center (seeded for *Bay Avenue*). They handle sales, CRM intakes, student onboarding, and billing resolution.

### A. CRM & Enquiry Intake (`/crm`)
* **Description**: Capture prospective student enquiries and move them through the sales pipeline.
* **Testing Steps**:
  1. Click **Add Enquiry** and submit mock parent/child details.
  2. Drag and drop the enquiry card (or use the dropdown) to progress it from `New` -> `Contacted` -> `Trial Booked` -> `Trial Done` -> `Converted`.
* **How to Verify**:
  - Once marked `Converted`, verify that a prompt appears allowing you to register the lead as an official student, pre-filling their CRM information.

### B. Student Onboarding (`/registration`)
* **Description**: Registers a new student and handles family associations (e.g. sibling linking).
* **Testing Steps**:
  1. Fill in the student name, primary center, and level.
  2. Under the **Sibling Linking** section, search for an existing parent's name/email. Select and link them.
  3. Submit the registration.
* **How to Verify**:
  - Navigate to `/students` (Student Register) and search for the student.
  - Open their profile drawer and verify that they share the exact `family_id` (indicated by listed siblings) with the existing student.

### C. Package Purchase & Activation (`/packages`)
* **Description**: Sells study credits/packages to registered students.
* **Testing Steps**:
  1. Choose a student and select a pricing Tier (e.g., "1 session/week").
  2. Select package type (**New** or **Renewal**), input discount percent (if any), and save.
* **How to Verify**:
  - Under `/package-register`, locate the student and verify the package details.
  - Under `/payment-unbilled`, verify that an **unpaid Invoice** is automatically created with the correct pricing and tax details.

### D. Billing, Invoices & Unbilled Resolution (`/payment-unbilled`)
* **Description**: Tracks student payments and resolves unbilled sessions (where a student attended classes with 0 remaining credits).
* **Testing Steps**:
  1. On the **Invoices** tab, select an unpaid invoice and click **Mark Paid**. Fill in the payment mode and reference.
  2. On the **Unbilled Attendance** tab, look for students with negative classes. Renew their package.
* **How to Verify**:
  - Once marked paid, the invoice status changes to `paid` and the audit log records the transaction.
  - Resolving unbilled sessions must automatically deduct those negative classes from the new package credits.

---

## 3. Coach Portal (`ryancardelang@mastermoves.com` / `mastermoves@coach$`)

Coaches manage class scheduling, log student attendance, and record skill/performance progress.

### A. Weekly Schedules & Calendars (`/schedule`)
* **Description**: Displays the coach's scheduled group/individual classes.
* **Testing Steps**:
  1. View the calendar. Verify it shows only your assigned classes/days.
* **How to Verify**:
  - Click on a class slot to see the roster of enrolled students.

### B. Attendance Entry (`/attendance`)
* **Description**: The primary check-in interface. Decrements student package credits.
* **Testing Steps**:
  1. Select your active slot.
  2. Mark students as **Present**, **Absent**, or **Makeup**. Enter lesson topic/notes.
  3. Click **Submit Attendance**.
* **How to Verify**:
  - **Crucial Invariant Check**: Go to the Student Dashboard or Student Register for that student. Their package `classes_remaining` must have decreased by the class duration (e.g., 2 hours). Their profile `last_attended` date must update to today.

### C. Progress Log (`/progress`)
* **Description**: Evaluates student skill levels (Openings, Tactics, Endgames, Strategy, Focus) and leaves performance notes.
* **Testing Steps**:
  1. Select a student and adjust the 1-5 rating sliders for each skill.
  2. Add evaluation comments and save.
* **How to Verify**:
  - Verify that a record appears in the history at the bottom of the page.
  - Check the Parent Portal / Student Dashboard to confirm the evaluation reflects in the progress chart.

---

## 4. Parent Portal (`mehtajinesh977@gmail.com` / `password123`)

Parents have read-only access to monitor their children's progress, attendance patterns, and package renewals.

### A. Student Overview (`/student-dashboard`)
* **Description**: Shows active package credits, overall attendance stats, and latest coach remarks.
* **Testing Steps**:
  1. Navigate to the dashboard.
* **How to Verify**:
  - Check that the active package shows the accurate number of remaining classes.
  - Ensure the **Classes Remaining** box highlights yellow/red if credits are low (under 3 remaining).

### B. Progress Reports (`/progress-report`)
* **Description**: Displays performance spider charts based on coach skill logs.
* **Testing Steps**:
  1. Navigate to `/progress-report`.
* **How to Verify**:
  - Ensure the radar/bar chart renders correctly with data matching the coach's progress entries.
  - Verify historical remarks are displayed in reverse-chronological order.
