// Master Moves OS (MMOS) — Local Storage Database Engine
// Simulates PostgreSQL, Supabase, DB Triggers, and Offline Queueing

import { saveStudentDB, saveProgressLogDB, syncOfflineQueueDB, saveTournamentReportDB } from '../app/actions';

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

export interface ClassSession {
  id: string;
  slot_id: string;
  student_id: string;
  scheduled_date: string;
  original_date?: string | null;
  status: 'scheduled' | 'completed' | 'rescheduled' | 'cancelled';
  note?: string | null;
  created_at: string;
}

export interface Coach {
  id: string;
  user_id: string;
  centre_id: string;
  centre_ids?: string[];
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
  chess_com_username?: string;
  lichess_username?: string;
  fide_rating?: number;
  fide_country?: string | null;
  parent_name?: string | null;
  alternate_centre?: string | null;
  resident_status?: string | null;
  address?: string | null;
  category?: string | null;
  notes?: string | null;
  referral_source?: string | null;
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
  kind: 'new' | 'renewal' | 'tournament' | 'unbilled' | 'settled' | 'completed';
  classes_total: number;
  classes_remaining: number;
  discount_pct: number;
  frozen: boolean;
  is_family_shared?: boolean;
  start_date: string;
  expiry_date?: string;
  ended_at?: string | null;
  bonus_classes?: number;
}

export interface Enrollment {
  id: string;
  student_id: string;
  slot_id: string;
  enrolled_at?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface ScheduleSlot {
  id: string;
  centre_id: string;
  coach_id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  time: string; // HH:MM
  level: string;
  capacity?: number;
  is_summer_camp?: boolean;
}

export interface Attendance {
  id: string;
  student_id: string;
  slot_id: string | null;
  coach_id: string;
  date: string;
  status: 'present' | 'absent' | 'makeup' | 'informed';
  topic?: string;
  note?: string;
  duration: number;
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

export interface TournamentReport {
  id: string;
  student_id: string;
  name: string;
  date: string;
  points: number;
  rating_change: number;
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
    localStorage.setItem('mmos_tournament_reports', JSON.stringify([]));
    localStorage.setItem('mmos_class_sessions', JSON.stringify([]));
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
    if (data.attendance) {
      // Proactively keep only the last 180 days of attendance locally to save localStorage quota
      const hundredEightyDaysAgo = new Date();
      hundredEightyDaysAgo.setDate(hundredEightyDaysAgo.getDate() - 180);
      const filteredAttendance = data.attendance.filter((a: any) => new Date(a.date).getTime() >= hundredEightyDaysAgo.getTime());
      this.save('attendance', filteredAttendance);
    }
    if (data.invoices) this.save('invoices', data.invoices);
    if (data.progressLogs) this.save('progress_logs', data.progressLogs);
    if (data.enquiries) this.save('enquiries', data.enquiries);
    if (data.enrollments) this.save('enrollments', data.enrollments);
    if (data.notifications) this.save('notifications', data.notifications);
    if (data.tournamentReports) this.save('tournament_reports', data.tournamentReports);
    if (data.classSessions) this.save('class_sessions', data.classSessions);
    if (data.auditLogs) this.save('audit_log', data.auditLogs);
    window.dispatchEvent(new Event('db-synced'));
  },
  // Helper loaders & savers
  get<T>(table: string): T[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem(`mmos_${table}`) || '[]');
  },

