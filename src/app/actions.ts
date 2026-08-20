"use server";

import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";
import { unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';

async function verifySession() {
  try {
    const cookieStore = await cookies();
    const cookieUserId = cookieStore.get('mmos_active_user_id')?.value;
    if (cookieUserId) {
      const user = await prisma.user.findUnique({
        where: { id: cookieUserId }
      });
      if (user) {
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            centre_id: user.centre_id
          }
        } as any;
      }
    }
  } catch (err) {
    console.warn("Could not read mmos_active_user_id from cookies:", err);
  }

  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    console.warn("Could not retrieve session via next-auth:", err);
  }

  if (!session || !session.user) {
    if (process.env.NODE_ENV === 'development') {
      const defaultUser = await prisma.user.findFirst({
        where: { role: 'owner' }
      });
      if (defaultUser) {
        return {
          user: {
            id: defaultUser.id,
            name: defaultUser.name,
            email: defaultUser.email,
            role: defaultUser.role,
            centre_id: defaultUser.centre_id
          }
        } as any;
      }
    }
    throw new Error("Unauthorized: No session found");
  }
  return session;
}

export async function logAuditDB(actorId: string | null, action: string, entity: string, before: any = null, after: any = null) {
  try {
    await prisma.auditLog.create({
      data: {
        actor_id: actorId,
        action,
        entity,
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: after ? JSON.parse(JSON.stringify(after)) : null,
        at: new Date()
      }
    });
  } catch (err) {
    console.warn("Failed to record DB audit log:", err);
  }
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData
  });
  await logAuditDB(session.user.id, 'UPDATE_USER_CREDENTIALS', 'users', { id: userId }, { name: updated.name, email: updated.email, role: updated.role });
  return updated;
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

  await logAuditDB(session.user.id, 'ADD_COACH', 'coaches', null, { id: coach.id, name, email });
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
  const updated = await prisma.coach.update({
    where: { id: coachId },
    data: {
      centre_id: centreId || null,
      centre_ids: centreIds
    }
  });
  await logAuditDB(session.user.id, 'UPDATE_COACH', 'coaches', { id: coachId }, { name, centreId, centreIds });
  return updated;
}

export async function reassignCoachDB(fromCoachId: string, toCoachId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  // Move all students from one coach to another
  const res = await prisma.student.updateMany({
    where: { coach_id: fromCoachId },
    data: { coach_id: toCoachId || null }
  });
  await logAuditDB(session.user.id, 'REASSIGN_COACH_STUDENTS', 'students', { fromCoachId }, { toCoachId });
  return res;
}

export async function deleteCoachDB(coachId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const res = await prisma.coach.update({
    where: { id: coachId },
    data: { active: false }
  });
  await logAuditDB(session.user.id, 'DELETE_COACH', 'coaches', { id: coachId }, { active: false });
  return res;
}

export async function saveCentreDB(data: { name: string; status: string }) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const res = await prisma.centre.create({
    data: { name: data.name, status: data.status }
  });
  await logAuditDB(session.user.id, 'CREATE_CENTRE', 'centres', null, data);
  return res;
}

export async function updateCentreStatusDB(centreId: string, status: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const res = await prisma.centre.update({
    where: { id: centreId },
    data: { status }
  });
  await logAuditDB(session.user.id, 'UPDATE_CENTRE_STATUS', 'centres', { id: centreId }, { status });
  return res;
}

export async function deleteCentreDB(centreId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }
  const res = await prisma.centre.update({
    where: { id: centreId },
    data: { status: 'inactive' }
  });
  await logAuditDB(session.user.id, 'DELETE_CENTRE', 'centres', { id: centreId }, { status: 'inactive' });
  return res;
}


// -------------------------------------------------------------
// Module 3 & 4: Scheduling and Progress
// -------------------------------------------------------------

export async function createScheduleSlot(centreId: string, coachId: string, day: string, time: string, level: string, capacity: number = 10, isSummerCamp: boolean = false, explicitId?: string) {
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

  const data: any = {
    centre_id: centreId,
    coach_id: coachId,
    day,
    time,
    level,
    capacity,
    is_summer_camp: isSummerCamp
  };
  
  if (explicitId) {
    data.id = explicitId.startsWith('slot-') ? explicitId.replace('slot-', '') : explicitId;
  }

  return await prisma.scheduleSlot.create({
    data
  });
}

export async function toggleSummerCampSlot(slotId: string, isSummerCamp: boolean, newTime?: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  const cleanSlotId = slotId.startsWith('slot-') ? slotId.replace('slot-', '') : slotId;
  const data: any = { is_summer_camp: isSummerCamp };
  if (newTime) {
    data.time = newTime;
  }
  return await prisma.scheduleSlot.update({
    where: { id: cleanSlotId },
    data
  });
}

