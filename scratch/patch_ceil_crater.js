const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

// 1. Add ceilHeights to globals
code = code.replace(/let terrainBottoms = \{\};/, 'let terrainBottoms = {};\nlet ceilHeights = {};');

// 2. Initialize in initStage
code = code.replace(/terrainBottoms = \{\};/, 'terrainBottoms = {};\n    ceilHeights = {};');

// 3. Populate in initStage (inside the x loop, before closing brace)
// The x loop ends with:
//               }
//           }
//       }
//   }
//   // === 구름정원 ...
const initLoopEndRegex = /^\s*\}\n\s*\}\n\s*\/\/\s*===\s*구름정원/m;
if (initLoopEndRegex.test(code)) {
    code = code.replace(initLoopEndRegex, `        if (tData.ceilFunc) {\n            ceilHeights[key] = tData.ceilFunc(x);\n        }\n    }\n\n    // === 구름정원`);
} else {
    // try another way to find end of x loop
    code = code.replace(/if \(tData\.func\) terrainHeights\[key\] = \[tData\.func\(x\)\];\n\s*\}/g, 
        `if (tData.func) terrainHeights[key] = [tData.func(x)];\n            }\n            if (tData.ceilFunc) ceilHeights[key] = tData.ceilFunc(x);\n        }`);
}

// 4. Update createCrater
code = code.replace(/if \(y !== -100 && y >= craterBottomY && y <= craterTopY \+ 0\.3\) \{/, 
`if (y !== -100 && y >= craterBottomY && y <= craterTopY + 0.3) {`);

const craterEndRegex = /terrainHeights\[key\]\[i\] = -100;\n\s*\}\n\s*\}\n\s*\}\n\s*\}/;
code = code.replace(craterEndRegex, `terrainHeights[key][i] = -100;\n                    }\n                }\n            }\n        }\n        if (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) {\n            if (ceilHeights[key] >= craterBottomY - 0.3 && ceilHeights[key] <= craterTopY) {\n                ceilHeights[key] = Math.max(ceilHeights[key], craterTopY);\n            }\n        }\n`);

// 5. Update updateGame collision
code = code.replace(/if \(tData\.ceilFunc\) \{\n\s*if \(ty >= tData\.ceilFunc\(tx\)\) \{\n\s*insideTerrain = true;\n\s*\}\n\s*\}/, 
`if (typeof ceilHeights !== 'undefined') {
                        const key = (Math.round(tx * 10) / 10).toFixed(1);
                        if (ceilHeights[key] !== undefined && ty >= ceilHeights[key]) {
                            insideTerrain = true;
                        }
                    }`);

// 6. Update render cave
code = code.replace(/tData\.ceilFunc/g, 'getCeilY');
code = code.replace(/if \(tData\.hasCaveWall && getCeilY\) \{/g, `
    const getCeilY = (x) => {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        return (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) ? ceilHeights[key] : (tData.ceilFunc ? tData.ceilFunc(x) : 1000);
    };
    if (tData.hasCaveWall && tData.ceilFunc) {`);
code = code.replace(/x \+= 0\.4/g, 'x += 0.2');
code = code.replace(/x -= 0\.4/g, 'x -= 0.2');

fs.writeFileSync('js/engine.js', code);
console.log('Patched engine.js');
