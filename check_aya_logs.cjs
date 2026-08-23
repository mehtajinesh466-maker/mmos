const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const pkgFile = path.join(publicDir, 'All Student Packages-24.xlsx');
const attFile = path.join(publicDir, 'All Attendance Records-18.xlsx');

const searchNames = ['aya elimi'];

const searchInFile = (file) => {
  const wb = xlsx.readFile(file);
  console.log(`Scanning ${path.basename(file)}:`);
  wb.SheetNames.forEach(sheet => {
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet]);
    data.forEach((row, idx) => {
      const rowStr = JSON.stringify(row).toLowerCase();
      searchNames.forEach(name => {
        if (rowStr.includes(name)) {
          console.log(`  Found "${name}" in Row ${idx + 2}:`, row);
        }
      });
    });
  });
};

if (fs.existsSync(pkgFile)) searchInFile(pkgFile);
if (fs.existsSync(attFile)) searchInFile(attFile);
