const fs = require('fs');

let maps = fs.readFileSync('js/maps.js', 'utf8');

// Replace cloud_garden2 entirely
const newCloudGarden2 = `    cloud_garden2: {
        name: "솜사탕(2)",
        bg: ["#0284c7", "#38bdf8", "#bae6fd"],
        color: "rgba(255, 228, 235, 0.95)",
        outColor: "rgba(244, 114, 182, 0.95)",
        deathZoneY: -25,
        islands3: null,
        init: function(seed) {
            const rnd = (min, max) => Math.random() * (max - min) + min;
            this.islands3 = {
                left:  { x0: -24, x1: -10, baseY: rnd(-1.0, 1.0)  },
                mid:   { x0:  -6, x1:   6, baseY: rnd( 2.0, 3.5)  },
                right: { x0:  10, x1:  24, baseY: rnd( 0.0, 1.5)  }
            };
        },
        func: function(x) {
            const isl = TERRAINS.cloud_garden2.islands3;
            if (!isl) return -100;
            let island = null;
            if (x >= isl.left.x0 - 0.1 && x <= isl.left.x1 + 0.1) island = isl.left;
            else if (x >= isl.mid.x0 - 0.1 && x <= isl.mid.x1 + 0.1) island = isl.mid;
            else if (x >= isl.right.x0 - 0.1 && x <= isl.right.x1 + 0.1) island = isl.right;
            if (!island) return -100;

            const { x0, x1, baseY } = island;
            const t = (x - (x0 + x1) / 2) / ((x1 - x0) / 2);
            const edgeFade = Math.cos(Math.max(-1, Math.min(1, t)) * Math.PI / 2.2);

            const bumps = Math.sin(x * 0.55) * 0.6 + Math.cos(x * 0.9 + 1.0) * 0.4;
            return (baseY + bumps) * edgeFade + (1 - edgeFade) * (baseY - 1.5);
        }
    },`;

// Find the start and end of cloud_garden2 in maps.js
const cg2Start = maps.indexOf('    cloud_garden2: {');
const cg2End = maps.indexOf('    },', cg2Start) + 6;
if (cg2Start !== -1 && cg2End !== -1) {
    maps = maps.slice(0, cg2Start) + newCloudGarden2 + maps.slice(cg2End);
}

fs.writeFileSync('js/maps.js', maps, 'utf8');

let eng = fs.readFileSync('js/engine.js', 'utf8');

// Combine buildTerrain block
eng = eng.replace(`} else if (stage.terrain === 'garden') {`, `} else if (stage.terrain === 'garden' || stage.terrain === 'cloud_garden2') {`);

// Remove buildTerrain cloud_garden2 block
const block1Old = `              } else if (stage.terrain === 'cloud_garden2') {\r
                  // sky와 동일한 단일 func 방식: 아래 두꺼운 섬층 (두께 5.5)\r
                  const roundedX = Math.round(x * 10) / 10;\r
                  if (y <= -99 || roundedX < -25 || roundedX > 25) {\r
                      terrainHeights[key] = [-100];\r
                      terrainBottoms[key] = [-100];\r
                  } else {\r
                      terrainHeights[key] = [y];\r
                      // 아래면: 두께 5.5 + 구불거리는 굴곡\r
                      const botBump = Math.sin(x * 0.18) * 0.2;\r
                      terrainBottoms[key] = [y - 5.5 + botBump];\r
                  }\r
              `;
const block1OldLF = block1Old.replace(/\\r\\n/g, '\\n');
eng = eng.replace(block1Old, '');
eng = eng.replace(block1OldLF, '');

// Also remove second variation just in case
const regexB1 = /\} else if \(stage\.terrain === 'cloud_garden2'\) \{[\s\S]*? terrainBottoms\[key\] = \[y - 5\.5 \+ botBump\];\s*\}\s*/;
eng = eng.replace(regexB1, '');

