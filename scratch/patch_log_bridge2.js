const fs = require('fs');
let code = fs.readFileSync('js/engine.js','utf8');
const startIdx = code.indexOf("else if (stage.terrain === 'log_bridge') {");
const endIdx = code.indexOf("} else {", startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let block = code.substring(startIdx, endIdx);
    
    // Replace context fetch
    block = block.replace(
        "        const { offCanvasGround, offCtxGround } = getSharedTerrainCtx();", 
        "        let targetCtx = ctx;\n        let craterCanvas = null;\n        if (typeof craters !== 'undefined' && craters.length > 0) {\n            craterCanvas = document.createElement('canvas');\n            craterCanvas.width = canvas.width;\n            craterCanvas.height = canvas.height;\n            targetCtx = craterCanvas.getContext('2d');\n        }"
    );
    
    // Replace all offCtxGround with targetCtx
    block = block.replace(/offCtxGround/g, 'targetCtx');
    
    // Replace crater logic and drawImage
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
    
    code = code.substring(0, startIdx) + block + code.substring(endIdx);
    fs.writeFileSync('js/engine.js', code);
    console.log("Patched log_bridge successfully!");
} else {
    console.log("Could not find block", startIdx, endIdx);
}
