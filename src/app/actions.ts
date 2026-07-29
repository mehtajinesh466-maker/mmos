"use server";

import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";

async function verifySession() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    throw new Error("Unauthorized: No session found");
  }
  return session;
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  let pass = "";
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export async function registerUser(data: any) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const rawPassword = data.password || generateRandomPassword();
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
      centre_id: data.role === 'owner' ? null : data.centre_id,
    }
  });
  return { ...user, generatedPassword: rawPassword };
}

export async function updateUserCredentialsDB(userId: string, data: { name?: string; email?: string; password?: string; role?: string }) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.password && data.password.trim().length > 0) {
    updateData.password = await bcrypt.hash(data.password.trim(), 10);
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData
  });
}

// -------------------------------------------------------------
// Centres & Coaches
// -------------------------------------------------------------

export async function addCoachDB(name: string, centreId: string, centreIds: string[] = []) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const rawPassword = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@mastermoves.ae`;

  // Create a user account for the coach first
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'coach',
      centre_id: centreId || null,
    }
  });
  // Then create coach record
  const coach = await prisma.coach.create({
    data: {
      user_id: user.id,
      centre_id: centreId || null,
      centre_ids: centreIds,
      active: true,
    }
  });

  return { ...coach, email, generatedPassword: rawPassword };
}

export async function updateCoachDB(coachId: string, name: string, centreId: string, centreIds: string[] = []) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, include: { user: true } });
  if (coach?.user_id) {
    await prisma.user.update({ where: { id: coach.user_id }, data: { name, centre_id: centreId || null } });
  }
  return await prisma.coach.update({
    where: { id: coachId },
    data: { 
      centre_id: centreId || null,
      centre_ids: centreIds
    }
  });
}

export async function reassignCoachDB(fromCoachId: string, toCoachId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  // Move all students from one coach to another
  return await prisma.student.updateMany({
    where: { coach_id: fromCoachId },
    data: { coach_id: toCoachId || null }
  });
}

export async function deleteCoachDB(coachId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.coach.update({
    where: { id: coachId },
    data: { active: false }
  });
}

export async function saveCentreDB(data: { name: string; status: string }) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.centre.create({
    data: { name: data.name, status: data.status }
  });
}

export async function updateCentreStatusDB(centreId: string, status: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.centre.update({
    where: { id: centreId },
    data: { status }
  });
}

export async function deleteCentreDB(centreId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.centre.update({
    where: { id: centreId },
    data: { status: 'inactive' }
  });
}


// -------------------------------------------------------------
// Module 3 & 4: Scheduling and Progress
// -------------------------------------------------------------

export async function createScheduleSlot(centreId: string, coachId: string, day: string, time: string, level: string, capacity: number = 10) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'coach') {
    const coachRecord = await prisma.coach.findFirst({ where: { user_id: session.user.id } });
    if (!coachRecord || coachRecord.id !== coachId) {
      throw new Error("Unauthorized");
    }
  }
  return await prisma.scheduleSlot.create({
    data: {
      centre_id: centreId,
      coach_id: coachId,
      day,
      time,
      level,
      capacity
    }
  });
}

export async function enrollStudent(studentId: string, slotId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }
  return await prisma.enrollment.create({
    data: {
      student_id: studentId,
      slot_id: slotId
    }
  });
}

export async function unenrollStudent(studentId: string, slotId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }
  return await prisma.enrollment.deleteMany({
    where: {
      student_id: studentId,
      slot_id: slotId
    }
  });
}

export async function logProgress(studentId: string, coachId: string, focusArea: string, evaluation: number, notes: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'coach') {
    const coachRecord = await prisma.coach.findFirst({ where: { user_id: session.user.id } });
    if (!coachRecord || coachRecord.id !== coachId) {
      throw new Error("Unauthorized");
    }
  }
  return await prisma.progressLog.create({
    data: {
      student_id: studentId,
      coach_id: coachId,
      focus_area: focusArea,
      evaluation,
      notes
    }
  });
}


export async function syncDatabaseToClient() {
  const session = await verifySession();
  const role = session.user.role;
  const userCentreId = session.user.centre_id;

  // Auto-backfill parent user accounts for any existing student family lacking one (optimized)
  if (role === 'owner' || role === 'front_desk') {
    const families = await prisma.family.findMany({ where: { email: { not: null } } });
    const parentUsers = await prisma.user.findMany({
      where: { role: 'parent' },
      select: { email: true }
    });
    const existingParentEmails = new Set(parentUsers.map(u => u.email.toLowerCase().trim()));

    const missingFamilies = families.filter(fam => {
      if (!fam.email || !fam.email.trim()) return false;
      return !existingParentEmails.has(fam.email.toLowerCase().trim());
    });

    if (missingFamilies.length > 0) {
      const defaultHash = await bcrypt.hash('Parent@12345', 10);
      for (const fam of missingFamilies) {
        const cleanEmail = fam.email!.toLowerCase().trim();
        await prisma.user.create({
          data: {
            name: fam.primary_name || 'Parent',
            email: cleanEmail,
            password: defaultHash,
            role: 'parent',
            centre_id: null
          }
        }).catch(() => {});
      }
    }
  }

  if (role === 'owner') {
    const [
      centres,
      users,
      coachesRaw,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogsRaw,
      notifications,
      tournamentReports
    ] = await Promise.all([
      prisma.centre.findMany(),
      prisma.user.findMany(),
      prisma.coach.findMany({ include: { user: true } }),
      prisma.family.findMany(),
      prisma.student.findMany(),
      prisma.tier.findMany(),
      prisma.package.findMany(),
      prisma.scheduleSlot.findMany(),
      prisma.attendance.findMany(),
      prisma.invoice.findMany(),
      prisma.enquiry.findMany(),
      prisma.enrollment.findMany(),
      prisma.progressLog.findMany(),
      prisma.notification.findMany(),
      prisma.tournamentReport.findMany()
    ]);

    const coaches = coachesRaw.map(c => ({
      ...c,
      name: c.user?.name || 'Unassigned',
    }));

    const progressLogs = progressLogsRaw.map(l => ({
      id: l.id,
      student_id: l.student_id,
      coach_id: l.coach_id,
      date: l.date ? l.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      topic: l.focus_area || '',
      mastery: (l.evaluation ?? 0) >= 5 ? 'Mastered' : (l.evaluation ?? 0) >= 4 ? 'Practising' : 'Learning',
      skills: l.skills || { openings: 3, tactics: 3, endgames: 3, strategy: 3, focus: 3 },
      note: l.notes || ''
    }));

    return JSON.parse(JSON.stringify({
      centres,
      users,
      coaches,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogs,
      notifications,
      tournamentReports
    }));
  }

  if (role === 'front_desk') {
    const [
      centres,
      users,
      coachesRaw,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogsRaw,
      notifications,
      tournamentReports
    ] = await Promise.all([
      prisma.centre.findMany(),
      prisma.user.findMany(),
      prisma.coach.findMany({ include: { user: true } }),
      prisma.family.findMany(),
      prisma.student.findMany(),
      prisma.tier.findMany(),
      prisma.package.findMany(),
      prisma.scheduleSlot.findMany(),
      prisma.attendance.findMany(),
      prisma.invoice.findMany(),
      prisma.enquiry.findMany(),
      prisma.enrollment.findMany(),
      prisma.progressLog.findMany(),
      prisma.notification.findMany(),
      prisma.tournamentReport.findMany()
    ]);

    const coaches = coachesRaw.map(c => ({
      ...c,
      name: c.user?.name || 'Unassigned',
    }));

    const progressLogs = progressLogsRaw.map(l => ({
      id: l.id,
      student_id: l.student_id,
      coach_id: l.coach_id,
      date: l.date ? l.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      topic: l.focus_area || '',
      mastery: (l.evaluation ?? 0) >= 5 ? 'Mastered' : (l.evaluation ?? 0) >= 4 ? 'Practising' : 'Learning',
      skills: l.skills || { openings: 3, tactics: 3, endgames: 3, strategy: 3, focus: 3 },
      note: l.notes || ''
    }));

    return JSON.parse(JSON.stringify({
      centres,
      users,
      coaches,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogs,
      notifications,
      tournamentReports
    }));
  }

  if (role === 'coach') {
    const coachRecord = await prisma.coach.findFirst({
      where: { user_id: session.user.id }
    });

    if (!coachRecord) {
      return {
        centres: [], users: [], coaches: [], families: [], students: [],
        tiers: [], packages: [], scheduleSlots: [], attendance: [], invoices: [], enquiries: [], enrollments: [], progressLogs: []
      };
    }

    const students = await prisma.student.findMany({
      where: { coach_id: coachRecord.id }
    });
    const studentIds = students.map(s => s.id);
    const familyIds = students.map(s => s.family_id).filter(Boolean) as string[];

    const [
      centres,
      users,
      coachesRaw,
      families,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogsRaw,
      notifications,
      tournamentReports
    ] = await Promise.all([
      prisma.centre.findMany({ where: { status: 'active' } }),
      prisma.user.findMany({
        where: { id: session.user.id }
      }),
      prisma.coach.findMany({
        where: { id: coachRecord.id },
        include: { user: true }
      }),
      prisma.family.findMany({
        where: { id: { in: familyIds } }
      }),
      prisma.tier.findMany({ where: { active: true } }),
      prisma.package.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.scheduleSlot.findMany({
        where: { coach_id: coachRecord.id }
      }),
      prisma.attendance.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.invoice.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.enquiry.findMany(),
      prisma.enrollment.findMany(),
      prisma.progressLog.findMany({
        where: { coach_id: coachRecord.id }
      }),
      prisma.notification.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.tournamentReport.findMany({
        where: { student_id: { in: studentIds } }
      })
    ]);

    const coaches = coachesRaw.map(c => ({
      ...c,
      name: c.user?.name || 'Unassigned',
    }));

    const progressLogs = progressLogsRaw.map(l => ({
      id: l.id,
      student_id: l.student_id,
      coach_id: l.coach_id,
      date: l.date ? l.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      topic: l.focus_area || '',
      mastery: (l.evaluation ?? 0) >= 5 ? 'Mastered' : (l.evaluation ?? 0) >= 4 ? 'Practising' : 'Learning',
      skills: l.skills || { openings: 3, tactics: 3, endgames: 3, strategy: 3, focus: 3 },
      note: l.notes || ''
    }));


    return JSON.parse(JSON.stringify({
      centres,
      users,
      coaches,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      enquiries,
      enrollments,
      progressLogs,
      notifications,
      tournamentReports
    }));
  }

  if (role === 'parent') {
    const family = await prisma.family.findFirst({
      where: { email: session.user.email || 'none' }
    });

    if (!family) {
      return {
        centres: [], users: [], coaches: [], families: [], students: [],
        tiers: [], packages: [], scheduleSlots: [], attendance: [], invoices: []
      };
    }

    const families = [family];
    const students = await prisma.student.findMany({
      where: { family_id: family.id }
    });
    const studentIds = students.map(s => s.id);
    const coachIds = students.map(s => s.coach_id).filter(Boolean) as string[];
    const centreIds = students.map(s => s.centre_id).filter(Boolean) as string[];

    const [
      centres,
      users,
      coachesRaw,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      notifications,
      tournamentReports
    ] = await Promise.all([
      prisma.centre.findMany({
        where: { id: { in: centreIds } }
      }),
      prisma.user.findMany({
        where: { id: session.user.id }
      }),
      prisma.coach.findMany({
        where: { id: { in: coachIds } },
        include: { user: true }
      }),
      prisma.tier.findMany({ where: { active: true } }),
      prisma.package.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.scheduleSlot.findMany({
        where: { centre_id: { in: centreIds } }
      }),
      prisma.attendance.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.invoice.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.notification.findMany({
        where: { student_id: { in: studentIds } }
      }),
      prisma.tournamentReport.findMany({
        where: { student_id: { in: studentIds } }
      })
    ]);

    const coaches = coachesRaw.map(c => ({
      ...c,
      name: c.user?.name || 'Unassigned',
    }));

    return JSON.parse(JSON.stringify({
      centres,
      users,
      coaches,
      families,
      students,
      tiers,
      packages,
      scheduleSlots,
      attendance,
      invoices,
      notifications,
      tournamentReports
    }));
  }

  throw new Error("Unauthorized");
}


export async function saveEnquiryDB(data: {
  child: string;
  age?: string;
  parent: string;
  phone: string;
  source: string;
  stage: string;
  centre_id?: string;
  experience?: string;
  trial_date?: string;
  coach_id?: string;
  notes?: string;
}) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    if (data.centre_id && data.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }
  return await prisma.enquiry.create({
    data: {
      child: data.child,
      age: data.age || null,
      parent: data.parent,
      phone: data.phone,
      source: data.source,
      stage: data.stage.toLowerCase().replace(' ', '_'),
      centre_id: data.centre_id || null,
      experience: data.experience || null,
      trial_date: data.trial_date ? new Date(data.trial_date) : null,
      coach_id: data.coach_id || null,
      notes: data.notes || null,
    }
  });
}

export async function updateEnquiryStageDB(id: string, stage: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (enquiry?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }

  return await prisma.enquiry.update({
    where: { id },
    data: { stage: stage.toLowerCase().replace(' ', '_') }
  });
}
async function updateStudentFlags(studentId: string, pkgId?: string, updatedRemaining?: number) {
  const allPkgs = await prisma.package.findMany({
    where: { student_id: studentId, frozen: false }
  });
  const totalRemaining = allPkgs.reduce((sum, p) => {
    const rem = (pkgId && p.id === pkgId && updatedRemaining !== undefined) ? updatedRemaining : p.classes_remaining;
    return sum + rem;
  }, 0);

  // Sum up duration for present/makeup attendance
  const attendedSum = await prisma.attendance.aggregate({
    _sum: { duration: true },
    where: {
      student_id: studentId,
      status: { in: ['present', 'makeup'] }
    }
  });
  const totalAttended = attendedSum._sum.duration || 0;

  // Sum total classes purchased
  const totalPurchased = allPkgs.reduce((sum, p) => sum + p.classes_total, 0);
  const unpaidClasses = Math.max(0, totalAttended - totalPurchased);

  // Compute student rate
  let studentRate = 125;
  if (allPkgs.length > 0) {
    const sorted = [...allPkgs].sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
    const latestPkg = sorted[0];
    const invoice = await prisma.invoice.findFirst({ where: { package_id: latestPkg.id } });
    if (invoice && invoice.amount) {
      studentRate = Math.round(Number(invoice.amount) / latestPkg.classes_total);
    } else if (latestPkg.tier_id) {
      const tier = await prisma.tier.findUnique({ where: { id: latestPkg.tier_id } });
      if (tier && tier.price) {
        const discount = latestPkg.discount_pct ? Number(latestPkg.discount_pct) : 0;
        studentRate = Math.round(Number(tier.price) * (1 - discount / 100) / latestPkg.classes_total);
      }
    }
  }
  const unpaidValue = unpaidClasses * studentRate;

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (student) {
    const flags = typeof student.flags === 'object' && student.flags ? { ...(student.flags as any) } : {};
    if (totalRemaining <= 2) {
      flags.low_package = true;
    } else {
      delete flags.low_package;
    }

    if (unpaidClasses > 0) {
      flags.unpaid_classes = unpaidClasses;
      flags.unpaid_value = unpaidValue;
    } else {
      delete flags.unpaid_classes;
      delete flags.unpaid_value;
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { flags }
    });
  }
}

export async function logAttendance(studentId: string, status: string | null, coachId: string, slotId?: string, duration: number = 2) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'coach') {
    const coachRecord = await prisma.coach.findFirst({ where: { user_id: session.user.id } });
    if (!coachRecord || coachRecord.id !== coachId) {
      throw new Error("Unauthorized");
    }
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const existing = await prisma.attendance.findFirst({
    where: {
      student_id: studentId,
      slot_id: slotId || null,
      date: {
        gte: startOfToday,
        lte: endOfToday
      }
    }
  });

  if (existing) {
    if (!status) {
      // Unmarked: delete the record and restore class if it was present
      if (existing.status === 'present') {
        const pkgs = await prisma.package.findMany({
          where: { student_id: studentId, frozen: false },
          orderBy: { start_date: 'asc' }
        });
        const pkgToRestore = pkgs.find(p => p.classes_remaining < p.classes_total);
        if (pkgToRestore) {
          const updatedPkg = await prisma.package.update({
            where: { id: pkgToRestore.id },
            data: { classes_remaining: pkgToRestore.classes_remaining + existing.duration }
          });
          await updateStudentFlags(studentId, pkgToRestore.id, updatedPkg.classes_remaining);
        }
      }
      const deletedRecord = await prisma.attendance.delete({
        where: { id: existing.id }
      });
      await updateStudentFlags(studentId);
      return deletedRecord;
    }

    if (existing.status === status) {
      return existing;
    }

    const oldStatus = existing.status;
    const oldDuration = existing.duration;
    
    // Update attendance record status and duration
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { status, duration }
    });

    if (oldStatus === 'present' && status !== 'present') {
      // Restore class
      const pkgs = await prisma.package.findMany({
        where: { student_id: studentId, frozen: false },
        orderBy: { start_date: 'asc' }
      });
      const pkgToRestore = pkgs.find(p => p.classes_remaining < p.classes_total);
      if (pkgToRestore) {
        const updatedPkg = await prisma.package.update({
          where: { id: pkgToRestore.id },
          data: { classes_remaining: pkgToRestore.classes_remaining + oldDuration }
        });
        await updateStudentFlags(studentId, pkgToRestore.id, updatedPkg.classes_remaining);
      }
    } else if (oldStatus !== 'present' && status === 'present') {
      // Deduct class
      const pkg = await prisma.package.findFirst({
        where: {
          student_id: studentId,
          frozen: false,
          classes_remaining: { gt: 0 }
        },
        orderBy: { start_date: 'asc' }
      });
      if (pkg) {
        const updatedPkg = await prisma.package.update({
          where: { id: pkg.id },
          data: { classes_remaining: pkg.classes_remaining - duration }
        });
        await updateStudentFlags(studentId, pkg.id, updatedPkg.classes_remaining);
      }
    } else if (oldStatus === 'present' && status === 'present' && oldDuration !== duration) {
      // Adjust class deduction difference
      const pkg = await prisma.package.findFirst({
        where: { student_id: studentId, frozen: false },
        orderBy: { start_date: 'asc' }
      });
      if (pkg) {
        const diff = duration - oldDuration; // e.g. from 2 to 1 (diff = -1) or 1 to 2 (diff = 1)
        const updatedPkg = await prisma.package.update({
          where: { id: pkg.id },
          data: { classes_remaining: pkg.classes_remaining - diff }
        });
        await updateStudentFlags(studentId, pkg.id, updatedPkg.classes_remaining);
      }
    }

    await updateStudentFlags(studentId);
    return updated;
  }

  if (!status) return null;

  const newRecord = await prisma.attendance.create({
    data: {
      student_id: studentId,
      status: status,
      coach_id: coachId,
      slot_id: slotId || null,
      date: new Date(),
      duration: duration
    }
  });

  if (status === 'present') {
    const pkg = await prisma.package.findFirst({
      where: {
        student_id: studentId,
        frozen: false,
        classes_remaining: { gt: 0 }
      },
      orderBy: { start_date: 'asc' }
    });
    if (pkg) {
      const updatedPkg = await prisma.package.update({
        where: { id: pkg.id },
        data: { classes_remaining: pkg.classes_remaining - duration }
      });
      await updateStudentFlags(studentId, pkg.id, updatedPkg.classes_remaining);
    }
  }

  await updateStudentFlags(studentId);
  return newRecord;
}
export async function closeStudentPackagesAndClasses(studentId: string) {
  // Update all packages to classes_remaining = 0
  await prisma.package.updateMany({
    where: { student_id: studentId, classes_remaining: { gt: 0 } },
    data: { classes_remaining: 0 }
  });

  // Delete all Enrollments (schedule slots)
  await prisma.enrollment.deleteMany({
    where: { student_id: studentId }
  });

  // Retrieve current student flags to update them
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { flags: true }
  });

  if (student) {
    const existingFlags = student.flags ? (student.flags as any) : {};
    const newFlags = {
      ...existingFlags,
      unpaid_classes: 0,
      unpaid_value: 0
    };
    await prisma.student.update({
      where: { id: studentId },
      data: {
        flags: newFlags
      }
    });
  }
}

export async function approveStudentInactive(studentId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized: Only owners can approve inactivation");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { status: 'inactive' }
  });

  await closeStudentPackagesAndClasses(studentId);
}

export async function saveStudentDB(studentData: any) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk' && session.user.role !== 'coach') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    if (studentData.centre_id && studentData.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }

  const existing = await prisma.student.findUnique({
    where: { id: studentData.id }
  });

  let targetStatus = studentData.status;

  if (existing) {
    // Reactivation check: if existing is inactive/pending_inactive and new status is active
    const wasInactiveOrPending = existing.status === 'inactive' || existing.status === 'pending_inactive';
    if (wasInactiveOrPending && targetStatus === 'active') {
      if (session.user.role !== 'owner') {
        throw new Error("Only the owner can reactivate a student");
      }
    }

    // Inactivation check: if new status is inactive and student wasn't already inactive
    if (targetStatus === 'inactive' && existing.status !== 'inactive') {
      if (session.user.role !== 'owner') {
        targetStatus = 'pending_inactive';
      } else {
        // If owner is marking inactive immediately, close packages & classes
        await closeStudentPackagesAndClasses(studentData.id);
      }
    }

    await prisma.student.update({
      where: { id: studentData.id },
      data: {
        name: studentData.name,
        level: studentData.level,
        status: targetStatus,
        fide_id: studentData.fide_id,
        chess_com_username: studentData.chess_com_username || null,
        lichess_username: studentData.lichess_username || null,
        fide_rating: studentData.fide_rating ? Number(studentData.fide_rating) : null,
        dob: studentData.dob ? new Date(studentData.dob) : null,
        gender: studentData.gender || null,
        school: studentData.school || null,
        coach_id: studentData.coach_id || null,
        centre_id: studentData.centre_id,
        pace_status: studentData.pace_status,
        pace_reason: studentData.pace_reason,
        flags: studentData.flags,
        last_attended: studentData.last_attended ? new Date(studentData.last_attended) : null,
        fide_country: studentData.fide_country || null,
        parent_name: studentData.parent_name || null,
        alternate_centre: studentData.alternate_centre || null,
        resident_status: studentData.resident_status || null,
        address: studentData.address || null,
        category: studentData.category || null,
        notes: studentData.notes || null,
        referral_source: studentData.referral_source || null
      }
    });
  } else {
    // New student
    if (targetStatus === 'inactive') {
      if (session.user.role !== 'owner') {
        targetStatus = 'pending_inactive';
      }
    }

    const createdStudent = await prisma.student.create({
      data: {
        id: studentData.id,
        name: studentData.name,
        level: studentData.level,
        status: targetStatus,
        fide_id: studentData.fide_id,
        chess_com_username: studentData.chess_com_username || null,
        lichess_username: studentData.lichess_username || null,
        fide_rating: studentData.fide_rating ? Number(studentData.fide_rating) : null,
        dob: studentData.dob ? new Date(studentData.dob) : null,
        gender: studentData.gender || null,
        school: studentData.school || null,
        pace_status: studentData.pace_status,
        pace_reason: studentData.pace_reason,
        flags: studentData.flags,
        centre_id: studentData.centre_id,
        coach_id: studentData.coach_id || null,
        family_id: studentData.family_id,
        fide_country: studentData.fide_country || null,
        parent_name: studentData.parent_name || null,
        alternate_centre: studentData.alternate_centre || null,
        resident_status: studentData.resident_status || null,
        address: studentData.address || null,
        category: studentData.category || null,
        notes: studentData.notes || null,
        referral_source: studentData.referral_source || null
      }
    });

    if (targetStatus === 'inactive' && session.user.role === 'owner') {
      await closeStudentPackagesAndClasses(createdStudent.id);
    }
  }
}


export async function saveTournamentReportDB(reportData: any) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  return await prisma.tournamentReport.create({
    data: {
      id: reportData.id,
      student_id: reportData.student_id,
      name: reportData.name,
      date: reportData.date ? new Date(reportData.date) : new Date(),
      points: reportData.points,
      rating_change: reportData.rating_change ? Number(reportData.rating_change) : 0
    }
  });
}

export async function saveProgressLogDB(logData: any) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach') {
    throw new Error("Unauthorized");
  }
  const student = await prisma.student.findUnique({ where: { id: logData.student_id } });
  if (!student) throw new Error("Student not found");

  if (session.user.role === 'coach') {
    const coachRecord = await prisma.coach.findFirst({ where: { user_id: session.user.id } });
    if (!coachRecord || coachRecord.id !== logData.coach_id) {
      throw new Error("Unauthorized");
    }
    // Allow coach to save progress logs for any student they teach
  }
  await prisma.progressLog.create({
    data: {
      student_id: logData.student_id,
      coach_id: logData.coach_id,
      date: logData.date ? new Date(logData.date) : new Date(),
      focus_area: logData.topic || logData.focus_area || '',
      evaluation: logData.mastery === 'Learning' ? 2 : logData.mastery === 'Practising' ? 4 : (logData.evaluation || 5),
      notes: logData.note || logData.notes || '',
      skills: logData.skills || null
    }
  });
}

export async function syncOfflineQueueDB(records: any[]) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  // Batch insert
  for (const record of records) {
    await logAttendance(record.student_id, record.status, record.coach_id);
  }
}

// -------------------------------------------------------------
// Phase 2: Students & Packages
// -------------------------------------------------------------

export async function registerStudent(data: any) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    if (data.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }

  let familyId = data.family_id;

  if (!familyId) {
    if (data.email) {
      const match = await prisma.family.findFirst({
        where: { email: { equals: data.email.toLowerCase().trim(), mode: 'insensitive' } }
      });
      if (match) familyId = match.id;
    }
    if (!familyId && data.phone) {
      const match = await prisma.family.findFirst({
        where: { phone: data.phone.trim() }
      });
      if (match) familyId = match.id;
    }
  }

  if (!familyId) {
    const family = await prisma.family.create({
      data: {
        primary_name: data.parent_name,
        phone: data.phone,
        email: data.email,
        consent_ops: data.consent_ops ?? true,
        consent_mktg: data.consent_mktg ?? false,
      }
    });
    familyId = family.id;
  }

  // 2. Automatically create parent User account if user doesn't already exist for this email
  if (data.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() }
    });
    if (!existingUser) {
      const rawPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await prisma.user.create({
        data: {
          name: data.parent_name || data.name,
          email: data.email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'parent',
          centre_id: data.centre_id || null
        }
      }).catch(err => console.warn("Parent user auto-creation skipped:", err));
    }
  }

  // 2. Create the student
  const student = await prisma.student.create({
    data: {
      family_id: familyId,
      centre_id: data.centre_id,
      coach_id: data.coach_id,
      name: data.name,
      dob: data.dob ? new Date(data.dob) : null,
      gender: data.gender,
      school: data.school,
      level: data.level,
      category: data.category || null,
      status: 'active',
      fide_id: data.fide_id,
      join_date: new Date(),
      photo_url: data.photo_url,
      flags: data.flags || {},
    }
  });

  // 3. Auto-create initial package
  if (data.tier_id) {
    const tier = await prisma.tier.findUnique({ where: { id: data.tier_id } });
    if (tier) {
      const discount = 0; // Sibling discount disabled per feedback
      
      const classesTotal = Number(data.package_size) || 12;
      const bonusClasses = Number(data.bonus_classes) || 0;
      const grandTotal = classesTotal + bonusClasses;

      const packageId = require('crypto').randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "packages" ("id", "student_id", "tier_id", "kind", "classes_total", "classes_remaining", "discount_pct", "start_date", "bonus_classes") 
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)`,
        packageId,
        student.id,
        tier.id,
        'new',
        grandTotal,
        grandTotal,
        discount,
        new Date(),
        bonusClasses
      );
    }
  }

  return student;
}

