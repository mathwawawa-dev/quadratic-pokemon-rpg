const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

// 1. Update collision logic in updateGame
const updateGameCollisionTarget = `                } else {
                    const key = (Math.round(tx * 10) / 10).toFixed(1);
                    const origYs = originalTerrainHeights[key] || [];`;
const updateGameCollisionReplacement = `                } else {
                    const key = (Math.round(tx * 10) / 10).toFixed(1);
                    
                    if (tData.hasCaveWall && typeof ceilHeights !== 'undefined') {
                        if (ceilHeights[key] !== undefined) {
                            if (ty >= ceilHeights[key]) { insideTerrain = true; break; }
                        } else if (tData.ceilFunc) {
                            if (ty >= tData.ceilFunc(tx)) { insideTerrain = true; break; }
                        }
                    }

                    const origYs = originalTerrainHeights[key] || [];`;

code = code.replace(updateGameCollisionTarget, updateGameCollisionReplacement);


// 2. Update crater destruction logic in createCrater
const craterTarget = `        for (let i = 0; i < terrainHeights[key].length; i++) {
            const y = terrainHeights[key][i];
            // 폭발 구체 범위(craterBottomY ~ craterTopY) 내에 위치한 표면 지형만 파괴되도록 정밀 검증 (상단 천장 언덕 유지를 통해 순간이동 슬라이딩 버그 예방)
            if (y !== -100 && y >= craterBottomY && y <= craterTopY + 0.3) {
                terrainHeights[key][i] = Math.min(y, craterBottomY);
                if (isFloating || stage.terrain === 'sky') {
                    if (terrainBottoms[key] && terrainHeights[key][i] < terrainBottoms[key][i]) {
                        terrainHeights[key][i] = -100;
                    }
                }
            }
        }`;

const craterReplacement = `        for (let i = 0; i < terrainHeights[key].length; i++) {
            const y = terrainHeights[key][i];
            // 폭발 구체 범위(craterBottomY ~ craterTopY) 내에 위치한 표면 지형만 파괴되도록 정밀 검증 (상단 천장 언덕 유지를 통해 순간이동 슬라이딩 버그 예방)
            if (y !== -100 && y >= craterBottomY && y <= craterTopY + 0.3) {
                terrainHeights[key][i] = Math.min(y, craterBottomY);
                if (isFloating || stage.terrain === 'sky') {
                    if (terrainBottoms[key] && terrainHeights[key][i] < terrainBottoms[key][i]) {
                        terrainHeights[key][i] = -100;
                    }
                }
            }
        }
        
        if (TERRAINS[stage.terrain].hasCaveWall && typeof ceilHeights !== 'undefined') {
            if (ceilHeights[key] === undefined && TERRAINS[stage.terrain].ceilFunc) {
                ceilHeights[key] = TERRAINS[stage.terrain].ceilFunc(x);
            }
            if (ceilHeights[key] !== undefined) {
                if (ceilHeights[key] <= craterTopY && ceilHeights[key] >= craterBottomY - 0.3) {
                    ceilHeights[key] = Math.max(ceilHeights[key], craterTopY);
                    
                    if (Math.random() < 0.6 && typeof effects !== 'undefined') {
                        effects.push({
                            type: 'rock',
                            x: x + (Math.random()-0.5)*0.5,
                            y: craterTopY,
                            vx: (Math.random()-0.5)*2,
                            vy: -Math.random()*2,
                            life: 40 + Math.random()*20,
                            maxLife: 60,
                            size: 0.15 + Math.random()*0.15,
                            color: Math.random() < 0.5 ? '#595959' : '#404040'
                        });
                    }
                }
            }
        }`;

code = code.replace(craterTarget, craterReplacement);

fs.writeFileSync('js/engine.js', code);
console.log("Collision and crater logic patched successfully.");
