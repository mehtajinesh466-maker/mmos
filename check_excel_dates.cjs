const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const attendanceFile = path.join(publicDir, 'All Attendance Records-18.xlsx');

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const wb = xlsx.readFile(attendanceFile);
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

console.log("Searching for Aadwitya Chawla in All Attendance Records-18.xlsx:");
let count = 0;
data.forEach(row => {
  const student = String(row['Student'] || '').trim().toLowerCase();
  if (student.includes("aadwitya") && student.includes("chawla")) {
    count++;
    const rawDate = row['Date'];
    const parsedDate = parseExcelDate(rawDate);
    console.log(`Row #${count}:`);
    console.log(`  Raw Date:`, rawDate, `(Type: ${typeof rawDate})`);
    console.log(`  Parsed Date:`, parsedDate ? parsedDate.toISOString() : 'failed');
  }
});