export async function renewPackage(studentId: string, tierId: string, kind: 'renewal' | 'tournament' = 'renewal') {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { family: true }
  });

  if (!student) throw new Error("Student not found");

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) throw new Error("Tier not found");

  // Check for sibling discount
  const siblingsCount = await prisma.student.count({
    where: { family_id: student.family_id, status: 'active' }
  });
  
  const discount = siblingsCount > 1 ? 10 : 0;
  
  // Parse total classes
  let classesTotal = 8;
  if (tier.inclusions && Array.isArray(tier.inclusions)) {
     const match = tier.inclusions[0]?.match(/(\d+)\s*classes/i);
     if (match) classesTotal = parseInt(match[1], 10);
  }

  const pkg = await prisma.package.create({
    data: {
      student_id: student.id,
      tier_id: tier.id,
      kind: kind,
      classes_total: classesTotal,
      classes_remaining: classesTotal,
      discount_pct: discount,
      start_date: new Date(),
    }
  });

  // Auto-generate invoice for billing ledger
  const tierPrice = Number(tier.price) || 1000;
  const finalAmount = Math.round(tierPrice * (1 - discount / 100));
  await prisma.invoice.create({
    data: {
      student_id: student.id,
      package_id: pkg.id,
      amount: finalAmount,
      status: 'paid',
      created_at: new Date()
    }
  }).catch(err => console.warn("Auto invoice generation skipped:", err));

  // Clear low_package flag on student
  const updatedFlags = typeof student.flags === 'object' && student.flags
    ? { ...(student.flags as any) }
    : {};
  delete updatedFlags.low_package;

  await prisma.student.update({
    where: { id: student.id },
    data: {
      flags: updatedFlags
    }
  });

  return JSON.parse(JSON.stringify(pkg));
}

