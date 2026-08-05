const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jinesh mehta\\Downloads';
const files = fs.readdirSync(dir);
const matches = files.filter(f => f.toLowerCase().includes('siblings') || f.toLowerCase().includes('mmcc'));
console.log("Matches found:", matches);
