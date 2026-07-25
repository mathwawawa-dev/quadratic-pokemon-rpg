const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

// 1. updateGame collision
code = code.replace(
    /\} else \{\n\s*const key = \(Math\.round\(tx \* 10\) \/ 10\)\.toFixed\(1\);/g,
    `} \n                if (!insideTerrain && (tData.func || tData.layers)) {\n                    const key = (Math.round(tx * 10) / 10).toFixed(1);`
);

// 2. render logic
code = code.replace(
    /ctx\.drawImage\(islandCanvas, 0, 0\);\n\s*\} else \{\n\s*for \(let l = 0; l < numLayers; l\+\+\) \{/g,
    `ctx.drawImage(islandCanvas, 0, 0);\n        }\n\n        if (tData.func || tData.layers) {\n            for (let l = 0; l < numLayers; l++) {`
);

fs.writeFileSync('js/engine.js', code);
console.log('Patched engine.js');