export async function getReconciliationData() {
  const session = await verifySession();
  const role = session.user.role;
  const centreId = session.user.centre_id;

  if (role !== 'owner' && role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  const filter = (role === 'front_desk' && centreId) ? { centre_id: centreId } : {};

  const students = await prisma.student.findMany({
    where: filter,
    include: {
      packages: true,
      coach: true,
      centre: true
    }
  });

  const contradicted = students.filter(s => {
    const unpaidVal = (s.flags as any)?.unpaid_value || 0;
    const hasCredit = s.packages.some(p => p.classes_remaining > 0);
    return unpaidVal > 0 && hasCredit;
  });

  return contradicted.map(s => {
    const maxCredit = Math.max(...s.packages.map(p => p.classes_remaining));
    return {
      id: s.id,
      name: s.name,
      centreName: s.centre?.name || 'Bay Avenue',
      coachName: s.coach?.name || 'JAMES',
      summaryOwed: (s.flags as any)?.unpaid_value || 0,
      ledgerClasses: maxCredit,
      ledgerOwed: 0,
      verdict: 'IN CREDIT'
    };
  });
}

export async function deleteStudentDB(id: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { student_id: id } }),
    prisma.enrollment.deleteMany({ where: { student_id: id } }),
    prisma.fideRating.deleteMany({ where: { student_id: id } }),
    prisma.invoice.deleteMany({ where: { student_id: id } }),
    prisma.notification.deleteMany({ where: { student_id: id } }),
    prisma.package.deleteMany({ where: { student_id: id } }),
    prisma.progressLog.deleteMany({ where: { student_id: id } }),
    prisma.report.deleteMany({ where: { student_id: id } }),
    prisma.studentSkill.deleteMany({ where: { student_id: id } }),
    prisma.tournamentReport.deleteMany({ where: { student_id: id } }),
    prisma.student.delete({ where: { id } })
  ]);

  return { success: true };
}

