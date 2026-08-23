const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const scheduleFile = path.join(__dirname, 'public', 'JLT coach schedules.xlsx');
const wb = xlsx.readFile(scheduleFile);

wb.SheetNames.forEach(sheetName => {
  const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
  data.forEach((row, idx) => {
    const name = String(row['Name'] || '').toLowerCase();
    if (name.includes('ashwin')) {
      console.log(`Found in JLT Schedule sheet "${sheetName}" (Row ${idx + 2}):`, row);
    }
  });
});
