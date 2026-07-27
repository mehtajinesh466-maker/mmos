import prisma from './prisma'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import * as xlsxModule from 'xlsx'

const XLSX = (xlsxModule as any).default || xlsxModule;

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
  console.log('Generating rich test data/importing from Excel for Master Moves OS...')
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

  const ownerHash = await bcrypt.hash('mastermoves@$', 10)
  const frontDeskHash = await bcrypt.hash('mastermoves@front@123', 10)
  const coachHash = await bcrypt.hash('mastermoves@coach$', 10)
  const parentHash = await bcrypt.hash('password123', 10)

  // We check if the Excel files exist in the public directory
  const publicDir = path.join(process.cwd(), 'public')
  const studentFile = path.join(publicDir, 'Student records-7.xlsx')
  const packageFile = path.join(publicDir, 'All Student Packages-8.xlsx')
  const attendanceFile = path.join(publicDir, 'All Attendance Records-5.xlsx')

  const hasFiles = fs.existsSync(studentFile) && fs.existsSync(packageFile) && fs.existsSync(attendanceFile)

  if (hasFiles) {
    console.log('Found Excel files. Starting high-performance Zoho Import...')
    
    // Read files safely using buffer to avoid sharing/lock issues on Windows
    const studentWorkbook = XLSX.read(fs.readFileSync(studentFile), { type: 'buffer' })
    const studentData: any[] = XLSX.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]])

    const packageWorkbook = XLSX.read(fs.readFileSync(packageFile), { type: 'buffer' })
    const packageData: any[] = XLSX.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]])

    const attendanceWorkbook = XLSX.read(fs.readFileSync(attendanceFile), { type: 'buffer' })
    const attendanceData: any[] = XLSX.utils.sheet_to_json(attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]])

    // Create centres
    const centreIds: { [key: string]: string } = {
      'JLT': crypto.randomUUID(),
      'Bay Avenue': crypto.randomUUID(),
      'Town Square': crypto.randomUUID()
    }

    await prisma.centre.createMany({
      data: [
        { id: centreIds['JLT'], name: 'JLT', status: 'active' },
        { id: centreIds['Bay Avenue'], name: 'Bay Avenue', status: 'active' },
        { id: centreIds['Town Square'], name: 'Town Square', status: 'inactive' }
      ]
    })

    const getCentreId = (name: string) => {
      if (!name) return centreIds['Bay Avenue']
      const clean = name.trim().toLowerCase()
      if (clean.includes('jlt')) return centreIds['JLT']
      if (clean.includes('bay') || clean.includes('mall')) return centreIds['Bay Avenue']
      return centreIds['Bay Avenue']
    }

    // Default users
    const uAmitId = crypto.randomUUID()
    const uSaraId = crypto.randomUUID()
    await prisma.user.createMany({
      data: [
        { id: uAmitId, name: 'Amit Goyal', role: 'owner', email: 'owner@mastermoves.com', password: ownerHash },
        { id: uSaraId, name: 'Sara Miller', role: 'front_desk', centre_id: centreIds['Bay Avenue'], email: 'sara@mastermoves.com', password: frontDeskHash }
      ]
    })

    // Extract unique coaches
    const uniqueCoachNames = new Set<string>()
    studentData.forEach(r => {
      if (r['Coaches Details']) {
        const name = String(r['Coaches Details']).trim()
        if (name && name !== 'Unassigned') uniqueCoachNames.add(name)
      }
    })
    attendanceData.forEach(r => {
      if (r['Coaches Details']) {
        const name = String(r['Coaches Details']).trim()
        if (name && name !== 'Unassigned') uniqueCoachNames.add(name)
      }
    })

    // Create users & coaches
    const coachMap = new Map<string, { userId: string; coachId: string }>()
    const usersToCreate: any[] = []
    const coachesToCreate: any[] = []

    uniqueCoachNames.forEach(coachName => {
      const uId = crypto.randomUUID()
      const cId = crypto.randomUUID()
      const email = `${coachName.toLowerCase().replace(/[^a-z]/g, '')}@mastermoves.com`
      
      usersToCreate.push({
        id: uId,
        name: coachName,
        email,
        password: coachHash,
        role: 'coach',
        centre_id: centreIds['Bay Avenue']
      })
      coachesToCreate.push({
        id: cId,
        user_id: uId,
        centre_id: centreIds['Bay Avenue'],
        title: 'Coach',
        active: true
      })
      coachMap.set(coachName.toLowerCase(), { userId: uId, coachId: cId })
    })

    // Add fallback coaches
    const fallbackCoaches = ['james estrada', 'reggie santiago', 'john mendoza', 'mahri geldiyeva', 'brylle arellano', 'brett portuguese']
    fallbackCoaches.forEach(name => {
      if (!coachMap.has(name)) {
        const uId = crypto.randomUUID()
        const cId = crypto.randomUUID()
        usersToCreate.push({
          id: uId,
          name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          email: `${name.replace(/\s+/g, '')}@mastermoves.com`,
          password: coachHash,
          role: 'coach',
          centre_id: name.includes('mahri') || name.includes('brylle') || name.includes('brett') ? centreIds['JLT'] : centreIds['Bay Avenue']
        })
        coachesToCreate.push({
          id: cId,
          user_id: uId,
          centre_id: name.includes('mahri') || name.includes('brylle') || name.includes('brett') ? centreIds['JLT'] : centreIds['Bay Avenue'],
          title: 'Coach',
          active: true
        })
        coachMap.set(name, { userId: uId, coachId: cId })
      }
    })

    await prisma.user.createMany({ data: usersToCreate })
    await prisma.coach.createMany({ data: coachesToCreate })

    const findCoach = (name: string) => {
      if (!name) return coachMap.get('james estrada')?.coachId || null
      const clean = name.trim().toLowerCase()
      if (coachMap.has(clean)) return coachMap.get(clean)!.coachId
      for (const [key, val] of coachMap.entries()) {
        if (clean.includes(key) || key.includes(clean)) {
          return val.coachId
        }
      }
      return coachMap.get('james estrada')?.coachId || null
    }

    // Create Tiers
    const tierIds = {
      'Mini': crypto.randomUUID(),
      'Core': crypto.randomUUID(),
      'Elite': crypto.randomUUID(),
      'Pro-Track': crypto.randomUUID()
    }
    await prisma.tier.createMany({
      data: [
        { id: tierIds['Mini'], name: 'Mini', price: 750, inclusions: ['4 classes/month'], active: true },
        { id: tierIds['Core'], name: 'Core', price: 1000, inclusions: ['8 classes/month'], active: true },
        { id: tierIds['Elite'], name: 'Elite', price: 1500, inclusions: ['12 classes/month'], active: true },
        { id: tierIds['Pro-Track'], name: 'Pro-Track', price: 3500, inclusions: ['24 classes/month'], active: true }
      ]
    })

    const getTierId = (classesCount: number) => {
      if (classesCount <= 4) return tierIds['Mini']
      if (classesCount <= 8) return tierIds['Core']
      if (classesCount <= 12) return tierIds['Elite']
      return tierIds['Pro-Track']
    }

    const parseExcelDate = (val: any): Date | null => {
      if (!val) return null
      if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000))
      }
      const d = new Date(val)
      return isNaN(d.getTime()) ? null : d
    }

    const cleanName = (name: string): string => {
      if (!name) return ''
      return name.trim().toLowerCase().replace(/\s+/g, ' ')
    }

    // Process Families & Students
    const familiesToCreate: any[] = []
    const studentsToCreate: any[] = []
    const familiesMap = new Map<string, string>()
    const studentMap = new Map<string, string>()
    const studentNameMap = new Map<string, string>()

    studentData.forEach((row, idx) => {
      const name = String(row['Name'] || '').trim()
      if (!name) return

      const phone = row['Mobile/Whatsapp'] ? String(row['Mobile/Whatsapp']).trim() : ''
      let famId = crypto.randomUUID()
      if (phone && familiesMap.has(phone)) {
        famId = familiesMap.get(phone)!
      } else {
        if (phone) familiesMap.set(phone, famId)
        familiesToCreate.push({
          id: famId,
          primary_name: `Parent of ${name}`,
          phone: phone || null,
          email: null,
          consent_ops: true,
          consent_mktg: false
        })
      }

      const sId = crypto.randomUUID()
      const refId = row['Student Id'] ? String(row['Student Id']).trim() : `MM-${1000 + idx}`
      studentMap.set(refId.toLowerCase(), sId)
      studentNameMap.set(cleanName(name), sId)

      const centreId = getCentreId(row['Assigned center'])
      const coachId = findCoach(row['Coaches Details'])
      const dob = parseExcelDate(row['Date of birth'])
      const joinDate = parseExcelDate(row['Date Enrolled']) || new Date()
      const level = row['Current Student levels'] || row['Joining Student level'] || 'Beginner'
      const status = String(row['Status'] || 'Active').trim().toLowerCase() === 'active' ? 'active' : 'inactive'

      studentsToCreate.push({
        id: sId,
        family_id: famId,
        centre_id: centreId,
        coach_id: coachId,
        name,
        dob,
        gender: row['Gender'] || null,
        school: row['School'] || null,
        level,
        status,
        fide_id: row['FIDE ID'] || null,
        join_date: joinDate,
        last_attended: null,
        pace_status: 'On track',
        flags: {}
      })
    })



    const findStudentId = (ref: string, name: string): string | null => {
      if (ref && studentMap.has(ref.trim().toLowerCase())) {
        return studentMap.get(ref.trim().toLowerCase())!
      }
      const clean = cleanName(name)
      if (clean && studentNameMap.has(clean)) {
        return studentNameMap.get(clean)!
      }
      return null
    }

    // Process Packages & Invoices
    const packagesToCreate: any[] = []
    const invoicesToCreate: any[] = []
    const studentPackageCounts = new Map<string, number>()

    packageData.forEach(row => {
      const studentName = String(row['Student'] || '').trim()
      const ref = row['Student Id'] ? String(row['Student Id']).trim() : ''
      const studentId = findStudentId(ref, studentName)
      if (!studentId) return

      const pkgId = crypto.randomUUID()
      const totalClasses = Number(row['No of classes']) || 8
      const price = Number(row['Price']) || 0
      const dateOfPayment = parseExcelDate(row['Date of payment']) || new Date()

      studentPackageCounts.set(studentId, (studentPackageCounts.get(studentId) || 0) + totalClasses)

      packagesToCreate.push({
        id: pkgId,
        student_id: studentId,
        tier_id: getTierId(totalClasses),
        kind: String(row['New/Renewal'] || 'new').toLowerCase().includes('renewal') ? 'renewal' : 'new',
        classes_total: totalClasses,
        classes_remaining: totalClasses,
        discount_pct: 0,
        frozen: false,
        start_date: dateOfPayment,
        expiry_date: null
      })

      invoicesToCreate.push({
        id: crypto.randomUUID(),
        package_id: pkgId,
        student_id: studentId,
        amount: price,
        vat: price * 0.05,
        status: 'paid',
        method: row['Mode of payment'] || 'Cash'
      })
    })

    // Process Attendance
    const attendanceToCreate: any[] = []
    const studentAttendanceCounts = new Map<string, number>()
    const studentLastAttended = new Map<string, Date>()

    attendanceData.forEach(row => {
      const studentName = String(row['Student'] || '').trim()
      const studentId = findStudentId('', studentName)
      if (!studentId) return

      const coachId = findCoach(row['Coaches Details'])
      const date = parseExcelDate(row['Date']) || new Date()
      const status = String(row['Attendance'] || 'present').trim().toLowerCase()

      if (status === 'present' || status === 'makeup') {
        studentAttendanceCounts.set(studentId, (studentAttendanceCounts.get(studentId) || 0) + 1)
        const currentLast = studentLastAttended.get(studentId)
        if (!currentLast || date.getTime() > currentLast.getTime()) {
          studentLastAttended.set(studentId, date)
        }
      }

      attendanceToCreate.push({
        id: crypto.randomUUID(),
        student_id: studentId,
        coach_id: coachId,
        date,
        status: status === 'present' || status === 'makeup' || status === 'absent' ? status : 'present',
        topic: null,
        note: 'Imported from Zoho Creator'
      })
    })

    // Chronological package remaining classes calculation (FIFO)
    const studentPackagesMap = new Map<string, any[]>()
    packagesToCreate.forEach(pkg => {
      if (!studentPackagesMap.has(pkg.student_id)) {
        studentPackagesMap.set(pkg.student_id, [])
      }
      studentPackagesMap.get(pkg.student_id)!.push(pkg)
    })

    studentPackagesMap.forEach((pkgs, studentId) => {
      pkgs.sort((a, b) => a.start_date.getTime() - b.start_date.getTime())
      let attended = studentAttendanceCounts.get(studentId) || 0
      pkgs.forEach(pkg => {
        const used = Math.min(pkg.classes_total, attended)
        pkg.classes_remaining = pkg.classes_total - used
        attended -= used
      })
    })

    // Update student details with calculated last_attended, low package, and unbilled metrics in memory
    for (const student of studentsToCreate) {
      if (studentLastAttended.has(student.id)) {
        student.last_attended = studentLastAttended.get(student.id)
      }
      const pkgs = studentPackagesMap.get(student.id) || []
      const totalRemaining = pkgs.reduce((sum, p) => sum + p.classes_remaining, 0)
      const totalClasses = pkgs.reduce((sum, p) => sum + p.classes_total, 0)
      
      const attendedCount = studentAttendanceCounts.get(student.id) || 0
      const unpaidClasses = Math.max(0, attendedCount - totalClasses)
      const unpaidValue = unpaidClasses * 125 // Standard rate 125 AED/class
      
      const flags: any = {}
      if (totalClasses > 0 && (totalRemaining / totalClasses <= 0.20 || totalRemaining <= 2)) {
        flags.low_package = true
      }
      if (unpaidClasses > 0) {
        flags.unpaid_classes = unpaidClasses
        flags.unpaid_value = unpaidValue
      }
      student.flags = flags
    }

    // Now insert families and students with the correct computed properties
    await prisma.family.createMany({ data: familiesToCreate })
    await prisma.student.createMany({ data: studentsToCreate })

    const dbStudents = await prisma.student.findMany({ select: { id: true } })
    const dbStudentIdsSet = new Set(dbStudents.map(s => s.id))
    const badAttendance = attendanceToCreate.filter(a => !dbStudentIdsSet.has(a.student_id))
    const badPackages = packagesToCreate.filter(p => !dbStudentIdsSet.has(p.student_id))
    
    console.log('--- SEEDING DIAGNOSTIC (DB LEVEL) ---')
    console.log('Total students actually in DB:', dbStudents.length)
    console.log('Total attendance in attendanceToCreate:', attendanceToCreate.length)
    console.log('Total packages in packagesToCreate:', packagesToCreate.length)
    console.log('Bad attendance count (student not in DB):', badAttendance.length)
    console.log('Bad package count (student not in DB):', badPackages.length)
    if (badAttendance.length > 0) {
      console.log('Sample bad attendance (not in DB):', badAttendance.slice(0, 3))
    }

    const chunkSize = 500
    for (let i = 0; i < packagesToCreate.length; i += chunkSize) {
      await prisma.package.createMany({ data: packagesToCreate.slice(i, i + chunkSize) })
    }
    for (let i = 0; i < invoicesToCreate.length; i += chunkSize) {
      await prisma.invoice.createMany({ data: invoicesToCreate.slice(i, i + chunkSize) })
    }
    for (let i = 0; i < attendanceToCreate.length; i += chunkSize) {
      await prisma.attendance.createMany({ data: attendanceToCreate.slice(i, i + chunkSize) })
    }

    // Schedule slots
    const scheduleSlotsToCreate = []
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const times = ['16:00', '17:30', '19:00']
    const levels = ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track']

    for (const day of days) {
      for (const time of times) {
        scheduleSlotsToCreate.push({
          id: crypto.randomUUID(),
          centre_id: centreIds['Bay Avenue'],
          coach_id: findCoach('james estrada')!,
          day,
          time,
          level: levels[Math.floor(Math.random() * levels.length)],
          capacity: 12
        })
        scheduleSlotsToCreate.push({
          id: crypto.randomUUID(),
          centre_id: centreIds['JLT'],
          coach_id: findCoach('brylle arellano')!,
          day,
          time,
          level: levels[Math.floor(Math.random() * levels.length)],
          capacity: 10
        })
      }
    }
    await prisma.scheduleSlot.createMany({ data: scheduleSlotsToCreate })

    const endTime = Date.now()
    console.log(`Rich operational database seed completed successfully in ${((endTime - startTime)/1000).toFixed(2)}s!`)
    return
  }

  // ── MOCK DATA FALLBACK ──────────────────────────────────────────────────
  // 1. Generate Centres
  const c1Id = crypto.randomUUID()
  const c2Id = crypto.randomUUID()
  const c3Id = crypto.randomUUID()

  await prisma.centre.createMany({
    data: [
      { id: c1Id, name: 'Bay Avenue', status: 'active' },
      { id: c2Id, name: 'JLT', status: 'active' },
      { id: c3Id, name: 'Town Square', status: 'inactive' }
    ]
  })

  const centreIdsList = [c1Id, c2Id]

  // 2. Generate Users
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
      { id: uAmitId, name: 'Amit Goyal', role: 'owner', email: 'owner@mastermoves.com', password: ownerHash },
      { id: uSaraId, name: 'Sara Miller', role: 'front_desk', centre_id: c1Id, email: 'sara@mastermoves.com', password: frontDeskHash },
      { id: uJamesId, name: 'James Estrada', role: 'coach', centre_id: c1Id, email: 'james@mastermoves.com', password: coachHash },
      { id: uReggieId, name: 'Reggie Santiago', role: 'coach', centre_id: c1Id, email: 'reggie@mastermoves.com', password: coachHash },
      { id: uJohnId, name: 'John Mendoza', role: 'coach', centre_id: c1Id, email: 'john@mastermoves.com', password: coachHash },
      { id: uMahriId, name: 'Mahri Geldiyeva', role: 'coach', centre_id: c2Id, email: 'mahri@mastermoves.com', password: coachHash },
      { id: uBrylleId, name: 'Brylle Arellano', role: 'coach', centre_id: c2Id, email: 'brylle@mastermoves.com', password: coachHash },
      { id: uBrettId, name: 'Brett Portuguese', role: 'coach', centre_id: c2Id, email: 'brett@mastermoves.com', password: coachHash },
      { id: uParentId, name: 'Robert Sterling', role: 'parent', email: 'parent@mastermoves.com', password: parentHash }
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

  const parentFirstNames = ['David', 'Sarah', 'Michael', 'Emma', 'Richard', 'Robert', 'John', 'Katherine', 'James', 'Aisha', 'Faisal', 'Sunita', 'Rajesh', 'Maria', 'Jose']
  const parentLastNames = ['Smith', 'Miller', 'Jones', 'Taylor', 'Brown', 'Singh', 'Al-Mansoori', 'Patel', 'Gomez', 'OConnor', 'Davis', 'Wilson', 'Rodriguez', 'Thomas']
  const studentFirstNames = ['Leo', 'Sophia', 'Arjun', 'Zoe', 'Aiden', 'Mia', 'Ryan', 'Chloe', 'Noah', 'Emma', 'Ethan', 'Olivia', 'Liam', 'Ava', 'Lucas', 'Isabella', 'Mason', 'Oliver', 'Charlotte', 'Kabir', 'Zayd', 'Rohan', 'Anya', 'Tariq', 'Sultan']
  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track']
  const statuses = ['active', 'active', 'active', 'active', 'inactive', 'left']
  const paceStatuses = ['On track', 'Ahead', 'Slow', 'Stalled']
  const chessFocusAreas = ['Tactics & Combinations', 'Opening Repertoire', 'Endgame Technique', 'Positional Strategy', 'Calculation Speed', 'Tournament Psychological Focus']
  const chessTopics = ['Pins & Skewers', 'King Safety', 'Rook Endgames', 'Sicilian Defense', 'Queen\'s Gambit', 'Pawn Structures', 'Double Attacks', 'Zwischenzug', 'Knight Outposts', 'Open Files control']

  // 5. Generate Families
  const familiesToCreateList = []
  const usersToCreateList = []

  const fSterlingId = crypto.randomUUID()
  familiesToCreateList.push({
    id: fSterlingId,
    primary_name: 'Robert Sterling',
    phone: '+971 50 999 8888',
    email: 'parent@mastermoves.com'
  })

  const generatedFamilyIds = [fSterlingId]
  const generatedFamilyDetails = [{ id: fSterlingId, primary_name: 'Robert Sterling' }]
  for (let i = 2; i <= 50; i++) {
    const familyId = crypto.randomUUID()
    const parentName = `${getRandomItem(parentFirstNames)} ${getRandomItem(parentLastNames)}`
    const phone = `+971 5${getRandomInt(0, 8)} ${getRandomInt(100, 999)} ${getRandomInt(1000, 9999)}`
    const email = `${parentName.toLowerCase().replace(/\s+/g, '.')}.${i}@example.com`
    
    familiesToCreateList.push({
      id: familyId,
      primary_name: parentName,
      phone,
      email,
      consent_ops: true,
      consent_mktg: getRandomItem([true, false])
    })

    usersToCreateList.push({
      id: crypto.randomUUID(),
      name: parentName,
      email,
      password: parentHash,
      role: 'parent',
      centre_id: null
    })

    generatedFamilyIds.push(familyId)
    generatedFamilyDetails.push({ id: familyId, primary_name: parentName })
  }

  await prisma.family.createMany({ data: familiesToCreateList })
  await prisma.user.createMany({ data: usersToCreateList })

  // 6. Generate Students
  const studentsToCreateList = []
  const alexStudentId = crypto.randomUUID()

  studentsToCreateList.push({
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
    const centreId = getRandomItem(centreIdsList)
    const coachId = getRandomItem(coachIds.filter(cid => {
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

    studentsToCreateList.push({
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

  await prisma.student.createMany({ data: studentsToCreateList })

  // 7. Generate Packages & Invoices
  const packagesToCreateList = []
  const invoicesToCreateList = []
  const ratingsToCreate = []

  const alexPkgId = crypto.randomUUID()
  packagesToCreateList.push({
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

  invoicesToCreateList.push({
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
      packagesToCreateList.push({
        id: oldPkgId,
        student_id: student.id,
        tier_id: tierId,
        kind: 'new',
        classes_total: 8,
        classes_remaining: 0,
        start_date: getRandomDate(60, 90),
        expiry_date: getRandomDate(30, 45)
      })
      invoicesToCreateList.push({
        id: crypto.randomUUID(),
        package_id: oldPkgId,
        student_id: student.id,
        amount: tierPrice,
        vat: tierPrice * 0.05,
        status: 'paid',
        method: getRandomItem(['Cash', 'Card', 'Bank Transfer'])
      })
    }

    const studentData = studentsToCreateList.find(s => s.id === student.id)
    const isLowPkg = studentData?.flags?.low_package ?? false
    const rem = isLowPkg ? getRandomInt(0, 2) : getRandomInt(3, 12)
    const total = getRandomItem([8, 12, 24])
    const kind = getRandomItem(['renewal', 'new', 'renewal'])

    const currentPkgId = crypto.randomUUID()
    packagesToCreateList.push({
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
    invoicesToCreateList.push({
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

  await prisma.package.createMany({ data: packagesToCreateList })
  await prisma.invoice.createMany({ data: invoicesToCreateList })
  await prisma.fideRating.createMany({ data: ratingsToCreate })

  // 8. Generate Attendance Logs
  console.log('Generating attendance logs...')
  const attendanceToCreateList = []
  for (const student of generatedStudents) {
    const numClasses = getRandomInt(5, 15)
    for (let j = 0; j < numClasses; j++) {
      const status = getRandomItem(['present', 'present', 'present', 'present', 'absent', 'makeup'])
      attendanceToCreateList.push({
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
  await prisma.attendance.createMany({ data: attendanceToCreateList })

  // 9. Generate Progress Logs
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

  // 10. Generate Enquiries
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
    const centreId = getRandomItem(centreIdsList)
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
  const scheduleSlotsToCreateList = []
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const times = ['16:00', '17:30', '19:00']
  
  for (const day of days) {
    for (const time of times) {
      scheduleSlotsToCreateList.push({
        id: crypto.randomUUID(),
        centre_id: c1Id,
        coach_id: chJamesId,
        day,
        time,
        level: getRandomItem(levels),
        capacity: 12
      })
      scheduleSlotsToCreateList.push({
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
  await prisma.scheduleSlot.createMany({ data: scheduleSlotsToCreateList })

  const endTime = Date.now()
  console.log(`Rich operational database seed completed successfully in ${((endTime - startTime)/1000).toFixed(2)}s!`)
}
