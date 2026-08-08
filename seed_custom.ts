import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting custom seeding for 20 diverse students and 3 coaches...');

  // Truncate tables cleanly using cascade
  const tables = [
    'attendance',
    'progress_logs',
    'student_skills',
    'fide_ratings',
    'invoices',
    'packages',
    'enrollments',
    'students',
    'schedule_slots',
    'coaches',
    'users',
    'centres',
    'families',
    'tiers',
    'enquiries',
    'reports',
    'notifications',
    'audit_log'
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (e: any) {
      console.warn(`Warning: Failed to truncate ${table}: ${e.message}`);
    }
  }

  // Pre-hashed passwords
  const ownerHash = await bcrypt.hash('mastermoves@$', 10);
  const frontDeskHash = await bcrypt.hash('mastermoves@front@123', 10);
  const coachHash = await bcrypt.hash('mastermoves@coach$', 10);
  const parentHash = await bcrypt.hash('password123', 10);

  // 1. Create Centres
  const bayAvenueId = crypto.randomUUID();
  const jltId = crypto.randomUUID();
  
  await prisma.centre.createMany({
    data: [
      { id: bayAvenueId, name: 'Bay Avenue', status: 'active' },
      { id: jltId, name: 'JLT', status: 'active' }
    ]
  });
  console.log('Centres seeded.');

  // 2. Create Users & Tiers
  const ownerId = crypto.randomUUID();
  const frontDeskId = crypto.randomUUID();
  
  await prisma.user.createMany({
    data: [
      { id: ownerId, name: 'Amit Goyal', role: 'owner', email: 'owner@mastermoves.com', password: ownerHash },
      { id: frontDeskId, name: 'Sara Miller', role: 'front_desk', centre_id: bayAvenueId, email: 'sara@mastermoves.com', password: frontDeskHash }
    ]
  });

  const tierMiniId = crypto.randomUUID();
  const tierCoreId = crypto.randomUUID();
  const tierEliteId = crypto.randomUUID();
  const tierProId = crypto.randomUUID();

  await prisma.tier.createMany({
    data: [
      { id: tierMiniId, name: 'Mini', price: 750, inclusions: ['4 classes/month'], active: true },
      { id: tierCoreId, name: 'Core', price: 1000, inclusions: ['8 classes/month'], active: true },
      { id: tierEliteId, name: 'Elite', price: 1500, inclusions: ['12 classes/month'], active: true },
      { id: tierProId, name: 'Pro-Track', price: 3500, inclusions: ['24 classes/month'], active: true }
    ]
  });
  console.log('Users and Tiers seeded.');

  // 3. Create 3 Coaches
  const coachJamesUserId = crypto.randomUUID();
  const coachJamesId = crypto.randomUUID();
  
  const coachReggieUserId = crypto.randomUUID();
  const coachReggieId = crypto.randomUUID();
  
  const coachMahriUserId = crypto.randomUUID();
  const coachMahriId = crypto.randomUUID();

  await prisma.user.createMany({
    data: [
      { id: coachJamesUserId, name: 'James Estrada', role: 'coach', email: 'james@mastermoves.com', password: coachHash, centre_id: bayAvenueId },
      { id: coachReggieUserId, name: 'Reggie Santiago', role: 'coach', email: 'reggie@mastermoves.com', password: coachHash, centre_id: bayAvenueId },
      { id: coachMahriUserId, name: 'Mahri Geldiyeva', role: 'coach', email: 'mahri@mastermoves.com', password: coachHash, centre_id: jltId }
    ]
  });

  await prisma.coach.createMany({
    data: [
      { id: coachJamesId, user_id: coachJamesUserId, centre_id: bayAvenueId, title: 'Grandmaster' },
      { id: coachReggieId, user_id: coachReggieUserId, centre_id: bayAvenueId, title: 'International Master' },
      { id: coachMahriId, user_id: coachMahriUserId, centre_id: jltId, title: 'FIDE Master' }
    ]
  });
  console.log('3 Coaches seeded.');

  // 4. Create Families
  // Parent 1 (mehtajinesh977@gmail.com / password123) - Has 2 kids (alex, aanya)
  const familyJineshId = crypto.randomUUID();
  const userJineshParentId = crypto.randomUUID();

  // We also create standard parent users
  await prisma.user.create({
    data: {
      id: userJineshParentId,
      name: 'Jinesh Mehta',
      email: 'mehtajinesh977@gmail.com',
      password: parentHash,
      role: 'parent'
    }
  });

  await prisma.family.create({
    data: {
      id: familyJineshId,
      primary_name: 'Jinesh Mehta',
      phone: '+971 50 123 4567',
      email: 'mehtajinesh977@gmail.com'
    }
  });

  // Additional 8 Families
  const familyIds: string[] = [familyJineshId];
  for (let i = 2; i <= 9; i++) {
    const famId = crypto.randomUUID();
    const parentUserId = crypto.randomUUID();
    const parentEmail = `parent${i}@example.com`;
    const parentName = `Parent User ${i}`;
    
    await prisma.user.create({
      data: {
        id: parentUserId,
        name: parentName,
        email: parentEmail,
        password: parentHash,
        role: 'parent'
      }
    });

    await prisma.family.create({
      data: {
        id: famId,
        primary_name: parentName,
        phone: `+971 50 111 222${i}`,
        email: parentEmail
      }
    });
    familyIds.push(famId);
  }

  // 5. Create 20 Diverse Students
  const studentsData = [
    // Family 1 (Jinesh) - Alexander Sterling (Active, Core, Bay Avenue, Coach James)
    { name: 'Alexander Sterling', familyId: familyIds[0], centreId: bayAvenueId, coachId: coachJamesId, level: 'Beginner', status: 'active', remainingClasses: 6, totalClasses: 8, tierId: tierCoreId, hasLowPackage: false },
    // Family 1 (Jinesh) - Aanya Sterling (Active, Elite, JLT, Coach Mahri - Sibling of Alexander)
    { name: 'Aanya Sterling', familyId: familyIds[0], centreId: jltId, coachId: coachMahriId, level: 'Intermediate', status: 'active', remainingClasses: 1, totalClasses: 12, tierId: tierEliteId, hasLowPackage: true },
    
    // Family 2 - Kabir Singh (Active, Pro-Track, Bay Avenue, Coach Reggie, Low Credits)
    { name: 'Kabir Singh', familyId: familyIds[1], centreId: bayAvenueId, coachId: coachReggieId, level: 'Pro-Track', status: 'active', remainingClasses: 2, totalClasses: 24, tierId: tierProId, hasLowPackage: true },
    // Family 2 - Rohan Singh (Active, Core, Bay Avenue, Coach James - Sibling of Kabir)
    { name: 'Rohan Singh', familyId: familyIds[1], centreId: bayAvenueId, coachId: coachJamesId, level: 'Intermediate', status: 'active', remainingClasses: 0, totalClasses: 8, tierId: tierCoreId, hasLowPackage: true },
    
    // Family 3 - Chloe Miller (Active, Mini, Bay Avenue, Coach James, Overdue/Negative Credits)
    { name: 'Chloe Miller', familyId: familyIds[2], centreId: bayAvenueId, coachId: coachJamesId, level: 'Beginner', status: 'active', remainingClasses: -2, totalClasses: 4, tierId: tierMiniId, hasLowPackage: true },
    
    // Family 4 - Ethan Patel (Inactive student, has left, has 0 credits)
    { name: 'Ethan Patel', familyId: familyIds[3], centreId: jltId, coachId: coachMahriId, level: 'Advanced', status: 'inactive', remainingClasses: 0, totalClasses: 8, tierId: tierCoreId, hasLowPackage: false },
    
    // Family 5 - Tariq Al-Mansoori (Active, Elite, JLT, Coach Mahri, High Credits)
    { name: 'Tariq Al-Mansoori', familyId: familyIds[4], centreId: jltId, coachId: coachMahriId, level: 'Advanced', status: 'active', remainingClasses: 12, totalClasses: 12, tierId: tierEliteId, hasLowPackage: false },
    
    // Family 6 - Sunita Sharma (Left status, Pro-Track, Bay Avenue, 0 credits)
    { name: 'Sunita Sharma', familyId: familyIds[5], centreId: bayAvenueId, coachId: coachReggieId, level: 'Pro-Track', status: 'left', remainingClasses: 0, totalClasses: 24, tierId: tierProId, hasLowPackage: false },
    
    // Individual Families (Families 7-9 and some single students)
    { name: 'Zoe Brown', familyId: familyIds[6], centreId: bayAvenueId, coachId: coachJamesId, level: 'Beginner', status: 'active', remainingClasses: 4, totalClasses: 4, tierId: tierMiniId, hasLowPackage: false },
    { name: 'Ryan Gomez', familyId: familyIds[7], centreId: jltId, coachId: coachMahriId, level: 'Intermediate', status: 'active', remainingClasses: 7, totalClasses: 8, tierId: tierCoreId, hasLowPackage: false },
    { name: 'Olivia Taylor', familyId: familyIds[8], centreId: bayAvenueId, coachId: coachReggieId, level: 'Advanced', status: 'active', remainingClasses: 10, totalClasses: 12, tierId: tierEliteId, hasLowPackage: false },
    
    // More single family students dynamically mapped to random familyIds
    { name: 'Sophia Smith', familyId: familyIds[0], centreId: bayAvenueId, coachId: coachJamesId, level: 'Beginner', status: 'active', remainingClasses: 3, totalClasses: 8, tierId: tierCoreId, hasLowPackage: false },
    { name: 'Liam Davis', familyId: familyIds[1], centreId: jltId, coachId: coachMahriId, level: 'Intermediate', status: 'active', remainingClasses: 5, totalClasses: 8, tierId: tierCoreId, hasLowPackage: false },
    { name: 'Mason Wilson', familyId: familyIds[2], centreId: bayAvenueId, coachId: coachReggieId, level: 'Advanced', status: 'active', remainingClasses: -1, totalClasses: 12, tierId: tierEliteId, hasLowPackage: true },
    { name: 'Charlotte Singh', familyId: familyIds[3], centreId: jltId, coachId: coachMahriId, level: 'Pro-Track', status: 'active', remainingClasses: 18, totalClasses: 24, tierId: tierProId, hasLowPackage: false },
    { name: 'Sultan Khalifa', familyId: familyIds[4], centreId: jltId, coachId: coachMahriId, level: 'Beginner', status: 'active', remainingClasses: 2, totalClasses: 4, tierId: tierMiniId, hasLowPackage: true },
    { name: 'Emma OConnor', familyId: familyIds[5], centreId: bayAvenueId, coachId: coachJamesId, level: 'Intermediate', status: 'active', remainingClasses: 4, totalClasses: 8, tierId: tierCoreId, hasLowPackage: false },
    { name: 'Aiden Rodriguez', familyId: familyIds[6], centreId: jltId, coachId: coachMahriId, level: 'Advanced', status: 'active', remainingClasses: 6, totalClasses: 12, tierId: tierEliteId, hasLowPackage: false },
    { name: 'Kabir Patel', familyId: familyIds[7], centreId: bayAvenueId, coachId: coachReggieId, level: 'Pro-Track', status: 'active', remainingClasses: 22, totalClasses: 24, tierId: tierProId, hasLowPackage: false },
    { name: 'Mia Jones', familyId: familyIds[8], centreId: bayAvenueId, coachId: coachJamesId, level: 'Beginner', status: 'active', remainingClasses: 0, totalClasses: 4, tierId: tierMiniId, hasLowPackage: true }
  ];

  const studentsList: any[] = [];

  for (const s of studentsData) {
    const studentId = crypto.randomUUID();
    const pkgId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - getRandomInt(6, 14));

    const flags: any = {};
    if (s.hasLowPackage) flags.low_package = true;
    if (s.remainingClasses < 0) {
      flags.unpaid_classes = Math.abs(s.remainingClasses);
      flags.unpaid_value = Math.abs(s.remainingClasses) * 125;
    }

    // Create Student
    const student = await prisma.student.create({
      data: {
        id: studentId,
        family_id: s.familyId,
        centre_id: s.centreId,
        coach_id: s.coachId,
        name: s.name,
        dob,
        gender: getRandomItem(['Male', 'Female']),
        school: 'Dubai International Academy',
        level: s.level,
        status: s.status,
        join_date: new Date(),
        last_attended: new Date(),
        flags
      }
    });

    studentsList.push(student);

    // Create active package
    await prisma.package.create({
      data: {
        id: pkgId,
        student_id: studentId,
        tier_id: s.tierId,
        kind: 'new',
        classes_total: s.totalClasses,
        classes_remaining: s.remainingClasses,
        discount_pct: 0,
        start_date: new Date()
      }
    });

    // Create paid invoice
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        package_id: pkgId,
        student_id: studentId,
        amount: s.totalClasses * 125,
        vat: s.totalClasses * 125 * 0.05,
        status: 'paid',
        method: 'Cash',
        created_at: new Date()
      }
    });

    // Add 2 mock attendance records for each student
    for (let j = 0; j < 2; j++) {
      await prisma.attendance.create({
        data: {
          id: crypto.randomUUID(),
          student_id: studentId,
          coach_id: s.coachId,
          date: new Date(Date.now() - j * 24 * 60 * 60 * 1000),
          status: 'present',
          duration: 2,
          topic: 'Tactical Combinations and Middle Game Basics',
          note: 'Excellent progress and class engagement.'
        }
      });
    }

    // Add progress log
    await prisma.progressLog.create({
      data: {
        id: crypto.randomUUID(),
        student_id: studentId,
        coach_id: s.coachId,
        date: new Date(),
        skills: {
          Openings: getRandomInt(1, 5),
          Tactics: getRandomInt(1, 5),
          Endgames: getRandomInt(1, 5),
          Strategy: getRandomInt(1, 5),
          Focus: getRandomInt(1, 5)
        },
        evaluation: getRandomInt(1, 5),
        focus_area: 'Endgame calculation',
        notes: 'Needs to work on basic rook endgames.'
      }
    });
  }

  // 6. Schedule slots
  const scheduleSlotsToCreate = [];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const times = ['16:00', '17:30', '19:00'];
  const levelsList = ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track'];

  for (const day of days) {
    for (const time of times) {
      scheduleSlotsToCreate.push({
        id: crypto.randomUUID(),
        centre_id: bayAvenueId,
        coach_id: coachJamesId,
        day,
        time,
        level: getRandomItem(levelsList),
        capacity: 12
      });
      scheduleSlotsToCreate.push({
        id: crypto.randomUUID(),
        centre_id: jltId,
        coach_id: coachMahriId,
        day,
        time,
        level: getRandomItem(levelsList),
        capacity: 10
      });
    }
  }

  await prisma.scheduleSlot.createMany({ data: scheduleSlotsToCreate });

  console.log('Custom operational seed completed successfully!');
  await prisma.$disconnect();
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

main().catch(err => {
  console.error('Custom seeding failed:', err);
  process.exit(1);
});
