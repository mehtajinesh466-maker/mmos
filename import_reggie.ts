import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const REGGIE_SCHEDULE = [
  // MONDAY
  { day: 'Mon', time: '16:00 - 17:00', students: ['Maadhav Jajoo'] },
  { day: 'Mon', time: '17:00 - 18:00', students: ['Kiyaana Jamshidzadeh', 'Aarav Sushil', 'Moein Khorey', 'Elijah Schnedler', 'Nirbhay Hemnani', 'Rishab Adya'] },
  { day: 'Mon', time: '18:00 - 19:00', students: ['Shivakkartik', 'Jigyansh Maloo'] },

  // TUESDAY
  { day: 'Tue', time: '17:00 - 18:00', students: ['Darsh Punjabi', 'Maadhav Jajoo', 'Parth Tewani', 'Misha Garg', 'Vihaan Koul', 'Shrey Jain'] },
  { day: 'Tue', time: '18:00 - 19:00', students: ['Kiyaansh Bhartia', 'Amayra Babber', 'Zoha Tanweer'] },

  // WEDNESDAY
  { day: 'Wed', time: '16:00 - 17:00', students: ['Swara Rathod'] },
  { day: 'Wed', time: '17:00 - 18:00', students: ['Myra Sondhi', 'Ishan Butani', 'Arjuna Nambi', 'Armaan Jethwani', 'Elijah Schnedler', 'Rishab Adya'] },
  { day: 'Wed', time: '18:00 - 19:00', students: ['Shivakkartik', 'Rajveer Bhagat', 'Nivaan Prasoon', 'Jigyansh Maloo', 'Ishaan Mahtani', 'Aadi Jain'] },

  // THURSDAY
  { day: 'Thu', time: '16:00 - 17:00', students: ['Nivruttta Veeravanallur'] },
  { day: 'Thu', time: '17:00 - 18:00', students: ['Aarav Sushil', 'Moein Khorey', 'Parth Tewani', 'Yathart Mundra', 'Vihaan Koul', 'Shrey Jain'] },
  { day: 'Thu', time: '18:00 - 19:00', students: ['Kiyaansh Bhartia', 'Amayra Babber', 'Zoha Tanweer'] },

  // FRIDAY
  { day: 'Fri', time: '14:00 - 15:00', students: ['Myra Sondhi'] },
  { day: 'Fri', time: '15:00 - 16:00', students: ['Noor', 'Rova'] },
  { day: 'Fri', time: '16:00 - 17:00', students: ['Evelyn', 'Advait Rathi', 'Zoha Tanweer', 'Adyant Jain'] },
  { day: 'Fri', time: '17:00 - 18:00', students: ['Kiyaana Jamshidzadeh', 'Ishan Butani', 'Arjuna Nambi', 'Armaan Jethwani', 'Darsh Punjabi', 'Nirbhay Hemnani'] },
  { day: 'Fri', time: '18:00 - 19:00', students: ['Rajveer Bhagat', 'Danial Nasab', 'Haneesh Prathyay Patnaikuni', 'Nivaan Prasoon', 'Kartik Goyal', 'Ishaan Mahtani'] },

  // SATURDAY
  { day: 'Sat', time: '12:00 - 13:00', students: ['Ishan Pandey', 'Dhiren Sapru', 'Shwetank Gupta'] },
  { day: 'Sat', time: '14:00 - 15:00', students: ['Ishan Butani', 'Aarav Sushil', 'Armaan Jethwani', 'Vihaan Koul', 'Shrey Jain', 'Nirbhay Hemnani', 'Vedha Purushottaman'] },
  { day: 'Sat', time: '15:00 - 16:00', students: ['Ishan Butani', 'Aarav Sushil', 'Armaan Jethwani', 'Vihaan Koul', 'Shrey Jain', 'Nirbhay Hemnani'] },
  { day: 'Sat', time: '16:00 - 17:00', students: ['Maadhav Jajoo', 'Shivakkartik', 'Parth Tewani', 'Rajveer Bhagat', 'Danial Nasab', 'Nivruttta Veeravanallur', 'Nivaan Prasoon', 'Yathart Mundra', 'Evelyn', 'Elijah Schnedler', 'Jigyansh Maloo', 'Ishaan Mahtani', 'Adyant Jain', 'Aarav Kumar', 'Kiaan Gupta', 'Aadi Jain', 'Rishab Adya'] },
  { day: 'Sat', time: '17:00 - 18:00', students: ['Maadhav Jajoo', 'Shivakkartik', 'Parth Tewani', 'Rajveer Bhagat', 'Danial Nasab', 'Nivruttta Veeravanallur', 'Nivaan Prasoon', 'Yathart Mundra', 'Elijah Schnedler', 'Jigyansh Maloo', 'Ishaan Mahtani', 'Adyant Jain', 'Aarav Kumar', 'Kiaan Gupta', 'Aadi Jain', 'Rishab Adya'] }
];

