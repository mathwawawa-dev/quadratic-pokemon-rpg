const fs = require('fs');
let code = fs.readFileSync('js/engine.js','utf8');
let start = code.indexOf("    } else if (stage.terrain === 'log_bridge') {");
let end = code.indexOf("    } else {", start);
if(start !== -1 && end !== -1) {
    let block = code.substring(start, end);
    const craterRegex = /if \(typeof craters !== 'undefined' && craters\.length > 0\) \{[\s\S]*?ctx\.drawImage\(offCanvasGround, 0, 0\);/;
    const newCraterLogic = `if (craterCanvas) {
            targetCtx.globalCompositeOperation = 'destination-out';
            for (const crater of craters) {
                const p = gridToScreen(crater.x, crater.y);
                const pr = scaleLength(crater.r);
                targetCtx.beginPath();
                targetCtx.arc(p.x, p.y, pr, 0, Math.PI * 2);
                targetCtx.fill();
            }
            targetCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(craterCanvas, 0, 0);
        }`;
    block = block.replace(craterRegex, newCraterLogic);
    code = code.substring(0, start) + block + code.substring(end);
    fs.writeFileSync('js/engine.js', code);
    console.log("Replaced crater logic");
} else {
    console.log("Could not find start/end", start, end);
}
