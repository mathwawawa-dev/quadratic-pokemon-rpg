const fs = require('fs');
let eng = fs.readFileSync('js/engine.js', 'utf8');

// Find all start indices for cloud_garden2 blocks
const block1Start = eng.indexOf(`} else if (stage.terrain === 'cloud_garden2') {`);
let block1End = -1;
if (block1Start !== -1) {
    block1End = eng.indexOf(`    } else if (stage.terrain === 'space') {`, block1Start);
    if (block1End === -1) {
        block1End = eng.indexOf(`    } else {`, block1Start);
    }
}

let eng2 = eng;
if (block1Start !== -1 && block1End !== -1) {
    eng2 = eng.slice(0, block1Start) + eng.slice(block1End);
}

// Find second block if it exists
const block2Start = eng2.indexOf(`} else if (stage.terrain === 'cloud_garden2') {`);
let block2End = -1;
if (block2Start !== -1) {
    block2End = eng2.indexOf(`    } else if (stage.terrain === 'space') {`, block2Start);
    if (block2End === -1) {
        block2End = eng2.indexOf(`    } else {`, block2Start);
    }
    if (block2End !== -1) {
        eng2 = eng2.slice(0, block2Start) + eng2.slice(block2End);
    }
}

fs.writeFileSync('js/engine.js', eng2, 'utf8');
console.log('Fixed drawTerrain in engine.js');
