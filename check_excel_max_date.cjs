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

let minDate = null;
let maxDate = null;
const yearCounts = {};

data.forEach(row => {
  const parsed = parseExcelDate(row['Date']);
  if (parsed) {
    if (!minDate || parsed < minDate) minDate = parsed;
    if (!maxDate || parsed > maxDate) maxDate = parsed;
    const year = parsed.getFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  }
});

console.log('--- EXCEL ATTENDANCE DATE RANGE ---');
console.log('Min Date:', minDate ? minDate.toISOString().split('T')[0] : 'none');
console.log('Max Date:', maxDate ? maxDate.toISOString().split('T')[0] : 'none');
console.log('Year Distribution:', yearCounts);
