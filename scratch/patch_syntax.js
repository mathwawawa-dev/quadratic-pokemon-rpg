const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

const targetStr = `let terrainHeights = {};
let originalTerrainHeights = {};
let terrainBottoms = {};
    ceilHeights = {};
let ceilHeights = {};
let explosionRadius = 0.7; // 폭발 반경 (0.7로 축소)`;

const replaceStr = `let terrainHeights = {};
let originalTerrainHeights = {};
let terrainBottoms = {};
let ceilHeights = {};
let explosionRadius = 0.7; // 폭발 반경 (0.7로 축소)`;

code = code.replace(targetStr.replace(/\r\n/g, '\n'), replaceStr.replace(/\r\n/g, '\n'));
code = code.replace(targetStr, replaceStr);

fs.writeFileSync('js/engine.js', code);
console.log("Syntax error patched");