const STUDENT_LEVELS: Record<string, string> = {
  'Myra Sondhi': 'Junior - Intermediate 2',
  'Kiyaana Jamshidzadeh': 'Junior - Intermediate 2',
  'Ishan Butani': 'Junior - Intermediate 2',
  'Aarav Sushil': 'Junior - Intermediate 2',
  'Arjuna Nambi': 'Junior - Intermediate 2',
  'Armaan Jethwani': 'Junior - Intermediate 2',
  'Moein Khorey': 'Junior - Intermediate 2',
  'Darsh Punjabi': 'Junior - Advance 1',
  'Maadhav Jajoo': 'Junior - Advance 1',
  'Shivakkartik': 'Junior - Advance 1',
  'Parth Tewani': 'Junior - Advance 1',
  'Rajveer Bhagat': 'Junior - Advance 2',
  'Danial Nasab': 'Senior - Advance 1',
  'Nivruttta Veeravanallur': 'Junior - Advance 2',
  'Haneesh Prathyay Patnaikuni': 'Junior - Advance 2',
  'Nivaan Prasoon': 'Junior - Advance 2',
  'Swara Rathod': 'Junior - Intermediate 1',
  'Yathart Mundra': 'Junior - Advance 1',
  'Evelyn': 'Junior - Intermediate 1',
  'Elijah Schnedler': 'Junior - Intermediate 1',
  'Advait Rathi': 'Junior - Intermediate 1',
  'Kartik Goyal': 'Junior - Intermediate 1',
  'Noor': 'Senior - Beginner 2',
  'Rova': 'Senior - Beginner 2',
  'Jigyansh Maloo': 'Junior - Advance 2',
  'Kiyaansh Bhartia': 'Junior - Intermediate 1',
  'Misha Garg': 'Junior - Intermediate 1',
  'Amayra Babber': 'Junior - Intermediate 1',
  'Zoha Tanweer': 'Junior - Intermediate 1',
  'Vihaan Koul': 'Junior - Intermediate 2',
  'Shrey Jain': 'Junior - Advance 1',
  'Ishaan Mahtani': 'Junior - Elite',
  'Adyant Jain': 'Junior - Intermediate 2',
  'Aarav Kumar': 'Junior - Intermediate 2',
  'Kiaan Gupta': 'Junior - Advance 1',
  'Aadi Jain': 'Senior - Advance 2',
  'Ishan Pandey': 'Adult - Intermediate 2',
  'Dhiren Sapru': 'Adult - Intermediate 1',
  'Shwetank Gupta': 'Adult - Intermediate 1',
  'Nirbhay Hemnani': 'Junior - Intermediate 2',
  'Rishab Adya': 'Junior - Advance 1',
  'Vedha Purushottaman': 'Senior - Beginner 2'
};

