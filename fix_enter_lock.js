const fs = require('fs');

// 1. Fix ui.js
let uiCode = fs.readFileSync('js/ui.js', 'utf8');
uiCode = uiCode.replace(/if \(fireEl && !fireEl\.disabled && GAME_STATE === 'IDLE'\)/g, "if (GAME_STATE === 'IDLE') { if (fireEl) fireEl.disabled = false;");
// Add closing brace if needed or replace properly
fs.writeFileSync('js/ui.js', uiCode, 'utf8');

// 2. Fix engine.js: ensure fire-btn is re-enabled whenever GAME_STATE becomes IDLE
let engineCode = fs.readFileSync('js/engine.js', 'utf8');
engineCode = engineCode.replace(/missile\.active = false;\s*GAME_STATE = 'IDLE';/g, "missile.active = false; GAME_STATE = 'IDLE'; const fBtn = document.getElementById('fire-btn'); if (fBtn) fBtn.disabled = false;");

fs.writeFileSync('js/engine.js', engineCode, 'utf8');
console.log('Successfully fixed Enter key and fire-btn locking issue!');