  save<T>(table: string, data: T[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`mmos_${table}`, JSON.stringify(data));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn(`Local storage quota exceeded for table ${table}. Trying to prune old records...`);
        if (table === 'attendance') {
          // Fallback to storing only the last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const pruned = (data as any[]).filter(a => new Date(a.date).getTime() >= thirtyDaysAgo.getTime());
          try {
            localStorage.setItem('mmos_attendance', JSON.stringify(pruned));
            console.log(`Successfully stored pruned attendance logs (${pruned.length} records).`);
            return;
          } catch (innerErr) {
            console.error('Failed to store even pruned attendance records:', innerErr);
          }
        }
      }
      throw e;
    }
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
    document.cookie = `mmos_active_user_id=${userId}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new Event('auth-change'));
  },

  // centres
  getCentres(): Centre[] {
    return this.get<Centre>('centres');
  },

  getClassSessions(): ClassSession[] {
    return this.get<ClassSession>('class_sessions');
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

  // Tournament Reports
  getTournamentReports(): TournamentReport[] {
    return this.get<TournamentReport>('tournament_reports');
  },

  saveTournamentReport(report: TournamentReport): void {
    const reports = this.getTournamentReports();
    reports.push(report);
    this.save('tournament_reports', reports);
    
    // Fire and forget to server
    if (this.isOnline()) {
      saveTournamentReportDB(report).catch(e => console.error('Failed to sync tournament report:', e));
    }
    
    this.logAudit('insert_tournament_report', 'tournament_reports', null, report);
    window.dispatchEvent(new Event('db-synced'));
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
    const targetDateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';
    const existingIdx = logs.findIndex(l => {
      if (l.student_id !== log.student_id) return false;
      const dStr = l.date ? new Date(l.date).toISOString().split('T')[0] : '';
      return dStr === targetDateStr;
    });

    if (existingIdx > -1) {
      logs[existingIdx] = {
        ...logs[existingIdx],
        topic: log.topic,
        mastery: log.mastery,
        note: log.note,
        coach_id: log.coach_id,
        skills: log.skills
      };
    } else {
      logs.push(log);
    }
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
    const existingIndex = list.findIndex(a => a.id === record.id);
    if (existingIndex !== -1) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }
    this.save('attendance', list);

    if (record.status === 'present' || record.status === 'makeup') {
      const packages = this.get<Package>('packages');
      const students = this.get<Student>('students');

      // 1) Find the active non-frozen individual package with remaining classes, sorted by start_date asc
      let targetPkg = packages
        .filter(p => p.student_id === record.student_id && !p.frozen && p.classes_remaining > 0)
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];

      // 2) Fallback: if no individual package, look for a sibling package marked as family-shared
      if (!targetPkg) {
        const student = students.find(s => s.id === record.student_id);
        if (student && student.family_id) {
          const siblingIds = students.filter(s => s.family_id === student.family_id).map(s => s.id);
          targetPkg = packages
            .filter(p => siblingIds.includes(p.student_id) && p.is_family_shared && !p.frozen && p.classes_remaining > 0)
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0];
        }
      }

      const beforePkg = targetPkg ? { ...targetPkg } : null;

      if (targetPkg) {
        // Decrement class remaining based on attendance duration
        const decrementVal = typeof record.duration === 'number' ? record.duration : 1;
        targetPkg.classes_remaining = Math.max(targetPkg.classes_remaining - decrementVal, 0);
        this.save('packages', packages);
        this.logAudit('package_decrement_trigger', 'packages', beforePkg, targetPkg);
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

        // Auto-check if package is low based on 20% threshold of total package classes
        const studentPkgs = packages.filter(p => p.student_id === record.student_id && !p.frozen);
        const totalRemaining = studentPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);
        const totalClasses = studentPkgs.reduce((sum, p) => sum + p.classes_total, 0);

        // 20% package threshold trigger (or remaining <= 2)
        if (totalClasses > 0 && (totalRemaining / totalClasses <= 0.20 || totalRemaining <= 2)) {
          student.flags.low_package = true;
        } else {
          delete student.flags.low_package;
        }

        // 3) Recalculate unpaid classes and values (including present, absent, makeup; excluding informed)
        const allStudentAtt = list.filter(a => a.student_id === record.student_id && ['present', 'absent', 'makeup'].includes(a.status));
        const totalAttended = allStudentAtt.reduce((sum, a) => sum + (a.duration ?? 1), 0);

        const totalPurchased = studentPkgs.reduce((sum, p) => sum + p.classes_total + (p.bonus_classes || 0), 0);
        const unpaidClasses = Math.max(0, totalAttended - totalPurchased);

        // Compute student rate based on sum of paid and bonus classes
        let studentRate = 125;
        if (studentPkgs.length > 0) {
          const sorted = [...studentPkgs].sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
          const latestPkg = sorted[0];
          const invoices = this.get<any>('invoices') || [];
          const invoice = invoices.find((inv: any) => inv.package_id === latestPkg.id);
          const pkgTotalClasses = latestPkg.classes_total + (latestPkg.bonus_classes || 0);
          if (invoice && invoice.amount) {
            studentRate = Math.round(Number(invoice.amount) / pkgTotalClasses);
          } else if (latestPkg.tier_id) {
            const tiers = this.get<any>('tiers') || [];
            const tier = tiers.find((t: any) => t.id === latestPkg.tier_id);
            if (tier && tier.price) {
              const discount = latestPkg.discount_pct ? Number(latestPkg.discount_pct) : 0;
              studentRate = Math.round(Number(tier.price) * (1 - discount / 100) / pkgTotalClasses);
            }
          }
        }
        const unpaidValue = unpaidClasses * studentRate;

        if (unpaidClasses > 0) {
          student.flags.unpaid_classes = unpaidClasses;
          student.flags.unpaid_value = unpaidValue;
        } else {
          delete student.flags.unpaid_classes;
          delete student.flags.unpaid_value;
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
