const fs = require('fs');
let code = fs.readFileSync('js/engine.js', 'utf8');

const caveRenderCode = `
    // Cave ceiling/wall overlay (동굴 외벽 렌더링)
    const getCeilY = (x) => {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        return (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) ? ceilHeights[key] : (tData.ceilFunc ? tData.ceilFunc(x) : 1000);
    };
    if (tData.hasCaveWall && tData.ceilFunc) {
        const caveMinX = -25, caveMaxX = 25;

        // 동굴 내부 경로(천장선 + 화면 하단)를 한 번만 구성
        const cavePath = () => {
            ctx.beginPath();
            const sp = gridToScreen(caveMinX, getCeilY(caveMinX));
            ctx.moveTo(sp.x, sp.y);
            for (let x = caveMinX; x <= caveMaxX; x += 0.2) {
                const p = gridToScreen(Math.min(x, caveMaxX), getCeilY(Math.min(x, caveMaxX)));
                ctx.lineTo(p.x, p.y);
            }
            // 우하단 → 좌하단 → 닫기
            ctx.lineTo(canvas.width + 10, canvas.height + 10);
            ctx.lineTo(-10, canvas.height + 10);
            ctx.closePath();
        };

        // 1. 외곽 어두운 영역 (evenodd 방식 사용)
        ctx.save();
        ctx.beginPath();
        // 화면 전체 사각형 (외부 경계)
        ctx.rect(-10, -10, canvas.width + 20, canvas.height + 20);
        // 동굴 내부 경로 (CCW 방향이 되도록 → evenodd 규칙으로 구멍)
        const sp2 = gridToScreen(caveMinX, getCeilY(caveMinX));
        ctx.moveTo(-10, canvas.height + 10);
        ctx.lineTo(canvas.width + 10, canvas.height + 10);
        const ep2 = gridToScreen(caveMaxX, getCeilY(caveMaxX));
        ctx.lineTo(ep2.x, ep2.y);
        for (let x = caveMaxX; x >= caveMinX; x -= 0.2) {
            const p = gridToScreen(Math.max(x, caveMinX), getCeilY(Math.max(x, caveMinX)));
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(-10, canvas.height + 10);
        ctx.closePath();

        ctx.fillStyle = '#0d0d0d';
        ctx.fill('evenodd');
        ctx.restore();

        // 2. 천장 바위(암석) 내부 채우기
        ctx.save();
        cavePath();
        ctx.clip(); // 구멍난 곳(실제 동굴 안)을 클리핑 영역으로 설정... 인데 반대로 위쪽을 그려야 하므로
        ctx.restore();
        
        ctx.save();
        ctx.beginPath();
        const cEdge2 = gridToScreen(caveMinX, getCeilY(caveMinX));
        ctx.moveTo(cEdge2.x, cEdge2.y);
        for (let x = caveMinX; x <= caveMaxX; x += 0.2) {
            const p = gridToScreen(Math.min(x, caveMaxX), getCeilY(Math.min(x, caveMaxX)));
            ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(canvas.width + 10, -10);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fillStyle = tData.color || '#595959';
        ctx.fill();
        ctx.restore();

        // 3. 천장 테두리선 (암석 윤곽)
        ctx.save();
        ctx.beginPath();
        const cEdge = gridToScreen(caveMinX, getCeilY(caveMinX));
        ctx.moveTo(cEdge.x, cEdge.y);
        for (let x = caveMinX; x <= caveMaxX; x += 0.2) {
            const p = gridToScreen(Math.min(x, caveMaxX), getCeilY(Math.min(x, caveMaxX)));
            ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(130,130,130,0.7)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

`;

code = code.replace(
    '        const numLayers = tData.layers ? tData.layers.length : 1;\n        if (tData.islands) {',
    caveRenderCode + '        const numLayers = tData.layers ? tData.layers.length : 1;\n        if (tData.islands) {'
);

fs.writeFileSync('js/engine.js', code);
console.log("Cave render patch complete.");
