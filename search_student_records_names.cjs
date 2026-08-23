const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const studentFile = path.join(__dirname, 'public', 'Student records-20.xlsx');
const wb = xlsx.readFile(studentFile);

wb.SheetNames.forEach(sheetName => {
  const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
  data.forEach(row => {
    const name = String(row['Name'] || '').toLowerCase();
    if (name.includes('aryaveer')) {
      console.log(`Found in sheet "${sheetName}":`, row);
    }
  });
});
