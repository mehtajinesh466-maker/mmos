const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const files = [
  'Platform_Accuracy_Check_Jul2026.xlsx',
  'Student_Base_Review_Jul2026_1.xlsx',
  'The best overdue list_Master_Moves_Overdue_Report_Jul2026_1.xlsx',
  'Student records-7.xlsx'
];

files.forEach(f => {
  const p = path.join(publicDir, f);
  if (!fs.existsSync(p)) return;
  const wb = xlsx.readFile(p);
  console.log(`File: ${f}`);
  console.log(`  Sheets:`, wb.SheetNames);
  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    if (data.length > 0) {
      console.log(`    Sheet: "${sheetName}" | Rows: ${data.length}`);
      console.log(`      Keys:`, Object.keys(data[0]));
    }
  });
});
