# CLAUDE.md — Master Moves OS

## Project Context
A single, cloud-based, owner-operated platform that runs a multi-centre chess academy: students, registration, packages & renewals, scheduling, attendance, learning progress, communications, payments, and analytics.

Centres: Bay Avenue, JLT, Town Square (planned).

## Roles
- `owner`: full access.
- `front_desk`: register, renew, payments, CRM, rosters for their centre. No pricing/finance settings.
- `coach`: only their classes/students; package check; daily attendance; logs progress. No finance/admin.
- `parent` (planned): read-only child info.

## Tech Stack
- Frontend: React (Vite) as a PWA.
- Backend: Supabase (PostgreSQL + Auth + Edge functions).
- Styling: Vanilla CSS.

## The Invariant Rule
Attendance writes to packages. Marking Present decrements remaining classes, updates last_attended, and clears inactivity flag atomically via database triggers. Never write package counts from the UI.

## Build Commands
- Run dev server: `npm run dev`
- Run production build: `npm run build`
- Preview build: `npm run preview`
- Lint check: `npm run lint`