export async function deletePackageDB(id: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.package.delete({
    where: { id }
  });
}

export async function updatePackageDB(id: string, data: any) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: { student: true }
    });
    if (pkg?.student.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }
  return JSON.parse(JSON.stringify(await prisma.package.update({
    where: { id },
    data: {
      classes_total: Number(data.classes_total),
      classes_remaining: Number(data.classes_remaining),
      frozen: data.frozen === true || data.frozen === 'true'
    }
  })));
}

export async function deleteAttendanceDB(id: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.attendance.delete({
    where: { id }
  });
}

export async function updateAttendanceDB(id: string, status: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.attendance.update({
    where: { id },
    data: { status }
  });
}

export async function deleteInvoiceDB(id: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  return await prisma.invoice.delete({
    where: { id }
  });
}

export async function updateInvoiceDB(id: string, status: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { student: true }
    });
    if (invoice?.student?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }
  return JSON.parse(JSON.stringify(await prisma.invoice.update({
    where: { id },
    data: { status }
  })));
}

export async function getActionCentreData() {
  const session = await verifySession();
  const role = session.user.role;
  const centreId = session.user.centre_id;

  if (role !== 'owner' && role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  const relationCentreFilter = (role === 'front_desk' && centreId) ? { centre_id: centreId } : {};
  const centreFilter = (role === 'front_desk' && centreId) ? { id: centreId } : {};

  const students = await prisma.student.findMany({
    where: relationCentreFilter,
    include: {
      centre: true,
      coach: {
        include: {
          user: true
        }
      },
      packages: {
        orderBy: {
          start_date: 'asc'
        }
      }
    }
  });

  const centres = await prisma.centre.findMany({
    where: centreFilter
  });
  const coaches = await prisma.coach.findMany({
    where: relationCentreFilter,
    include: {
      user: true
    }
  });
  const tiers = await prisma.tier.findMany();

  return JSON.parse(JSON.stringify({
    students,
    centres,
    coaches,
    tiers
  }));
}

export async function backfillParentUsersDB() {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }

  const families = await prisma.family.findMany({
    where: { email: { not: null } }
  });

  let createdCount = 0;
  for (const fam of families) {
    if (!fam.email || !fam.email.trim()) continue;
    const cleanEmail = fam.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!existing) {
      const rawPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await prisma.user.create({
        data: {
          name: fam.primary_name || 'Parent',
          email: cleanEmail,
          password: hashedPassword,
          role: 'parent',
          centre_id: null
        }
      }).catch(err => console.warn("Backfill parent user error:", err));
      createdCount++;
    }
  }

  return { createdCount };
}

