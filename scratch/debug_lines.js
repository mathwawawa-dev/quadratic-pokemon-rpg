const fs = require('fs');
let lines = fs.readFileSync('js/engine.js','utf8').split('\n');
let start = -1, end = -1;
for(let i=0;i<lines.length;i++) {
    if(lines[i].includes("} else if (stage.terrain === 'log_bridge') {")) {
        start = i;
    } else if (start !== -1 && end === -1 && lines[i].includes("    } else {")) {
        end = i;
        break;
    }
}
console.log("start:", start, "end:", end);
if (start !== -1) console.log(lines[start]);
if (end !== -1) console.log(lines[end]);
