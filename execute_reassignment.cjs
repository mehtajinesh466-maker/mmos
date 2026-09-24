const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Full 153 items from the 4-page PDF document
const list = [
  // Page 1
  { name: "Aadya", coach: "Ryan" },
  { name: "Aarav Suhas", coach: "Bryle" },
  { name: "Aarya", coach: "Bret" },
  { name: "Aarya Saxena", coach: "Bret" },
  { name: "Aarya Shah", coach: "Bryle" },
  { name: "Aaryan Srivastava", coach: "Bryle" },
  { name: "Aaryan Garg", coach: "Bret" },
  { name: "Aaryan Garge", coach: "Bret" },
  { name: "Adam Draidi", coach: "Bret" },
  { name: "Aditya Mahesh Bhosale", coach: "Bryle" },
  { name: "Advait Nittala", coach: "Bryle" },
  { name: "Advik", coach: "Bret" },
  { name: "Ahaan Jain", coach: "Bryle" },
  { name: "Aiden Currimboy", coach: "Bryle" },
  { name: "Aiden Jeejeebhoy", coach: "Bryle" },
  { name: "Aisha Agarwal", coach: "Bryle" },
  { name: "AKIRA", coach: "Bret" },
  { name: "Alex (Adult)", coach: "Bryle" },
  { name: "Alex Donner", coach: "Ryan" },
  { name: "Ammar", coach: "Bret" },
  { name: "Ammar Allindin", coach: "Bret" },
  { name: "Ananya Puranic", coach: "Bryle" },
  { name: "Anika Iyer", coach: "Bryle" },
  { name: "Antonio Moran", coach: "Bryle" },
  { name: "Arhit Lokare", coach: "Bryle" },
  { name: "Arshita", coach: "Bret" },
  { name: "Aryan Garg", coach: "Ryan" },
  { name: "Asher", coach: "Bret" },
  { name: "Ashwin", coach: "Bret" },
  { name: "Atharv Agarwal", coach: "Bryle" },
  { name: "Aya Naser", coach: "Bryle" },
  { name: "Aydamir", coach: "Bret" },
  { name: "Barman Hassanpour", coach: "Bryle" },
  { name: "Benjamin Matthew", coach: "Bryle" },
  { name: "Bhavisha Arwani", coach: "Bryle" },

  // Page 2
  { name: "Bobby", coach: "Bryle" },
  { name: "Borozdin Mikhail \"Misha\"", coach: "Bryle" },
  { name: "Caspian Jarvenpaa", coach: "Bryle" },
  { name: "Daivik Joshi", coach: "Ryan" },
  { name: "Daiwik Joshi", coach: "Ryan" },
  { name: "Daksh Mathur", coach: "Bryle" },
  { name: "Daniil Apostolov,", coach: "Bryle" },
  { name: "Darsh Rikin Shah", coach: "Bryle" },
  { name: "Davit Nazaryan", coach: "Bryle" },
  { name: "Dhrithi", coach: "Bret" },
  { name: "Dhrithi Jalan", coach: "Bret" },
  { name: "Diansh", coach: "Ryan" },
  { name: "Eleandre M.Tiosan", coach: "Ryan" },
  { name: "Elija", coach: "Bryle" },
  { name: "Essa Altawil", coach: "Bryle" },
  { name: "Ethan Taveneer", coach: "Bryle" },
  { name: "Faris Cherif", coach: "Bret" },
  { name: "Finn Lyndon", coach: "Bryle" },
  { name: "Griva", coach: "Bret" },
  { name: "Hamza", coach: "Bret" },
  { name: "Hasan Aladin", coach: "Bryle" },
  { name: "Hector Marco", coach: "Bryle" },
  { name: "Hridhaan Parmar", coach: "Bryle" },
  { name: "Hridit", coach: "Bret" },
  { name: "Hridith Deskmukh", coach: "Ryan" },
  { name: "Irena Dey", coach: "Bryle" },
  { name: "Ivaan", coach: "Bret" },
  { name: "James Nutter", coach: "Bryle" },
  { name: "Jinansh Nilay Shah", coach: "Ryan" },
  { name: "Jiyansh", coach: "Bret" },
  { name: "Kaashvi Karthikeyan Shyamala", coach: "Bryle" },
  { name: "Kabir Keswani", coach: "Bret" },
  { name: "Kairav", coach: "Bret" },
  { name: "Kanav Bansal", coach: "Bret" },
  { name: "Kaveer", coach: "Bret" },
  { name: "Kavya Shah", coach: "Bryle" },
  { name: "Kian Lyndon", coach: "Bryle" },
  { name: "Kiyaan Veer Chopra", coach: "Ryan" },
  { name: "Kristina (adult)", coach: "Bryle" },
  { name: "Latiksh", coach: "Bret" },

  // Page 3
  { name: "Latiskh", coach: "Bret" },
  { name: "Leyaan", coach: "Bret" },
  { name: "Leyaan vergara", coach: "Bret" },
  { name: "Lunle Xang \"Lukas\"", coach: "Bryle" },
  { name: "Maksim (Alex son)", coach: "Bryle" },
  { name: "Marah Draidi", coach: "Bret" },
  { name: "Maya Narula", coach: "Bryle" },
  { name: "Meerah Altawil", coach: "Bryle" },
  { name: "Mihail Filipjonoks", coach: "Bryle" },
  { name: "Milaan vergara", coach: "Bret" },
  { name: "Milann vergara", coach: "Bryle" },
  { name: "Minha", coach: "Bret" },
  { name: "Minha Harith", coach: "Bret" },
  { name: "Mohamed Zayd", coach: "Bret" },
  { name: "Mohammed Hamza Sheikh", coach: "Ryan" },
  { name: "Moksha", coach: "Bret" },
  { name: "Moksha Mehul", coach: "Bret" },
  { name: "Myra Bhandari", coach: "Bryle" },
  { name: "Nikil Reddy Thalamarla", coach: "Bryle" },
  { name: "Nikolai", coach: "Bret" },
  { name: "Nina Karol", coach: "Bret" },
  { name: "Noah Sholi", coach: "Ryan" },
  { name: "Om Mehta", coach: "Bryle" },
  { name: "Pavika Grover", coach: "Bryle" },
  { name: "Phalak Joshi", coach: "Ryan" },
  { name: "Pranav Naganandh", coach: "Bret" },
  { name: "Pranshi", coach: "Bryle" },
  { name: "Raghav", coach: "Bret" },
  { name: "Raguram Sreeehari", coach: "Bret" },
  { name: "Rahyl", coach: "Bret" },
  { name: "Reeva Dhanani", coach: "Ryan" },
  { name: "Reyansh Agarwal (5yr — Deepshikha's son)", coach: "Bret" },
  { name: "Reyansh Agarwal (elder)", coach: "Bryle" },
  { name: "Reyansh Mehra", coach: "Ryan" },
  { name: "Reyansh Mishra", coach: "Bryle" },
  { name: "Rhagav", coach: "Bret" },
  { name: "Rishaan Singh Parmar", coach: "Bryle" },
  { name: "Riyansh Agarwal", coach: "Bryle" },
  { name: "Saad", coach: "Bret" },
  { name: "Saad Cherif", coach: "Bret" },

  // Page 4
  { name: "Sai Sanhith", coach: "Bryle" },
  { name: "Saif Jassim Mohamed", coach: "Bryle" },
  { name: "Shaurya Gurehiya", coach: "Bret" },
  { name: "Shivansh Sachin Chougue", coach: "Ryan" },
  { name: "Shrey", coach: "Bret" },
  { name: "Shreya Rupin Karan", coach: "Bret" },
  { name: "Shreyan Garg", coach: "Bryle" },
  { name: "Shuarya Shah", coach: "Bret" },
  { name: "Siddhi Pujara", coach: "Bryle" },
  { name: "Simon Filipjonoks", coach: "Bryle" },
  { name: "Skand Nandiraju", coach: "Bryle" },
  { name: "Skyler Saxena", coach: "Bryle" },
  { name: "Skylyn", coach: "Bret" },
  { name: "Subhdra", coach: "Bret" },
  { name: "Sudiksha", coach: "Bret" },
  { name: "Suleiman", coach: "Bret" },
  { name: "Suleiman Sholi", coach: "Bret" },
  { name: "Surveen Rana", coach: "Bryle" },
  { name: "Swaniti", coach: "Bryle" },
  { name: "Timor Damirov", coach: "Bryle" },
  { name: "Toba", coach: "Bret" },
  { name: "Trishaan Angra", coach: "Bryle" },
  { name: "Vadim Apostolov", coach: "Bryle" },
  { name: "Vardhana Jain", coach: "Bryle" },
  { name: "Vihaan Kumar", coach: "Bryle" },
  { name: "Vince Peralta", coach: "Bryle" },
  { name: "Visagan", coach: "Bret" },
  { name: "Vivaan Patel", coach: "Bryle" },
  { name: "Voitek Soltys", coach: "Bryle" },
  { name: "Wail", coach: "Bret" },
  { name: "Wail Bazaou", coach: "Bret" },
  { name: "Yedhant Jaiswal", coach: "Bryle" },
  { name: "Yohan Peralta", coach: "Bryle" },
  { name: "Yukth Shetty", coach: "Bryle" },
  { name: "Yuvaan", coach: "Bret" },
  { name: "Yuvaan Shah", coach: "Bret" },
  { name: "Zar Bilimoria", coach: "Bryle" },
  { name: "Zara Iyer", coach: "Bryle" }
];

