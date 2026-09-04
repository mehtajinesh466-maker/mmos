import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCHEDULE_DATA = [
  // Monday
  { day: 'Mon', time: '12:00 - 13:00', students: ['Aleysia Cheung'] },
  { day: 'Mon', time: '14:00 - 15:00', students: ['Saisha Chaturuede'] },
  { day: 'Mon', time: '16:00 - 17:00', students: ['Azalea Samara Alvares', 'Jessica Lalwani', 'Raya Fatima Hussain'] },
  { day: 'Mon', time: '17:00 - 18:00', students: ['Bodhi', 'Khai Rajguru', 'Meer Bantaarora', 'Neal Kothari', 'Saisha Chaturuede', 'Zen Rajguru'] },
  { day: 'Mon', time: '18:00 - 19:00', students: ['Aadvik Totla', 'Aavya Pitti', 'dwij pandya', 'Evaana Jamshidzadeh', 'Sofia Canle'] },

  // Tuesday
  { day: 'Tue', time: '12:00 - 13:00', students: ['Jayan Gupta'] },
  { day: 'Tue', time: '14:00 - 15:00', students: ['Saisha Chaturuede'] },
  { day: 'Tue', time: '16:00 - 17:00', students: ['avyaan memon', 'Shaarvi Saraf'] },
  { day: 'Tue', time: '17:00 - 18:00', students: ['Aryav Baser', 'Saarvin Dasgupta'] },
  { day: 'Tue', time: '18:00 - 19:00', students: ['Gracia Babbar', 'Jafar Abdala Escobar', 'Mantra Dhawal', 'Sofia Canle', 'Sophie Saber', 'Veer Bajaj', 'Viha Garg'] },

  // Wednesday
  { day: 'Wed', time: '11:00 - 12:00', students: ['Aleysia Cheung', 'Muhav', 'Nuhav'] }, // adding both Muhav and Nuhav just in case it was a typo in previous or this run, will match by first found
  { day: 'Wed', time: '12:00 - 13:00', students: ['Jayan Gupta'] },
  { day: 'Wed', time: '16:00 - 17:00', students: ['Ayaan Swarup', 'Samridh Prashant'] },
  { day: 'Wed', time: '17:00 - 18:00', students: ['Aadvik Totla', 'ADVAIT RANA', 'Avyukt Damani', 'dwij pandya', 'Mantra Dhawal', 'Sofia Canle', 'veer saxena', 'Zoe De La cuesta guil'] },
  { day: 'Wed', time: '18:00 - 19:00', students: ['Aavya Pitti', 'Rayeesha Shah'] },
  { day: 'Wed', time: '19:00 - 20:00', students: ['Ananya Arjun', 'Tiya Mundhra'] },

  // Thursday - none

  // Friday
  { day: 'Fri', time: '11:00 - 12:00', students: ['Michakel'] },
  { day: 'Fri', time: '14:00 - 15:00', students: ['Jayan Gupta', 'Mihail Senguen', 'Neal Kothari', 'Ryan Dhirani', 'Vanya Chordia'] },
  { day: 'Fri', time: '15:00 - 16:00', students: ['Aavya Pitti', 'ADVAIT RANA', 'aryan maheshwari', 'Pablo Lopez', 'Raya Fatima Hussain', 'Rine Girdhar', 'Samridh Prashant'] },
  { day: 'Fri', time: '16:00 - 17:00', students: ['Jasmine hamiani', 'Vivaan Rath'] },
  { day: 'Fri', time: '17:00 - 18:00', students: ['Ananya Arjun', 'Avirraj Jain', 'Ayaan Swarup', 'Meer Bantaarora', 'Sabrina Abdelkhalek', 'Tansh Dhirani', 'Vedant Garg'] },
  { day: 'Fri', time: '18:00 - 19:00', students: ['Evaana Jamshidzadeh', 'Jafar Abdala Escobar', 'Rayeesha Shah', 'Rudra', 'veer saxena', 'Zoe De La cuesta guil'] },

  // Saturday
  { day: 'Sat', time: '10:00 - 11:00', students: ['Aavya Jain', 'Advay jain', 'avyaan memon', 'Saarvin Dasgupta', 'Shaarvi Saraf'] },
  { day: 'Sat', time: '11:00 - 12:00', students: ['Ali Afzal Dar', 'Angie Benamar', 'Meer Bantaarora', 'Nail Hamza', 'Rayan Pietrek', 'Soumaya Hamza', 'Veer Sood', 'Yushav Aleem'] },
  { day: 'Sat', time: '12:00 - 13:00', students: ['Aviraj', 'Hridhaan Bhatia', 'Myra Tulshyan', 'Nail Hamza', 'Soumaya Hamza', 'Tiya Mundhra'] },
  { day: 'Sat', time: '14:00 - 15:00', students: ['Angie Benamar', 'Ryan Dhirani'] },
  { day: 'Sat', time: '15:00 - 16:00', students: ['Jayan Gupta', 'Jessica Lalwani', 'Sayanah S Narayan', 'Veer Bajaj', 'Vivaan Rath'] },
  { day: 'Sat', time: '16:00 - 17:00', students: ['Inaya Dewan', 'Miraya Gupta', 'Rine Girdhar', 'Roslyn'] },
  { day: 'Sat', time: '17:00 - 18:00', students: ['Aavya Pitti', 'Karen Chmait', 'Rayeesha Shah'] },

  // Sunday
  { day: 'Sun', time: '10:00 - 11:00', students: ['aryan maheshwari', 'Ibrahim Boudenagh', 'Jafar Abdala Escobar', 'Pablo Lopez', 'Sofia Canle'] },
  { day: 'Sun', time: '11:00 - 12:00', students: ['Aavya Jain', 'Advay jain', 'Angie Benamar', 'Avyaan Saraf', 'Luna Ozornek', 'Reyansh Raparia', 'Shaarvi Saraf'] },
  { day: 'Sun', time: '12:00 - 13:00', students: ['Angie Benamar', 'Jayan Gupta', 'Maya Ozornek', 'Meer Bantaarora', 'Mihail Senguen', 'Myra Tulshyan', 'Saisha Chaturuede', 'Samridh Prashant'] },
  { day: 'Sun', time: '16:00 - 17:00', students: ['Inaya Dewan', 'Khai Rajguru', 'Rennes J.Deszmpzrado Jr', 'Rudra', 'Tansh Dhirani', 'veer saxena', 'Zen Rajguru'] },
  { day: 'Sun', time: '17:00 - 18:00', students: ['Neil Dhakan'] },
];