// -------------------------------------------------------------
// Notification Helpers & Actions (WhatsApp & Email)
// -------------------------------------------------------------

// Helper to send transactional emails using Resend API with graceful local fallback
async function sendEmailNotification(toEmail: string, subject: string, bodyHtml: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Master Moves OS <notifications@mastermoves.com>',
          to: [toEmail],
          subject: subject,
          html: bodyHtml
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error(`Resend API Error: ${response.statusText} (${errText})`);
      } else {
        console.log(`✓ Email sent successfully via Resend API to ${toEmail}`);
      }
    } catch (e) {
      console.error('Failed to send email via Resend:', e);
    }
  } else {
    // Local development simulation logging
    console.log('\n--- [EMAIL SIMULATION] ---');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log('Body:', bodyHtml.replace(/<[^>]*>/g, ' ')); // clean html tags for console
    console.log('---------------------------\n');
  }
}

// Helper to send WhatsApp messages (supports Meta Cloud API, Twilio, or UltraMsg)
async function sendWhatsAppNotification(toPhone: string, bodyText: string) {
  const cleanPhone = toPhone.replace(/[\s\-\(\)]/g, '');

  // 1. UltraMsg (Easiest - Scan QR code, no Meta approval needed)
  const ultramsgInstance = process.env.ULTRAMSG_INSTANCE_ID;
  const ultramsgToken = process.env.ULTRAMSG_TOKEN;
  if (ultramsgInstance && ultramsgToken) {
    try {
      const response = await fetch(`https://api.ultramsg.com/${ultramsgInstance}/messages/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: ultramsgToken,
          to: cleanPhone,
          body: bodyText
        })
      });
      if (response.ok) {
        console.log(`✓ WhatsApp sent via UltraMsg API to ${cleanPhone}`);
        return;
      }
    } catch (e) {
      console.error('UltraMsg WhatsApp Error:', e);
    }
  }

  // 2. Twilio for WhatsApp
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  if (twilioSid && twilioAuth) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`,
          To: cleanPhone.startsWith('whatsapp:') ? cleanPhone : `whatsapp:${cleanPhone}`,
          Body: bodyText
        })
      });
      if (response.ok) {
        console.log(`✓ WhatsApp sent via Twilio to ${cleanPhone}`);
        return;
      }
    } catch (e) {
      console.error('Twilio WhatsApp Error:', e);
    }
  }

  // 3. Official Meta Cloud API
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (accessToken && phoneId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone.replace(/^\+/, ''),
          type: "text",
          text: { body: bodyText }
        })
      });
      if (response.ok) {
        console.log(`✓ WhatsApp sent via Meta API to ${cleanPhone}`);
        return;
      }
    } catch (e) {
      console.error('Meta WhatsApp API Error:', e);
    }
  }

  // Local development simulation logging
  console.log('\n--- [WHATSAPP SIMULATION] ---');
  console.log(`To: ${cleanPhone}`);
  console.log(`Message: ${bodyText}`);
  console.log('------------------------------\n');
}

