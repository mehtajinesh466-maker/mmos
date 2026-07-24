// Master Moves OS (MMOS) — Local Storage Database Engine
// Simulates PostgreSQL, Supabase, DB Triggers, and Offline Queueing

import { saveStudentDB, saveProgressLogDB, syncOfflineQueueDB } from '../app/actions';

export interface Centre {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface User {
  id: string;
  name: string;
  role: 'owner' | 'front_desk' | 'coach' | 'parent';
  centre_id?: string;
}

export interface Coach {
  id: string;
  user_id: string;
  centre_id: string;
  title?: string;
  active: boolean;
  name: string; // denormalized for easy rendering
}

export interface Student {
  id: string;
  family_id: string;
  centre_id: string;
  coach_id: string | null;
  name: string;
  dob: string;
  gender: string;
  school: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro-Track';
  status: 'active' | 'inactive' | 'frozen' | 'left';
  fide_id?: string;
  photo_url?: string;
  join_date: string;
  last_attended: string | null;
  pace_status: 'Ahead' | 'On track' | 'Slow' | 'Stalled' | 'New';
  pace_reason: string | null;
  flags: {
    inactive?: boolean;
    low_package?: boolean;
    at_risk?: boolean;
    slow_progress?: boolean;
  };
}

export interface Tier {
  id: string;
  name: string;
  price: number;
  inclusions: string[];
  active: boolean;
}

export interface Package {
  id: string;
  student_id: string;
  tier_id: string;
  kind: 'new' | 'renewal' | 'tournament';
  classes_total: number;
  classes_remaining: number;
  discount_pct: number;
  frozen: boolean;
  start_date: string;
  expiry_date?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  slot_id: string;
  enrolled_at?: string;
}

export interface ScheduleSlot {
  id: string;
  centre_id: string;
  coach_id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  time: string; // HH:MM
  level: string;
  capacity?: number;
}

export interface Attendance {
  id: string;
  student_id: string;
  slot_id: string | null;
  coach_id: string;
  date: string;
  status: 'present' | 'absent' | 'makeup';
  topic?: string;
  note?: string;
  created_at: string;
  synced?: boolean; // PWA queue marker
}

export interface ProgressLog {
  id: string;
  student_id: string;
  coach_id: string;
  date: string;
  topic: string;
  mastery: 'Learning' | 'Practising' | 'Mastered';
  skills: {
    openings: number;
    tactics: number;
    endgames: number;
    strategy: number;
    focus: number;
  };
  note?: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  before: any;
  after: any;
  at: string;
}

export interface Enquiry {
  id: string;
  child: string;
  age?: string;
  parent: string;
  phone: string;
  source: string;
  stage: 'new' | 'contacted' | 'trial_booked' | 'trial_done' | 'converted' | 'lost';
  centre_id: string;
  experience?: string;
  trial_date?: string;
  coach_id?: string;
  notes?: string;
  created_at?: string;
}

// Helper to initialize local storage
function initStorage() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem('mmos_initialized')) {
    localStorage.setItem('mmos_centres', JSON.stringify([]));
    localStorage.setItem('mmos_users', JSON.stringify([]));
    localStorage.setItem('mmos_coaches', JSON.stringify([]));
    localStorage.setItem('mmos_tiers', JSON.stringify([]));
    localStorage.setItem('mmos_students', JSON.stringify([]));
    localStorage.setItem('mmos_packages', JSON.stringify([]));
    localStorage.setItem('mmos_schedule_slots', JSON.stringify([]));
    localStorage.setItem('mmos_attendance', JSON.stringify([]));
    localStorage.setItem('mmos_progress_logs', JSON.stringify([]));
    localStorage.setItem('mmos_audit_log', JSON.stringify([]));
    localStorage.setItem('mmos_enquiries', JSON.stringify([]));
    localStorage.setItem('mmos_invoices', JSON.stringify([]));
    localStorage.setItem('mmos_offline_queue', JSON.stringify([]));
    localStorage.setItem('mmos_notifications', JSON.stringify([]));
    localStorage.setItem('mmos_initialized', 'true');
  }
}

initStorage();

