"use server";

import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';

export async function registerUser(data: any) {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  return await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
      centre_id: data.role === 'owner' ? null : data.centre_id,
    }
  });
}

// -------------------------------------------------------------
// Centres & Coaches
// -------------------------------------------------------------

export async function addCoachDB(name: string, centreId: string) {
  // Create a user account for the coach first
  const user = await prisma.user.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@mastermoves.ae`,
      password: 'changeme123',
      role: 'coach',
      centre_id: centreId || null,
    }
  });
  // Then create coach record
  return await prisma.coach.create({
    data: {
      user_id: user.id,
      centre_id: centreId || null,
      active: true,
    }
  });
}

export async function updateCoachDB(coachId: string, name: string, centreId: string) {
  const coach = await prisma.coach.findUnique({ where: { id: coachId }, include: { user: true } });
  if (coach?.user_id) {
    await prisma.user.update({ where: { id: coach.user_id }, data: { name, centre_id: centreId || null } });
  }
  return await prisma.coach.update({
    where: { id: coachId },
    data: { centre_id: centreId || null }
  });
}

export async function reassignCoachDB(fromCoachId: string, toCoachId: string) {
  // Move all students from one coach to another
  return await prisma.student.updateMany({
    where: { coach_id: fromCoachId },
    data: { coach_id: toCoachId || null }
  });
}

export async function deleteCoachDB(coachId: string) {
  return await prisma.coach.update({
    where: { id: coachId },
    data: { active: false }
  });
}

export async function saveCentreDB(data: { name: string; status: string }) {
  return await prisma.centre.create({
    data: { name: data.name, status: data.status }
  });
}

export async function updateCentreStatusDB(centreId: string, status: string) {
  return await prisma.centre.update({
    where: { id: centreId },
    data: { status }
  });
}

export async function deleteCentreDB(centreId: string) {
  return await prisma.centre.update({
    where: { id: centreId },
    data: { status: 'inactive' }
  });
}


// -------------------------------------------------------------
// Module 3 & 4: Scheduling and Progress
// -------------------------------------------------------------

export async function createScheduleSlot(centreId: string, coachId: string, day: string, time: string, level: string, capacity: number = 10) {
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
  return await prisma.enrollment.create({
    data: {
      student_id: studentId,
      slot_id: slotId
    }
  });
}

export async function logProgress(studentId: string, coachId: string, focusArea: string, evaluation: number, notes: string) {
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
  const centres = await prisma.centre.findMany();
  const users = await prisma.user.findMany();
  const coachesRaw = await prisma.coach.findMany({ include: { user: true } });
  // Denormalize coach name from user relation
  const coaches = coachesRaw.map(c => ({
    ...c,
    name: c.user?.name || 'Unassigned',
  }));
  const families = await prisma.family.findMany();
  const students = await prisma.student.findMany();
  const tiers = await prisma.tier.findMany();
  const packages = await prisma.package.findMany();
  const scheduleSlots = await prisma.scheduleSlot.findMany();
  const attendance = await prisma.attendance.findMany();
  const invoices = await prisma.invoice.findMany();

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
  }));
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

export async function logAttendance(studentId: string, status: string, coachId: string) {
  await prisma.attendance.create({
    data: {
      student_id: studentId,
      status: status,
      coach_id: coachId,
      date: new Date()
    }
  });
  
  if (status === 'present') {
    // find active package and decrement
    const pkg = await prisma.package.findFirst({
      where: {
        student_id: studentId,
        frozen: false,
        classes_remaining: { gt: 0 }
      },
      orderBy: { start_date: 'asc' }
    });
    
    if (pkg) {
      await prisma.package.update({
        where: { id: pkg.id },
        data: { classes_remaining: pkg.classes_remaining - 1 }
      });
    }
  }
}

export async function saveStudentDB(studentData: any) {
  // Check if student exists
  const existing = await prisma.student.findUnique({
    where: { id: studentData.id }
  });

  if (existing) {
    await prisma.student.update({
      where: { id: studentData.id },
      data: {
        name: studentData.name,
        level: studentData.level,
        status: studentData.status,
        fide_id: studentData.fide_id,
        pace_status: studentData.pace_status,
        pace_reason: studentData.pace_reason,
        flags: studentData.flags,
        last_attended: studentData.last_attended ? new Date(studentData.last_attended) : null
      }
    });
  } else {
    await prisma.student.create({
      data: {
        id: studentData.id,
        name: studentData.name,
        level: studentData.level,
        status: studentData.status,
        fide_id: studentData.fide_id,
        pace_status: studentData.pace_status,
        pace_reason: studentData.pace_reason,
        flags: studentData.flags,
        centre_id: studentData.centre_id,
        coach_id: studentData.coach_id,
        family_id: studentData.family_id
      }
    });
  }
}

export async function saveProgressLogDB(logData: any) {
  await prisma.progressLog.create({
    data: {
      id: logData.id,
      student_id: logData.student_id,
      coach_id: logData.coach_id,
      date: new Date(logData.date),
      topic: logData.topic,
      mastery: logData.mastery,
      skills: logData.skills,
      note: logData.note
    }
  });
}

export async function syncOfflineQueueDB(records: any[]) {
  // Batch insert
  for (const record of records) {
    await logAttendance(record.student_id, record.status, record.coach_id);
  }
}

// -------------------------------------------------------------
// Phase 2: Students & Packages
// -------------------------------------------------------------

export async function registerStudent(data: any) {
  let familyId = data.family_id;

  // 1. Create family if not exists or no ID provided
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
      status: 'active',
      fide_id: data.fide_id,
      join_date: new Date(),
    }
  });

  // 3. Auto-create initial package
  if (data.tier_id) {
    const tier = await prisma.tier.findUnique({ where: { id: data.tier_id } });
    if (tier) {
      // Check for sibling discount
      const siblingsCount = await prisma.student.count({
        where: { family_id: familyId, status: 'active' }
      });
      
      const discount = siblingsCount > 1 ? 10 : 0; // 10% sibling discount
      
      // Parse total classes from inclusions or default to 8
      let classesTotal = 8;
      if (tier.inclusions && Array.isArray(tier.inclusions)) {
         const match = tier.inclusions[0]?.match(/(\d+)\s*classes/i);
         if (match) classesTotal = parseInt(match[1], 10);
      }

      await prisma.package.create({
        data: {
          student_id: student.id,
          tier_id: tier.id,
          kind: 'new',
          classes_total: classesTotal,
          classes_remaining: classesTotal,
          discount_pct: discount,
          start_date: new Date(),
        }
      });
    }
  }

  return student;
}

export async function renewPackage(studentId: string, tierId: string, kind: 'renewal' | 'tournament' = 'renewal') {
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

  return pkg;
}

export async function getReconciliationData() {
  const students = await prisma.student.findMany({
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
  return await prisma.student.update({
    where: { id },
    data: { status: 'inactive' }
  });
}

export async function deletePackageDB(id: string) {
  return await prisma.package.delete({
    where: { id }
  });
}

export async function updatePackageDB(id: string, data: any) {
  return await prisma.package.update({
    where: { id },
    data: {
      classes_total: Number(data.classes_total),
      classes_remaining: Number(data.classes_remaining),
      frozen: data.frozen === true || data.frozen === 'true'
    }
  });
}

export async function deleteAttendanceDB(id: string) {
  return await prisma.attendance.delete({
    where: { id }
  });
}

export async function updateAttendanceDB(id: string, status: string) {
  return await prisma.attendance.update({
    where: { id },
    data: { status }
  });
}

export async function deleteInvoiceDB(id: string) {
  return await prisma.invoice.delete({
    where: { id }
  });
}

export async function updateInvoiceDB(id: string, status: string) {
  return await prisma.invoice.update({
    where: { id },
    data: { status }
  });
}

export async function getActionCentreData() {
  const students = await prisma.student.findMany({
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

  const centres = await prisma.centre.findMany();
  const coaches = await prisma.coach.findMany({
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

