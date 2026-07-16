import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with master moves records...')

  // Clear existing data
  await prisma.attendance.deleteMany()
  await prisma.package.deleteMany()
  await prisma.student.deleteMany()
  await prisma.scheduleSlot.deleteMany()
  await prisma.coach.deleteMany()
  await prisma.user.deleteMany()
  await prisma.centre.deleteMany()
  await prisma.family.deleteMany()
  await prisma.tier.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.enquiry.deleteMany()

  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. Create Centres
  const c1 = await prisma.centre.create({ data: { name: 'Bay Avenue', status: 'active' } })
  const c2 = await prisma.centre.create({ data: { name: 'JLT', status: 'active' } })
  const c3 = await prisma.centre.create({ data: { name: 'Town Square', status: 'inactive' } }) // Planned 2027

  // 2. Create Users (Amit, Sara, Coaches, Parent)
  const uAmit = await prisma.user.create({ data: { name: 'Amit Goyal', role: 'owner', email: 'owner@mastermoves.com', password: hashedPassword } })
  const uSara = await prisma.user.create({ data: { name: 'Sara Miller', role: 'front_desk', centre_id: c1.id, email: 'sara@mastermoves.com', password: hashedPassword } })
  
  const uJames = await prisma.user.create({ data: { name: 'James Estrada', role: 'coach', centre_id: c1.id, email: 'james@mastermoves.com', password: hashedPassword } })
  const uReggie = await prisma.user.create({ data: { name: 'Reggie Santiago', role: 'coach', centre_id: c1.id, email: 'reggie@mastermoves.com', password: hashedPassword } })
  const uJohn = await prisma.user.create({ data: { name: 'John Mendoza', role: 'coach', centre_id: c1.id, email: 'john@mastermoves.com', password: hashedPassword } })
  const uMahri = await prisma.user.create({ data: { name: 'Mahri Geldiyeva', role: 'coach', centre_id: c2.id, email: 'mahri@mastermoves.com', password: hashedPassword } })
  const uBrylle = await prisma.user.create({ data: { name: 'Brylle Arellano', role: 'coach', centre_id: c2.id, email: 'brylle@mastermoves.com', password: hashedPassword } })
  const uBrett = await prisma.user.create({ data: { name: 'Brett Portuguese', role: 'coach', centre_id: c2.id, email: 'brett@mastermoves.com', password: hashedPassword } })
  
  const uParent = await prisma.user.create({ data: { name: 'Robert Sterling', role: 'parent', email: 'parent@mastermoves.com', password: hashedPassword } })

  // 3. Create Coaches
  const chJames = await prisma.coach.create({ data: { user_id: uJames.id, centre_id: c1.id, title: 'FIDE Master' } })
  const chReggie = await prisma.coach.create({ data: { user_id: uReggie.id, centre_id: c1.id, title: 'Candidate Master' } })
  const chJohn = await prisma.coach.create({ data: { user_id: uJohn.id, centre_id: c1.id, title: 'National Master' } })
  const chMahri = await prisma.coach.create({ data: { user_id: uMahri.id, centre_id: c2.id, title: 'WGM' } })
  const chBrylle = await prisma.coach.create({ data: { user_id: uBrylle.id, centre_id: c2.id, title: 'Coach' } })
  const chBrett = await prisma.coach.create({ data: { user_id: uBrett.id, centre_id: c2.id, title: 'Coach' } })

  // Map coach names to IDs
  const coachMap: { [key: string]: string } = {
    'james estrada': chJames.id,
    'reggie santiago': chReggie.id,
    'john john mendoza': chJohn.id,
    'john mendoza': chJohn.id,
    'mahri wgm': chMahri.id,
    'mahri geldiyeva': chMahri.id,
    'brylle braca arellano': chBrylle.id,
    'brylle arellano': chBrylle.id,
    'brett portuguese': chBrett.id
  }

  // 4. Create Tiers
  const tMini = await prisma.tier.create({ data: { name: 'Mini', price: 750, inclusions: ['4 classes/month'], active: true } })
  const tCore = await prisma.tier.create({ data: { name: 'Core', price: 1000, inclusions: ['8 classes/month'], active: true } })
  const tElite = await prisma.tier.create({ data: { name: 'Elite', price: 1500, inclusions: ['12 classes/month'], active: true } })
  const tPro = await prisma.tier.create({ data: { name: 'Pro-Track', price: 3500, inclusions: ['24 classes/month'], active: true } })

  const tierMap: { [key: string]: string } = {
    'Mini': tMini.id,
    'Core': tCore.id,
    'Elite': tElite.id,
    'Pro-Track': tPro.id
  }

  // 5. Create 5 test student records (including Alexander Sterling)
  const fSterling = await prisma.family.create({
    data: {
      primary_name: 'Sterling Family',
      phone: '+971 50 999 8888',
      email: 'parent@mastermoves.com'
    }
  });

  const fSmith = await prisma.family.create({
    data: {
      primary_name: 'Smith Family',
      phone: '+971 50 111 2222',
      email: 'smith@example.com'
    }
  });

  const fBrown = await prisma.family.create({
    data: {
      primary_name: 'Brown Family',
      phone: '+971 50 333 4444',
      email: 'brown@example.com'
    }
  });

  const fMiller = await prisma.family.create({
    data: {
      primary_name: 'Miller Family',
      phone: '+971 50 555 6666',
      email: 'miller@example.com'
    }
  });

  const fWatson = await prisma.family.create({
    data: {
      primary_name: 'Watson Family',
      phone: '+971 50 777 8888',
      email: 'watson@example.com'
    }
  });

  const testStudents = [
    {
      family_id: fSterling.id,
      centre_id: c1.id,
      coach_id: chJames.id,
      name: 'Alexander Sterling',
      level: 'Beginner',
      status: 'active',
      join_date: new Date('2026-07-01'),
      last_attended: new Date('2026-07-12'),
      fide_id: 'MM-1001',
      pace_status: 'On track',
      tier_id: tCore.id,
      classes_total: 8,
      classes_remaining: 3,
      billing_total: 1000,
      overdue: 0,
      unpaid_classes: 0,
      unpaid_value: 0,
      low_package: true,
      att_dates: ['2026-07-03', '2026-07-05', '2026-07-07', '2026-07-10', '2026-07-12']
    },
    {
      family_id: fSmith.id,
      centre_id: c1.id,
      coach_id: chJames.id,
      name: 'Bob Jones',
      level: 'Intermediate',
      status: 'active',
      join_date: new Date('2026-06-15'),
      last_attended: new Date('2026-07-14'),
      fide_id: 'MM-1002',
      pace_status: 'Slow',
      tier_id: tElite.id,
      classes_total: 12,
      classes_remaining: 0,
      billing_total: 1500,
      overdue: 0,
      unpaid_classes: 2,
      unpaid_value: 250,
      low_package: true,
      att_dates: ['2026-06-18', '2026-06-21', '2026-06-25', '2026-06-28', '2026-07-02', '2026-07-05', '2026-07-09', '2026-07-12', '2026-07-14']
    },
    {
      family_id: fBrown.id,
      centre_id: c1.id,
      coach_id: chJohn.id,
      name: 'Charlie Brown',
      level: 'Beginner',
      status: 'inactive',
      join_date: new Date('2026-05-01'),
      last_attended: new Date('2026-05-28'),
      fide_id: 'MM-1003',
      pace_status: 'Stalled',
      tier_id: tMini.id,
      classes_total: 4,
      classes_remaining: 0,
      billing_total: 750,
      overdue: 750,
      unpaid_classes: 4,
      unpaid_value: 750,
      low_package: true,
      att_dates: ['2026-05-05', '2026-05-12', '2026-05-19', '2026-05-28']
    },
    {
      family_id: fMiller.id,
      centre_id: c2.id,
      coach_id: chMahri.id,
      name: 'David Miller',
      level: 'Advanced',
      status: 'active',
      join_date: new Date('2026-07-02'),
      last_attended: new Date('2026-07-15'),
      fide_id: 'MM-1004',
      pace_status: 'On track',
      tier_id: tCore.id,
      classes_total: 8,
      classes_remaining: 4,
      billing_total: 1000,
      overdue: 0,
      unpaid_classes: 0,
      unpaid_value: 0,
      low_package: false,
      att_dates: ['2026-07-04', '2026-07-08', '2026-07-11', '2026-07-15']
    },
    {
      family_id: fWatson.id,
      centre_id: c2.id,
      coach_id: chJames.id,
      name: 'Emma Watson',
      level: 'Beginner',
      status: 'active',
      join_date: new Date('2026-06-10'),
      last_attended: new Date('2026-07-08'),
      fide_id: 'MM-1005',
      pace_status: 'Slow',
      tier_id: tElite.id,
      classes_total: 12,
      classes_remaining: 0,
      billing_total: 1500,
      overdue: 0,
      unpaid_classes: 3,
      unpaid_value: 375,
      low_package: true,
      att_dates: ['2026-06-12', '2026-06-15', '2026-06-19', '2026-06-22', '2026-06-26', '2026-06-29', '2026-07-03', '2026-07-06', '2026-07-08']
    }
  ];

  for (const ts of testStudents) {
    const student = await prisma.student.create({
      data: {
        family_id: ts.family_id,
        centre_id: ts.centre_id,
        coach_id: ts.coach_id,
        name: ts.name,
        level: ts.level,
        status: ts.status,
        join_date: ts.join_date,
        last_attended: ts.last_attended,
        fide_id: ts.fide_id,
        pace_status: ts.pace_status,
        flags: {
          at_risk: ts.pace_status === 'Slow',
          inactive: ts.status === 'inactive',
          unpaid_classes: ts.unpaid_classes,
          unpaid_value: ts.unpaid_value,
          low_package: ts.low_package
        }
      }
    });

    const pkg = await prisma.package.create({
      data: {
        student_id: student.id,
        tier_id: ts.tier_id,
        classes_total: ts.classes_total,
        classes_remaining: ts.classes_remaining,
        start_date: ts.join_date,
        expiry_date: new Date(ts.join_date.getTime() + 60 * 24 * 60 * 60 * 1000)
      }
    });

    if (ts.billing_total > 0) {
      await prisma.invoice.create({
        data: {
          package_id: pkg.id,
          student_id: student.id,
          amount: ts.billing_total,
          vat: ts.billing_total * 0.05,
          status: ts.overdue > 0 ? 'unpaid' : 'paid',
          method: 'Card'
        }
      });
    }

    for (const dStr of ts.att_dates) {
      await prisma.attendance.create({
        data: {
          student_id: student.id,
          coach_id: ts.coach_id,
          date: new Date(dStr),
          status: 'present'
        }
      });
    }
  }

  // 6. Create standard schedule slots
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const times = ['16:00', '17:30', '19:00']
  const levels = ['Beginner', 'Intermediate', 'Advanced']

  for (const day of days) {
    for (const time of times) {
      await prisma.scheduleSlot.create({
        data: {
          centre_id: c1.id,
          coach_id: chJames.id,
          day,
          time,
          level: levels[Math.floor(Math.random() * levels.length)]
        }
      })
    }
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
