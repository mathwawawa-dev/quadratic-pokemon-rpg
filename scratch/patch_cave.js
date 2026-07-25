const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

// 1. Declare let ceilHeights
code = code.replace(
    'let terrainBottoms = {};',
    'let terrainBottoms = {};\nlet ceilHeights = {};'
);

// 2. Initialize in initStage
code = code.replace(
    '    terrainBottoms = {};\n    terrainSpikes = [];',
    '    terrainBottoms = {};\n    ceilHeights = {};\n    terrainSpikes = [];'
);

// 3. Populate in initStage
code = code.replace(
    /        originalTerrainHeights\[key\] = \[\.\.\.terrainHeights\[key\]\];\n    \}/,
    '        originalTerrainHeights[key] = [...terrainHeights[key]];\n        if (tData.ceilFunc) ceilHeights[key] = tData.ceilFunc(x);\n    }'
);

// 4. Update createCrater
const craterPatch = `
    }
    
    // 천장 파괴 및 파편 이펙트 추가
    if (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) {
        if (ceilHeights[key] !== 1000 && ceilHeights[key] >= craterBottomY - 0.3 && ceilHeights[key] <= craterTopY) {
            ceilHeights[key] = Math.max(ceilHeights[key], craterTopY);
            
            // 파편 파티클 이펙트 (폭발 반경이 천장에 닿았을 때)
            if (Math.random() > 0.4) {
                effects.push({
                    type: 'rock',
                    x: cx + (Math.random() - 0.5) * radius * 1.5,
                    y: ceilHeights[key] - Math.random() * 0.5,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: -Math.random() * 0.3,
                    life: 40 + Math.random() * 20,
                    maxLife: 60,
                    size: 0.1 + Math.random() * 0.3
                });
            }
        }
    }
`;
code = code.replace(
    /                terrainHeights\[key\]\[i\] = Math\.max\(terrainHeights\[key\]\[i\], craterTopY\);\n            \}\n        \}\n    \}/,
    '                terrainHeights[key][i] = Math.max(terrainHeights[key][i], craterTopY);\n            }\n        }\n    }' + craterPatch
);

// 5. Update updateGame collision
const collisionPatch = `
                if (!insideTerrain && typeof ceilHeights !== 'undefined') {
                    const key = (Math.round(tx * 10) / 10).toFixed(1);
                    if (ceilHeights[key] !== undefined && ty >= ceilHeights[key]) {
                        insideTerrain = true;
                    }
                }
                
                if (!insideTerrain && (tData.func || tData.layers)) {`;
code = code.replace(
    '                if (!insideTerrain && (tData.func || tData.layers)) {',
    collisionPatch
);

// 6. Update render cave
const caveRenderRegex = /(if \(tData\.hasCaveWall && tData\.ceilFunc\) \{\s*const caveMinX = -25, caveMaxX = 25;)/;
const caveRenderPatch = `
    const getCeilY = (x) => {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        return (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) ? ceilHeights[key] : (tData.ceilFunc ? tData.ceilFunc(x) : 1000);
    };
    $1`;
code = code.replace(caveRenderRegex, caveRenderPatch);
code = code.replace(/tData\.ceilFunc\(/g, 'getCeilY(');


// 7. Update effects rendering for 'rock' particles
const rockEffectRenderPatch = `
        } else if (e.type === 'rock') {
            const p = gridToScreen(e.x, e.y);
            const r = scaleLength(e.size || 0.2);
            ctx.fillStyle = 'rgba(80, 70, 70, ' + (e.life / (e.maxLife || 60)) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            
            // 물리 효과 (중력 적용)
            e.vy -= 0.02; // 중력
            e.x += e.vx;
            e.y += e.vy;
            
            // 회전은 그리기 단순화를 위해 생략
        } else if (e.type === 'shield') {`;

code = code.replace(
    /        \} else if \(e\.type === 'shield'\) \{/,
    rockEffectRenderPatch
);


fs.writeFileSync('js/engine.js', code);
console.log("engine.js patched successfully");
