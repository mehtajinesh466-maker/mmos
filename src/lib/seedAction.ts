import prisma from './prisma'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

// Utility to get random item
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Utility to get random integer
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Random date helper
function getRandomDate(daysAgoMin: number, daysAgoMax: number): Date {
  const daysAgo = getRandomInt(daysAgoMin, daysAgoMax)
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date
}

export async function runSeed() {
  console.log('Generating rich test data for Master Moves OS using optimized bulk inserts...')
  const startTime = Date.now()

  // Use TRUNCATE CASCADE to cleanly wipe all tables regardless of foreign key constraints
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
  ]

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`)
    } catch (e: any) {
      console.warn(`Warning: Failed to truncate ${table}: ${e.message}`)
    }
  }

  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. Generate Centres
  const c1Id = crypto.randomUUID()
  const c2Id = crypto.randomUUID()
  const c3Id = crypto.randomUUID()

  await prisma.centre.createMany({
    data: [
      { id: c1Id, name: 'Bay Avenue', status: 'active' },
      { id: c2Id, name: 'JLT', status: 'active' },
      { id: c3Id, name: 'Town Square', status: 'inactive' } // Planned
    ]
  })

  const centreIds = [c1Id, c2Id]

  // 2. Generate Users (owner, front desk, coaches, parent)
  const uAmitId = crypto.randomUUID()
  const uSaraId = crypto.randomUUID()
  const uJamesId = crypto.randomUUID()
  const uReggieId = crypto.randomUUID()
  const uJohnId = crypto.randomUUID()
  const uMahriId = crypto.randomUUID()
  const uBrylleId = crypto.randomUUID()
  const uBrettId = crypto.randomUUID()
  const uParentId = crypto.randomUUID()

  await prisma.user.createMany({
    data: [
      { id: uAmitId, name: 'Amit Goyal', role: 'owner', email: 'owner@mastermoves.com', password: hashedPassword },
      { id: uSaraId, name: 'Sara Miller', role: 'front_desk', centre_id: c1Id, email: 'sara@mastermoves.com', password: hashedPassword },
      { id: uJamesId, name: 'James Estrada', role: 'coach', centre_id: c1Id, email: 'james@mastermoves.com', password: hashedPassword },
      { id: uReggieId, name: 'Reggie Santiago', role: 'coach', centre_id: c1Id, email: 'reggie@mastermoves.com', password: hashedPassword },
      { id: uJohnId, name: 'John Mendoza', role: 'coach', centre_id: c1Id, email: 'john@mastermoves.com', password: hashedPassword },
      { id: uMahriId, name: 'Mahri Geldiyeva', role: 'coach', centre_id: c2Id, email: 'mahri@mastermoves.com', password: hashedPassword },
      { id: uBrylleId, name: 'Brylle Arellano', role: 'coach', centre_id: c2Id, email: 'brylle@mastermoves.com', password: hashedPassword },
      { id: uBrettId, name: 'Brett Portuguese', role: 'coach', centre_id: c2Id, email: 'brett@mastermoves.com', password: hashedPassword },
      { id: uParentId, name: 'Robert Sterling', role: 'parent', email: 'parent@mastermoves.com', password: hashedPassword }
    ]
  })

  // 3. Generate Coaches
  const chJamesId = crypto.randomUUID()
  const chReggieId = crypto.randomUUID()
  const chJohnId = crypto.randomUUID()
  const chMahriId = crypto.randomUUID()
  const chBrylleId = crypto.randomUUID()
  const chBrettId = crypto.randomUUID()

  await prisma.coach.createMany({
    data: [
      { id: chJamesId, user_id: uJamesId, centre_id: c1Id, title: 'FIDE Master' },
      { id: chReggieId, user_id: uReggieId, centre_id: c1Id, title: 'Candidate Master' },
      { id: chJohnId, user_id: uJohnId, centre_id: c1Id, title: 'National Master' },
      { id: chMahriId, user_id: uMahriId, centre_id: c2Id, title: 'WGM' },
      { id: chBrylleId, user_id: uBrylleId, centre_id: c2Id, title: 'Coach' },
      { id: chBrettId, user_id: uBrettId, centre_id: c2Id, title: 'Coach' }
    ]
  })

  const coachIds = [chJamesId, chReggieId, chJohnId, chMahriId, chBrylleId, chBrettId]

  // 4. Generate Tiers
  const tMiniId = crypto.randomUUID()
  const tCoreId = crypto.randomUUID()
  const tEliteId = crypto.randomUUID()
  const tProId = crypto.randomUUID()

  await prisma.tier.createMany({
    data: [
      { id: tMiniId, name: 'Mini', price: 750, inclusions: ['4 classes/month'], active: true },
      { id: tCoreId, name: 'Core', price: 1000, inclusions: ['8 classes/month'], active: true },
      { id: tEliteId, name: 'Elite', price: 1500, inclusions: ['12 classes/month'], active: true },
      { id: tProId, name: 'Pro-Track', price: 3500, inclusions: ['24 classes/month'], active: true }
    ]
  })

  const tierIds = [tMiniId, tCoreId, tEliteId, tProId]

  // Names arrays for dynamic generation
  const parentFirstNames = ['David', 'Sarah', 'Michael', 'Emma', 'Richard', 'Robert', 'John', 'Katherine', 'James', 'Aisha', 'Faisal', 'Sunita', 'Rajesh', 'Maria', 'Jose']
  const parentLastNames = ['Smith', 'Miller', 'Jones', 'Taylor', 'Brown', 'Singh', 'Al-Mansoori', 'Patel', 'Gomez', 'OConnor', 'Davis', 'Wilson', 'Rodriguez', 'Thomas']
  
  const studentFirstNames = ['Leo', 'Sophia', 'Arjun', 'Zoe', 'Aiden', 'Mia', 'Ryan', 'Chloe', 'Noah', 'Emma', 'Ethan', 'Olivia', 'Liam', 'Ava', 'Lucas', 'Isabella', 'Mason', 'Oliver', 'Charlotte', 'Kabir', 'Zayd', 'Rohan', 'Anya', 'Tariq', 'Sultan']
  
  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track']
  const statuses = ['active', 'active', 'active', 'active', 'inactive', 'left']
  const paceStatuses = ['On track', 'Ahead', 'Slow', 'Stalled']

  const chessFocusAreas = ['Tactics & Combinations', 'Opening Repertoire', 'Endgame Technique', 'Positional Strategy', 'Calculation Speed', 'Tournament Psychological Focus']
  const chessTopics = ['Pins & Skewers', 'King Safety', 'Rook Endgames', 'Sicilian Defense', 'Queen\'s Gambit', 'Pawn Structures', 'Double Attacks', 'Zwischenzug', 'Knight Outposts', 'Open Files control']

  // 5. Generate Families and their Parent Users
  const familiesToCreate = []
  const usersToCreate = []

  // First family: Sterling family connected to Robert parent login
  const fSterlingId = crypto.randomUUID()
  familiesToCreate.push({
    id: fSterlingId,
    primary_name: 'Robert Sterling',
    phone: '+971 50 999 8888',
    email: 'parent@mastermoves.com'
  })

  // Generate 49 other families
  const generatedFamilyIds = [fSterlingId]
  const generatedFamilyDetails = [{ id: fSterlingId, primary_name: 'Robert Sterling' }]
  for (let i = 2; i <= 50; i++) {
    const familyId = crypto.randomUUID()
    const parentName = `${getRandomItem(parentFirstNames)} ${getRandomItem(parentLastNames)}`
    const phone = `+971 5${getRandomInt(0, 8)} ${getRandomInt(100, 999)} ${getRandomInt(1000, 9999)}`
    const email = `${parentName.toLowerCase().replace(/\s+/g, '.')}.${i}@example.com`
    
    familiesToCreate.push({
      id: familyId,
      primary_name: parentName,
      phone,
      email,
      consent_ops: true,
      consent_mktg: getRandomItem([true, false])
    })

    // Pre-insert parent user account to avoid slow backfilling hashing on sync
    usersToCreate.push({
      id: crypto.randomUUID(),
      name: parentName,
      email,
      password: hashedPassword,
      role: 'parent',
      centre_id: null
    })

    generatedFamilyIds.push(familyId)
    generatedFamilyDetails.push({ id: familyId, primary_name: parentName })
  }

  await prisma.family.createMany({ data: familiesToCreate })
  await prisma.user.createMany({ data: usersToCreate })

  // 6. Generate Students
  const studentsToCreate = []
  const alexStudentId = crypto.randomUUID()

  studentsToCreate.push({
    id: alexStudentId,
    family_id: fSterlingId,
    centre_id: c1Id,
    coach_id: chJamesId,
    name: 'Alexander Sterling',
    dob: getRandomDate(3000, 4500),
    gender: 'Male',
    school: 'Dubai British School',
    level: 'Beginner',
    status: 'active',
    fide_id: 'MM-1001',
    join_date: getRandomDate(100, 200),
    last_attended: getRandomDate(2, 5),
    pace_status: 'On track',
    flags: {
      low_package: true
    }
  })

  const generatedStudents = [{ id: alexStudentId, coach_id: chJamesId }]

  for (let i = 2; i <= 60; i++) {
    const studentId = crypto.randomUUID()
    const family = getRandomItem(generatedFamilyDetails)
    const centreId = getRandomItem(centreIds)
    const coachId = getRandomItem(coachIds.filter(cid => {
      // Find coach with correct centre
      if (cid === chJamesId || cid === chReggieId || cid === chJohnId) return centreId === c1Id
      return centreId === c2Id
    })) || chJamesId
    
    const name = `${getRandomItem(studentFirstNames)} ${family.primary_name ? family.primary_name.split(' ')[1] : 'Mendoza'}`
    const dob = getRandomDate(2500, 5000)
    const gender = getRandomItem(['Male', 'Female'])
    const level = getRandomItem(levels)
    const status = getRandomItem(statuses)
    const paceStatus = getRandomItem(paceStatuses)
    const fide_id = `MM-${1000 + i}`
    const join_date = getRandomDate(60, 300)
    
    const isLowPackage = getRandomItem([true, false, false])
    const isAtRisk = paceStatus === 'Slow' || paceStatus === 'Stalled'
    const isInactive = status === 'inactive'
    const unpaidClasses = getRandomItem([0, 0, 0, 1, 2, 3, 4])
    const unpaidValue = unpaidClasses * 125

    studentsToCreate.push({
      id: studentId,
      family_id: family.id,
      centre_id: centreId,
      coach_id: coachId,
      name,
      dob,
      gender,
      level,
      status,
      fide_id,
      join_date,
      last_attended: status === 'active' ? getRandomDate(1, 14) : getRandomDate(15, 60),
      pace_status: paceStatus,
      flags: {
        low_package: isLowPackage,
        at_risk: isAtRisk,
        inactive: isInactive,
        unpaid_classes: unpaidClasses,
        unpaid_value: unpaidValue
      }
    })

    generatedStudents.push({ id: studentId, coach_id: coachId })
  }

  await prisma.student.createMany({ data: studentsToCreate })

  // 7. Generate Packages & Invoices
  const packagesToCreate = []
  const invoicesToCreate = []
  const ratingsToCreate = []

  // Sterling Package
  const alexPkgId = crypto.randomUUID()
  packagesToCreate.push({
    id: alexPkgId,
    student_id: alexStudentId,
    tier_id: tCoreId,
    kind: 'new',
    classes_total: 8,
    classes_remaining: 2,
    discount_pct: 0,
    start_date: getRandomDate(30, 40),
    expiry_date: getRandomDate(-15, -5)
  })

  invoicesToCreate.push({
    id: crypto.randomUUID(),
    package_id: alexPkgId,
    student_id: alexStudentId,
    amount: 1000,
    vat: 50,
    status: 'paid',
    method: 'Card'
  })

  for (let i = 1; i < generatedStudents.length; i++) {
    const student = generatedStudents[i]
    const hasMultiplePkgs = getRandomItem([true, false, false])
    const tierId = getRandomItem(tierIds)
    let tierPrice = 1000
    if (tierId === tMiniId) tierPrice = 750
    else if (tierId === tEliteId) tierPrice = 1500
    else if (tierId === tProId) tierPrice = 3500

    if (hasMultiplePkgs) {
      const oldPkgId = crypto.randomUUID()
      packagesToCreate.push({
        id: oldPkgId,
        student_id: student.id,
        tier_id: tierId,
        kind: 'new',
        classes_total: 8,
        classes_remaining: 0,
        start_date: getRandomDate(60, 90),
        expiry_date: getRandomDate(30, 45)
      })
      invoicesToCreate.push({
        id: crypto.randomUUID(),
        package_id: oldPkgId,
        student_id: student.id,
        amount: tierPrice,
        vat: tierPrice * 0.05,
        status: 'paid',
        method: getRandomItem(['Cash', 'Card', 'Bank Transfer'])
      })
    }

    // Current package
    const studentData = studentsToCreate.find(s => s.id === student.id)
    const isLowPkg = studentData?.flags?.low_package ?? false
    const rem = isLowPkg ? getRandomInt(0, 2) : getRandomInt(3, 12)
    const total = getRandomItem([8, 12, 24])
    const kind = getRandomItem(['renewal', 'new', 'renewal'])

    const currentPkgId = crypto.randomUUID()
    packagesToCreate.push({
      id: currentPkgId,
      student_id: student.id,
      tier_id: tierId,
      kind,
      classes_total: total,
      classes_remaining: rem,
      start_date: getRandomDate(5, 29),
      expiry_date: getRandomDate(-30, -1)
    })

    const unpaidValue = studentData?.flags?.unpaid_value ?? 0
    const invStatus = unpaidValue > 0 ? 'unpaid' : 'paid'
    invoicesToCreate.push({
      id: crypto.randomUUID(),
      package_id: currentPkgId,
      student_id: student.id,
      amount: tierPrice,
      vat: tierPrice * 0.05,
      status: invStatus,
      method: invStatus === 'paid' ? getRandomItem(['Cash', 'Card', 'Bank Transfer']) : null
    })

    if (getRandomItem([true, false])) {
      ratingsToCreate.push({
        id: crypto.randomUUID(),
        student_id: student.id,
        date: getRandomDate(30, 60),
        rating: getRandomInt(600, 1400)
      })
    }
  }

  await prisma.package.createMany({ data: packagesToCreate })
  await prisma.invoice.createMany({ data: invoicesToCreate })
  await prisma.fideRating.createMany({ data: ratingsToCreate })

  // 8. Generate Attendance Logs (~600 records)
  console.log('Generating attendance logs...')
  const attendanceToCreate = []
  for (const student of generatedStudents) {
    const numClasses = getRandomInt(5, 15)
    for (let j = 0; j < numClasses; j++) {
      const status = getRandomItem(['present', 'present', 'present', 'present', 'absent', 'makeup'])
      attendanceToCreate.push({
        id: crypto.randomUUID(),
        student_id: student.id,
        coach_id: student.coach_id,
        date: getRandomDate(1, 59),
        status,
        topic: status === 'present' ? getRandomItem(chessTopics) : null,
        note: status === 'absent' ? 'Parent called in advance' : 'Active participation'
      })
    }
  }
  await prisma.attendance.createMany({ data: attendanceToCreate })

  // 9. Generate Progress Logs (~150 records)
  console.log('Generating progress logs...')
  const progressLogsToCreate = []
  for (const student of generatedStudents) {
    const numLogs = getRandomInt(1, 3)
    for (let j = 0; j < numLogs; j++) {
      const focus = getRandomItem(chessFocusAreas)
      progressLogsToCreate.push({
        id: crypto.randomUUID(),
        student_id: student.id,
        coach_id: student.coach_id,
        date: getRandomDate(1, 40),
        focus_area: focus,
        evaluation: getRandomInt(3, 5),
        notes: `Struggled initially but demonstrated mastery of key patterns by the end of the session.`,
        skills: {
          openings: getRandomInt(2, 5),
          tactics: getRandomInt(2, 5),
          endgames: getRandomInt(2, 5),
          strategy: getRandomInt(2, 5),
          focus: getRandomInt(2, 5)
        }
      })
    }
  }
  await prisma.progressLog.createMany({ data: progressLogsToCreate })

  // 10. Generate Enquiries (~40 records)
  console.log('Generating enquiries...')
  const enquiryStages = ['new', 'contacted', 'trial_booked', 'trial_done', 'converted', 'lost']
  const enquirySources = ['Google Search', 'Instagram Ads', 'Referral', 'Walk-in Flyer', 'Facebook Post']
  const enquiriesToCreate = []

  for (let i = 1; i <= 40; i++) {
    const childName = `${getRandomItem(studentFirstNames)} ${getRandomItem(parentLastNames)}`
    const parentName = `${getRandomItem(parentFirstNames)} ${getRandomItem(parentLastNames)}`
    const phone = `+971 5${getRandomInt(0, 8)} ${getRandomInt(100, 999)} ${getRandomInt(1000, 9999)}`
    const stage = getRandomItem(enquiryStages)
    const source = getRandomItem(enquirySources)
    const centreId = getRandomItem(centreIds)
    const coachId = getRandomItem(coachIds.filter(cid => {
      if (cid === chJamesId || cid === chReggieId || cid === chJohnId) return centreId === c1Id
      return centreId === c2Id
    })) || chJamesId

    enquiriesToCreate.push({
      id: crypto.randomUUID(),
      child: childName,
      parent: parentName,
      phone,
      source,
      stage,
      centre_id: centreId,
      age: `${getRandomInt(6, 14)} years`,
      experience: getRandomItem(['None', 'Plays at school', 'Advanced Beginner']),
      trial_date: stage === 'trial_booked' || stage === 'trial_done' ? getRandomDate(-5, 10) : null,
      coach_id: coachId,
      notes: 'Interested in weekend afternoon slots.',
      created_at: getRandomDate(5, 30)
    })
  }
  await prisma.enquiry.createMany({ data: enquiriesToCreate })

  // 11. Generate Schedule Slots
  console.log('Generating schedule slots...')
  const scheduleSlotsToCreate = []
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const times = ['16:00', '17:30', '19:00']
  
  for (const day of days) {
    for (const time of times) {
      scheduleSlotsToCreate.push({
        id: crypto.randomUUID(),
        centre_id: c1Id,
        coach_id: chJamesId,
        day,
        time,
        level: getRandomItem(levels),
        capacity: 12
      })
      scheduleSlotsToCreate.push({
        id: crypto.randomUUID(),
        centre_id: c2Id,
        coach_id: chMahriId,
        day,
        time,
        level: getRandomItem(levels),
        capacity: 10
      })
    }
  }
  await prisma.scheduleSlot.createMany({ data: scheduleSlotsToCreate })

  const endTime = Date.now()
  console.log(`Rich operational database seed completed successfully in ${((endTime - startTime)/1000).toFixed(2)}s!`)
}
