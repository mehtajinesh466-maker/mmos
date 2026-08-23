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

function parseScheduleString(scheduleStr: any) {
  if (!scheduleStr) return [];
  const cleanStr = String(scheduleStr).trim();
  
  const pattern = /(\d+)(?:-(\d+))?\s*(PM|AM)?\s*\(([^)]+)\)/gi;
  const results: { day: string; time: string }[] = [];
  let match: any;
  
  const dayMapping: { [key: string]: string } = {
    'mon': 'Mon', 'monday': 'Mon',
    'tue': 'Tue', 'tuesday': 'Tue',
    'wed': 'Wed', 'wednesday': 'Wed',
    'thu': 'Thu', 'thur': 'Thu', 'thurs': 'Thu', 'thursday': 'Thu',
    'fri': 'Fri', 'friday': 'Fri',
    'sat': 'Sat', 'saturday': 'Sat',
    'sun': 'Sun', 'sunday': 'Sun'
  };

  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  while ((match = pattern.exec(cleanStr)) !== null) {
    const startHourRaw = parseInt(match[1]);
    const amPm = match[3] ? match[3].toUpperCase() : null;
    const daysRaw = match[4].toLowerCase().trim();
    
    let startHour = startHourRaw;
    if (amPm === 'PM' && startHour < 12) {
      startHour += 12;
    } else if (amPm === 'AM' && startHour === 12) {
      startHour = 0;
    } else if (!amPm) {
      if (startHour < 9) {
        startHour += 12;
      }
    }
    
    const formattedTime = `${String(startHour).padStart(2, '0')}:00`;
    
    let days: string[] = [];
    if (daysRaw.includes('everyday')) {
      if (daysRaw.includes('except')) {
        const exceptDay = daysRaw.replace('everyday except', '').trim();
        const mappedExcept = dayMapping[exceptDay];
        days = allDays.filter(d => d !== mappedExcept);
      } else {
        days = [...allDays];
      }
    } else if (daysRaw.includes(',')) {
      days = daysRaw.split(',').map(d => dayMapping[d.trim()]).filter(Boolean);
    } else if (daysRaw.includes('-')) {
      const parts = daysRaw.split('-');
      const startDay = dayMapping[parts[0].trim()];
      const endDay = dayMapping[parts[1].trim()];
      
      const startIndex = allDays.indexOf(startDay);
      const endIndex = allDays.indexOf(endDay);
      
      if (startIndex !== -1 && endIndex !== -1) {
        if (startIndex <= endIndex) {
          days = allDays.slice(startIndex, endIndex + 1);
        } else {
          days = [...allDays.slice(startIndex), ...allDays.slice(0, endIndex + 1)];
        }
      }
    } else {
      const mapped = dayMapping[daysRaw];
      if (mapped) days.push(mapped);
    }
    
    days.forEach(day => {
      results.push({ day, time: formattedTime });
    });
  }
  
  return results;
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

  const publicDir = path.join(process.cwd(), 'public')
  const newStudentFile = path.join(publicDir, 'Student records-20.xlsx')
  const newPackageFile = path.join(publicDir, 'All Student Packages-24.xlsx')
  const newAttendanceFile = path.join(publicDir, 'All Attendance Records-18.xlsx')
  const newScheduleFile = path.join(publicDir, 'JLT coach schedules.xlsx')

  const hasNewFiles = fs.existsSync(newStudentFile) && fs.existsSync(newPackageFile) && fs.existsSync(newAttendanceFile)

  if (hasNewFiles) {
    console.log('Found new Excel files. Starting high-performance Master Moves OS Import...')
    const newStartTime = Date.now()

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

    const getCentreId = (name: any) => {
      if (!name) return centreIds['Bay Avenue']
      const clean = String(name).trim().toLowerCase()
      if (clean.includes('jlt')) return centreIds['JLT']
      if (clean.includes('bay') || clean.includes('mall')) return centreIds['Bay Avenue']
      return centreIds['Bay Avenue']
    }

    // Default users (Amit and Sara)
    const uAmitId = crypto.randomUUID()
    const uSaraId = crypto.randomUUID()
    await prisma.user.createMany({
      data: [
        { id: uAmitId, name: 'Amit Goyal', role: 'owner', email: 'owner@mastermoves.com', password: ownerHash },
        { id: uSaraId, name: 'Sara Miller', role: 'front_desk', centre_id: centreIds['Bay Avenue'], email: 'sara@mastermoves.com', password: frontDeskHash }
      ]
    })

    // Create coaches
    const coachMap = new Map<string, { userId: string; coachId: string }>()
    const usersToCreate: any[] = []
    const coachesToCreate: any[] = []

    const fallbackCoaches = [
      'james estrada',
      'reggie santiago',
      'john mendoza',
      'mahri geldiyeva',
      'brylle arellano',
      'brett portuguese',
      'ryan carandang'
    ]

    fallbackCoaches.forEach(name => {
      const uId = crypto.randomUUID()
      const cId = crypto.randomUUID()
      usersToCreate.push({
        id: uId,
        name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        email: `${name.replace(/\s+/g, '')}@mastermoves.com`,
        password: coachHash,
        role: 'coach',
        centre_id: (name.includes('mahri') || name.includes('brylle') || name.includes('brett') || name.includes('ryan')) ? centreIds['JLT'] : centreIds['Bay Avenue']
      })
      coachesToCreate.push({
        id: cId,
        user_id: uId,
        centre_id: (name.includes('mahri') || name.includes('brylle') || name.includes('brett') || name.includes('ryan')) ? centreIds['JLT'] : centreIds['Bay Avenue'],
        title: 'Coach',
        active: true
      })
      coachMap.set(name, { userId: uId, coachId: cId })
    })

    await prisma.user.createMany({ data: usersToCreate })
    await prisma.coach.createMany({ data: coachesToCreate })

    const findCoach = (name: string) => {
      if (!name) return coachMap.get('james estrada')?.coachId || null
      const clean = name.trim().toLowerCase()
      if (clean.includes('james')) return coachMap.get('james estrada')?.coachId || null
      if (clean.includes('reggie')) return coachMap.get('reggie santiago')?.coachId || null
      if (clean.includes('john')) return coachMap.get('john mendoza')?.coachId || null
      if (clean.includes('mahri')) return coachMap.get('mahri geldiyeva')?.coachId || null
      if (clean.includes('brylle') || clean.includes('bryle')) return coachMap.get('brylle arellano')?.coachId || null
      if (clean.includes('brett')) return coachMap.get('brett portuguese')?.coachId || null
      if (clean.includes('ryan') || clean.includes('cardelang') || clean.includes('carandang')) return coachMap.get('ryan carandang')?.coachId || null

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

    // Load sheets
    const studentRosterWorkbook = XLSX.read(fs.readFileSync(newStudentFile), { type: 'buffer' })
    const studentRosterData: any[] = []
    studentRosterWorkbook.SheetNames.forEach(sheetName => {
      const sheetData: any[] = XLSX.utils.sheet_to_json(studentRosterWorkbook.Sheets[sheetName])
      studentRosterData.push(...sheetData)
    })

    const packageWorkbook = XLSX.read(fs.readFileSync(newPackageFile), { type: 'buffer' })
    const packageData: any[] = XLSX.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]])

    const attendanceWorkbook = XLSX.read(fs.readFileSync(newAttendanceFile), { type: 'buffer' })
    const attendanceData: any[] = XLSX.utils.sheet_to_json(attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]])

    // Process Students & Families
    const familiesToCreate: any[] = []
    const studentsToCreate: any[] = []
    const familiesMap = new Map<string, string>() // phone -> familyId
    const studentMap = new Map<string, string>() // studentId (lowercase) -> db UUID
    const studentNameMap = new Map<string, string>() // cleanName -> db UUID


    studentRosterData.forEach((row, idx) => {
      const name = String(row['Name'] || '').trim()
      if (!name) return

      const clean = cleanName(name)
      const rawPhone = row['Mobile/Whatsapp'] || ''
      const phone = String(rawPhone).trim()

      let familyId = crypto.randomUUID()
      if (phone && phone !== 'undefined' && phone !== '') {
        if (familiesMap.has(phone)) {
          familyId = familiesMap.get(phone)!
        } else {
          familiesMap.set(phone, familyId)
          familiesToCreate.push({
            id: familyId,
            primary_name: `Parent of ${name}`,
            phone: phone,
            email: null,
            consent_ops: true,
            consent_mktg: false
          })
        }
      } else {
        familiesToCreate.push({
          id: familyId,
          primary_name: `Parent of ${name}`,
          phone: null,
          email: null,
          consent_ops: true,
          consent_mktg: false
        })
      }

      const sId = crypto.randomUUID()
      const refId = String(row['Student Id'] || '').trim()
      if (refId) {
        studentMap.set(refId.toLowerCase(), sId)
      }
      studentNameMap.set(clean, sId)

      const centreId = getCentreId(row['Assigned center'])
      const coachId = findCoach(row['Coaches Details'])
      const dob = parseExcelDate(row['Date of birth'])
      const joinDate = parseExcelDate(row['Date Enrolled']) || new Date('2026-08-01')
      const level = row['Current Student levels'] || row['Joining Student level'] || 'Beginner'
      const status = String(row['Status'] || 'Active').trim().toLowerCase() === 'active' ? 'active' : 'inactive'

      studentsToCreate.push({
        id: sId,
        family_id: familyId,
        centre_id: centreId,
        coach_id: coachId,
        name,
        dob,
        gender: null,
        school: row['School'] || null,
        level,
        status,
        fide_id: null,
        join_date: joinDate,
        last_attended: null,
        pace_status: 'On track',
        flags: refId ? { custom_student_id: refId } : {},
        address: row['Address'] || null,
        alternate_centre: row['Alternate Center'] || null,
        resident_status: row['ET /JLT Resident'] || null,
        category: row['Student category'] || null,
        notes: row['NOTES'] || 'Imported from Student records-20',
        referral_source: row['HOW DID YOU HEAR ABOUT US '] || null,
        parent_name: row['Parent name'] || null
      })
    })

    const findStudentId = (ref: string, name: string): string | null => {
      const clean = cleanName(name)
      if (clean && studentNameMap.has(clean)) {
        return studentNameMap.get(clean)!
      }
      if (ref && studentMap.has(ref.trim().toLowerCase())) {
        const sId = studentMap.get(ref.trim().toLowerCase())!
        if (clean) {
          studentNameMap.set(clean, sId)
        }
        return sId
      }
      return null
    }

    // Process Packages
    const packagesToCreate: any[] = []
    const invoicesToCreate: any[] = []

    packageData.forEach(row => {
      const studentName = String(row['Student'] || '').trim()
      if (!studentName) return
      if (cleanName(studentName) === 'aya elimi') return

      let studentId = findStudentId(row['Student Id'], studentName)
      if (!studentId) {
        studentId = crypto.randomUUID()
        const clean = cleanName(studentName)
        studentNameMap.set(clean, studentId)
        if (row['Student Id']) {
          studentMap.set(String(row['Student Id']).trim().toLowerCase(), studentId)
        }

        const familyId = crypto.randomUUID()
        familiesToCreate.push({
          id: familyId,
          primary_name: `Parent of ${studentName}`,
          phone: null,
          email: null,
          consent_ops: true,
          consent_mktg: false
        })

        studentsToCreate.push({
          id: studentId,
          family_id: familyId,
          centre_id: getCentreId(row['Assigned center']),
          coach_id: findCoach(''),
          name: studentName,
          dob: null,
          gender: null,
          school: null,
          level: 'Beginner',
          status: 'active',
          join_date: parseExcelDate(row['Student Enroll First']) || new Date(),
          last_attended: null,
          flags: {},
          notes: 'Created dynamically from package logs'
        })
      }

      const pkgId = crypto.randomUUID()
      const totalClasses = Number(row['No of classes']) || 0
      const completedClasses = Number(row['Completed Classes']) || 0
      const remainingClasses = totalClasses - completedClasses
      const price = Number(row['Price']) || 0
      const dateOfPayment = parseExcelDate(row['Date of payment']) || parseExcelDate(row['Student Enroll First']) || new Date()

      const rawKind = String(row['New/Renewal'] || 'New').toLowerCase()
      const kind = rawKind.includes('tournament') ? 'tournament' : (rawKind.includes('renewal') ? 'renewal' : 'new')

      packagesToCreate.push({
        id: pkgId,
        student_id: studentId,
        tier_id: getTierId(totalClasses),
        kind: kind,
        classes_total: totalClasses,
        classes_remaining: remainingClasses,
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
        method: row['Mode of payment'] || 'Online',
        created_at: dateOfPayment
      })
    })

    // Process Attendance
    const attendanceToCreate: any[] = []
    const studentLastAttended = new Map<string, Date>()

    // Find max date in attendanceData to use as fallback for empty dates
    let maxAttendanceDate = new Date('2026-08-22')
    attendanceData.forEach(row => {
      const d = parseExcelDate(row['Date'])
      if (d && d > maxAttendanceDate) {
        maxAttendanceDate = d
      }
    })

    attendanceData.forEach(row => {
      const studentName = String(row['Student'] || '').trim()
      if (!studentName) return
      if (cleanName(studentName) === 'aya elimi') return

      let studentId = findStudentId('', studentName)
      if (!studentId) {
        studentId = crypto.randomUUID()
        const clean = cleanName(studentName)
        studentNameMap.set(clean, studentId)

        const familyId = crypto.randomUUID()
        familiesToCreate.push({
          id: familyId,
          primary_name: `Parent of ${studentName}`,
          phone: null,
          email: null,
          consent_ops: true,
          consent_mktg: false
        })

        studentsToCreate.push({
          id: studentId,
          family_id: familyId,
          centre_id: getCentreId(row['Assigned center']),
          coach_id: findCoach(row['Coaches Details']),
          name: studentName,
          dob: null,
          gender: null,
          school: null,
          level: 'Beginner',
          status: 'inactive',
          join_date: parseExcelDate(row['Date']) || maxAttendanceDate,
          last_attended: null,
          flags: {}
        })
      }

      const date = parseExcelDate(row['Date']) || maxAttendanceDate
      if (date) {
        const currentLast = studentLastAttended.get(studentId)
        if (!currentLast || date > currentLast) {
          studentLastAttended.set(studentId, date)
        }
      }

      const status = String(row['Attendance'] || 'Present').trim().toLowerCase()
      const rawDuration = row['Class duration']
      const duration = (rawDuration !== undefined && rawDuration !== null && rawDuration !== '') ? Number(rawDuration) : 2

      attendanceToCreate.push({
        id: crypto.randomUUID(),
        student_id: studentId,
        coach_id: findCoach(row['Coaches Details']),
        date: date,
        status: status === 'makeup' ? 'makeup' : (status === 'absent' ? 'absent' : 'present'),
        duration: duration,
        topic: null,
        note: 'Imported from Attendance Records'
      })
    })

    // Update student last_attended, low_package, and unbilled flags
    for (const student of studentsToCreate) {
      if (studentLastAttended.has(student.id)) {
        student.last_attended = studentLastAttended.get(student.id)
      }

      const pkgs = packagesToCreate.filter(p => p.student_id === student.id)
      const totalRemaining = pkgs.reduce((sum, p) => sum + p.classes_remaining, 0)
      const totalClasses = pkgs.reduce((sum, p) => sum + p.classes_total, 0)

      if (totalClasses > 0 && (totalRemaining / totalClasses <= 0.20 || totalRemaining <= 2)) {
        student.flags = {
          ...student.flags,
          low_package: true
        }
      }

      // Calculate unbilled classes
      const studentAtt = attendanceToCreate.filter(a => a.student_id === student.id && (a.status === 'present' || a.status === 'makeup'))
      const totalAttended = studentAtt.reduce((sum, a) => sum + a.duration, 0)
      const unpaidClasses = Math.max(0, totalAttended - totalClasses)

      if (unpaidClasses > 0) {
        let rate = 125
        if (pkgs.length > 0) {
          const sorted = [...pkgs].sort((a, b) => b.start_date.getTime() - a.start_date.getTime())
          const latestPkg = sorted[0]
          const invoice = invoicesToCreate.find(inv => inv.package_id === latestPkg.id)
          const price = invoice ? invoice.amount : 0
          rate = (price > 0 && latestPkg.classes_total > 0) ? Math.round(price / latestPkg.classes_total) : 125
        }
        student.flags = {
          ...student.flags,
          unpaid_classes: unpaidClasses,
          unpaid_value: unpaidClasses * rate
        }
      }
    }

    // Insert to DB
    await prisma.family.createMany({ data: familiesToCreate })
    await prisma.student.createMany({ data: studentsToCreate })

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

    // Process JLT coach schedules
    const scheduleSlotsToCreate: any[] = []
    const enrollmentsToCreate: any[] = []
    const slotMap = new Map<string, string>()

    if (fs.existsSync(newScheduleFile)) {
      const wbSchedule = XLSX.read(fs.readFileSync(newScheduleFile), { type: 'buffer' })
      wbSchedule.SheetNames.forEach(sheetName => {
        const sheetData: any[] = XLSX.utils.sheet_to_json(wbSchedule.Sheets[sheetName])
        sheetData.forEach(row => {
          const name = String(row['Name'] || '').trim()
          if (!name) return

          const studentId = findStudentId('', name)
          if (!studentId) return

          const coachName = row['Updated Coach'] || sheetName.replace('Coach ', '')
          const coachId = findCoach(coachName)
          if (!coachId) return

          const scheduleStr = row['Schedule'] || row['Remarks']
          const slots = parseScheduleString(scheduleStr)

          slots.forEach(slot => {
            const slotKey = `${coachId}_${slot.day}_${slot.time}`
            let slotId = slotMap.get(slotKey)

            if (!slotId) {
              slotId = crypto.randomUUID()
              slotMap.set(slotKey, slotId)
              scheduleSlotsToCreate.push({
                id: slotId,
                centre_id: centreIds['JLT'],
                coach_id: coachId,
                day: slot.day,
                time: slot.time,
                level: row['Level'] || 'Beginner',
                capacity: 10,
                is_summer_camp: false
              })
            }

            enrollmentsToCreate.push({
              id: crypto.randomUUID(),
              student_id: studentId,
              slot_id: slotId,
              enrolled_at: new Date()
            })
          })
        })
      })
    }

    // Create default slots for Bay Avenue as a fallback
    const mockDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const mockTimes = ['16:00', '17:30', '19:00']
    const mockLevels = ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track']

    for (const day of mockDays) {
      for (const time of mockTimes) {
        scheduleSlotsToCreate.push({
          id: crypto.randomUUID(),
          centre_id: centreIds['Bay Avenue'],
          coach_id: findCoach('james estrada')!,
          day,
          time,
          level: mockLevels[Math.floor(Math.random() * mockLevels.length)],
          capacity: 12,
          is_summer_camp: false
        })
      }
    }

    await prisma.scheduleSlot.createMany({ data: scheduleSlotsToCreate })

    for (let i = 0; i < enrollmentsToCreate.length; i += chunkSize) {
      await prisma.enrollment.createMany({ data: enrollmentsToCreate.slice(i, i + chunkSize) })
    }

    const newEndTime = Date.now()
    console.log(`New Master Moves OS import completed successfully in ${((newEndTime - newStartTime)/1000).toFixed(2)}s!`)
    return
  }

  // We check if the Excel files exist in the public directory
  const studentFile = path.join(publicDir, 'student information.xlsx')
  const packageFile = path.join(publicDir, 'All Student Packages-8.xlsx')
  const attendanceFile = path.join(publicDir, 'All Attendance Records-5.xlsx')

  const hasFiles = fs.existsSync(studentFile) && fs.existsSync(attendanceFile)

  if (hasFiles) {
    console.log('Found Excel files. Starting high-performance Zoho Import...')
    
    // Read files safely using buffer to avoid sharing/lock issues on Windows
    const studentRosterWorkbook = XLSX.read(fs.readFileSync(studentFile), { type: 'buffer' })
    const studentRosterData: any[] = XLSX.utils.sheet_to_json(studentRosterWorkbook.Sheets[studentRosterWorkbook.SheetNames[0]])

    const overdueFile = path.join(publicDir, 'The best overdue list_Master_Moves_Overdue_Report_Jul2026_1.xlsx')
    const overdueWorkbook = XLSX.read(fs.readFileSync(overdueFile), { type: 'buffer' })
    const ledgerData: any[] = XLSX.utils.sheet_to_json(overdueWorkbook.Sheets['Full Ledger'], { range: 3 })
    const timelineData: any[] = XLSX.utils.sheet_to_json(overdueWorkbook.Sheets['Package Timeline'], { range: 3 })

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

    const getCentreId = (name: any) => {
      if (!name) return centreIds['Bay Avenue']
      const clean = String(name).trim().toLowerCase()
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

    // Extract unique coaches from Full Ledger and Attendance
    const uniqueCoachNames = new Set<string>()
    ledgerData.forEach(r => {
      if (r['Coach']) {
        const name = String(r['Coach']).trim()
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

    // Map Roster Students for extra fields lookup
    const rosterMap = new Map<string, any>()
    studentRosterData.forEach(row => {
      const name = String(row['Name'] || '').trim()
      if (name) {
        rosterMap.set(cleanName(name), row)
      }
    })

    // Process Families & Students from Full Ledger
    const familiesToCreate: any[] = []
    const studentsToCreate: any[] = []
    const familiesMap = new Map<string, string>()
    const studentMap = new Map<string, string>()
    const studentNameMap = new Map<string, string>()

    ledgerData.forEach((row, idx) => {
      const name = String(row['Student Name'] || '').trim()
      if (!name) return
      
      // Skip headers and footers
      if (!row['Centre'] || String(row['Centre']).trim().toLowerCase() === 'undefined') return
      if (name.includes('students') || name.includes('Total') || name === 'Students on this list') return

      const clean = cleanName(name)
      const rosterInfo = rosterMap.get(clean)

      const rawPhone = row['Mobile / WhatsApp'] || rosterInfo?.['Mobile/Whatsapp'] || ''
      const phone = String(rawPhone).trim()
      let famId = crypto.randomUUID()
      if (phone && familiesMap.has(phone)) {
        famId = familiesMap.get(phone)!
      } else {
        if (phone) familiesMap.set(phone, famId)
        familiesToCreate.push({
          id: famId,
          primary_name: rosterInfo?.['Parent name'] ? String(rosterInfo['Parent name']).trim() : `Parent of ${name}`,
          phone: phone || null,
          email: rosterInfo?.['Email'] || null,
          consent_ops: true,
          consent_mktg: false
        })
      }

      const sId = crypto.randomUUID()
      const refId = rosterInfo?.['Student Id'] || `MM-${1000 + idx}`
      studentMap.set(String(refId).toLowerCase(), sId)
      studentNameMap.set(clean, sId)

      const centreId = getCentreId(String(row['Centre']))
      const coachId = findCoach(String(row['Coach']))
      const dob = parseExcelDate(rosterInfo?.['Date of birth'])
      let joinDate = parseExcelDate(rosterInfo?.['Date Enrolled']) || new Date('2026-08-01')
      if (joinDate.getTime() >= new Date('2026-08-04').getTime()) {
        joinDate = new Date('2026-08-01')
      }
      const level = row['Level'] || rosterInfo?.['Current Student levels'] || rosterInfo?.['Joining Student level'] || 'Beginner'
      
      const activity = String(row['Activity'] || '').trim()
      const status = activity === 'Active' ? 'active' : 'inactive'

      const overdueClasses = Number(row['Overdue Classes']) || 0
      const unbilledValue = Number(row['Unbilled Value (AED)']) || 0
      
      const flags: any = {}
      if (overdueClasses > 0) {
        flags.unpaid_classes = overdueClasses
        flags.unpaid_value = unbilledValue
      }

      studentsToCreate.push({
        id: sId,
        family_id: famId,
        centre_id: centreId,
        coach_id: coachId,
        name,
        dob,
        gender: rosterInfo?.['Gender'] || null,
        school: rosterInfo?.['School'] || null,
        level,
        status,
        fide_id: rosterInfo?.['FIDE ID'] || null,
        join_date: joinDate,
        last_attended: null,
        pace_status: 'On track',
        flags: flags,
        fide_country: rosterInfo?.['COUNTRY AS PER FIDE '] || null,
        parent_name: rosterInfo?.['Parent name'] || null,
        alternate_centre: rosterInfo?.['Alternate Center'] || null,
        resident_status: rosterInfo?.['ET /JLT Resident'] || null,
        address: rosterInfo?.['Address'] || null,
        category: rosterInfo?.['Student category'] || null,
        notes: rosterInfo?.['NOTES'] || 'Imported from Overdue Ledger',
        referral_source: rosterInfo?.['HOW DID YOU HEAR ABOUT US '] || null
      })
    })

    const findStudentId = (ref: string, name: string): string | null => {
      const clean = cleanName(name)
      if (clean && studentNameMap.has(clean)) {
        return studentNameMap.get(clean)!
      }
      if (ref && studentMap.has(ref.trim().toLowerCase())) {
        const sId = studentMap.get(ref.trim().toLowerCase())!
        if (clean) {
          studentNameMap.set(clean, sId)
        }
        return sId
      }
      return null
    }

    // Process Packages from Package Timeline sheet
    const packagesToCreate: any[] = []
    const invoicesToCreate: any[] = []

    timelineData.forEach((row, idx) => {
      const studentName = String(row['Student Name'] || row['Package-by-package history'] || '').trim()
      if (!studentName) return

      const lowerName = studentName.toLowerCase()
      if (
        lowerName.includes('total') || 
        lowerName.includes('students') || 
        lowerName.includes('allocated') || 
        lowerName.includes('classes used') ||
        lowerName.includes('exactly one of them') ||
        lowerName.includes('activity marks whether') ||
        lowerName.includes('sessions columns show') ||
        studentName === 'Students on this list'
      ) {
        return
      }

      let studentId = findStudentId('', studentName)
      if (!studentId) {
        // Fallback or dynamic creation if somehow missing
        studentId = crypto.randomUUID()
        const clean = cleanName(studentName)
        studentNameMap.set(clean, studentId)

        const famId = crypto.randomUUID()
        familiesToCreate.push({
          id: famId,
          primary_name: `Parent of ${studentName}`,
          phone: null,
          email: null,
          consent_ops: true,
          consent_mktg: false
        })

        studentsToCreate.push({
          id: studentId,
          family_id: famId,
          centre_id: getCentreId(row['Centre']),
          coach_id: findCoach(''),
          name: studentName,
          dob: null,
          gender: null,
          school: null,
          level: 'Beginner',
          status: 'active',
          join_date: new Date(),
          last_attended: null,
          flags: {},
          notes: 'Created dynamically from timeline logs'
        })
      }

      const pkgId = crypto.randomUUID()
      const totalClasses = Number(row['Classes']) || 0
      const price = Number(row['Price (AED)']) || 0
      const packageBalance = Number(row['Package Balance']) || 0
      const dateOfPayment = parseExcelDate(row['Date of Payment']) || new Date()

      const rawKind = String(row['Type'] || 'new').toLowerCase()
      const kind = rawKind.includes('tournament') ? 'tournament' : (rawKind.includes('renewal') ? 'renewal' : 'new')

      packagesToCreate.push({
        id: pkgId,
        student_id: studentId,
        tier_id: getTierId(totalClasses),
        kind: kind,
        classes_total: totalClasses,
        classes_remaining: packageBalance,
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
        method: 'Online',
        created_at: dateOfPayment
      })
    })

    // Process Attendance from All Attendance Records
    const attendanceToCreate: any[] = []
    const studentLastAttended = new Map<string, Date>()

    attendanceData.forEach(row => {
      const studentName = String(row['Student'] || '').trim()
      if (!studentName) return
      let studentId = findStudentId('', studentName)

      if (!studentId) {
        studentId = crypto.randomUUID()
        const clean = cleanName(studentName)
        studentNameMap.set(clean, studentId)

        const famId = crypto.randomUUID()
        familiesToCreate.push({
          id: famId,
          primary_name: `Parent of ${studentName}`,
          phone: null,
          email: null,
          consent_ops: true,
          consent_mktg: false
        })

        studentsToCreate.push({
          id: studentId,
          family_id: famId,
          centre_id: getCentreId(row['Assigned center'] || 'Bay Avenue Mall'),
          coach_id: findCoach(row['Coaches Details']),
          name: studentName,
          dob: null,
          gender: null,
          school: null,
          level: 'Beginner',
          status: 'inactive',
          join_date: new Date(),
          last_attended: null,
          flags: {}
        })
      }

      const date = parseExcelDate(row['Date'])
      if (date) {
        const currentLast = studentLastAttended.get(studentId)
        if (!currentLast || date > currentLast) {
          studentLastAttended.set(studentId, date)
        }
      }

      const status = String(row['Attendance'] || 'present').trim().toLowerCase()
      const rawDuration = row['Class duration']
      const duration = (rawDuration !== undefined && rawDuration !== null && rawDuration !== '') ? Number(rawDuration) : 2

      attendanceToCreate.push({
        id: crypto.randomUUID(),
        student_id: studentId,
        coach_id: findCoach(row['Coaches Details']),
        date: date || new Date(),
        status: status === 'makeup' ? 'makeup' : (status === 'absent' ? 'absent' : 'present'),
        duration: duration,
        topic: row['Topic name'] ? String(row['Topic name']).trim() : null,
        note: 'Imported from Zoho Creator'
      })
    })

    // Update student details with calculated last_attended and low package flags in memory
    for (const student of studentsToCreate) {
      if (studentLastAttended.has(student.id)) {
        student.last_attended = studentLastAttended.get(student.id)
      }
      
      const pkgs = packagesToCreate.filter(p => p.student_id === student.id)
      const totalRemaining = pkgs.reduce((sum, p) => sum + p.classes_remaining, 0)
      const totalClasses = pkgs.reduce((sum, p) => sum + p.classes_total, 0)
      
      if (totalClasses > 0 && (totalRemaining / totalClasses <= 0.20 || totalRemaining <= 2)) {
        student.flags = {
          ...student.flags,
          low_package: true
        }
      }
    }

    // Now insert families and students
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