// Server Action: Send Student Progress Report
export async function sendProgressReport(studentId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { family: true, coach: { include: { user: true } }, centre: true }
  });
  if (!student) throw new Error("Student not found");

  const parentName = student.family?.primary_name || 'Parent';
  const email = student.family?.email;
  const phone = student.family?.phone;
  const coachName = student.coach?.user?.name || 'Coach';
  const centreName = student.centre?.name || 'Centre';

  const subject = `Master Moves Chess - Progress Report for ${student.name}`;
  const bodyText = `Hi ${parentName}, here is the chess progress report for ${student.name} at ${centreName}. Assigned Coach: ${coachName}. Current level: ${student.level || 'Beginner'}. Pace Status: ${student.pace_status || 'On track'}. We are excited about their continuation!`;
  const bodyHtml = `<p>Hi <b>${parentName}</b>,</p><p>Here is the chess progress report for <b>${student.name}</b> at ${centreName}.</p><ul><li><b>Assigned Coach:</b> ${coachName}</li><li><b>Current level:</b> ${student.level || 'Beginner'}</li><li><b>Pace Status:</b> ${student.pace_status || 'On track'}</li></ul><p>We are excited about their chess development and continuation!</p><p>Best regards,<br/>Master Moves Team</p>`;

  if (email && email.trim()) {
    await sendEmailNotification(email.trim(), subject, bodyHtml);
    await prisma.notification.create({
      data: {
        student_id: studentId,
        type: 'progress_report',
        channel: 'email',
        status: 'sent',
        sent_at: new Date()
      }
    });
  }

  if (phone && phone.trim()) {
    await sendWhatsAppNotification(phone.trim(), bodyText);
    await prisma.notification.create({
      data: {
        student_id: studentId,
        type: 'progress_report',
        channel: 'whatsapp',
        status: 'sent',
        sent_at: new Date()
      }
    });
  }

  return {
    success: true,
    parentName,
    email: email || 'No email registered',
    phone: phone || 'No phone registered'
  };
}