// Remove px assignment logic in cloud_garden2
const regexB2 = /\} else if \(stage\.terrain === 'cloud_garden2'\) \{\s*\/\/ 적 스폰 허용 중앙부 확장\s*px = -12 \+ Math\.random\(\) \* 24;\s*/;
eng = eng.replace(regexB2, '');

// In drawTerrain, change garden block
eng = eng.replace(`} else if (stage.terrain === 'garden') {`, `} else if (stage.terrain === 'garden' || stage.terrain === 'cloud_garden2') {`);

// Remove first cloud_garden2 draw block
const block3Old = `} else if (stage.terrain === 'cloud_garden2') {\r
        const cloudStartX = -25;\r
        const cloudEndX = 25;\r
        \r
        let targetCtx = ctx;\r
        let craterCanvas = null;\r
        if (typeof craters !== 'undefined' && craters.length > 0) {\r
            const cc = getCraterCanvas(canvas.width, canvas.height);\r
            craterCanvas = cc.canvas; targetCtx = cc.ctx;\r
        }\r
\r
        const getOrigY = (x) => {\r
            const key = (Math.round(x * 10) / 10).toFixed(1);\r
            return (originalTerrainHeights[key] && originalTerrainHeights[key].length > 0) ? originalTerrainHeights[key][0] : -100;\r
        };\r
        const getBotY = (x) => {\r
            const key = (Math.round(x * 10) / 10).toFixed(1);\r
            return (terrainBottoms[key] && terrainBottoms[key].length > 0) ? terrainBottoms[key][0] : -100;\r
        };\r
\r
        // 탑라인 그림자: 두 겹 렌더링으로 솜사탕 부피감 형성\r
        targetCtx.beginPath();\r
        let startP = gridToScreen(cloudStartX, getOrigY(cloudStartX) - 1.5);\r
        targetCtx.moveTo(startP.x, startP.y);\r
        for (let x = cloudStartX; x <= cloudEndX; x += 0.2) {\r
            const p = gridToScreen(x, getOrigY(x) - 1.5);\r
            targetCtx.lineTo(p.x, p.y);\r
        }\r
        targetCtx.lineWidth = 15;\r
        targetCtx.strokeStyle = 'rgba(255,192,203,0.3)';\r
        targetCtx.lineJoin = 'round';\r
        targetCtx.stroke();\r
\r
        // 메인 폴리곤 (상단 func ~ 하단 terrainBottoms)\r
        targetCtx.beginPath();\r
        startP = gridToScreen(cloudStartX, getOrigY(cloudStartX));\r
        targetCtx.moveTo(startP.x, startP.y);\r
        for (let x = cloudStartX; x <= cloudEndX; x += 0.2) {\r
            const p = gridToScreen(x, getOrigY(x));\r
            targetCtx.lineTo(p.x, p.y);\r
        }\r
        // 우측 둥근 캡\r
        const rtTop = getOrigY(cloudEndX);\r
        const rtBot = getBotY(cloudEndX);\r
        const rightMidP = gridToScreen(cloudEndX + 2.0, (rtTop + rtBot) / 2);\r
        const rightBotP = gridToScreen(cloudEndX, rtBot);\r
        targetCtx.quadraticCurveTo(rightMidP.x, rightMidP.y, rightBotP.x, rightBotP.y);\r
\r
        // 하단면\r
        for (let x = cloudEndX; x >= cloudStartX; x -= 0.2) {\r
            const p = gridToScreen(x, getBotY(x));\r
            targetCtx.lineTo(p.x, p.y);\r
        }\r
\r
        // 좌측 둥근 캡\r
        const ltTop = getOrigY(cloudStartX);\r
        const ltBot = getBotY(cloudStartX);\r
        const leftMidP = gridToScreen(cloudStartX - 2.0, (ltTop + ltBot) / 2);\r
        const leftTopP = gridToScreen(cloudStartX, ltTop);\r
        targetCtx.quadraticCurveTo(leftMidP.x, leftMidP.y, leftTopP.x, leftTopP.y);\r
\r
        targetCtx.closePath();\r
        targetCtx.fillStyle = tData.color;\r
        targetCtx.fill();\r
        targetCtx.strokeStyle = tData.outColor;\r
        targetCtx.lineWidth = 3;\r
        targetCtx.stroke();\r
\r
        if (craterCanvas) {\r
            targetCtx.globalCompositeOperation = 'destination-out';\r
            for (const crater of craters) {\r
                const p = gridToScreen(crater.x, crater.y);\r
                const pr = scaleLength(crater.r);\r
                targetCtx.beginPath();\r
                targetCtx.arc(p.x, p.y, pr, 0, Math.PI * 2);\r
                targetCtx.fill();\r
            }\r
            targetCtx.globalCompositeOperation = 'source-over';\r
            ctx.drawImage(craterCanvas, 0, 0);\r
        }\r
    }`;
const block3Regex = /\} else if \(stage\.terrain === 'cloud_garden2'\) \{[\s\S]*?ctx\.drawImage\(craterCanvas, 0, 0\);\s*\}\s*\}/g;
eng = eng.replace(block3Regex, '');

// Remove second cloud_garden2 draw block
const block4Regex = /\} else if \(stage\.terrain === 'cloud_garden2'\) \{[\s\S]*?ctx\.drawImage\(craterCanvas, 0, 0\);\s*\}\s*\}/g;
eng = eng.replace(block4Regex, '');

fs.writeFileSync('js/engine.js', eng, 'utf8');
console.log('Fixed cloud_garden2 lag and bug');
