const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.xlsx'));

const searchNames = ['sheikh', 'sholi', 'bodhi'];

console.log("=== SEARCHING SPECIFICALLY FOR SHEIKH, SHOLI, BODHI ===");

files.forEach(file => {
  const filePath = path.join(publicDir, file);
  try {
    const wb = xlsx.readFile(filePath);
    wb.SheetNames.forEach(sheetName => {
      let data = [];
      try {
        data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
      } catch (e) {}

      data.forEach((row, idx) => {
        const rowStr = JSON.stringify(row).toLowerCase();
        
        searchNames.forEach(target => {
          if (rowStr.includes(target)) {
            console.log(`Match: "${target}" | File: "${file}" | Sheet: "${sheetName}" | Row: ${idx + 2}`);
            console.log(`  Details:`, row);
            console.log(`----------------------------------------`);
          }
        });
      });
    });
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
});