async function main() {
  const coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: 'James', mode: 'insensitive' } } },
    include: { user: true }
  });

  if (!coach || !coach.centre_id) {
    console.log("Coach James not found or has no centre.");
    return;
  }
  
  console.log(`Working with Coach: ${coach.user?.name} (${coach.id})`);

  // Find all current slots for James
  const existingSlots = await prisma.scheduleSlot.findMany({
    where: { coach_id: coach.id }
  });
  
  const existingSlotIds = existingSlots.map(s => s.id);
  
  // Clean up all data referencing James's slots
  if (existingSlotIds.length > 0) {
    await prisma.attendance.deleteMany({ where: { slot_id: { in: existingSlotIds } } });
    await prisma.classSession.deleteMany({ where: { slot_id: { in: existingSlotIds } } });
    await prisma.enrollment.deleteMany({ where: { slot_id: { in: existingSlotIds } } });
    await prisma.scheduleSlot.deleteMany({ where: { id: { in: existingSlotIds } } });
    console.log(`Deleted ${existingSlotIds.length} existing slots and their related enrollments/attendance.`);
  }

  // Create 91 template slots (13 per day x 7 days, 8 AM - 9 PM)
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
          capacity: 10
        }
      });
      newSlotMap.set(`${day}|${time}`, slot.id);
    }
  }
  console.log(`Created 91 template slots.`);

  // Process specific enrollments
  for (const classData of SCHEDULE_DATA) {
    const slotId = newSlotMap.get(`${classData.day}|${classData.time}`);
    if (!slotId) {
      console.log(`Error: Slot not found for ${classData.day} ${classData.time}`);
      continue;
    }

    let levelForSlot = 'Mixed';
    
    for (const studentName of classData.students) {
      // Find student
      let student = await prisma.student.findFirst({
        where: { name: { equals: studentName, mode: 'insensitive' } }
      });
      
      // Fallback if there was a typo, try finding by matching part of the name
      if (!student) {
         student = await prisma.student.findFirst({
           where: { name: { contains: studentName.split(' ')[0], mode: 'insensitive' } }
         });
      }
      
      if (!student) {
        // Create if it absolutely doesn't exist
        student = await prisma.student.create({
          data: {
            name: studentName,
            centre_id: coach.centre_id,
            coach_id: coach.id,
            level: 'Unknown'
          }
        });
        console.log(`Created missing student: ${studentName}`);
      }

      // Record their level so we can update the slot level later
      if (student.level && student.level !== 'Unknown') {
         levelForSlot = student.level; // just pick the last known level
      }

      await prisma.enrollment.create({
        data: {
          student_id: student.id,
          slot_id: slotId
        }
      });
      console.log(`Enrolled ${student.name} into ${classData.day} ${classData.time}`);
    }
    
    // optionally update the slot level based on the students in it
    await prisma.scheduleSlot.update({
      where: { id: slotId },
      data: { level: levelForSlot }
    });
  }

  console.log("Done fixing schedule!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
