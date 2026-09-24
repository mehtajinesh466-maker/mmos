const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Full 153 items from the 4-page PDF:
const list = [
  // Page 1
  { name: "Aadya", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Aarav Suhas", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aarya", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Aarya Saxena", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aarya Shah", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aaryan Srivastava", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aaryan Garg", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Aaryan Garge", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Adam Draidi", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aditya Mahesh Bhosale", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Advait Nittala", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Advik", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Ahaan Jain", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aiden Currimboy", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Aiden Jeejeebhoy", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aisha Agarwal", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "AKIRA", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Alex (Adult)", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Alex Donner", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Ammar", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Ammar Allindin", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Ananya Puranic", coach: "Bryle", status: "Note - CRM says John Mendoza" },
  { name: "Anika Iyer", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Antonio Moran", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Arhit Lokare", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Arshita", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Aryan Garg", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Asher", coach: "Bret", status: "Note - CRM says John Mendoza" },
  { name: "Ashwin", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Atharv Agarwal", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Aya Naser", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Aydamir", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Barman Hassanpour", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Benjamin Matthew", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Bhavisha Arwani", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },

  // Page 2
  { name: "Bobby", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Borozdin Mikhail \"Misha\"", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Caspian Jarvenpaa", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Daivik Joshi", coach: "Ryan", status: "Confirmed (schedule + CRM agree)" },
  { name: "Daiwik Joshi", coach: "Ryan", status: "Confirmed (schedule + CRM agree)" },
  { name: "Daksh Mathur", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Daniil Apostolov,", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Darsh Rikin Shah", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Davit Nazaryan", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Dhrithi", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Dhrithi Jalan", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Diansh", coach: "Ryan", status: "Confirmed by user — Ryan + Mahri (not Bret)" },
  { name: "Eleandre M.Tiosan", coach: "Ryan", status: "Confirmed (schedule + CRM agree)" },
  { name: "Elija", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Essa Altawil", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Ethan Taveneer", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Faris Cherif", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Finn Lyndon", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Griva", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Hamza", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Hasan Aladin", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Hector Marco", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Hridhaan Parmar", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Hridit", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Hridith Deskmukh", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Irena Dey", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Ivaan", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "James Nutter", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Jinansh Nilay Shah", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Jiyansh", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Kaashvi Karthikeyan Shyamala", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Kabir Keswani", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Kairav", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Kanav Bansal", coach: "Bret", status: "Resolved by CRM" },
  { name: "Kaveer", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Kavya Shah", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Kian Lyndon", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Kiyaan Veer Chopra", coach: "Ryan", status: "Resolved by CRM" },
  { name: "Kristina (adult)", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Latiksh", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },

  // Page 3
  { name: "Latiskh", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Leyaan", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Leyaan vergara", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Lunle Xang \"Lukas\"", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Maksim (Alex son)", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Marah Draidi", coach: "Bret", status: "Note - CRM says James Estrada" },
  { name: "Maya Narula", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Meerah Altawil", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Mihail Filipjonoks", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Milaan vergara", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Milann vergara", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Minha", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Minha Harith", coach: "Bret", status: "Note - CRM says Mahri Geldiyeva" },
  { name: "Mohamed Zayd", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Mohammed Hamza Sheikh", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Moksha", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Moksha Mehul", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Myra Bhandari", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Nikil Reddy Thalamarla", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Nikolai", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Nina Karol", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Noah Sholi", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Om Mehta", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Pavika Grover", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Phalak Joshi", coach: "Ryan", status: "Confirmed (schedule + CRM agree)" },
  { name: "Pranav Naganandh", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Pranshi", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Raghav", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Raguram Sreeehari", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Rahyl", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Reeva Dhanani", coach: "Ryan", status: "Confirmed by user" },
  { name: "Reyansh Agarwal (5yr — Deepshikha's son)", coach: "Bret", status: "Confirmed by user" },
  { name: "Reyansh Agarwal (elder)", coach: "Bryle", status: "Confirmed by user" },
  { name: "Reyansh Mehra", coach: "Ryan", status: "Confirmed (schedule + CRM agree)" },
  { name: "Reyansh Mishra", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Rhagav", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Rishaan Singh Parmar", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Riyansh Agarwal", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Saad", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Saad Cherif", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },

  // Page 4
  { name: "Sai Sanhith", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Saif Jassim Mohamed", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Shaurya Gurehiya", coach: "Bret", status: "Note - CRM says John Mendoza" },
  { name: "Shivansh Sachin Chougue", coach: "Ryan", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Shrey", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Shreya Rupin Karan", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Shreyan Garg", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Shuarya Shah", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Siddhi Pujara", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Simon Filipjonoks", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Skand Nandiraju", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Skyler Saxena", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Skylyn", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Subhdra", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Sudiksha", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Suleiman", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Suleiman Sholi", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Surveen Rana", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Swaniti", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Timor Damirov", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Toba", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Trishaan Angra", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Vadim Apostolov", coach: "Bryle", status: "Note - CRM says James Estrada" },
  { name: "Vardhana Jain", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Vihaan Kumar", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Vince Peralta", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Visagan", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Vivaan Patel", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Voitek Soltys", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Wail", coach: "Bret", status: "Coach Bret / Coach Ryan (NEEDS CONFIRMATION)" }, // Wail Bazaou confirmed Bret
  { name: "Wail Bazaou", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Yedhant Jaiswal", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Yohan Peralta", coach: "Bryle", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Yukth Shetty", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Yuvaan", coach: "Bret", status: "Schedule only (not in CRM / Unassigned)" },
  { name: "Yuvaan Shah", coach: "Bret", status: "Confirmed (schedule + CRM agree)" },
  { name: "Zar Bilimoria", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" },
  { name: "Zara Iyer", coach: "Bryle", status: "Confirmed (schedule + CRM agree)" }
];

async function main() {
  const coaches = await prisma.coach.findMany({ include: { user: true } });
  const bret = coaches.find(c => c.user?.name.toLowerCase().includes('brett'));
  const bryle = coaches.find(c => c.user?.name.toLowerCase().includes('brylle'));
  const ryan = coaches.find(c => c.user?.name.toLowerCase().includes('ryan'));

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

  console.log(`Starting reassignment for ${list.length} target records against ${dbStudents.length} DB records...`);

  const updates = [];
  const notFound = [];

  for (const item of list) {
    const targetCoach = coachMap[item.coach];
    if (!targetCoach) {
      console.error(`Unknown coach: ${item.coach}`);
      continue;
    }

    const cName = clean(item.name);

    // Special handlings for ambiguous/complex names:
    let matchedStudent = null;

    if (item.name === "Reyansh Agarwal (5yr — Deepshikha's son)") {
      // Find Reyansh Agarwal Private or student with 5yr notes if any
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Reyansh Agarwal Private")) ||
                       dbStudents.find(s => s.notes?.includes("Deepshikha") || s.parent_name?.toLowerCase().includes("deepshikha"));
    } else if (item.name === "Reyansh Agarwal (elder)") {
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Reyansh Agarwal") && s.name !== "Reyansh Agarwal Private");
    } else if (item.name === "Alex (Adult)") {
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Alex Veber (Adult)")) ||
                       dbStudents.find(s => clean(s.name) === clean("Alex") && s.centre.name === "JLT");
    } else if (item.name === "Daniil Apostolov,") {
      matchedStudent = dbStudents.find(s => clean(s.name).includes("daniil apostolov"));
    } else if (item.name === "Borozdin Mikhail \"Misha\"") {
      matchedStudent = dbStudents.find(s => clean(s.name).includes("borozdin") || clean(s.name).includes("misha") || clean(s.name) === clean("Borozdin Mikhail"));
    } else if (item.name === "Lunle Xang \"Lukas\"") {
      matchedStudent = dbStudents.find(s => clean(s.name).includes("lunle") || clean(s.name).includes("lukas"));
    } else if (item.name === "Maksim (Alex son)") {
      matchedStudent = dbStudents.find(s => clean(s.name).includes("maksim"));
    } else if (item.name === "Diansh") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "diansh") ||
                       dbStudents.find(s => clean(s.name) === "diansh joshi");
    } else if (item.name === "Milaan vergara") {
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Milaan Vergara-") || clean(s.name) === clean("Milaan Vergara"));
    } else if (item.name === "Milann vergara") {
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Milann Vergara"));
    } else if (item.name === "Reyansh Mishra") {
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Reyansh Misra") || clean(s.name) === clean("Reyansh Mishra"));
    } else if (item.name === "Raghav") {
      matchedStudent = dbStudents.find(s => clean(s.name) === clean("Raghav (JLT)") || clean(s.name) === "raghav");
    } else if (item.name === "Rhagav") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "rhagav");
    } else if (item.name === "Vince Peralta") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "vince" || clean(s.name) === "vince peralta");
    } else if (item.name === "Yohan Peralta") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "yohan charles peralta" || clean(s.name) === "yohan");
    } else if (item.name === "Wail") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "wail");
    } else if (item.name === "Wail Bazaou") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "wail bazaou");
    } else if (item.name === "Yuvaan") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "yuvaan");
    } else if (item.name === "Yuvaan Shah") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "yuvaan shah");
    } else if (item.name === "Saad") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "saad");
    } else if (item.name === "Saad Cherif") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "saad cherif");
    } else if (item.name === "Faris Cherif") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "faris cherif" || clean(s.name) === "faras cherif");
    } else if (item.name === "Suleiman") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "suleiman");
    } else if (item.name === "Suleiman Sholi") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "suleiman sholi");
    } else if (item.name === "Leyaan") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "leyaan");
    } else if (item.name === "Leyaan vergara") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "leyaan vergara");
    } else if (item.name === "Hridit") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "hridit");
    } else if (item.name === "Hridith Deskmukh") {
      matchedStudent = dbStudents.find(s => clean(s.name).includes("hridith") || clean(s.name).includes("deshmukh") || clean(s.name).includes("deskmukh"));
    } else if (item.name === "Elija") {
      matchedStudent = dbStudents.find(s => clean(s.name) === "elija" || clean(s.name) === "elijah");
    } else {
      // Direct exact match
      matchedStudent = dbStudents.find(s => clean(s.name) === cName);
      if (!matchedStudent) {
        // Partial match
        matchedStudent = dbStudents.find(s => clean(s.name).startsWith(cName) || cName.startsWith(clean(s.name)));
      }
    }

    if (!matchedStudent) {
      notFound.push(item);
    } else {
      updates.push({
        item,
        student: matchedStudent,
        targetCoach,
        needsChange: matchedStudent.coach_id !== targetCoach.id
      });
    }
  }

  console.log(`\nMatched: ${updates.length}`);
  console.log(`Not found: ${notFound.length}`);
  if (notFound.length > 0) {
    console.log('Not found items:', notFound);
  }

  const toChange = updates.filter(u => u.needsChange);
  console.log(`\nTo update in database: ${toChange.length} students`);
  toChange.forEach(u => {
    console.log(`  -> Student: "${u.student.name}" (ID: ${u.student.id}) | From: "${u.student.coach?.user?.name || 'Unassigned'}" -> To: "${u.targetCoach.user.name}"`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
