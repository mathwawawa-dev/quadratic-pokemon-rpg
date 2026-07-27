const fs = require('fs');
let code = fs.readFileSync('js/engine.js','utf8');

// Find the log_bridge section
const startIdx = code.indexOf("else if (stage.terrain === 'log_bridge') {");
const endIdx = code.indexOf("} else {", startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let block = code.substring(startIdx, endIdx);
    
    // We will just replace ALL 'offCtxGround' with 'targetCtx' in this block
    block = block.replace(/offCtxGround/g, 'targetCtx');
    
    // Replace 'offCanvasGround' with 'craterCanvas' in this block
    block = block.replace(/offCanvasGround/g, 'craterCanvas');
    
    // Now replace the initialization
    block = block.replace(
        /const \{ craterCanvas, targetCtx \} = getSharedTerrainCtx\(\);/,
        `let targetCtx = ctx;
        let craterCanvas = null;
        if (typeof craters !== 'undefined' && craters.length > 0) {
            craterCanvas = document.createElement('canvas');
            craterCanvas.width = canvas.width;
            craterCanvas.height = canvas.height;
            targetCtx = craterCanvas.getContext('2d');
        }`
    );
    
    // And replace the final crater drawing logic
    // The original logic is:
    /*
        if (typeof craters !== 'undefined' && craters.length > 0) {
            targetCtx.globalCompositeOperation = 'destination-out';
            for (const crater of craters) {
                const p = gridToScreen(crater.x, crater.y);
                const pr = scaleLength(crater.r);
                targetCtx.beginPath();
                targetCtx.arc(p.x, p.y, pr, 0, Math.PI * 2);
                targetCtx.fill();
            }
            targetCtx.globalCompositeOperation = 'source-over';
        }

        ctx.drawImage(craterCanvas, 0, 0);
    */
    // Let's replace the whole bottom part from 'if (typeof craters'
    const craterBlockStart = block.indexOf("if (typeof craters !== 'undefined' && craters.length > 0) {");
    if (craterBlockStart !== -1) {
        block = block.substring(0, craterBlockStart) + `if (craterCanvas) {
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
        }
    `;
    }
    
    code = code.substring(0, startIdx) + block + code.substring(endIdx);
    fs.writeFileSync('js/engine.js', code);
    console.log("Patched successfully!");
} else {
    console.log("Could not find block indices!");
}
