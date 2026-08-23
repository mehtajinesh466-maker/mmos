const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const attendanceFile = path.join(__dirname, 'public', 'All Attendance Records-18.xlsx');
const wb = xlsx.readFile(attendanceFile);
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const parseExcelDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

console.log("Printing sample rows that failed date parsing in Excel:");
let failedCount = 0;
data.forEach((row, idx) => {
  const parsed = parseExcelDate(row['Date']);
  if (!parsed) {
    failedCount++;
    if (failedCount <= 30) {
      console.log(`Failed Row #${failedCount} (Excel row ${idx + 2}):`, row);
    }
  }
});
console.log(`\nTotal rows that failed date parsing: ${failedCount}`);
