const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const studentFile = path.join(publicDir, 'student information.xlsx');
const packageFile = path.join(publicDir, 'All Student Packages-8.xlsx');
const attendanceFile = path.join(publicDir, 'All Attendance Records-5.xlsx');

const studentWorkbook = xlsx.readFile(studentFile);
const studentData = xlsx.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]]);

const packageWorkbook = xlsx.readFile(packageFile);
const packageData = xlsx.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]]);

const attendanceWorkbook = xlsx.readFile(attendanceFile);
const attendanceData = xlsx.utils.sheet_to_json(attendanceWorkbook.Sheets[attendanceWorkbook.SheetNames[0]]);

const cleanName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const studentMap = new Map();
const studentNameMap = new Map();
const studentIdToName = new Map();

studentData.forEach((row, idx) => {
  const name = String(row['Name'] || '').trim();
  if (!name) return;
  const sId = `STUDENT_${idx}`;
  const refId = row['Student Id'] ? String(row['Student Id']).trim() : `MM-${1000 + idx}`;
  studentMap.set(refId.toLowerCase(), sId);
  studentNameMap.set(cleanName(name), sId);
  studentIdToName.set(sId, name);
});

// Compare mapping strategies
packageData.forEach((row, idx) => {
  const studentName = String(row['Student'] || '').trim();
  if (!studentName) return;
  const ref = row['Student Id'] ? String(row['Student Id']).trim() : '';
  
  const idByRef = ref && studentMap.has(ref.toLowerCase()) ? studentMap.get(ref.toLowerCase()) : null;
  const idByName = studentNameMap.has(cleanName(studentName)) ? studentNameMap.get(cleanName(studentName)) : null;
  
  if (idByRef && idByName && idByRef !== idByName) {
    console.log(`Mismatch on package row ${idx + 2}:`);
    console.log(`  Package Student: "${studentName}", Ref: "${ref}"`);
    console.log(`  By Ref Maps To: "${studentIdToName.get(idByRef)}"`);
    console.log(`  By Name Maps To: "${studentIdToName.get(idByName)}"`);
  }
});
