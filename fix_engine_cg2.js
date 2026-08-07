const fs = require('fs');
const lines = fs.readFileSync('js/engine.js', 'utf8').split('\n');

// Patch 1: buildTerrain - merge garden + cloud_garden2 (line 622 0-indexed = 621)
// Current line 632 (1-indexed) is "} else if (stage.terrain === 'cloud_garden2') {"
// We need to merge it into the garden block just above (line 622).
// First apply the changes from engine.js that are already done via prior edit session.

// Check current state
const L622 = lines[621] || '';  // 0-indexed
const L632 = lines[631] || '';
console.log('L622:', L622.trim());
console.log('L632:', L632.trim());

// garden block at line 622 (1-indexed) -> index 621
// cloud_garden2 block at line 632 (1-indexed) -> index 631

if (L622.trim().startsWith('} else if') && L622.includes("'garden'") && !L622.includes('cloud_garden2')) {
    console.log('PATCH1: merging garden + cloud_garden2 at buildTerrain');
    // Change garden to include cloud_garden2
    lines[621] = lines[621].replace("'garden')", "'garden' || stage.terrain === 'cloud_garden2')");
    
    // Remove lines 632-644 (the cloud_garden2 buildTerrain block)
    // 0-indexed: 631 to 643
    const removeStart = 631;
    const removeEnd = 644; // exclusive
    lines.splice(removeStart, removeEnd - removeStart);
}

// Patch 2: px spawn block
// After removing the cloud_garden2 buildTerrain block, line numbers shift by (644-631)=13 lines
// Original line 691 (1-indexed) was cloud_garden2 px spawn -> now around 678

const newLines = lines;
for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].includes("} else if (stage.terrain === 'cloud_garden2') {") &&
        (newLines[i+1] || '').includes('적 스폰 허용') || 
        (newLines[i+1] || '').includes('단일 긴 구름') ||
        (newLines[i+1] || '').includes('px = -12')) {
        console.log(`PATCH2: removing cg2 px block at line ${i+1}`);
        // Find the closing brace of this block
        let end = i + 1;
        while (end < newLines.length && !newLines[end].trim().startsWith('} else') && !newLines[end].trim().startsWith('} else {')) {
            end++;
        }
        newLines.splice(i, end - i);
        break;
    }
}

// Patch 3: garden px spawn block - add cloud_garden2
for (let i = 0; i < newLines.length; i++) {
    if (newLines[i].includes("if (stage.terrain === 'garden')") &&
        (newLines[i+1] || '').includes('중앙 섬')) {
        console.log(`PATCH3: merging garden px block at line ${i+1}`);
        newLines[i] = newLines[i].replace("'garden')", "'garden' || stage.terrain === 'cloud_garden2')");
        break;
    }
}

// Patch 4: drawTerrain - cloud_garden2 first block (now around line 4012) -> replace with garden merge
// Find: "    } else if (stage.terrain === 'cloud_garden2') {" followed by "const cloudStartX = -25;"
for (let i = 0; i < newLines.length; i++) {
    const cur = newLines[i].trim();
    const next = (newLines[i+1] || '').trim();
    if (cur === "} else if (stage.terrain === 'cloud_garden2') {" && 
        next.startsWith('const cloudStartX')) {
        console.log(`PATCH4: replacing first cg2 draw block at line ${i+1}`);
        // Find end of this block (the next "} else if" at same indent level)
        let end = i + 1;
        while (end < newLines.length) {
            const t = newLines[end].trim();
            if (t.startsWith('} else if') && newLines[end].startsWith('    }')) break;
            end++;
        }
        // Replace the opening line with garden merge
        newLines.splice(i, end - i, "    } else if (stage.terrain === 'garden' || stage.terrain === 'cloud_garden2') {");
        break;
    }
}

// Patch 5: drawTerrain - second cloud_garden2 block (now around 4237) -> remove entirely
for (let i = 0; i < newLines.length; i++) {
    const cur = newLines[i].trim();
    const next = (newLines[i+1] || '').trim();
    if (cur === "} else if (stage.terrain === 'cloud_garden2') {" && 
        next.startsWith('const cg2StartX')) {
        console.log(`PATCH5: removing second cg2 draw block at line ${i+1}`);
        let end = i + 1;
        while (end < newLines.length) {
            const t = newLines[end].trim();
            if (t.startsWith('} else if') && newLines[end].startsWith('    }')) break;
            end++;
        }
        newLines.splice(i, end - i);
        break;
    }
}

fs.writeFileSync('js/engine.js', newLines.join('\n'), 'utf8');
console.log('Done patching engine.js');