async function main() {
  const coaches = await prisma.coach.findMany({ include: { user: true } });
  const bret = coaches.find(c => c.user?.name.toLowerCase().includes('brett'));
  const bryle = coaches.find(c => c.user?.name.toLowerCase().includes('brylle'));
  const ryan = coaches.find(c => c.user?.name.toLowerCase().includes('ryan'));

  if (!bret || !bryle || !ryan) {
    throw new Error('Could not find all 3 coaches (Brett, Brylle, Ryan) in database.');
  }

  const coachMap = {
    'Bret': bret,
    'Bryle': bryle,
    'Ryan': ryan
  };

  const dbStudents = await prisma.student.findMany({
    include: {
      coach: { include: { user: true } },
      centre: true
    }
  });

  function clean(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const studentTargetCoachMap = new Map(); // studentId -> { student, targetCoach, reason }

  function assign(student, targetCoach, reason) {
    if (!student) return;
    studentTargetCoachMap.set(student.id, {
      student,
      targetCoach,
      reason
    });
  }

  for (const item of list) {
    const targetCoach = coachMap[item.coach];
    const cName = clean(item.name);

    if (item.name === "Reyansh Agarwal (5yr — Deepshikha's son)") {
      const s = dbStudents.find(s => clean(s.name) === clean("Reyansh Agarwal Private"));
      assign(s, targetCoach, item.name);
    } else if (item.name === "Reyansh Agarwal (elder)") {
      const s = dbStudents.find(s => clean(s.name) === clean("Reyansh Agarwal") && s.name !== "Reyansh Agarwal Private");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Alex (Adult)") {
      const s = dbStudents.find(s => clean(s.name) === clean("Alex Veber (Adult)"));
      assign(s, targetCoach, item.name);
    } else if (item.name === "Borozdin Mikhail \"Misha\"") {
      const s = dbStudents.find(s => clean(s.name) === "misha");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Daniil Apostolov,") {
      const s = dbStudents.find(s => clean(s.name).includes("daniil apostolov"));
      assign(s, targetCoach, item.name);
    } else if (item.name === "Diansh") {
      const s1 = dbStudents.find(s => clean(s.name) === "diansh");
      const s2 = dbStudents.find(s => clean(s.name) === "diansh joshi");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Aya Naser") {
      const s = dbStudents.find(s => clean(s.name) === "aya nasser" || clean(s.name) === "aya naser");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Bhavisha Arwani") {
      const s = dbStudents.find(s => clean(s.name) === "bhavisha");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Elija") {
      const s = dbStudents.find(s => clean(s.name) === "elija pm" || clean(s.name) === "elija");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Hridit") {
      const s = dbStudents.find(s => clean(s.name) === "hridit deskmukh");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Hridith Deskmukh") {
      const s = dbStudents.find(s => clean(s.name) === "hridith deskmukh");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Kairav") {
      const s = dbStudents.find(s => clean(s.name) === "kairav");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Latiksh" || item.name === "Latiskh") {
      const s1 = dbStudents.find(s => clean(s.name) === "latiksh");
      const s2 = dbStudents.find(s => clean(s.name) === "latiksh gupta");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Leyaan" || item.name === "Leyaan vergara") {
      const s = dbStudents.find(s => clean(s.name) === "leyaan vergara");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Milaan vergara") {
      const s = dbStudents.find(s => clean(s.name) === clean("Milaan Vergara-") || clean(s.name) === "milaan vergara");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Milann vergara") {
      const s = dbStudents.find(s => clean(s.name) === clean("Milann Vergura") || clean(s.name) === "milann vergara");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Reyansh Mishra") {
      const s = dbStudents.find(s => clean(s.name) === "reyansh misra" || clean(s.name) === "reyansh mishra");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Raghav" || item.name === "Rhagav") {
      const s = dbStudents.find(s => clean(s.name) === clean("Raghav (JLT)") || clean(s.name) === "raghav");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Saad" || item.name === "Saad Cherif") {
      const s = dbStudents.find(s => clean(s.name) === "saad cherif");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Faris Cherif") {
      const s1 = dbStudents.find(s => clean(s.name) === "faris cherif");
      const s2 = dbStudents.find(s => clean(s.name) === "faras cherif");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Shuarya Shah") {
      const s = dbStudents.find(s => clean(s.name) === "shaurya shah");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Suleiman" || item.name === "Suleiman Sholi") {
      const s = dbStudents.find(s => clean(s.name) === "suleiman sholi");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Vince Peralta") {
      const s1 = dbStudents.find(s => clean(s.name) === "vince");
      const s2 = dbStudents.find(s => clean(s.name) === "vince charlie peralta");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Yohan Peralta") {
      const s1 = dbStudents.find(s => clean(s.name) === "yohan");
      const s2 = dbStudents.find(s => clean(s.name) === "yohan charles peralta");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Wail" || item.name === "Wail Bazaou") {
      const s1 = dbStudents.find(s => clean(s.name) === "wail");
      const s2 = dbStudents.find(s => clean(s.name) === "wail bazaou");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Yuvaan" || item.name === "Yuvaan Shah") {
      const s1 = dbStudents.find(s => clean(s.name) === "yuvaan");
      const s2 = dbStudents.find(s => clean(s.name) === "yuvaan shah");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Aarya") {
      // General Aarya match if exact
      const s = dbStudents.find(s => clean(s.name) === "aarya");
      if (s) assign(s, targetCoach, item.name);
    } else if (item.name === "Aaryan Garg" || item.name === "Aaryan Garge") {
      const s = dbStudents.find(s => clean(s.name) === "aaryan garg");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Ammar" || item.name === "Ammar Allindin") {
      const s1 = dbStudents.find(s => clean(s.name) === "ammar");
      const s2 = dbStudents.find(s => clean(s.name) === "ammar allindin");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Ananya Puranic") {
      const s = dbStudents.find(s => clean(s.name) === "ananya puranik");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Asher") {
      const s = dbStudents.find(s => clean(s.name) === "asher");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Shaurya Gurehiya") {
      const s = dbStudents.find(s => clean(s.name) === "shaurya gurehiya");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Vadim Apostolov") {
      const s = dbStudents.find(s => clean(s.name) === "vadim apostolov");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Marah Draidi") {
      const s = dbStudents.find(s => clean(s.name) === "marah draidi");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Minha Harith") {
      const s = dbStudents.find(s => clean(s.name) === "minha harith");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Minha") {
      const s = dbStudents.find(s => clean(s.name) === "minha");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Mihail Filipjonoks") {
      const s1 = dbStudents.find(s => clean(s.name) === "mihail");
      const s2 = dbStudents.find(s => clean(s.name) === "mihail filipjonoks (adult)");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Maksim (Alex son)") {
      const s = dbStudents.find(s => clean(s.name) === "maksim (alex son)");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Lunle Xang \"Lukas\"") {
      const s = dbStudents.find(s => clean(s.name) === clean("Lunle Xang \"Lukas\""));
      assign(s, targetCoach, item.name);
    } else if (item.name === "AKIRA") {
      const s1 = dbStudents.find(s => clean(s.name) === "akira");
      const s2 = dbStudents.find(s => clean(s.name) === "akira agarwal");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Jiyansh") {
      const s1 = dbStudents.find(s => clean(s.name) === "jiyansh");
      const s2 = dbStudents.find(s => clean(s.name) === "jiyansh shah");
      assign(s1, targetCoach, item.name);
      assign(s2, targetCoach, item.name);
    } else if (item.name === "Kaveer") {
      const s = dbStudents.find(s => clean(s.name) === "kaveer");
      assign(s, targetCoach, item.name);
    } else if (item.name === "Shrey") {
      const s = dbStudents.find(s => clean(s.name) === "shrey");
      assign(s, targetCoach, item.name);
    } else {
      // Exact or direct prefix match
      let s = dbStudents.find(s => clean(s.name) === cName);
      if (!s) {
        s = dbStudents.find(s => clean(s.name).startsWith(cName) || cName.startsWith(clean(s.name)));
      }
      if (s) {
        assign(s, targetCoach, item.name);
      }
    }
  }

  console.log(`\nTotal unique student records identified to be set/verified: ${studentTargetCoachMap.size}`);

  let updatedCount = 0;
  let alreadyCorrectCount = 0;

  for (const [studentId, entry] of studentTargetCoachMap.entries()) {
    const { student, targetCoach, reason } = entry;
    const currentCoachName = student.coach?.user?.name || 'Unassigned';
    if (student.coach_id === targetCoach.id) {
      alreadyCorrectCount++;
      // console.log(`[ALREADY CORRECT] ${student.name} -> ${targetCoach.user.name}`);
    } else {
      updatedCount++;
      console.log(`[REASSIGNING] ${student.name} (ID: ${student.id}) | From: "${currentCoachName}" -> To: "${targetCoach.user.name}" (Matched: "${reason}")`);
      await prisma.student.update({
        where: { id: student.id },
        data: { coach_id: targetCoach.id }
      });
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY OF REASSIGNMENT:`);
  console.log(`Total students verified against list: ${studentTargetCoachMap.size}`);
  console.log(`Students updated to new/correct coach: ${updatedCount}`);
  console.log(`Students already correctly assigned: ${alreadyCorrectCount}`);
  console.log(`========================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