export async function enrollStudent(studentId: string, slotId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk' && session.user.role !== 'coach') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }

  // Ensure slotId is a clean UUID
  const cleanSlotId = slotId.startsWith('slot-') ? slotId.replace('slot-', '') : slotId;

  // Check if enrollment already exists to prevent duplicate key errors
  const existing = await prisma.enrollment.findFirst({
    where: {
      student_id: studentId,
      slot_id: cleanSlotId
    }
  });
  if (existing) {
    return { success: true, id: existing.id };
  }

  const created = await prisma.enrollment.create({
    data: {
      student_id: studentId,
      slot_id: cleanSlotId
    }
  });
  return { success: true, id: created.id };
}

export async function unenrollStudent(studentId: string, slotId: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk' && session.user.role !== 'coach') {
    throw new Error("Unauthorized");
  }
  if (session.user.role === 'front_desk' && session.user.centre_id) {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (student?.centre_id !== session.user.centre_id) {
      throw new Error("Unauthorized");
    }
  }
  // Ensure slotId is a clean UUID
  const cleanSlotId = slotId.startsWith('slot-') ? slotId.replace('slot-', '') : slotId;
  await prisma.enrollment.deleteMany({
    where: {
      student_id: studentId,
      slot_id: cleanSlotId
    }
  });
  return { success: true };
}

export async function logProgress(studentId: string, coachId: string, focusArea: string, evaluation: number, notes: string, dateStr?: string) {
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
      notes,
      date: dateStr ? new Date(dateStr) : new Date()
    }
  });
}


