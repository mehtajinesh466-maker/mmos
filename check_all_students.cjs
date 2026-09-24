const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// List from PDF:
const list = [
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
  { name: "Reyansh Agarwal (5yr — Deepshikha's son)", coach: "Bret", rawQuery: "Reyansh Agarwal" },
  { name: "Reyansh Agarwal (elder)", coach: "Bryle", rawQuery: "Reyansh Agarwal" },
  { name: "Reyansh Mehra", coach: "Ryan" },
  { name: "Reyansh Mishra", coach: "Bryle" },
  { name: "Rhagav", coach: "Bret" },
  { name: "Rishaan Singh Parmar", coach: "Bryle" },
  { name: "Riyansh Agarwal", coach: "Bryle" },
  { name: "Saad", coach: "Bret" },
  { name: "Saad Cherif", coach: "Bret" },
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
  { name: "Wail", coach: "Bret" }, // Note: Wail / Coach Bret or Ryan - Wail Bazaou is Bret
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
  const dbStudents = await prisma.student.findMany({
    include: {
      coach: { include: { user: true } },
      centre: true,
      family: true
    }
  });

  const coaches = await prisma.coach.findMany({
    include: { user: true }
  });

  const coachMap = {
    'Bret': coaches.find(c => c.user.name.toLowerCase().includes('brett')),
    'Bryle': coaches.find(c => c.user.name.toLowerCase().includes('brylle')),
    'Ryan': coaches.find(c => c.user.name.toLowerCase().includes('ryan')),
  };

  console.log('Coach Bret ID:', coachMap.Bret?.id, coachMap.Bret?.user.name);
  console.log('Coach Bryle ID:', coachMap.Bryle?.id, coachMap.Bryle?.user.name);
  console.log('Coach Ryan ID:', coachMap.Ryan?.id, coachMap.Ryan?.user.name);

  console.log('\n--- MATCHING CHECK ---');
  
  // Normalization helper
  function clean(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const unassignedOrMismatch = [];
  const notFoundInDb = [];
  const matched = [];

  for (const item of list) {
    const itemClean = clean(item.name);
    // Find in DB
    const exact = dbStudents.filter(s => clean(s.name) === itemClean);
    let matches = exact;
    if (matches.length === 0) {
      // try fuzzy / includes
      matches = dbStudents.filter(s => {
        const sClean = clean(s.name);
        return sClean.includes(itemClean) || itemClean.includes(sClean);
      });
    }

    if (matches.length === 0) {
      notFoundInDb.push(item);
    } else {
      matched.push({
        item,
        matchedStudents: matches.map(s => ({
          id: s.id,
          name: s.name,
          currentCoach: s.coach?.user?.name || 'Unassigned',
          currentCoachId: s.coach_id,
          centre: s.centre.name,
          status: s.status,
          targetCoach: item.coach,
          targetCoachId: coachMap[item.coach]?.id
        }))
      });
    }
  }

  console.log(`Matched list items: ${matched.length} / ${list.length}`);
  console.log(`Not found list items: ${notFoundInDb.length}`);
  if (notFoundInDb.length > 0) {
    console.log('Not found:', JSON.stringify(notFoundInDb, null, 2));
  }

  console.log('\n--- MATCH DETAILS ---');
  let needsUpdateCount = 0;
  for (const m of matched) {
    for (const st of m.matchedStudents) {
      const matchCoach = st.currentCoachId === st.targetCoachId;
      if (!matchCoach) {
        needsUpdateCount++;
        console.log(`[UPDATE NEEDED] Student: "${st.name}" (ID: ${st.id}, Centre: ${st.centre}) -> Current Coach: "${st.currentCoach}" => Target Coach: "Coach ${st.targetCoach}" (${coachMap[st.targetCoach]?.user.name})`);
      } else {
        console.log(`[OK] Student: "${st.name}" -> Already Coach "${st.currentCoach}"`);
      }
    }
  }

  console.log(`\nTotal updates needed among matched: ${needsUpdateCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
