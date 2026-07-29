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

console.log('--- student information.xlsx match for Veer Bajaj ---');
console.log(studentData.filter(s => s.Name && s.Name.toLowerCase().includes('veer bajaj')));

console.log('--- All Student Packages-8.xlsx match for Veer Bajaj ---');
console.log(packageData.filter(p => p.Student && p.Student.toLowerCase().includes('veer bajaj')));

console.log('--- student information.xlsx match for Joschua ---');
console.log(studentData.filter(s => s.Name && s.Name.toLowerCase().includes('joschua')));

console.log('--- All Student Packages-8.xlsx match for Joschua ---');
console.log(packageData.filter(p => p.Student && p.Student.toLowerCase().includes('joschua')));