export async function syncDatabaseToClient() {
  noStore();
  const session = await verifySession();
  const role = session.user.role;
  const userCentreId = session.user.centre_id;

  // Database Self-Healing Migration for Student Custom IDs
  try {
    const allSts = await prisma.student.findMany({
      include: { centre: true }
    });

    const usedIds = new Set<string>();
    const studentsToUpdate = [];

    // First pass: collect all existing non-colliding custom IDs from flags
    for (const s of allSts) {
      const flags = typeof s.flags === 'object' && s.flags ? (s.flags as any) : {};
      if (flags.custom_student_id) {
        usedIds.add(flags.custom_student_id);
      }
    }

    // Second pass: assign custom IDs to students who don't have them, or resolve duplicates
    for (const s of allSts) {
      const flags = typeof s.flags === 'object' && s.flags ? { ...(s.flags as any) } : {};
      let idToAssign = flags.custom_student_id;
      
      const prefix = (s.centre?.name || 'BAY').slice(0, 3).toUpperCase();
      let hasChange = false;

      // If missing, or if it is a duplicate ID assigned to more than 1 student in database
      const isDuplicate = idToAssign && [...allSts].filter(st => {
        const otherFlags = typeof st.flags === 'object' && st.flags ? (st.flags as any) : {};
        return otherFlags.custom_student_id === idToAssign;
      }).length > 1;

      if (!idToAssign || isDuplicate) {
        // Fallback to fide_id if it's a real FIDE rating ID and not MM-xxxx
        if (s.fide_id && !s.fide_id.startsWith('MM-')) {
          idToAssign = s.fide_id;
        } else {
          // If it was a duplicate, remove it from usedIds so we can generate a new one
          if (idToAssign) usedIds.delete(idToAssign);
          const numPart = s.id.replace(/\D/g, '').slice(0, 3) || '000';
          let candidate = `${prefix}-${numPart}`;
          
          // Resolve collisions immediately
          if (usedIds.has(candidate)) {
            let num = parseInt(numPart, 10) || 100;
            while (usedIds.has(`${prefix}-${num}`)) {
              num++;
            }
            candidate = `${prefix}-${num}`;
          }
          idToAssign = candidate;
        }
        
        flags.custom_student_id = idToAssign;
        usedIds.add(idToAssign);
        hasChange = true;
      }

      if (hasChange) {
        studentsToUpdate.push({ id: s.id, flags });
      }
    }

    // Save updates to database
    if (studentsToUpdate.length > 0) {
      await Promise.all(
        studentsToUpdate.map(item =>
          prisma.student.update({
            where: { id: item.id },
            data: { flags: item.flags }
          })
        )
      );
    }
  } catch (migErr) {
    console.error("Custom ID self-healing migration failed:", migErr);
  }

  // Database Self-Healing Migration for Package Numbers
  try {
    const allStudents = await prisma.student.findMany({
      include: { packages: true }
    });
    const pkgsToUpdate = [];
    for (const s of allStudents) {
      const sorted = [...s.packages].sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
      });
      
      for (let i = 0; i < sorted.length; i++) {
        const expectedNo = i + 1;
        if (sorted[i].package_number !== expectedNo) {
          pkgsToUpdate.push({ id: sorted[i].id, package_number: expectedNo });
        }
      }
    }
    if (pkgsToUpdate.length > 0) {
      await Promise.all(
        pkgsToUpdate.map(item =>
          prisma.package.update({
            where: { id: item.id },
            data: { package_number: item.package_number }
          })
        )
      );
    }
  } catch (pkgMigErr) {
    console.error("Package number self-healing migration failed:", pkgMigErr);
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
      tournamentReports,
      auditLogsRaw
    ] = await Promise.all([
      prisma.centre.findMany(),
      prisma.user.findMany(),
      prisma.coach.findMany({ include: { user: true } }),
      prisma.family.findMany(),
      prisma.student.findMany(),
      prisma.tier.findMany(),
      prisma.package.findMany(),
      prisma.scheduleSlot.findMany(),
      prisma.attendance.findMany({
        where: {
          date: {
            gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.invoice.findMany(),
      prisma.enquiry.findMany(),
      prisma.enrollment.findMany(),
      prisma.progressLog.findMany(),
      prisma.notification.findMany(),
      prisma.tournamentReport.findMany(),
      prisma.auditLog.findMany({
        orderBy: { at: 'desc' },
        take: 200,
        include: { actor: true }
      })
    ]);

    const coaches = coachesRaw.map(c => ({
      ...c,
      name: c.user?.name || 'Unassigned',
    }));

    const auditLogs = auditLogsRaw.map(l => ({
      id: l.id,
      actor: l.actor?.name || l.actor_id || 'System',
      action: l.action || 'activity',
      entity: l.entity || 'general',
      before: l.before,
      after: l.after,
      at: l.at ? l.at.toISOString() : new Date().toISOString()
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
      tournamentReports,
      auditLogs
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
      prisma.attendance.findMany({
        where: {
          date: {
            gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
          }
        }
      }),
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

    const primaryStudents = await prisma.student.findMany({
      where: { coach_id: coachRecord.id }
    });
    const primaryStudentIds = primaryStudents.map(s => s.id);

    const coachSlots = await prisma.scheduleSlot.findMany({
      where: { coach_id: coachRecord.id }
    });
    const coachSlotIds = coachSlots.map(s => s.id);

    const enrollmentsRaw = await prisma.enrollment.findMany({
      where: { slot_id: { in: coachSlotIds } }
    });
    const enrolledStudentIds = enrollmentsRaw.map(e => e.student_id);

    const allVisibleStudentIds = Array.from(new Set([...primaryStudentIds, ...enrolledStudentIds]));

    const students = await prisma.student.findMany({
      where: { id: { in: allVisibleStudentIds } }
    });
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
        where: { student_id: { in: allVisibleStudentIds } }
      }),
      prisma.scheduleSlot.findMany({
        where: { coach_id: coachRecord.id }
      }),
      prisma.attendance.findMany({
        where: { student_id: { in: allVisibleStudentIds } }
      }),
      prisma.invoice.findMany({
        where: { student_id: { in: allVisibleStudentIds } }
      }),
      prisma.enquiry.findMany(),
      prisma.enrollment.findMany(),
      prisma.progressLog.findMany({
        where: { coach_id: coachRecord.id }
      }),
      prisma.notification.findMany({
        where: { student_id: { in: allVisibleStudentIds } }
      }),
      prisma.tournamentReport.findMany({
        where: { student_id: { in: allVisibleStudentIds } }
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
  try {
    const session = await verifySession();
    if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
      return { success: false, error: "Unauthorized" };
    }
    if (session.user.role === 'front_desk' && session.user.centre_id) {
      if (data.centre_id && data.centre_id !== session.user.centre_id) {
        return { success: false, error: "Unauthorized" };
      }
    }

    // Validate UUID format for foreign keys to prevent db crash
    const isValidUUID = (id?: string) => {
      if (!id) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    };

    const finalCentreId = isValidUUID(data.centre_id) ? data.centre_id : null;
    const finalCoachId = isValidUUID(data.coach_id) ? data.coach_id : null;

    const enquiry = await prisma.enquiry.create({
      data: {
        child: data.child,
        age: data.age || null,
        parent: data.parent,
        phone: data.phone,
        source: data.source,
        stage: data.stage.toLowerCase().replace(' ', '_'),
        centre_id: finalCentreId,
        experience: data.experience || null,
        trial_date: data.trial_date ? new Date(data.trial_date) : null,
        coach_id: finalCoachId,
        notes: data.notes || null,
      }
    });
    return { success: true, data: enquiry };
  } catch (err: any) {
    console.error("Error saving enquiry:", err);
    return { success: false, error: err.message || String(err) };
  }
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
export async function updateStudentFlags(studentId: string, pkgId?: string, updatedRemaining?: number, skipSiblings = false) {
  // 1. Fetch all non-frozen, non-unbilled packages for the student or family siblings if family shared
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { family: { include: { students: true } } }
  });
  if (!student) return;

  // Find all sibling student IDs if family exists
  const studentIds = student.family ? student.family.students.map(s => s.id) : [studentId];

  // Retrieve packages:
  // - Packages owned directly by this student
  // - OR family shared packages owned by siblings
  const allPkgs = await prisma.package.findMany({
    where: {
      OR: [
        { student_id: studentId },
        { student_id: { in: studentIds }, is_family_shared: true }
      ],
      frozen: false
    },
    orderBy: { start_date: 'asc' }
  });

  // Separate packages:
  // - Paid packages (new, renewal, tournament, completed, settled)
  // - Unbilled packages (arrears tracking)
  const paidPkgs = allPkgs.filter(p => p.kind !== 'unbilled');
  const unbilledPkgs = allPkgs.filter(p => p.kind === 'unbilled');

  // Sort paidPkgs stably by start_date asc, then by kind order, and break ties with ID localeCompare to ensure stability.
  const kindOrder: Record<string, number> = { 'new': 1, 'settled': 2, 'renewal': 3, 'tournament': 4 };
  paidPkgs.sort((a, b) => {
    const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
    const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    const orderA = kindOrder[a.kind || ''] || 99;
    const orderB = kindOrder[b.kind || ''] || 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.id.localeCompare(b.id);
  });

  // Reset paid packages to their full initial entitlement
  for (const p of paidPkgs) {
    const initialEntitlement = p.classes_total + (p.bonus_classes || 0);
    p.classes_remaining = initialEntitlement;
  }

  // 2. Fetch all attendance logs for the student AND all siblings
  const siblingAtts = await prisma.attendance.findMany({
    where: {
      student_id: { in: studentIds },
      status: { in: ['present', 'absent', 'makeup'] }
    },
    orderBy: { date: 'asc' }
  });

  // Chronologically consume from packages:
  // For each attendance record, find the oldest eligible package with classes remaining and deduct from it.
  let primaryDeficit = 0;
  const packageClosingDates: Record<string, Date> = {};

  for (const att of siblingAtts) {
    let amountToDeduct = att.duration || 1;
    const isPrimary = att.student_id === studentId;

    // Try to deduct from eligible packages
    for (const p of paidPkgs) {
      if (amountToDeduct <= 0) break;
      if (p.classes_remaining <= 0) continue;

      // Eligibility check:
      // - Primary student can deduct from any package they have access to (both private and shared)
      // - Sibling can ONLY deduct from shared packages
      const isEligible = isPrimary || p.is_family_shared;

      if (isEligible) {
        const deduct = Math.min(p.classes_remaining, amountToDeduct);
        p.classes_remaining -= deduct;
        amountToDeduct -= deduct;
        if (p.classes_remaining === 0) {
          packageClosingDates[p.id] = new Date(att.date);
        }
      }
    }

    // If there is still a deduction left, it becomes an unbilled deficit
    if (amountToDeduct > 0 && isPrimary) {
      primaryDeficit += amountToDeduct;
    }
  }

  // 4. Update the paid packages in the database
  // We keep the original package kind (New/Renewal/Tournament) and only update classes_remaining.
  // We dynamically stamp ended_at to the closing class date if classes_remaining is 0, and clear it to null if balance becomes > 0.
  for (const p of paidPkgs) {
    const shouldBeEnded = p.classes_remaining === 0;
    const closingDate = packageClosingDates[p.id] || new Date();
    await prisma.package.update({
      where: { id: p.id },
      data: {
        classes_remaining: p.classes_remaining,
        ended_at: shouldBeEnded ? (p.ended_at || closingDate) : null
      }
    });
  }

  // 5. Handle unbilled overflow for the primary student
  if (primaryDeficit > 0) {
    const existingUnbilled = unbilledPkgs[0];
    if (existingUnbilled) {
      await prisma.package.update({
        where: { id: existingUnbilled.id },
        data: { classes_remaining: -primaryDeficit }
      });
    } else {
      const existingPkgsCount = await prisma.package.count({ where: { student_id: studentId } });
      await prisma.package.create({
        data: {
          student_id: studentId,
          classes_total: 0,
          classes_remaining: -primaryDeficit,
          kind: 'unbilled',
          start_date: new Date(),
          first_class_date: new Date(),
          package_number: existingPkgsCount + 1
        }
      });
    }
  } else {
    for (const up of unbilledPkgs) {
      await prisma.package.update({
        where: { id: up.id },
        data: { classes_remaining: 0 }
      });
    }
  }

  // 6. Update student flags and metrics
  const updatedPkgs = await prisma.package.findMany({
    where: { student_id: studentId, frozen: false }
  });

  const activePaidPkgs = updatedPkgs.filter(p => p.kind !== 'unbilled' && p.kind !== 'settled');
  const totalRemaining = activePaidPkgs.reduce((sum, p) => sum + p.classes_remaining, 0);

  const unpaidClasses = primaryDeficit;

  // Compute student rate
  let studentRate = 125;
  const lastPkg = activePaidPkgs[activePaidPkgs.length - 1];
  if (lastPkg) {
    const invoice = await prisma.invoice.findFirst({ where: { package_id: lastPkg.id } });
    const totalClasses = lastPkg.classes_total + (lastPkg.bonus_classes || 0);
    if (invoice && invoice.amount) {
      studentRate = Math.round(Number(invoice.amount) / totalClasses);
    } else if (lastPkg.tier_id) {
      const tier = await prisma.tier.findUnique({ where: { id: lastPkg.tier_id } });
      if (tier && tier.price) {
        const discount = lastPkg.discount_pct ? Number(lastPkg.discount_pct) : 0;
        studentRate = Math.round(Number(tier.price) * (1 - discount / 100) / totalClasses);
      }
    }
  }
  const unpaidValue = unpaidClasses * studentRate;

  const flags = typeof student.flags === 'object' && student.flags ? { ...(student.flags as any) } : {};
  let hasLowPackage = false;
  if (totalRemaining <= 2) {
    hasLowPackage = true;
  } else {
    for (const p of activePaidPkgs) {
      if (p.classes_remaining > 0) {
        const initial = p.classes_total + (p.bonus_classes || 0);
        if (initial > 0 && (p.classes_remaining / initial) <= 0.20) {
          hasLowPackage = true;
          break;
        }
      }
    }
  }

  if (hasLowPackage) {
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

  const latestAttendance = await prisma.attendance.findFirst({
    where: { student_id: studentId, status: { in: ['present', 'makeup'] } },
    orderBy: { date: 'desc' }
  });

  await prisma.student.update({
    where: { id: studentId },
    data: {
      flags,
      last_attended: latestAttendance ? latestAttendance.date : null
    }
  });

  // Re-run flags for siblings to sync their shared package balances
  if (!skipSiblings && student.family && student.family.students.length > 1) {
    for (const sib of student.family.students) {
      if (sib.id !== studentId) {
        await updateStudentFlags(sib.id, undefined, undefined, true);
      }
    }
  }
}

export async function logAttendance(studentId: string, status: string | null, coachId: string, slotId?: string, duration: number = 1, customDateStr?: string, topic?: string) {
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

  let targetDate = new Date();
  if (customDateStr) {
    targetDate = new Date(customDateStr);
  }

  // Timezone-safe UTC midnight date
  const targetDateMidnight = new Date(targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z');

  const existing = await prisma.attendance.findFirst({
    where: {
      student_id: studentId,
      slot_id: slotId || null,
      date: targetDateMidnight
    }
  });

  if (existing) {
    if (!status) {
      const deletedRecord = await prisma.attendance.delete({
        where: { id: existing.id }
      });
      await updateStudentFlags(studentId);
      await logAuditDB(session.user.id, 'DELETE_ATTENDANCE', 'attendance', existing, null);
      return deletedRecord;
    }

    if (existing.status === status && existing.duration === duration && (topic === undefined || existing.topic === topic)) {
      return existing;
    }

    const oldStatus = existing.status;
    const oldDuration = existing.duration;

    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { status, duration, topic: topic !== undefined ? topic : existing.topic }
    });
    await updateStudentFlags(studentId);
    await logAuditDB(session.user.id, 'UPDATE_ATTENDANCE', 'attendance', { status: oldStatus, duration: oldDuration }, updated);
    return updated;
  }

  if (!status) return null;

  const newRecord = await prisma.attendance.create({
    data: {
      student_id: studentId,
      status: status,
      coach_id: coachId,
      slot_id: slotId || null,
      date: targetDateMidnight,
      duration: duration,
      topic: topic || null
    }
  });

  await logAuditDB(session.user.id, 'CREATE_ATTENDANCE', 'attendance', null, newRecord);
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

    if (studentData.centre_id && studentData.centre_id !== existing.centre_id) {
      const newCentre = await prisma.centre.findUnique({ where: { id: studentData.centre_id } });
      const prefix = (newCentre?.name || 'BAY').slice(0, 3).toUpperCase();
      const flags = typeof studentData.flags === 'object' && studentData.flags ? { ...studentData.flags } : {};
      if (flags.custom_student_id) {
        flags.custom_student_id = flags.custom_student_id.replace(/^[A-Z]{3}/, prefix);
        studentData.flags = flags;
      }
    }

    const updated = await prisma.student.update({
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
    await logAuditDB(session.user.id, 'UPDATE_STUDENT', 'students', existing, updated);
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
    await logAuditDB(session.user.id, 'CREATE_STUDENT', 'students', null, createdStudent);
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
    await logAttendance(record.student_id, record.status, record.coach_id, record.slot_id || undefined, record.duration, record.date, record.topic);
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

  // 2b. Automatically create student User account
  const studentEmail = `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@mastermoves.ae`;
  const existingStudentUser = await prisma.user.findUnique({
    where: { email: studentEmail }
  });
  if (!existingStudentUser) {
    const rawPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    await prisma.user.create({
      data: {
        name: data.name,
        email: studentEmail,
        password: hashedPassword,
        role: 'parent',
        centre_id: data.centre_id || null
      }
    }).catch(err => console.warn("Student user auto-creation skipped:", err));
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
      parent_name: data.parent_name || null,
      referral_source: data.acquisition_source || null,
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

      const existingPkgsCount = await prisma.package.count({ where: { student_id: student.id } });
      const packageId = crypto.randomUUID();
      await prisma.package.create({
        data: {
          id: packageId,
          student_id: student.id,
          tier_id: tier.id,
          kind: 'new',
          classes_total: classesTotal,
          classes_remaining: grandTotal,
          discount_pct: discount,
          start_date: new Date(),
          first_class_date: new Date(),
          package_number: existingPkgsCount + 1,
          bonus_classes: bonusClasses
        }
      });

      // Auto-generate paid invoice for billing ledger
      let finalAmount = 0;
      if (data.rate_per_class && data.package_size) {
        finalAmount = (Number(data.package_size) || 12) * (Number(data.rate_per_class) || 100);
      } else {
        const tierPrice = Number(tier.price) || 1000;
        finalAmount = Math.round(tierPrice * (1 - discount / 100));
      }

      await prisma.invoice.create({
        data: {
          student_id: student.id,
          package_id: packageId,
          amount: finalAmount,
          status: data.payment_status || data.flags?.payment_status || 'paid',
          method: data.payment_method || data.flags?.payment_method || 'cash',
          settlement_ref: data.payment_remarks || data.flags?.payment_remarks || '',
          created_at: new Date()
        }
      }).catch(err => console.warn("Auto invoice generation skipped:", err));
      
      await updateStudentFlags(student.id);
    }
  }

  return student;
}

export async function renewPackage(studentId: string, tierId: string, kind: 'renewal' | 'tournament' | 'new' = 'renewal', isFamilyShared: boolean = false, customClasses?: number, customRate?: number, paymentMethod?: string, paymentRemarks?: string) {
  try {
    const session = await verifySession();
    if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
      return { success: false, error: "Unauthorized" };
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { family: true }
    });

    if (!student) return { success: false, error: "Student not found" };

    const tier = await prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) return { success: false, error: "Tier not found" };

    // Check for sibling discount
    const siblingsCount = student.family_id
      ? await prisma.student.count({
          where: { family_id: student.family_id, status: 'active' }
        })
      : 1;
    
    const discount = siblingsCount > 1 ? 10 : 0;
    
    // Parse total classes
    let classesTotal = customClasses || 8;
    if (!customClasses && tier.inclusions && Array.isArray(tier.inclusions)) {
       const match = tier.inclusions[0]?.match(/(\d+)\s*classes/i);
       if (match) classesTotal = parseInt(match[1], 10);
    }

    // Arrears calculations
    let arrearsAmount = 0;
    const unbilledPkgs = await prisma.package.findMany({
      where: { student_id: student.id, kind: 'unbilled' }
    });
    const totalArrearsClasses = unbilledPkgs.reduce((sum, p) => sum + Math.abs(p.classes_remaining), 0);
    if (totalArrearsClasses > 0) {
      let studentRate = 100;
      const lastPkg = await prisma.package.findFirst({
        where: { student_id: student.id, NOT: { kind: { in: ['unbilled', 'settled'] } } },
        orderBy: { start_date: 'desc' }
      });
      if (lastPkg) {
        const lastInvoice = await prisma.invoice.findFirst({ where: { package_id: lastPkg.id } });
        if (lastInvoice && lastInvoice.amount) {
          studentRate = Math.round(Number(lastInvoice.amount) / lastPkg.classes_total);
        }
      }
      arrearsAmount = totalArrearsClasses * studentRate;
    }

    // Reactivate student if they were inactive or departed
    if (student.status !== 'active') {
      await prisma.student.update({
        where: { id: student.id },
        data: { status: 'active' }
      });
    }

    const existingPkgsCount = await prisma.package.count({ where: { student_id: student.id } });
    const pkg = await prisma.package.create({
      data: {
        student_id: student.id,
        tier_id: tier.id,
        kind: kind,
        classes_total: classesTotal,
        classes_remaining: classesTotal,
        discount_pct: discount,
        is_family_shared: isFamilyShared,
        start_date: new Date(),
        first_class_date: new Date(),
        package_number: existingPkgsCount + 1,
      }
    });

    // Auto-generate invoice for billing ledger (includes arrears)
    const tierPrice = (customClasses && customRate) ? customClasses * customRate : (Number(tier.price) || 1000);
    const finalAmount = Math.round(tierPrice * (1 - discount / 100)) + arrearsAmount;

    await prisma.invoice.create({
      data: {
        package_id: pkg.id,
        student_id: student.id,
        amount: finalAmount,
        status: 'paid',
        method: paymentMethod || 'cash',
        settlement_ref: paymentRemarks || '',
        created_at: new Date()
      }
    }).catch(err => console.warn("Auto invoice generation skipped:", err));

    // Transition unbilled packages to settled status
    const renewalDate = new Date();
    for (const unbilled of unbilledPkgs) {
      if (unbilled.classes_remaining < 0) {
        await prisma.package.update({
          where: { id: unbilled.id },
          data: {
            kind: 'settled',
            classes_total: Math.abs(unbilled.classes_remaining),
            classes_remaining: 0,
            start_date: renewalDate,
            ended_at: renewalDate
          }
        });
      }
    }

    await updateStudentFlags(student.id);

    return { success: true, data: JSON.parse(JSON.stringify(pkg)) };
  } catch (err: any) {
    console.error("[RENEW_PACKAGE_ERROR]", err);
    return { success: false, error: err.message || "Failed to renew package" };
  }
}

export async function renewSiblingPackage(
  tierId: string,
  kind: 'renewal' | 'new' | 'tournament' = 'renewal',
  allocations: Array<{ studentId: string; classes: number; amount: number; discountPct?: number }>
) {
  try {
    const session = await verifySession();
    if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
      throw new Error("Unauthorized");
    }

    const results = [];
    const tier = await prisma.tier.findUnique({ where: { id: tierId } }) || { id: tierId };

    for (const alloc of allocations) {
      const student = await prisma.student.findUnique({
        where: { id: alloc.studentId }
      });
      if (!student) continue;

      // Reactivate student if they were inactive or departed
      if (student.status !== 'active') {
        await prisma.student.update({
          where: { id: student.id },
          data: { status: 'active' }
        });
      }

      const existingPkgsCount = await prisma.package.count({ where: { student_id: student.id } });
      const pkg = await prisma.package.create({
        data: {
          student_id: student.id,
          tier_id: tier.id,
          kind: kind,
          classes_total: Number(alloc.classes),
          classes_remaining: Number(alloc.classes),
          discount_pct: Number(alloc.discountPct ?? 10),
          start_date: new Date(),
          first_class_date: new Date(),
          package_number: existingPkgsCount + 1,
        }
      });

      await prisma.invoice.create({
        data: {
          student_id: student.id,
          package_id: pkg.id,
          amount: Math.round(alloc.amount),
          status: 'paid',
          created_at: new Date()
        }
      }).catch(err => console.warn("Auto invoice generation skipped:", err));

      await updateStudentFlags(student.id);

      results.push(pkg);
    }

    return JSON.parse(JSON.stringify(results));
  } catch (err: any) {
    console.error("[RENEW_SIBLING_PACKAGE_ERROR]", err);
    throw new Error(err.message || "Failed to renew sibling package");
  }
}

export async function getReconciliationData() {
  const session = await verifySession();
  const role = session.user.role;
  const centreId = session.user.centre_id;

  if (role !== 'owner' && role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  const filter = {};

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
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  const before = await prisma.attendance.findUnique({ where: { id } });
  const deleted = await prisma.attendance.delete({
    where: { id }
  });
  await logAuditDB(session.user.id, 'DELETE_ATTENDANCE_REGISTER', 'attendance', before, null);
  if (before?.student_id) {
    await updateStudentFlags(before.student_id);
  }
  return deleted;
}

export async function updateAttendanceDB(id: string, status: string) {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'coach' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }
  const before = await prisma.attendance.findUnique({ where: { id } });
  const updated = await prisma.attendance.update({
    where: { id },
    data: { status }
  });
  await logAuditDB(session.user.id, 'UPDATE_ATTENDANCE_REGISTER', 'attendance', before, updated);
  if (updated?.student_id) {
    await updateStudentFlags(updated.student_id);
  }
  return updated;
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

  const students = await prisma.student.findMany();

  let createdCount = 0;
  for (const student of students) {
    const cleanName = student.name.trim();
    const emailPrefix = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const cleanEmail = `${emailPrefix}@mastermoves.ae`;

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!existing) {
      const rawPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await prisma.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          role: 'parent',
          centre_id: student.centre_id
        }
      }).catch(err => console.warn("Backfill student user error:", err));
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

