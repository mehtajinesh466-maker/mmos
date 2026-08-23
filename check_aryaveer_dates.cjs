const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const attendanceFile = path.join(__dirname, 'public', 'All Attendance Records-18.xlsx');
  const wb = xlsx.readFile(attendanceFile);
  const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  const excelRows = [];
  data.forEach((row, idx) => {
    const sName = String(row['Student'] || '').trim();
    if (sName.toLowerCase().includes('aryaveer') || sName.toLowerCase().includes('sundaram')) {
      excelRows.push({ idx: idx + 2, row });
    }
  });

  const dbStudent = await prisma.student.findFirst({
    where: { name: { contains: 'Aryaveer', mode: 'insensitive' } },
    include: { attendance: true }
  });

  console.log(`--- ARYAVEER SUNDARAM COMPARISON ---`);
  console.log(`Excel Row Count: ${excelRows.length}`);
  console.log(`DB Student Name: ${dbStudent ? dbStudent.name : 'none'}`);
  console.log(`DB Attendance Count: ${dbStudent ? dbStudent.attendance.length : 0}`);

  console.log(`\nExcel Records:`);
  excelRows.forEach(e => {
    console.log(`  Row ${e.idx}: Date = ${e.row.Date}, Status = ${e.row.Attendance}, Duration = ${e.row['Class duration']}`);
  });

  if (dbStudent) {
    console.log(`\nDB Attendance Records:`);
    dbStudent.attendance.forEach(a => {
      console.log(`  Date = ${a.date.toISOString().split('T')[0]}, Status = ${a.status}, Duration = ${a.duration}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