function getDayNumber(day: string): number {
  const map: Record<string, number> = {
    'sunday': 0, 'sun': 0, 'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };
  return map[day.toLowerCase()] ?? 1;
}

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'Reggie', mode: 'insensitive' } } },
    include: { user: true }
  });

  if (!coach) return console.log("Coach Reggie not found!");
  console.log(`Found Coach Reggie: ${coach.user.name}`);

  // 1. Wipe all existing slots for Coach Reggie
  const existingSlots = await prisma.scheduleSlot.findMany({
    where: { coach_id: coach.id }
  });
  const existingSlotIds = existingSlots.map(s => s.id);

  if (existingSlotIds.length > 0) {
    await prisma.classSession.deleteMany({ where: { slot_id: { in: existingSlotIds } } });
    await prisma.attendance.deleteMany({ where: { slot_id: { in: existingSlotIds } } });
    await prisma.enrollment.deleteMany({ where: { slot_id: { in: existingSlotIds } } });
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: existingSlotIds } } });
    console.log(`Wiped ${existingSlotIds.length} existing slots for Reggie.`);
  }

  // 2. Create 91 template slots
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const baseTimes = [
    '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
    '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
    '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00',
    '20:00 - 21:00'
  ];

  const newSlotMap = new Map<string, string>(); // key: "Day|Time", value: slot.id

  for (const day of days) {
    for (const time of baseTimes) {
      const slot = await prisma.scheduleSlot.create({
        data: {
          centre_id: coach.centre_id,
          coach_id: coach.id,
          day,
          time,
          level: 'Mixed',
          capacity: 20
        }
      });
      newSlotMap.set(`${day}|${time}`, slot.id);
    }
  }
  console.log(`Created 91 template slots.`);

  const sessionPayload = [];
  const today = new Date();

  // 3. Process enrollments and generate perfectly aligned sessions
  for (const classData of REGGIE_SCHEDULE) {
    const slotId = newSlotMap.get(`${classData.day}|${classData.time}`);
    if (!slotId) continue;

    const dayNum = getDayNumber(classData.day);
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const mondayThisWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + distanceToMonday);
    const firstDate = new Date(mondayThisWeek);
    const offset = dayNum === 0 ? 6 : dayNum - 1; 
    firstDate.setDate(firstDate.getDate() + offset);

    let levelForSlot = 'Mixed';

    for (const studentName of classData.students) {
      let student = await prisma.student.findFirst({
        where: { name: { equals: studentName, mode: 'insensitive' } }
      });
      
      if (!student) {
        student = await prisma.student.findFirst({
          where: { name: { contains: studentName.split(' ')[0], mode: 'insensitive' } }
        });
      }
      
      if (!student) {
        student = await prisma.student.create({
          data: {
            name: studentName,
            centre_id: coach.centre_id,
            coach_id: coach.id,
            level: STUDENT_LEVELS[studentName] || 'Unknown'
          }
        });
        console.log(`Created missing student: ${studentName}`);
      } else if (STUDENT_LEVELS[studentName] && student.level !== STUDENT_LEVELS[studentName]) {
        // Update level if needed
        student = await prisma.student.update({
          where: { id: student.id },
          data: { level: STUDENT_LEVELS[studentName] }
        });
      }

      levelForSlot = student.level || 'Mixed';

      await prisma.enrollment.create({
        data: {
          student_id: student.id,
          slot_id: slotId
        }
      });

      // Generate 12 weeks of perfectly aligned sessions
      for (let i = 0; i < 12; i++) {
        const targetDate = new Date(firstDate);
        targetDate.setDate(targetDate.getDate() + (i * 7));
        targetDate.setHours(12, 0, 0, 0); 
        sessionPayload.push({
          student_id: student.id,
          slot_id: slotId,
          scheduled_date: targetDate,
          status: 'scheduled'
        });
      }
    }

    await prisma.scheduleSlot.update({
      where: { id: slotId },
      data: { level: levelForSlot }
    });
  }

  // 4. Batch create all the class sessions
  if (sessionPayload.length > 0) {
    await prisma.classSession.createMany({
      data: sessionPayload
    });
    console.log(`Generated ${sessionPayload.length} perfect ClassSessions for Coach Reggie.`);
  }
}

main().finally(() => prisma.$disconnect());
