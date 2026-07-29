const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const publicDir = 'c:\\Users\\jinesh mehta\\Downloads\\master-moves-os\\public';
const studentFile = path.join(publicDir, 'student information.xlsx');
const packageFile = path.join(publicDir, 'All Student Packages-8.xlsx');

const studentWorkbook = xlsx.readFile(studentFile);
const studentData = xlsx.utils.sheet_to_json(studentWorkbook.Sheets[studentWorkbook.SheetNames[0]]);

const packageWorkbook = xlsx.readFile(packageFile);
const packageData = xlsx.utils.sheet_to_json(packageWorkbook.Sheets[packageWorkbook.SheetNames[0]]);

const cleanName = (name) => {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
};

const studentMap = new Map();
const studentNameMap = new Map();

studentData.forEach((row, idx) => {
  const name = String(row['Name'] || '').trim();
  if (!name) return;
  const sId = `STUDENT_${idx}`;
  const refId = row['Student Id'] ? String(row['Student Id']).trim() : `MM-${1000 + idx}`;
  studentMap.set(refId.toLowerCase(), sId);
  studentNameMap.set(cleanName(name), sId);
});

const findStudentId = (ref, name) => {
  const clean = cleanName(name);
  if (clean && studentNameMap.has(clean)) {
    return studentNameMap.get(clean);
  }
  if (ref && studentMap.has(ref.trim().toLowerCase())) {
    return studentMap.get(ref.trim().toLowerCase());
  }
  return null;
};

const unmatched = new Map();

packageData.forEach(row => {
  const name = String(row['Student'] || '').trim();
  if (!name) return;
  const ref = row['Student Id'] ? String(row['Student Id']).trim() : '';
  const studentId = findStudentId(ref, name);
  if (!studentId) {
    unmatched.set(cleanName(name), { name, ref });
  }
});

console.log('Total unmatched student names in packages sheet:', unmatched.size);
console.log('Sample unmatched names:');
const keys = Array.from(unmatched.keys());
keys.slice(0, 30).forEach(k => {
  const info = unmatched.get(k);
  console.log(`  Name: "${info.name}" | Ref: "${info.ref}"`);
});
