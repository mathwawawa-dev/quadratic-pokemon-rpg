const fs = require('fs');
const code = fs.readFileSync('js/ui.js', 'utf8');
const lines = code.split('\n');

for (let i = 245; i < 265; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
