const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

const targetStr = '    // 숨겨진 땅 포켓몬 근처';
const replaceStr = `        if (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) {
            if (ceilHeights[key] !== 1000 && ceilHeights[key] >= craterBottomY - 0.3 && ceilHeights[key] <= craterTopY) {
                ceilHeights[key] = Math.max(ceilHeights[key], craterTopY);
            }
        }
    // 숨겨진 땅 포켓몬 근처`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('js/engine.js', code);
    console.log("createCrater patched via script 3");
} else {
    console.log("Could not find targetStr");
}
