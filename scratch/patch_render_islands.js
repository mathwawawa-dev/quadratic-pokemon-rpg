const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

const islandsBlockRegex = /(if \(tData\.islands\) \{\s*\/\/ 원형\/타원\(도형\) 기반 렌더링 \+ 크레이터 지우기 \(구름 방식\)[\s\S]*?ctx\.drawImage\(islandCanvas, 0, 0\);\s*\})/m;

const match = code.match(islandsBlockRegex);
if (match) {
    const islandsBlock = match[0];
    
    // Remove the block from its current position
    code = code.replace(islandsBlock, '');
    
    // Insert it right before // Grid & Axes
    const insertPoint = '// Grid & Axes';
    code = code.replace(insertPoint, islandsBlock + '\n\n    ' + insertPoint);
    
    fs.writeFileSync('js/engine.js', code);
    console.log('Patched engine.js');
} else {
    console.log('Could not find islands block');
}
