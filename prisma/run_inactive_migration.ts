import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as xlsxModule from 'xlsx';

const XLSX = (xlsxModule as any).default || xlsxModule;
const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(process.cwd(), 'public', 'The best overdue list_Master_Moves_Overdue_Report_Jul2026_1.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  const sheetName = 'Inactive List';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error(`Sheet "${sheetName}" not found in workbook.`);
    process.exit(1);
  }

  const rows: any[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${rows.length} rows in the "${sheetName}" sheet.`);

  // Find header line or name column.
  // The first key is 'Inactive — no class in over 120 days (253 students)'.
  // Row index 0 has header names if the sheet was converted.
  const nameColumnKey = Object.keys(rows[0] || {})[0];
  if (!nameColumnKey) {
    console.error('Could not determine name column key.');
    process.exit(1);
  }

  const inactiveNames: string[] = [];
  rows.forEach((row, i) => {
    const rawName = row[nameColumnKey];
    if (rawName && typeof rawName === 'string') {
      const name = rawName.trim();
      // Skip descriptions, headers, or summary rows
      if (
        name.toLowerCase().includes('inactive') ||
        name.toLowerCase().includes('parked so the front') ||
        name.toLowerCase().includes('student name') ||
        name.toLowerCase().includes('total') ||
        name.toLowerCase().includes('students')
      ) {
        return;
      }
      inactiveNames.push(name);
    }
  });

  console.log(`Extracted ${inactiveNames.length} student names to mark inactive.`);

  // Fetch all students from DB
  const dbStudents = await prisma.student.findMany({
    select: { id: true, name: true, status: true }
  });

  console.log(`Found ${dbStudents.length} students in DB.`);

  let updatedCount = 0;
  let packageClosedCount = 0;
  let enrollmentDeletedCount = 0;

  for (const name of inactiveNames) {
    // Exact or normalized case insensitive match
    const student = dbStudents.find(
      s => s.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (student) {
      console.log(`Processing student: ${student.name} (${student.id})`);
      
      // Update status and flags
      const existingFlags = student.flags ? (student.flags as any) : {};
      const newFlags = {
        ...existingFlags,
        unpaid_classes: 0,
        unpaid_value: 0
      };

      await prisma.student.update({
        where: { id: student.id },
        data: {
          status: 'inactive',
          flags: newFlags
        }
      });
      updatedCount++;

      // Close packages
      const pkgsResult = await prisma.package.updateMany({
        where: { student_id: student.id, classes_remaining: { gt: 0 } },
        data: { classes_remaining: 0 }
      });
      packageClosedCount += pkgsResult.count;

      // Delete enrollments
      const enrollResult = await prisma.enrollment.deleteMany({
        where: { student_id: student.id }
      });
      enrollmentDeletedCount += enrollResult.count;
    } else {
      console.warn(`Could not match student name from sheet: "${name}"`);
    }
  }

  console.log('--- Migration completed ---');
  console.log(`Students updated: ${updatedCount}`);
  console.log(`Packages closed: ${packageClosedCount}`);
  console.log(`Enrollments deleted: ${enrollmentDeletedCount}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
