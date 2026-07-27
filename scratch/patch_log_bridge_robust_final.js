const fs = require('fs');
let lines = fs.readFileSync('js/engine.js','utf8').split('\n');

let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "    } else if (stage.terrain === 'log_bridge') {") {
        startLine = i;
    } else if (startLine !== -1 && endLine === -1 && lines[i] === "    } else {") {
        endLine = i;
        break;
    }
}

if (startLine !== -1 && endLine !== -1) {
    let blockLines = lines.slice(startLine, endLine);
    let block = blockLines.join('\n');
    
    // Replace the init
    block = block.replace(
        /const \{ offCanvasGround, offCtxGround \} = getSharedTerrainCtx\(\);/,
        `let targetCtx = ctx;\n        let craterCanvas = null;\n        if (typeof craters !== 'undefined' && craters.length > 0) {\n            craterCanvas = document.createElement('canvas');\n            craterCanvas.width = canvas.width;\n            craterCanvas.height = canvas.height;\n            targetCtx = craterCanvas.getContext('2d');\n        }`
    );
    
    // Replace all offCtxGround with targetCtx
    block = block.replace(/offCtxGround/g, 'targetCtx');
    
    // Replace crater logic at the end
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
    
    lines.splice(startLine, endLine - startLine, block);
    fs.writeFileSync('js/engine.js', lines.join('\n'));
    console.log("Patched successfully!");
} else {
    console.log("Could not find startLine or endLine", startLine, endLine);
}