// Database Query APIs wrapper
export const db = {
  syncFromNeon(data: any) {
    if (data.centres) this.save('centres', data.centres);
    if (data.users) this.save('users', data.users);
    if (data.coaches) this.save('coaches', data.coaches);
    if (data.tiers) this.save('tiers', data.tiers);
    if (data.students) this.save('students', data.students);
    if (data.packages) this.save('packages', data.packages);
    if (data.scheduleSlots) this.save('schedule_slots', data.scheduleSlots);
    if (data.attendance) this.save('attendance', data.attendance);
    if (data.invoices) this.save('invoices', data.invoices);
    if (data.progressLogs) this.save('progress_logs', data.progressLogs);
    if (data.enquiries) this.save('enquiries', data.enquiries);
    if (data.enrollments) this.save('enrollments', data.enrollments);
    if (data.notifications) this.save('notifications', data.notifications);
    window.dispatchEvent(new Event('db-synced'));
  },
  // Helper loaders & savers
  get<T>(table: string): T[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(`mmos_${table}`) || '[]');
  },

  save<T>(table: string, data: T[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`mmos_${table}`, JSON.stringify(data));
  },

  // Auth & Roles Mock state
  getCurrentUser(): User {
    if (typeof window === 'undefined') return { id: '', name: 'Loading', role: 'owner' };
    const activeUserId = localStorage.getItem('mmos_active_user_id') || 'u-1'; // Default to Amit (Owner)
    const users = this.get<User>('users');
    return users.find(u => u.id === activeUserId) || users[0];
  },

  setCurrentUser(userId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('mmos_active_user_id', userId);
    window.dispatchEvent(new Event('auth-change'));
  },

  // centres
  getCentres(): Centre[] {
    return this.get<Centre>('centres');
  },

  // Users & Coaches
  getUsers(): User[] {
    return this.get<User>('users');
  },

  getCoaches(): Coach[] {
    return this.get<Coach>('coaches');
  },

  // Students & Families
  getStudents(): Student[] {
    return this.get<Student>('students');
  },

  saveStudent(student: Student): void {
    const students = this.getStudents();
    const index = students.findIndex(s => s.id === student.id);
    const before = index !== -1 ? students[index] : null;

    if (index !== -1) {
      students[index] = student;
    } else {
      students.push(student);
    }
    this.save('students', students);
    
    // Fire and forget to server
    if (this.isOnline()) {
      saveStudentDB(student).catch(e => console.error('Failed to sync student:', e));
    }
    
    this.logAudit('save_student', 'students', before, student);
  },

  // Packages & Tiers
  getPackages(): Package[] {
    return this.get<Package>('packages');
  },

  getTiers(): Tier[] {
    return this.get<Tier>('tiers');
  },

  // Schedule Slots & Enrollments
  getScheduleSlots(): ScheduleSlot[] {
    return this.get<ScheduleSlot>('schedule_slots');
  },

  getEnrollments(): Enrollment[] {
    return this.get<Enrollment>('enrollments');
  },

  saveEnrollment(enr: Enrollment): void {
    const enrollments = this.getEnrollments();
    const existingIndex = enrollments.findIndex(e => e.id === enr.id || (e.student_id === enr.student_id && e.slot_id === enr.slot_id));
    if (existingIndex !== -1) {
      enrollments[existingIndex] = enr;
    } else {
      enrollments.push(enr);
    }
    this.save('enrollments', enrollments);
    window.dispatchEvent(new Event('db-synced'));
  },

  removeEnrollment(studentId: string, slotId: string): void {
    const enrollments = this.getEnrollments().filter(e => !(e.student_id === studentId && e.slot_id === slotId));
    this.save('enrollments', enrollments);
    window.dispatchEvent(new Event('db-synced'));
  },

  // Attendance
  getAttendance(): Attendance[] {
    return this.get<Attendance>('attendance');
  },

  // Enquiries
  getEnquiries(): Enquiry[] {
    return this.get<Enquiry>('enquiries');
  },

  getNotifications(): any[] {
    return this.get<any>('notifications');
  },

  saveEnquiry(enq: Enquiry): void {
    const enqs = this.getEnquiries();
    enqs.unshift(enq);
    this.save('enquiries', enqs);
    this.logAudit('create_enquiry', 'enquiries', null, enq);
    window.dispatchEvent(new Event('db-synced'));
  },

  // Progress Logs
  getProgressLogs(): ProgressLog[] {
    return this.get<ProgressLog>('progress_logs');
  },

  saveProgressLog(log: ProgressLog): void {
    const logs = this.getProgressLogs();
    logs.push(log);
    this.save('progress_logs', logs);
    
    // Update student skills profile
    const students = this.getStudents();
    const student = students.find(s => s.id === log.student_id);
    if (student) {
      // Just a simple simulation of updating skill level and last log
      // Check if student has low speed progress
      if (log.mastery === 'Learning') {
        student.flags.slow_progress = true;
        student.pace_status = 'Slow';
        student.pace_reason = 'Struggling with ' + log.topic;
      } else if (log.mastery === 'Mastered') {
        student.flags.slow_progress = false;
        student.pace_status = 'Ahead';
        student.pace_reason = null;
      } else {
        student.pace_status = 'On track';
        student.pace_reason = null;
      }
      this.saveStudent(student);
    }
    
    // Fire and forget to server
    if (this.isOnline()) {
      saveProgressLogDB(log).catch(e => console.error('Failed to sync log:', e));
    }

    this.logAudit('insert_progress_log', 'progress_logs', null, log);
  },

  // Audit Logging
  getAuditLog(): AuditLog[] {
    return this.get<AuditLog>('audit_log');
  },

  logAudit(action: string, entity: string, before: any, after: any): void {
    const logs = this.get<AuditLog>('audit_log');
    const actor = this.getCurrentUser();
    const newLog: AuditLog = {
      id: 'aud-' + crypto.randomUUID(),
      actor: actor.name,
      action,
      entity,
      before,
      after,
      at: new Date().toISOString()
    };
    logs.unshift(newLog); // Put latest on top
    this.save('audit_log', logs);
  },

  // --- ATOMIC TRIGGER INVARIANT: ATTENDANCE -> PACKAGE DECREMENT ---
  // Replicates on_attendance_present() trigger in SQL
  processAttendanceRecord(record: Attendance): void {
    const list = this.get<Attendance>('attendance');
    
    // Prevent double insertions of same ID
    if (list.some(a => a.id === record.id)) return;
    
    list.push(record);
    this.save('attendance', list);

    if (record.status === 'present') {
      const packages = this.get<Package>('packages');
      const students = this.get<Student>('students');

      // 1) Find the active non-frozen package with remaining classes, sorted by start_date asc
      const activePkg = packages
        .filter(p => p.student_id === record.student_id && !p.frozen && p.classes_remaining > 0)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];

      const beforePkg = activePkg ? { ...activePkg } : null;

      if (activePkg) {
        // Decrement class remaining
        activePkg.classes_remaining = Math.max(activePkg.classes_remaining - 1, 0);
        this.save('packages', packages);
        this.logAudit('package_decrement_trigger', 'packages', beforePkg, activePkg);
      }

      // 2) Update student last_attended and clear 'inactive' flag
      const student = students.find(s => s.id === record.student_id);
      if (student) {
        const beforeStudent = { ...student };
        student.last_attended = record.date;
        
        // Remove inactive flag
        delete student.flags.inactive;
        if (student.status === 'inactive') {
          student.status = 'active';
        }

        // Auto-check if package is low now based on total remaining classes
        const studentPkgs = packages.filter(p => p.student_id === record.student_id && !p.frozen);
        const totalRemaining = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

        if (totalRemaining <= 2) {
          student.flags.low_package = true;
        } else {
          delete student.flags.low_package;
        }

        this.save('students', students);
        this.logAudit('student_attendance_trigger', 'students', beforeStudent, student);
      }
    }
  },

  // --- OFFLINE / PWA SYNC ENGINE ---
  getOfflineQueue(): Attendance[] {
    return this.get<Attendance>('offline_queue');
  },

  addToOfflineQueue(record: Attendance): void {
    const queue = this.getOfflineQueue();
    queue.push(record);
    this.save('offline_queue', queue);
    window.dispatchEvent(new Event('offline-queue-changed'));
  },

  syncOfflineQueue(): { success: boolean; count: number } {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return { success: true, count: 0 };

    const count = queue.length;
    // Process records sequentially (atomic execution order is preserved)
    queue.forEach(record => {
      record.synced = true;
      this.processAttendanceRecord(record);
    });
    
    // Batch persist to server
    syncOfflineQueueDB(queue).catch(e => console.error('Failed to sync queue:', e));

    // Clear queue
    this.save('offline_queue', []);
    window.dispatchEvent(new Event('offline-queue-changed'));
    this.logAudit('offline_queue_sync', 'offline_queue', `${count} items in queue`, 'Synced to DB');
    
    return { success: true, count };
  },

  // Check connectivity status
  isOnline(): boolean {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
  }
};