export async function generateOnlineBackup() {
  const session = await verifySession();
  if (session.user.role !== 'owner' && session.user.role !== 'front_desk') {
    throw new Error("Unauthorized");
  }

  const [
    centres, users, coaches, families, students, tiers, packages, scheduleSlots, attendance, invoices, enquiries, enrollments, progressLogs, notifications, auditLogs
  ] = await Promise.all([
    prisma.centre.findMany(),
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, centre_id: true } }),
    prisma.coach.findMany(),
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
    prisma.auditLog.findMany({ take: 500, orderBy: { at: 'desc' } })
  ]);

  const timestamp = new Date().toISOString();
  const backupPayload = {
    metadata: {
      version: "1.0.0",
      timestamp,
      generatedBy: session.user.name || session.user.email,
      environment: "online_server"
    },
    counts: {
      students: students.length,
      packages: packages.length,
      attendance: attendance.length,
      invoices: invoices.length,
      coaches: coaches.length,
      auditLogs: auditLogs.length
    },
    data: {
      centres, users, coaches, families, students, tiers, packages, scheduleSlots, attendance, invoices, enquiries, enrollments, progressLogs, notifications, auditLogs
    }
  };

  await logAuditDB(session.user.id, 'GENERATE_ONLINE_BACKUP', 'system', null, { timestamp, counts: backupPayload.counts });

  return JSON.parse(JSON.stringify(backupPayload));
}

