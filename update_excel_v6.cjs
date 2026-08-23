const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const studentFile = path.join(__dirname, 'public', 'Student records-20.xlsx');
if (!fs.existsSync(studentFile)) {
  console.error("Student records-20.xlsx not found!");
  process.exit(1);
}

const wb = xlsx.readFile(studentFile);
const bayAvenueData = xlsx.utils.sheet_to_json(wb.Sheets['bay avenue']);
const jltData = xlsx.utils.sheet_to_json(wb.Sheets['jlt']);

const studentUpdates = {
  'advait nittala': { coach: '   Ryan Cardelang  ', center: 'JLT', action: 'move' },
  'anya dhanani': { coach: '   Ryan Cardelang  ', center: 'JLT', action: 'move' },
  'ashwin d.nambiar': { coach: 'Brett Portuguese', center: 'JLT', action: 'move' },
  'aya elimi': { action: 'delete' },
  'finn lyndon': { coach: 'Brylle Arellano', center: 'JLT', action: 'move' },
  'kiyaan veer chopra': { coach: 'Brett Portuguese', center: 'JLT', action: 'move' },
  'noah dukhgan': { coach: '   Ryan Cardelang  ', center: 'JLT', action: 'move' },
  'reeva dhanani': { coach: '   Ryan Cardelang  ', center: 'JLT', action: 'move' },
  's.s, rudhresh': { coach: '   JOHN JOHN MENDOZA  ', center: 'Bay avenue mall', action: 'stay' }
};

const newBayAvenueData = [];
const movedRows = [];

bayAvenueData.forEach(row => {
  const name = String(row['Name'] || '').trim().toLowerCase();
  
  if (studentUpdates[name]) {
    const update = studentUpdates[name];
    if (update.action === 'delete') {
      console.log(`Deleting student: "${row['Name']}"`);
      return;
    }
    
    row['Assigned center'] = update.center;
    row['Coaches Details'] = update.coach;
    
    if (update.action === 'move') {
      console.log(`Moving student to JLT: "${row['Name']}" with Coach: "${update.coach}"`);
      movedRows.push(row);
    } else {
      console.log(`Keeping student in Bay Avenue: "${row['Name']}" with Coach: "${update.coach}"`);
      newBayAvenueData.push(row);
    }
  } else {
    newBayAvenueData.push(row);
  }
});

// Append moved rows to JLT sheet
jltData.push(...movedRows);

// Re-write sheets
const newBaySheet = xlsx.utils.json_to_sheet(newBayAvenueData);
const newJltSheet = xlsx.utils.json_to_sheet(jltData);

const newWb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(newWb, newBaySheet, 'bay avenue');
xlsx.utils.book_append_sheet(newWb, newJltSheet, 'jlt');

// Write workbook
xlsx.writeFile(newWb, studentFile);
console.log(`\nWorkbook updated successfully!`);
console.log(`New Bay Avenue sheet row count: ${newBayAvenueData.length}`);
console.log(`New JLT sheet row count: ${jltData.length}`);
