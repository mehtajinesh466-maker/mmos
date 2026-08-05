const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const siblingGroups = [
  ["Evaana Jamshidzadeh", "Kiyaana Jamshidzadeh"],
  ["Anika Iyer", "Zarah Iyer"],
  ["Kiaan Gupta", "Miraya Gupta"],
  ["Abigail Gonsalves", "Avishai Gonsalves"],
  ["Nyra jain", "Vihaan Dam"],
  ["Myra Bhandari", "Pranshi Kulshrestha"],
  ["Eva Ghannaj", "Yana Ghannaj"],
  ["Dhanya Garg", "Vedant Garg"],
  ["Misha Garg", "Visha Garg"],
  ["Abhijay Singh Matharu", "Abhiraj Singh Matharu", "Vihaan Singh Matharu"],
  ["Alena Gordina", "Mikhail Gordina"],
  ["Aadi Jain", "Shrey Jain"],
  ["Keyan Kanodia", "Mivaan Anuraag Mehta", "Namish Chandpara", "Tapish Kanodia"],
  ["Vince Charlie Peralta", "Yohann Charles Peralta"],
  ["Ayaan Saraf", "Shaarvi Saraf"],
  ["Aarya Shah", "Darsh Shah"],
  ["Aaryav Rodrigues", "Ronav Rodrigues"],
  ["Kabir Shrivastava", "Shaan Shrivastava"],
  ["Kavya Shah", "Yuvaan Shah"],
  ["Joshua Lemke", "Lilah Lemke"],
  ["Tiya Mundhra", "Yatharth Mundhra"],
  ["Aarika", "Adheesha"],
  ["Asher Ashish", "Ashton Ashish"],
  ["Emmanuel kamel", "Karas kamel"],
  ["Aryaveer Bhagat", "Rajveer Bhagat"],
  ["Aanya Jain", "Advay Jain"],
  ["Jan Kulczycka", "Weronika Kulczycka"],
  ["Daniil Apostolov", "vadim apostolov"],
  ["Faras Ghenas", "Ibrahim Koudemagh", "Ilyes Ghennas"],
  ["Skyler Saxena", "Skylym Saxena"],
  ["Finn Lyndon", "kian lyndon"],
  ["Aadya saxena", "Aarya Saxena"],
  ["Andreas Papadouris", "elene"],
  ["Kyra Gupta", "Prisha Gupta"],
  ["Subhadra", "zarah Alwin"],
  ["Khai Rajguru", "Zen Rajguru"],
  ["Mihails Filipjonoks", "Simon Filipjonoks"],
  ["Adam Draidi", "Marah Draidi", "Mihail Senguen", "Noyan Senguen"],
  ["Dhriityk Raipancholia", "Kaartik Raipancholia"],
  ["Ammar Aloem", "Yushav Aloem"],
  ["Luna Ozornek", "Maya Ozornek"],
  ["Aarna Bansal", "Sudiksha Khandelwal"],
  ["Kush", "TARA"],
  ["Dishita Jhunjhunwala", "Mohika Jhunjhunwala"],
  ["Rishik Kumar", "Vihaan Kumar"],
  ["Adam Al Sawaf", "Alexander Al Sawaf"],
  ["Lara Shembesh", "Omar Shembesh"],
  ["Evelyn", "Roslyn"],
  ["Aayansh", "Rivah"],
  ["Aashray Mittal", "Shaivi Mittal"],
  ["Khalid Alaryan", "Yousef Alaryan"],
  ["Rayan Pietrek", "Taliyah Pietrek"],
  ["Eva Ajanjan", "Nora Ajanjan"],
  ["Amit Chordia", "Bodhi Chordia", "Vanya Chordia"],
  ["Adam Afzal Dar", "Ali Afzal Dar"],
  ["Isha Sawlani", "Rhea Sawlani"],
  ["Nikita Sheth", "Nyra Sheth"],
  ["Rudra Bajaj", "Shiva Bajaj", "Veer Bajaj"],
  ["Vasilisa", "Vladimir"],
  ["Muhab Yousef", "nedal yousef", "noor yousef", "roya yousef"]
];

function cleanName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\(jlt\)/g, '').trim();
}

async function main() {
  const dbStudents = await prisma.student.findMany({
    select: { id: true, name: true }
  });

  const dbStudentNames = dbStudents.map(s => ({
    id: s.id,
    originalName: s.name,
    cleanName: cleanName(s.name)
  }));

  console.log(`Loaded ${dbStudents.length} students from database.`);

  let totalMatched = 0;
  let totalNamesToCheck = 0;

  for (let i = 0; i < siblingGroups.length; i++) {
    const group = siblingGroups[i];
    console.log(`\nGroup ${i + 1}:`);
    const matchedList = [];
    const unmatchedList = [];

    for (const name of group) {
      totalNamesToCheck++;
      const cleanTarget = cleanName(name);
      
      // Let's do a direct clean match, and if that fails, try a substring check
      let match = dbStudentNames.find(s => s.cleanName === cleanTarget);
      if (!match) {
        // Try substring match: check if cleanTarget is contained in student's clean name or vice-versa
        match = dbStudentNames.find(s => s.cleanName.includes(cleanTarget) || cleanTarget.includes(s.cleanName));
      }

      if (match) {
        matchedList.push({ name, matchedAs: match.originalName, id: match.id });
        totalMatched++;
      } else {
        unmatchedList.push(name);
      }
    }

    console.log(`  Matched:`, matchedList.map(m => `"${m.name}" -> "${m.matchedAs}"`).join(', '));
    if (unmatchedList.length > 0) {
      console.log(`  UNMATCHED:`, unmatchedList.map(u => `"${u}"`).join(', '));
    }
  }

  console.log(`\nVerification Summary:`);
  console.log(`Total names checked: ${totalNamesToCheck}`);
  console.log(`Total matched: ${totalMatched}`);
  console.log(`Total unmatched: ${totalNamesToCheck - totalMatched}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
