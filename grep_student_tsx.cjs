const fs = require('fs');
const content = fs.readFileSync('src/components/Students.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('family')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
