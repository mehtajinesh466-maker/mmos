-- ============================================================
--  Master Moves OS — starter schema (PostgreSQL / Supabase)
--  Companion to the Developer Handover Kit v1.0
--  This is a starting point: core tables, the critical package
--  trigger, and RLS scaffolding. Extend per the Requirements Spec.
-- ============================================================

-- ---------- reference / org ----------
create table centres (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'active'
);

-- app users map to Supabase auth.users; role drives access
create table users (
  id          uuid primary key,              -- = auth.users.id
  name        text not null,
  role        text not null check (role in ('owner','front_desk','coach','parent')),
  centre_id   uuid references centres(id)
);

create table coaches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),
  centre_id   uuid references centres(id),
  title       text,                          -- e.g. WGM
  active      boolean default true
);

-- ---------- people ----------
create table families (
  id            uuid primary key default gen_random_uuid(),
  primary_name  text,
  phone         text,
  email         text,
  consent_ops   boolean default true,
  consent_mktg  boolean default false
);

create table students (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid references families(id),
  centre_id     uuid references centres(id) not null,
  coach_id      uuid references coaches(id),
  name          text not null,
  dob           date,
  gender        text,
  school        text,
  level         text check (level in ('Beginner','Intermediate','Advanced','Pro-Track')),
  status        text not null default 'active' check (status in ('active','inactive','frozen','left')),
  fide_id       text,
  photo_url     text,
  join_date     date default now(),
  last_attended date,
  pace_status   text,                        -- Ahead/On track/Slow/Stalled/New (derived)
  pace_reason   text,                        -- reason code for Slow/Stalled
  flags         jsonb default '{}'::jsonb    -- {inactive, low_package, at_risk}
);

-- ---------- membership ----------
create table tiers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- Mini / Core / Elite / Pro-Track / Private*
  price       numeric(10,2) not null,
  inclusions  jsonb default '[]'::jsonb,
  active      boolean default true
);

create table packages (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references students(id) not null,
  tier_id           uuid references tiers(id),
  kind              text default 'new' check (kind in ('new','renewal','tournament')),
  classes_total     int not null,
  classes_remaining int not null,
  discount_pct      numeric(5,2) default 0,
  frozen            boolean default false,
  start_date        date default now(),
  expiry_date       date
);

-- ---------- scheduling & attendance ----------
create table schedule_slots (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid references centres(id) not null,
  coach_id    uuid references coaches(id) not null,
  day         text not null,                 -- Mon..Sun
  time        text not null,                 -- HH:MM
  level       text not null
);

create table attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) not null,
  slot_id     uuid references schedule_slots(id),
  coach_id    uuid references coaches(id) not null,
  date        date not null default now(),
  status      text not null check (status in ('present','absent','makeup')),
  topic       text,
  note        text,
  created_at  timestamptz default now()
);

-- ---------- progress ----------
create table progress_logs (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id) not null,
  coach_id    uuid references coaches(id) not null,
  date        date default now(),
  topic       text,
  mastery     text check (mastery in ('Learning','Practising','Mastered')),
  skills      jsonb,                          -- {openings,tactics,endgames,strategy,focus}
  note        text
);

create table student_skills (
  student_id  uuid references students(id),
  skill       text,
  value       int,                            -- 0..100 (derived)
  primary key (student_id, skill)
);

create table fide_ratings (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id),
  date        date,
  rating      int
);

-- ---------- crm / reports / billing ----------
create table enquiries (
  id          uuid primary key default gen_random_uuid(),
  child       text,
  parent      text,
  phone       text,
  source      text,
  stage       text default 'new',
  centre_id   uuid references centres(id),
  trial_date  date
);

create table reports (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id),
  period      text,
  status      text default 'draft' check (status in ('draft','approved','issued')),
  pdf_url     text,
  approved_by uuid references users(id),
  created_at  timestamptz default now()
);

create table invoices (
  id            uuid primary key default gen_random_uuid(),
  package_id    uuid references packages(id),
  student_id    uuid references students(id),
  amount        numeric(10,2),
  vat           numeric(10,2),
  method        text,
  settlement_ref text,
  status        text default 'unpaid',
  created_at    timestamptz default now()
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       uuid references users(id),
  action      text,
  entity      text,
  before      jsonb,
  after       jsonb,
  at          timestamptz default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id),
  type        text,
  channel     text,
  status      text,
  sent_at     timestamptz
);

-- ============================================================
--  CRITICAL RULE: attendance (present) -> decrement package
-- ============================================================
create or replace function on_attendance_present() returns trigger as $$
begin
  if new.status = 'present' then
    update packages
       set classes_remaining = greatest(classes_remaining - 1, 0)
     where student_id = new.student_id
       and frozen = false
       and classes_remaining > 0
       and id = (
         select id from packages
          where student_id = new.student_id and frozen = false and classes_remaining > 0
          order by start_date asc limit 1
       );
    update students
       set last_attended = new.date,
           flags = flags - 'inactive'
     where id = new.student_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_attendance_present
  after insert on attendance
  for each row execute function on_attendance_present();
