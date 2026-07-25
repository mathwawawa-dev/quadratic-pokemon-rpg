const fs = require('fs');
const path = require('path');

const files = ['index.html', 'js/engine.js', 'js/ui.js', 'js/data.js'];

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('?') && (line.includes("'") || line.includes('"') || line.includes('`') || line.includes('>'))) {
      // Print line if it has ? inside quotes or HTML tags
      console.log(`${file}:${i+1}: ${line.trim()}`);
    }
  });
});