export async function purgeTestStudents() {
  const session = await verifySession();
  if (session.user.role !== 'owner') {
    throw new Error("Unauthorized");
  }

  // Find all test students whose names start with known test prefixes
  const testStudents = await prisma.student.findMany({
    where: {
      OR: [
        { name: { startsWith: 'TEST_MMOS_', mode: 'insensitive' } },
        { name: { startsWith: 'ZZTEST', mode: 'insensitive' } },
        { name: { startsWith: 'QA0813', mode: 'insensitive' } },
      ]
    },
    select: { id: true, name: true }
  });

  let purgedCount = 0;
  for (const s of testStudents) {
    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { student_id: s.id } }),
      prisma.enrollment.deleteMany({ where: { student_id: s.id } }),
      prisma.fideRating.deleteMany({ where: { student_id: s.id } }),
      prisma.invoice.deleteMany({ where: { student_id: s.id } }),
      prisma.notification.deleteMany({ where: { student_id: s.id } }),
      prisma.package.deleteMany({ where: { student_id: s.id } }),
      prisma.progressLog.deleteMany({ where: { student_id: s.id } }),
      prisma.report.deleteMany({ where: { student_id: s.id } }),
      prisma.studentSkill.deleteMany({ where: { student_id: s.id } }),
      prisma.tournamentReport.deleteMany({ where: { student_id: s.id } }),
      prisma.student.delete({ where: { id: s.id } }),
    ]);
    purgedCount++;
  }

  await logAuditDB(session.user.id, 'PURGE_TEST_STUDENTS', 'system', null, { purgedCount, students: testStudents.map(s => s.name) });

  return { success: true, purgedCount, purgedNames: testStudents.map(s => s.name) };
}
