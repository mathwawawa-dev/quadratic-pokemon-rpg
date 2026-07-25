const fs = require('fs');
const code = fs.readFileSync('js/engine.js', 'utf8');
const lines = code.split('\n');

for (let i = 740; i <= 845; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
