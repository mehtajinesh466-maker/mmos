const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('public/MMCC_Siblings_Data_Brief.xlsx');
let out = '';

workbook.SheetNames.forEach((name) => {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  out += `### Sheet: ${name}\n\n`;
  
  // Show up to first 30 rows
  const rowsToShow = data.slice(0, 30);
  rowsToShow.forEach(row => {
    out += `| ${row.map(val => val !== undefined && val !== null ? String(val).replace(/\n/g, ' ') : '').join(' | ')} |\n`;
  });
  out += '\n\n';
});

fs.writeFileSync('xlsx_details.txt', out);
console.log("Done");
