import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = [
  ["Aadvik Totla", 2, "MON 6-7 PM; WED 5-6 PM", "Junior Int-1"],
  ["Aavya Jain", 2, "SAT 10-11 AM; SUN 11-12 AM", "Early Starts - Beginner 1"],
  ["Aavya Pitti", 4, "MON 6-7 PM; WED 6-7 PM; FRI 3-4 PM; SAT 5-6 PM", "Junior Int-1"],
  ["ADVAIT RANA", 2, "WED 5-6 PM; FRI 3-4 PM", "Junior Int-2"],
  ["Advay jain", 2, "SAT 10-11 AM; SUN 11-12 AM", "Early Starts - Beginner 1"],
  ["Aleysia Cheung", 2, "MON 12-1 PM; WED 11-12 AM", "Junior Int-1"],
  ["Ali Afzal Dar", 1, "SAT 11-12 AM", "Early Starts - Beginner 2"],
  ["Ananya Arjun", 2, "WED 7-8 PM; FRI 5-6 PM", "Beginner 2"],
  ["Angie Benamar", 4, "SAT 11-12 AM; SAT 2-3 PM; SUN 11-12 AM; SUN 12-1 PM", "Early Starts - Beginner 2"],
  ["aryan maheshwari", 2, "FRI 3-4 PM; SUN 10-11 AM", "Junior Int-2"],
  ["Aryav Baser", 1, "TUES 5-6 PM", "Early Starts - Beginner 1"],
  ["Aviraj", 1, "SAT 12-1 PM", "Beginner 2"],
  ["Avirraj Jain", 1, "FRI 5-6 PM", "Early Starts - Beginner 2"],
  ["avyaan memon", 2, "TUES 4-5 PM; SAT 10-11 AM", "Early Starts - Beginner"],
  ["Avyaan Saraf", 1, "SUN 11-12 AM", "Early Starts - Beginner 1"],
  ["Avyukt Damani", 1, "WED 5-6 PM", "Junior Int-2"],
  ["Ayaan Swarup", 2, "WED 4-5 PM; FRI 5-6 PM", "Early Starts - Beginner 2"],
  ["Azalea Samara Alvares", 1, "MON 4-5 PM", "Junior Int-1"],
  ["Bodhi", 1, "MON 5-6 PM", "Early Starts - Beginner 2"],
  ["dwij pandya", 2, "MON 6-7 PM; WED 5-6 PM", "Junior Int-1"],
  ["Evaana Jamshidzadeh", 2, "MON 6-7 PM; FRI 6-7 PM", "Early Starts - Advanced"],
  ["Gracia Babbar", 1, "TUES 6-7 PM", "Junior Int-1"],
  ["Hridhaan Bhatia", 1, "SAT 12-1 PM", "Beginner 2"],
  ["Ibrahim Boudenagh", 1, "SUN 10-11 AM", "Intermediate 2"],
  ["Inaya Dewan", 2, "SAT 4-5 PM; SUN 4-5 PM", "Junior Int-1"],
  ["Jafar Abdala Escobar", 3, "TUES 6-7 PM; FRI 6-7 PM; SUN 10-11 AM", "Junior Int-1"],
  ["Jasmine hamiani", 1, "FRI 4-5 PM", "Private"],
  ["Jayan Gupta", 5, "TUES 12-1 PM; WED 12-1 PM; FRI 2-3 PM; SAT 3-4 PM; SUN 12-1 PM", "Beginner 2"],
  ["Jessica Lalwani", 2, "MON 4-5 PM; SAT 3-4 PM", "Junior Int-1"],
  ["Karen Chmait", 1, "SAT 5-6 PM", "Private"],
  ["Khai Rajguru", 2, "MON 5-6 PM; SUN 4-5 PM", "Early Starts - Beginner 2"],
  ["Luna Ozornek", 1, "SUN 11-12 AM", "Early Starts - Beginner 1"],
  ["Mantra Dhawal", 2, "TUES 6-7 PM; WED 5-6 PM", "Junior Int-1"],
  ["Maya Ozornek", 1, "SUN 12-1 PM", "Early Starts - Beginner 2"],
  ["Meer Bantaarora", 4, "MON 5-6 PM; FRI 5-6 PM; SAT 11-12 AM; SUN 12-1 PM", "Early Starts - Beginner 2"],
  ["Michakel", 1, "FRI 11-12 AM", "Junior Int-1"],
  ["Mihail Senguen", 2, "FRI 2-3 PM; SUN 12-1 PM", "Early Starts - Beginner 2"],
  ["Miraya Gupta", 1, "SAT 4-5 PM", "Junior Int-1"],
  ["Myra Tulshyan", 2, "SAT 12-1 PM; SUN 12-1 PM", "Beginner 2"],
  ["Nail Hamza", 2, "SAT 11-12 AM; SAT 12-1 PM", "Early Starts - Beginner 2"],
  ["Neal Kothari", 2, "MON 5-6 PM; FRI 2-3 PM", "Early Starts - Beginner 2"],
  ["Neil Dhakan", 1, "SUN 5-6 PM", "Junior Int-1"],
  ["Nuhav", 1, "WED 11-12 AM", "Junior Int-1"],
  ["Pablo Lopez", 2, "FRI 3-4 PM; SUN 10-11 AM", "Junior Int-2"],
  ["Raya Fatima Hussain", 2, "MON 4-5 PM; FRI 3-4 PM", "Junior Int-2"],
  ["Rayan Pietrek", 1, "SAT 11-12 AM", "Early Starts - Beginner 2"],
  ["Rayeesha Shah", 3, "WED 6-7 PM; FRI 6-7 PM; SAT 5-6 PM", "Early Starts - Advanced"],
  ["Rennes J.Deszmpzrado Jr", 1, "SUN 4-5 PM", "Junior Int-1"],
  ["Reyansh Raparia", 1, "SUN 11-12 AM", "Early Starts - Beginner 1"],
  ["Rine Girdhar", 2, "FRI 3-4 PM; SAT 4-5 PM", "Early Starts - Beginner"],
  ["Roslyn", 1, "SAT 4-5 PM", "Junior Int-1"],
  ["Rudra", 2, "FRI 6-7 PM; SUN 4-5 PM", "Junior Int-2"],
  ["Ryan Dhirani", 2, "FRI 2-3 PM; SAT 2-3 PM", "Beginner 2"],
  ["Saanvin Dasgupta", 2, "TUES 5-6 PM; SAT 10-11 AM", "Early Starts - Beginner 1"],
  ["Sabrina Abdelkhalek", 1, "FRI 5-6 PM", "Early Starts - Beginner 2"],
  ["Saisha Chaturuede", 4, "MON 2-3 PM; MON 5-6 PM; TUES 2-3 PM; SUN 12-1 PM", "Private"],
  ["Samridh Prashant", 3, "WED 4-5 PM; FRI 3-4 PM; SUN 12-1 PM", "Early Starts - Beginner 2"],
  ["Sayanah S Narayan", 1, "SAT 3-4 PM", "Beginner 2"],
  ["Shaarvi Saraf", 3, "TUES 4-5 PM; SAT 10-11 AM; SUN 11-12 AM", "Early Starts - Beginner 1"],
  ["Sofia Canle", 4, "MON 6-7 PM; TUES 6-7 PM; WED 5-6 PM; SUN 10-11 AM", "Junior Int-1"],
  ["Sophie Saber", 1, "TUES 6-7 PM", "Junior Int-1"],
  ["Soumaya Hamza", 2, "SAT 11-12 AM; SAT 12-1 PM", "Early Starts - Beginner 2"],
  ["Tansh Dhirani", 2, "FRI 5-6 PM; SUN 4-5 PM", "Early Starts - Beginner 2"],
  ["Tiya Mundhra", 2, "WED 7-8 PM; SAT 12-1 PM", "Beginner 2"],
  ["Vanya Chordia", 1, "FRI 2-3 PM", "Early Starts - Beginner 2"],
  ["Vedant Garg", 1, "FRI 5-6 PM", "Early Starts - Beginner 2"],
  ["Veer Bajaj", 2, "TUES 6-7 PM; SAT 3-4 PM", "Junior Int-1"],
  ["veer saxena", 3, "WED 5-6 PM; FRI 6-7 PM; SUN 4-5 PM", "Junior Int-1"],
  ["Veer Sood", 1, "SAT 11-12 AM", "Early Starts - Beginner 2"],
  ["Viha Garg", 1, "TUES 6-7 PM", "Junior Int-1"],
  ["Vivaan Rath", 2, "FRI 4-5 PM; SAT 3-4 PM", "Beginner 2"],
  ["Yushav Aleem", 1, "SAT 11-12 AM", "Early Starts - Beginner 2"],
  ["Zen Rajguru", 2, "MON 5-6 PM; SUN 4-5 PM", "Early Starts - Beginner 2"],
  ["Zoe De La cuesta guil", 2, "WED 5-6 PM; FRI 6-7 PM", "Junior Int-2"],
];