// Server Action: Notify all enrolled students for a schedule class slot
export async function notifyEnrolledStudents(slotId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  const slot = await prisma.scheduleSlot.findUnique({
    where: { id: slotId },
    include: { centre: true, coach: { include: { user: true } } }
  });
  if (!slot) throw new Error("Schedule slot not found");

  const enrollments = await prisma.enrollment.findMany({
    where: { slot_id: slotId },
    include: { student: { include: { family: true } } }
  });

  const coachName = slot.coach?.user?.name || 'Coach';
  const centreName = slot.centre?.name || 'Centre';

  let count = 0;
  for (const enr of enrollments) {
    const student = enr.student;
    if (!student) continue;

    const parentName = student.family?.primary_name || 'Parent';
    const email = student.family?.email;
    const phone = student.family?.phone;

    const subject = `Upcoming Chess Class Reminder - Master Moves`;
    const bodyText = `Hi ${parentName}, this is a reminder that ${student.name} has a scheduled chess session on ${slot.day} at ${slot.time} at ${centreName} with ${coachName}. Please make sure they attend on time.`;
    const bodyHtml = `<p>Hi <b>${parentName}</b>,</p><p>This is a reminder that <b>${student.name}</b> has a scheduled chess session on <b>${slot.day} at ${slot.time}</b> at ${centreName} with ${coachName}.</p><p>Please make sure they arrive on time.</p><p>Best regards,<br/>Master Moves Team</p>`;

    if (email && email.trim()) {
      await sendEmailNotification(email.trim(), subject, bodyHtml);
      await prisma.notification.create({
        data: {
          student_id: student.id,
          type: 'class_reminder',
          channel: 'email',
          status: 'sent',
          sent_at: new Date()
        }
      });
    }

    if (phone && phone.trim()) {
      await sendWhatsAppNotification(phone.trim(), bodyText);
      await prisma.notification.create({
        data: {
          student_id: student.id,
          type: 'class_reminder',
          channel: 'whatsapp',
          status: 'sent',
          sent_at: new Date()
        }
      });
    }
    count++;
  }

  return { success: true, count };
}

export async function linkSiblingFamily(studentId: string, familyId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { family_id: familyId }
  });
}

