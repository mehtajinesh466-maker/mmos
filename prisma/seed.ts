import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

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

async function main() {
  console.log('Generating rich test data for Master Moves OS...')

  // Clear existing data in correct dependency order
  await prisma.attendance.deleteMany()
  await prisma.progressLog.deleteMany()
  await prisma.studentSkill.deleteMany()
  await prisma.fideRating.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.package.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.student.deleteMany()
  await prisma.scheduleSlot.deleteMany()
  await prisma.coach.deleteMany()
  await prisma.user.deleteMany()
  await prisma.centre.deleteMany()
  await prisma.family.deleteMany()
  await prisma.tier.deleteMany()
  await prisma.enquiry.deleteMany()
  await prisma.report.deleteMany()

  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. Create Centres
  const c1 = await prisma.centre.create({ data: { name: 'Bay Avenue', status: 'active' } })
  const c2 = await prisma.centre.create({ data: { name: 'JLT', status: 'active' } })
  const c3 = await prisma.centre.create({ data: { name: 'Town Square', status: 'inactive' } }) // Planned

  const centres = [c1, c2]

  // 2. Create Users
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

  const coaches = [chJames, chReggie, chJohn, chMahri, chBrylle, chBrett]

  // 4. Create Tiers
  const tMini = await prisma.tier.create({ data: { name: 'Mini', price: 750, inclusions: ['4 classes/month'], active: true } })
  const tCore = await prisma.tier.create({ data: { name: 'Core', price: 1000, inclusions: ['8 classes/month'], active: true } })
  const tElite = await prisma.tier.create({ data: { name: 'Elite', price: 1500, inclusions: ['12 classes/month'], active: true } })
  const tPro = await prisma.tier.create({ data: { name: 'Pro-Track', price: 3500, inclusions: ['24 classes/month'], active: true } })

  const tiers = [tMini, tCore, tElite, tPro]

  // Names arrays for dynamic generation
  const parentFirstNames = ['David', 'Sarah', 'Michael', 'Emma', 'Richard', 'Robert', 'John', 'Katherine', 'James', 'Aisha', 'Faisal', 'Sunita', 'Rajesh', 'Maria', 'Jose']
  const parentLastNames = ['Smith', 'Miller', 'Jones', 'Taylor', 'Brown', 'Singh', 'Al-Mansoori', 'Patel', 'Gomez', 'OConnor', 'Davis', 'Wilson', 'Rodriguez', 'Thomas']
  
  const studentFirstNames = ['Leo', 'Sophia', 'Arjun', 'Zoe', 'Aiden', 'Mia', 'Ryan', 'Chloe', 'Noah', 'Emma', 'Ethan', 'Olivia', 'Liam', 'Ava', 'Lucas', 'Isabella', 'Mason', 'Oliver', 'Charlotte', 'Kabir', 'Zayd', 'Rohan', 'Anya', 'Tariq', 'Sultan']
  
  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track']
  const statuses = ['active', 'active', 'active', 'active', 'inactive', 'left']
  const paceStatuses = ['On track', 'Ahead', 'Slow', 'Stalled']

  const chessFocusAreas = ['Tactics & Combinations', 'Opening Repertoire', 'Endgame Technique', 'Positional Strategy', 'Calculation Speed', 'Tournament Psychological Focus']
  const chessTopics = ['Pins & Skewers', 'King Safety', 'Rook Endgames', 'Sicilian Defense', 'Queen\'s Gambit', 'Pawn Structures', 'Double Attacks', 'Zwischenzug', 'Knight Outposts', 'Open Files control']

  // 5. Create Families & Students
  // First family: Sterling family connected to Robert parent login
  const fSterling = await prisma.family.create({
    data: {
      primary_name: 'Robert Sterling',
      phone: '+971 50 999 8888',
      email: 'parent@mastermoves.com'
    }
  })

  // Create Alexander Sterling student
  const alexStudent = await prisma.student.create({
    data: {
      family_id: fSterling.id,
      centre_id: c1.id,
      coach_id: chJames.id,
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
    }
  })

  // Seed initial packages for Alexander Sterling
  const alexPkg = await prisma.package.create({
    data: {
      student_id: alexStudent.id,
      tier_id: tCore.id,
      kind: 'new',
      classes_total: 8,
      classes_remaining: 2,
      discount_pct: 0,
      start_date: getRandomDate(30, 40),
      expiry_date: getRandomDate(-15, -5)
    }
  })

  await prisma.invoice.create({
    data: {
      package_id: alexPkg.id,
      student_id: alexStudent.id,
      amount: 1000,
      vat: 50,
      status: 'paid',
      method: 'Card'
    }
  })

  // Generate 49 other families
  const createdFamilies = [fSterling]
  for (let i = 2; i <= 50; i++) {
    const parentName = `${getRandomItem(parentFirstNames)} ${getRandomItem(parentLastNames)}`
    const phone = `+971 5${getRandomInt(0, 8)} ${getRandomInt(100, 999)} ${getRandomInt(1000, 9999)}`
    const email = `${parentName.toLowerCase().replace(/\s+/g, '.')}@example.com`
    
    const fam = await prisma.family.create({
      data: {
        primary_name: parentName,
        phone,
        email,
        consent_ops: true,
        consent_mktg: getRandomItem([true, false])
      }
    })
    createdFamilies.push(fam)
  }

  // Generate 59 other students
  const createdStudents = [alexStudent]
  for (let i = 2; i <= 60; i++) {
    const family = getRandomItem(createdFamilies)
    const centre = getRandomItem(centres)
    const coach = getRandomItem(coaches.filter(ch => ch.centre_id === centre.id)) || coaches[0]
    
    const name = `${getRandomItem(studentFirstNames)} ${family.primary_name ? family.primary_name.split(' ')[1] : 'Mendoza'}`
    const dob = getRandomDate(2500, 5000)
    const gender = getRandomItem(['Male', 'Female'])
    const level = getRandomItem(levels)
    const status = getRandomItem(statuses)
    const paceStatus = getRandomItem(paceStatuses)
    const fide_id = `MM-${1000 + i}`
    const join_date = getRandomDate(60, 300)
    
    // Flags configuration
    const isLowPackage = getRandomItem([true, false, false])
    const isAtRisk = paceStatus === 'Slow' || paceStatus === 'Stalled'
    const isInactive = status === 'inactive'
    const unpaidClasses = getRandomItem([0, 0, 0, 1, 2, 3, 4])
    const unpaidValue = unpaidClasses * 125 // average class price

    const student = await prisma.student.create({
      data: {
        family_id: family.id,
        centre_id: centre.id,
        coach_id: coach.id,
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
      }
    })
    createdStudents.push(student)

    // Packages & Invoices for this student
    const hasMultiplePkgs = getRandomItem([true, false, false])
    const tier = getRandomItem(tiers)

    if (hasMultiplePkgs) {
      // Create an older expired package
      const oldPkg = await prisma.package.create({
        data: {
          student_id: student.id,
          tier_id: tier.id,
          kind: 'new',
          classes_total: 8,
          classes_remaining: 0,
          start_date: getRandomDate(60, 90),
          expiry_date: getRandomDate(30, 45)
        }
      })
      await prisma.invoice.create({
        data: {
          package_id: oldPkg.id,
          student_id: student.id,
          amount: tier.price,
          vat: Number(tier.price) * 0.05,
          status: 'paid',
          method: getRandomItem(['Cash', 'Card', 'Bank Transfer'])
        }
      })
    }

    // Current package
    const rem = isLowPackage ? getRandomInt(0, 2) : getRandomInt(3, 12)
    const total = getRandomItem([8, 12, 24])
    const kind = getRandomItem(['renewal', 'new', 'renewal'])

    const currentPkg = await prisma.package.create({
      data: {
        student_id: student.id,
        tier_id: tier.id,
        kind,
        classes_total: total,
        classes_remaining: rem,
        start_date: getRandomDate(5, 29),
        expiry_date: getRandomDate(-30, -1)
      }
    })

    // Invoice for current package
    const invStatus = unpaidValue > 0 ? 'unpaid' : 'paid'
    await prisma.invoice.create({
      data: {
        package_id: currentPkg.id,
        student_id: student.id,
        amount: tier.price,
        vat: Number(tier.price) * 0.05,
        status: invStatus,
        method: invStatus === 'paid' ? getRandomItem(['Cash', 'Card', 'Bank Transfer']) : null
      }
    })

    // Fide Rating progression simulation
    if (getRandomItem([true, false])) {
      await prisma.fideRating.create({
        data: {
          student_id: student.id,
          date: getRandomDate(30, 60),
          rating: getRandomInt(600, 1400)
        }
      })
    }
  }

  // 6. Generate Attendance Logs (approx 600 records)
  console.log('Generating attendance logs...')
  for (const student of createdStudents) {
    const numClasses = getRandomInt(5, 15)
    for (let j = 0; j < numClasses; j++) {
      const coach = coaches.find(c => c.id === student.coach_id) || coaches[0]
      const status = getRandomItem(['present', 'present', 'present', 'present', 'absent', 'makeup'])
      
      await prisma.attendance.create({
        data: {
          student_id: student.id,
          coach_id: coach.id,
          date: getRandomDate(1, 59),
          status,
          topic: status === 'present' ? getRandomItem(chessTopics) : null,
          note: status === 'absent' ? 'Parent called in advance' : 'Active participation'
        }
      })
    }
  }

  // 7. Generate Progress Logs (approx 150 records)
  console.log('Generating progress logs...')
  for (const student of createdStudents) {
    const numLogs = getRandomInt(1, 3)
    for (let j = 0; j < numLogs; j++) {
      const coach = coaches.find(c => c.id === student.coach_id) || coaches[0]
      const focus = getRandomItem(chessFocusAreas)
      const note = `Struggled initially but demonstrated mastery of key patterns by the end of the session.`
      
      await prisma.progressLog.create({
        data: {
          student_id: student.id,
          coach_id: coach.id,
          date: getRandomDate(1, 40),
          focus_area: focus,
          evaluation: getRandomInt(3, 5),
          notes: note,
          skills: {
            openings: getRandomInt(2, 5),
            tactics: getRandomInt(2, 5),
            endgames: getRandomInt(2, 5),
            strategy: getRandomInt(2, 5),
            focus: getRandomInt(2, 5)
          }
        }
      })
    }
  }

  // 8. Generate Enquiries (approx 40 records)
  console.log('Generating enquiries...')
  const enquiryStages = ['new', 'contacted', 'trial_booked', 'trial_done', 'converted', 'lost']
  const enquirySources = ['Google Search', 'Instagram Ads', 'Referral', 'Walk-in Flyer', 'Facebook Post']
  
  for (let i = 1; i <= 40; i++) {
    const childName = `${getRandomItem(studentFirstNames)} ${getRandomItem(parentLastNames)}`
    const parentName = `${getRandomItem(parentFirstNames)} ${getRandomItem(parentLastNames)}`
    const phone = `+971 5${getRandomInt(0, 8)} ${getRandomInt(100, 999)} ${getRandomInt(1000, 9999)}`
    const stage = getRandomItem(enquiryStages)
    const source = getRandomItem(enquirySources)
    const centre = getRandomItem(centres)
    const coach = getRandomItem(coaches.filter(ch => ch.centre_id === centre.id)) || coaches[0]

    await prisma.enquiry.create({
      data: {
        child: childName,
        parent: parentName,
        phone,
        source,
        stage,
        centre_id: centre.id,
        age: `${getRandomInt(6, 14)} years`,
        experience: getRandomItem(['None', 'Plays at school', 'Advanced Beginner']),
        trial_date: stage === 'trial_booked' || stage === 'trial_done' ? getRandomDate(-5, 10) : null,
        coach_id: coach.id,
        notes: 'Interested in weekend afternoon slots.',
        created_at: getRandomDate(5, 30)
      }
    })
  }

  // 9. Create standard schedule slots for both centres
  console.log('Generating schedule slots...')
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const times = ['16:00', '17:30', '19:00']
  
  for (const day of days) {
    for (const time of times) {
      // Bay Avenue slot
      await prisma.scheduleSlot.create({
        data: {
          centre_id: c1.id,
          coach_id: chJames.id,
          day,
          time,
          level: getRandomItem(levels),
          capacity: 12
        }
      })
      // JLT slot
      await prisma.scheduleSlot.create({
        data: {
          centre_id: c2.id,
          coach_id: chMahri.id,
          day,
          time,
          level: getRandomItem(levels),
          capacity: 10
        }
      })
    }
  }

  console.log('Rich operational database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