async function main() {
  const users = await prisma.user.findMany({ where: { name: { contains: "James", mode: "insensitive" } }, include: { coaches: true } });
  console.log("Found users for James:", users.map(u => u.name));
  
  let coach = await prisma.coach.findFirst({
    where: { user: { name: { contains: "James", mode: "insensitive" } } },
    include: { user: true }
  });
  
  if (!coach) {
    console.log("Coach James not found. Please specify coach ID or create Coach James.");
    return;
  }
  
  console.log("Using Coach:", coach.user?.name, coach.id);
  const centreId = coach.centre_id;
  if (!centreId) {
    console.log("Coach has no centre.");
    return;
  }
  
  for (const [name, _, slotsStr, level] of data) {
    const studentName = String(name);
    const slots = String(slotsStr).split(';').map(s => s.trim()).filter(Boolean);
    const studentLevel = String(level);
    
    // Find or create student
    let student = await prisma.student.findFirst({
      where: { name: { equals: studentName, mode: 'insensitive' } }
    });
    
    if (!student) {
      student = await prisma.student.create({
        data: {
          name: studentName,
          centre_id: centreId,
          level: studentLevel,
          coach_id: coach.id,
        }
      });
      console.log(`Created student: ${studentName}`);
    } else {
      console.log(`Found student: ${studentName}`);
      // optionally update coach and level
      await prisma.student.update({
        where: { id: student.id },
        data: {
          level: studentLevel,
          coach_id: coach.id,
        }
      });
    }
    
    // Process slots
    for (const slotStr of slots) {
      // Slot string is like "MON 6-7 PM"
      const parts = slotStr.split(' ');
      const day = parts[0]; // MON, TUES, etc.
      const time = parts.slice(1).join(' '); // 6-7 PM
      
      let scheduleSlot = await prisma.scheduleSlot.findFirst({
        where: {
          coach_id: coach.id,
          day,
          time
        }
      });
      
      if (!scheduleSlot) {
        scheduleSlot = await prisma.scheduleSlot.create({
          data: {
            centre_id: centreId,
            coach_id: coach.id,
            day,
            time,
            level: studentLevel,
            capacity: 10
          }
        });
        console.log(`Created slot: ${day} ${time}`);
      }
      
      // Check enrollment
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          student_id: student.id,
          slot_id: scheduleSlot.id
        }
      });
      
      if (!enrollment) {
        await prisma.enrollment.create({
          data: {
            student_id: student.id,
            slot_id: scheduleSlot.id
          }
        });
        console.log(`Enrolled ${studentName} in ${day} ${time}`);
      }
    }
  }
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
