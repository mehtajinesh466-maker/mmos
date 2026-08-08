const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backup() {
  console.log('Starting database backup...');
  const data = {};
  
  const tables = [
    'centre',
    'user',
    'coach',
    'family',
    'student',
    'tier',
    'package',
    'scheduleSlot',
    'enrollment',
    'attendance',
    'progressLog',
    'studentSkill',
    'fideRating',
    'enquiry',
    'report',
    'invoice',
    'auditLog',
    'notification',
    'tournamentReport'
  ];

  for (const table of tables) {
    try {
      console.log(`Backing up table: ${table}...`);
      data[table] = await prisma[table].findMany();
    } catch (err) {
      console.error(`Failed to backup table ${table}:`, err.message);
    }
  }

  const backupPath = path.join(__dirname, 'db_backup_prod.json');
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`Backup completed successfully! Saved to: ${backupPath}`);
  
  await prisma.$disconnect();
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
