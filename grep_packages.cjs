const fs = require('fs');
const content = fs.readFileSync('src/components/Packages.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('family') || line.toLowerCase().includes('sibling')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
