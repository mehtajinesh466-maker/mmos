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

  // 5. Load and seed 152 student records
  const mockStudentsPath = path.join(process.cwd(), 'prisma', 'mock_students.json')
  if (fs.existsSync(mockStudentsPath)) {
    const rawData = fs.readFileSync(mockStudentsPath, 'utf-8')
    const studentsArray = JSON.parse(rawData)

    console.log(`Loading ${studentsArray.length} student records...`)

    for (const record of studentsArray) {
      const name = record[0]
      const code = record[1] || `MM-${Math.floor(Math.random()*9000)+1000}`
      const centreCode = record[2]
      const alertCat = record[3]
      const alertReason = record[4]
      const classesTotal = record[5] || 8
      const paid = record[6] || 0
      const overdue = record[7] || 0
      const unbilled = record[8] || 0
      const refunded = record[9] || 0
      const classesRemaining = record[10] || 0
      const engagement = record[11] || 'Engaged'
      const attCount = record[12] || 0
      const expiryDate = record[14] ? new Date(record[14]) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      const billingTotal = record[15] || 0
      const levelClass = record[17] || 'Juniors-Intermediate B'
      
      const levelParts = levelClass.split('-')
      const level = (levelParts[1] || 'Beginner').replace(' 1','').replace(' 2','').replace(' A','').replace(' B','') as any

      const rawCoach = (record[18] || '').toLowerCase().trim()
      const coachId = coachMap[rawCoach] || chJames.id
      const joinDate = record[19] ? new Date(record[19]) : new Date()

      const centreId = centreCode === 'J' ? c2.id : c1.id

      // Create Family
      const familyName = name.split(' ').pop() + ' Family'
      const family = await prisma.family.create({
        data: {
          primary_name: familyName,
          phone: '+971 50 123 4567',
          email: `${familyName.toLowerCase().replace(' ', '')}@example.com`
        }
      })

      // If name matches robert sterling's child, link it to Robert Sterling
      if (name.toLowerCase().includes('alexander sterling')) {
        await prisma.student.create({
          data: {
            id: 's-alex-sterling-id',
            family_id: family.id,
            centre_id: centreId,
            coach_id: coachId,
            name,
            level: 'Beginner',
            status: 'active',
            join_date: joinDate,
            fide_id: code,
            pace_status: 'On track',
            flags: {}
          }
        })
        continue;
      }

      // Create Student
      const student = await prisma.student.create({
        data: {
          family_id: family.id,
          centre_id: centreId,
          coach_id: coachId,
          name,
          level: ['Beginner', 'Intermediate', 'Advanced', 'Pro-Track'].includes(level) ? level : 'Beginner',
          status: overdue > 0 ? 'inactive' : 'active',
          join_date: joinDate,
          fide_id: code,
          pace_status: engagement === 'Slipping' ? 'Slow' : engagement === 'Cold' ? 'Stalled' : 'On track',
          flags: {
            at_risk: alertCat === 'HOT',
            inactive: engagement === 'Cold',
            unpaid_classes: record[21] || 0,
            unpaid_value: record[22] || 0,
            low_package: classesRemaining <= 3
          }
        }
      })

      // Create Package
      const tId = tierMap[levelClass.split('-')[0]] || tCore.id
      const pkg = await prisma.package.create({
        data: {
          student_id: student.id,
          tier_id: tId,
          classes_total: classesTotal,
          classes_remaining: classesRemaining,
          start_date: joinDate,
          expiry_date: expiryDate
        }
      })

      // Create Invoice if billing exists
      if (billingTotal > 0) {
        await prisma.invoice.create({
          data: {
            package_id: pkg.id,
            student_id: student.id,
            amount: billingTotal,
            vat: billingTotal * 0.05,
            status: overdue > 0 ? 'unpaid' : 'paid',
            method: 'Card'
          }
        })
      }
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
