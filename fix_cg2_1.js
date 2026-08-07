const fs = require('fs');

let eng = fs.readFileSync('js/engine.js', 'utf8');

const r1 = `} else if (stage.terrain === 'garden') {`;
const r2 = `} else if (stage.terrain === 'garden' || stage.terrain === 'cloud_garden2') {`;

eng = eng.split(r1).join(r2);

const r3 = `} else if (stage.terrain === 'cloud_garden2') {\r
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
              }`;

let block1 = r3;
if (eng.includes(block1)) {
    eng = eng.replace(block1, '');
} else {
    block1 = block1.replace(/\r\n/g, '\n');
    eng = eng.replace(block1, '');
}

const r4 = `} else if (stage.terrain === 'cloud_garden2') {\r
            // 적 스폰 허용 중앙부 확장\r
            px = -12 + Math.random() * 24;\r
        }`;
let block2 = r4;
if (eng.includes(block2)) {
    eng = eng.replace(block2, '');
} else {
    block2 = block2.replace(/\r\n/g, '\n');
    eng = eng.replace(block2, '');
}

fs.writeFileSync('js/engine.js', eng, 'utf8');
console.log('Fixed buildTerrain logic in engine.js');
