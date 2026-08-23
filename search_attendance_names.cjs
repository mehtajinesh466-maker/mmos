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
  return new Date(val);
};

const searchTerms = ['aadwitya', 'srivastav', 'sureka', 'ahaan', 'patnaikuni', 'ilyes', 'misha', 'pavika'];

console.log("Searching for attendance records matching terms in Excel:");
const matches = {};
searchTerms.forEach(t => matches[t] = []);

data.forEach((row, idx) => {
  const name = String(row['Student'] || '').toLowerCase();
  searchTerms.forEach(term => {
    if (name.includes(term)) {
      matches[term].push({ idx, row, parsedDate: parseExcelDate(row['Date']) });
    }
  });
});

searchTerms.forEach(term => {
  console.log(`\n--- Term: "${term}" (Found ${matches[term].length} records) ---`);
  // Group by student name in sheet
  const group = {};
  matches[term].forEach(m => {
    const sName = String(m.row['Student']).trim();
    if (!group[sName]) group[sName] = [];
    group[sName].push(m);
  });
  
  Object.keys(group).forEach(sName => {
    const records = group[sName];
    console.log(`  Student Name in Sheet: "${sName}" (Count: ${records.length})`);
    // Print 3 latest dates
    const sorted = records.sort((a, b) => b.parsedDate - a.parsedDate);
    console.log(`    Latest 3 dates:`, sorted.slice(0, 3).map(r => r.parsedDate ? r.parsedDate.toISOString().split('T')[0] : 'failed'));
  });
});
