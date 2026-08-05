const XLSX = require('xlsx');
const workbook = XLSX.readFile('public/MMCC_Siblings_Data_Brief.xlsx');
const sheet = workbook.Sheets['2. Families'];
const data = XLSX.utils.sheet_to_json(sheet);
console.log("Total rows:", data.length);
console.log("Headers:", Object.keys(data[0] || {}));
console.log("Row 0:", data[0]);
console.log("Row 1:", data[1]);
console.log("Row 2:", data[2]);
