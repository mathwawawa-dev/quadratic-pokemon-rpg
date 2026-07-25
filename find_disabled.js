const fs = require('fs');
const code = fs.readFileSync('js/engine.js', 'utf8');
const lines = code.split('\n');

lines.forEach((line, i) => {
  if (line.includes('disabled') || line.includes("GAME_STATE = 'IDLE'")) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
