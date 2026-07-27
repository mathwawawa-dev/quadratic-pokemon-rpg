const fs = require('fs');
let code = fs.readFileSync('js/engine.js','utf8');
let start = code.indexOf("    } else if (stage.terrain === 'log_bridge') {");
let end = code.indexOf("    } else {", start);
if(start !== -1 && end !== -1) {
    let block = code.substring(start, end);
    block = block.split('offCtxGround').join('targetCtx');
    code = code.substring(0, start) + block + code.substring(end);
    fs.writeFileSync('js/engine.js', code);
    console.log("Replaced offCtxGround -> targetCtx");
} else {
    console.log("Could not find start/end", start, end);
}
