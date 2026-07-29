const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const file = path.join(publicDir, 'The best overdue list_Master_Moves_Overdue_Report_Jul2026_1.xlsx');

const wb = xlsx.readFile(file);
const timelineData = xlsx.utils.sheet_to_json(wb.Sheets['Package Timeline'], { range: 3 });

let sumRealPrices = 0;
let realCount = 0;
let skipped = [];

timelineData.forEach((row, idx) => {
  const studentName = String(row['Student Name'] || '').trim();
  if (!studentName) return;
  
  // Skip if Pkg # is missing or not a number
  const pkgNum = row['Pkg #'];
  if (pkgNum === undefined || pkgNum === null || isNaN(Number(pkgNum))) {
    skipped.push({ studentName, pkgNum, price: row['Price (AED)'] });
    return;
  }
  
  const price = Number(row['Price (AED)']) || 0;
  sumRealPrices += price;
  realCount++;
});

console.log('Total real packages:', realCount);
console.log('Sum of real packages:', sumRealPrices);
console.log('First 10 skipped items:');
skipped.slice(0, 10).forEach(item => console.log(item));
