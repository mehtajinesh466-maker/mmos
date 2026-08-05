const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const unmatched = [
  "Vihaan Dam",
  "Visha Garg",
  "Namish Chandpara",
  "Namah Chandpara",
  "Ayaan Saraf",
  "Joshua Lemke",
  "Aanya Jain",
  "Faras Ghenas",
  "Ibrahim Koudemagh",
  "Ilyes Ghennas",
  "Skylym Saxena",
  "Skylim Saxena",
  "Kyra Gupta",
  "Prisha Gupta",
  "zarah Alwin",
  "Adam Draidi",
  "Marah Draidi",
  "Noyan Senguen",
  "Dhriityk Raipancholia",
  "Ammar Aloem",
  "Yushav Aloem",
  "Mohika Jhunjhunwala",
  "Nora Ajanjan",
  "Bodhi Chordia",
  "roya yousef"
];

async function main() {
  const dbStudents = await prisma.student.findMany({
    select: { name: true }
  });

  for (const target of unmatched) {
    const firstWord = target.split(' ')[0].toLowerCase();
    const matches = dbStudents.filter(s => {
      const nameLower = s.name.toLowerCase();
      return nameLower.includes(firstWord) || nameLower.split(' ').some(w => w === firstWord);
    }).map(s => s.name);
    console.log(`Unmatched: "${target}" -> matches in DB starting with "${firstWord}":`, matches);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
