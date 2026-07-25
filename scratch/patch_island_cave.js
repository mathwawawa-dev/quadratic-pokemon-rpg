const fs = require('fs');

// --- 1. maps.js ---
let maps = fs.readFileSync('js/maps.js', 'utf8');

// replace cave map
maps = maps.replace(
    /cave: \{[\s\S]*?ceilFunc:[\s\S]*?\}[\s\S]*?\},/,
    `cave: {
        name: "어두운 동굴",
        bg: ["#0d0d0d", "#262626", "#404040"],
        color: "#595959", outColor: "#0d0d0d",
        func: (x) => Math.sin((x + terrainSeed) / 4) * Math.cos((x - terrainSeed) / 2) * 3 - 2,
        init: function(seed) {
            this.islands = [[], []]; // 천장 바위 레이어
            
            const addRock = (layer, x, y, rx, ry) => {
                this.islands[layer].push({ type: 'ellipse', cx: x, cy: y, rx: rx, ry: ry, rot: 0 });
            };

            // 1. 최상단 두꺼운 천장 기반암 (빈틈없이 덮음)
            for(let x = -45; x <= 45; x += 3.5) {
                addRock(0, x, 32, 4.5, 3.5 + Math.random() * 1.5);
            }
            
            // 2. 아래로 뻗어나오는 뾰족한 종유석들
            for(let x = -38; x <= 38; x += (4 + Math.random() * 4)) {
                addRock(1, x, 24 + Math.random() * 4, 1.5 + Math.random() * 1.5, 5 + Math.random() * 4);
                // 약간 겹치는 중간 바위
                if (Math.random() > 0.4) {
                    addRock(1, x + (Math.random()-0.5)*2, 28, 2.5, 2.5);
                }
            }
        }
    },`
);

fs.writeFileSync('js/maps.js', maps);

// --- 2. engine.js ---
let engine = fs.readFileSync('js/engine.js', 'utf8');

// Remove original cave ceiling code in updateGame
engine = engine.replace(
    /\/\/ 어두운 동굴 맵: 천장 충돌 OUT 판정[\s\S]*?return;\n                \}\n            \}/,
    `// 동굴 천장(islands) 충돌 처리는 아래 islands 루프에서 자동으로 해결됨`
);

// Remove cave ceiling overlay in render
engine = engine.replace(
    /\/\/ Cave ceiling\/wall overlay \(동굴 외벽 렌더링\)[\s\S]*?\/\/ Terrain polygon/,
    `// Terrain polygon`
);

// updateGame collision logic: check BOTH islands and solid floor
engine = engine.replace(
    /\} else \{\n\s*const key = \(Math\.round\(tx \* 10\)/,
    `}\n                if (!insideTerrain && (tData.func || tData.layers)) {\n                    const key = (Math.round(tx * 10)`
);

// render logic: render BOTH islands and solid floor
engine = engine.replace(
    /ctx\.drawImage\(islandCanvas, 0, 0\);\n        \} else \{\n\s*for \(let l = 0; l < numLayers; l\+\+\) \{/,
    `ctx.drawImage(islandCanvas, 0, 0);\n        }\n\n        if (tData.func || tData.layers) {\n            for (let l = 0; l < numLayers; l++) {`
);

fs.writeFileSync('js/engine.js', engine);

console.log('Patched engine and maps successfully!');
