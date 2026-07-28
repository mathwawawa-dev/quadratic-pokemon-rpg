// ============================================================
// engine.js  ?? Core game loop, physics, rendering
// ============================================================

// ---------- Canvas & Context ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

window.gameMouseX = -1000;
window.gameMouseY = -1000;
window.showAllEnemyHP = false;

// shadowBlur ì¡°ê±´ë¶€ ë¹„í™œ?±í™” ?Œë˜ê·? IDLE ì¤‘ì—??0, FIRING ?ëŠ” ?´í™???ˆì„ ?Œë§Œ 1
let isFiring = false;

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    window.gameMouseX = e.clientX - rect.left;
    window.gameMouseY = e.clientY - rect.top;
});
canvas.addEventListener('mouseleave', () => {
    window.gameMouseX = -1000;
    window.gameMouseY = -1000;
});


// ---------- Coordinate System ----------
let X_MIN = -10, X_MAX = 20, Y_MIN = -15, Y_MAX = 25;

let caveCeilingCanvas = null;
let needsCaveRedraw = true;
let CELL_SIZE = 1;

// ---------- Game State ----------
let currentStage = 0;
let GAME_STATE = 'IDLE'; // IDLE | FIRING | OVER

// ---------- Entities ----------
let player = {
    x: 0, y: 0, w: 1.5, h: 1.5,
    hp: 100, maxHp: 100,
    img: null, isFlying: false,
    shake: 0, vx: 0, vy: 0,
    rotation: 0, angularVelocity: 0,
    isKnockedBack: false, facing: 1, groundLayerIdx: -1,
    name: '', movePoints: 2, maxMovePoints: 2
};
let enemies = [];

// ---------- Projectile ----------
let missile = { active: false, x: 0, y: 0, trail: [], maxY: 0, func: null, dx: 0.1, distanceTraveled: 0, startX: 0, isCheat: false };

// ---------- Effects & Globals ----------
let effects = [];
let screenShake = 0;
let terrainHeights = {};
let originalTerrainHeights = {};
let terrainBottoms = {};
let ceilHeights = {};
let explosionRadius = 0.7; // ??°œ ë°˜ê²½ (0.7ë¡?ì¶•ì†Œ)
let playerGold = 0;
let baseDamageBoost = 1.0; // ?Œì›Œ???ì„  ?ë“ ???°ë?ì§€ ë°°ìœ¨ ì¦ê?
let isFirstTurn = true;    // ?¤í…Œ?´ì? ì²????¬ë? (ì´ˆì‹¬?ì˜ ë²„í”„ 2ë°??°ë?ì§€??
let balloons = [];          // ê³µì¤‘ ?ì„  ëª©ë¡
let cloudParams = [
    { bx: 5,  by: 18, speed: 3000, radius: 2.2, alpha: 0.6 },
    { bx: -4, by: 12, speed: 5000, radius: 1.6, alpha: 0.4 }
];

// êµ¬ë¦„ êµ¬ë© ?°ì´??(ë¯¸ì‚¬??ê´€?????ì„±)
let cloudHoles = []; // { x, y, radius, maxRadius, life, maxLife }
// ?¬ë ˆ?´í„° ?°ì´??(?„í˜• ê¸°ë°˜ ì§€?•ì„ ì§€?°ê¸° ?„í•´ ? ì?)
let craters = [];
// ?¬ë ˆ?´í„° ë§ˆìŠ¤?¹ìš© ?¤í”„?¤í¬ë¦?ìº”ë²„????ë§??„ë ˆ??new canvas ?ì„± ë°©ì? (GC ë³‘ëª© ?œê±°)
let _craterCanvas = null;
let _craterCtx = null;
function getCraterCanvas(w, h) {
    if (!_craterCanvas) {
        _craterCanvas = document.createElement('canvas');
        _craterCtx = _craterCanvas.getContext('2d');
    }
    if (_craterCanvas.width !== w || _craterCanvas.height !== h) {
        _craterCanvas.width = w;
        _craterCanvas.height = h;
    }
    _craterCtx.clearRect(0, 0, w, h);
    return { canvas: _craterCanvas, ctx: _craterCtx };
}

// ---------- ?¬ì¼“ë³??´ë?ì§€ ?„ë¦¬ë¡œë“œ ----------
const pokeballImg = new Image();
pokeballImg.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';

// ---------- Sprite Cache ----------
const spriteCache = {};
function loadSprite(idOrName) {
    if (spriteCache[idOrName]) return spriteCache[idOrName];
    const img = new Image();
    if (idOrName.startsWith('assets/') || idOrName.includes('/')) {
        img.src = idOrName;
    } else {
        const primarySrc  = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${idOrName}`;
        const fallbackSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idOrName}`;
        img.src = primarySrc;
        img.onerror = () => { if (img.src !== fallbackSrc) img.src = fallbackSrc; };
    }
    spriteCache[idOrName] = img;
    return img;
}

// ---------- Coordinate Helpers ----------
function gridToScreen(x, y) {
    return {
        x: (x - X_MIN) / (X_MAX - X_MIN) * canvas.width,
        y: canvas.height - (y - Y_MIN) / (Y_MAX - Y_MIN) * canvas.height
    };
}
function scaleLength(len) { return len * CELL_SIZE; }

// ---------- Resize / Viewport ----------
function resize() {
    needsCaveRedraw = true;
    if (!window.innerWidth) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const aspect = canvas.width / canvas.height;
    let yRange = Y_MAX - Y_MIN;
    let xRange = yRange * aspect;
    
    // Zoom out limit (max scale = 88)
    if (xRange > 88) {
        xRange = 88;
        yRange = xRange / aspect;
        const yCenter = (Y_MIN + Y_MAX) / 2;
        Y_MIN = yCenter - yRange / 2;
        Y_MAX = yCenter + yRange / 2;
    }
    
    // Pan limit: X_MIN >= -44, X_MAX <= 44
    let xCenter = (X_MIN + X_MAX) / 2;
    if (xCenter - xRange / 2 < -44) {
        xCenter = -44 + xRange / 2;
    }
    if (xCenter + xRange / 2 > 44) {
        xCenter = 44 - xRange / 2;
    }
    X_MIN = xCenter - xRange / 2;
    X_MAX = xCenter + xRange / 2;

    // Pan limit: Y_MIN >= -40 (log_bridge??-20), Y_MAX <= 50
    const stage = LEVELS[currentStage % LEVELS.length];
    const minYLimit = (stage && stage.terrain === 'log_bridge') ? -20 : -40;
    
    let yCenter = (Y_MIN + Y_MAX) / 2;
    if (yCenter - yRange / 2 < minYLimit) {
        yCenter = minYLimit + yRange / 2;
    }
    if (yCenter + yRange / 2 > 50) {
        yCenter = 50 - yRange / 2;
    }
    Y_MIN = yCenter - yRange / 2;
    Y_MAX = yCenter + yRange / 2;
    CELL_SIZE = canvas.height / yRange;
}
window.addEventListener('resize', resize);

function resetView() {
    needsCaveRedraw = true;
    if (!window.innerWidth) return;
    const aspect = window.innerWidth / window.innerHeight;
    
    let minX = player.x, maxX = player.x;
    let minY = player.y, maxY = player.y;
    
    enemies.forEach(e => {
        if (e.hp > 0 || true) {
            if (e.x < minX) minX = e.x; if (e.x > maxX) maxX = e.x;
            if (e.y < minY) minY = e.y; if (e.y > maxY) maxY = e.y;
        }
    });

    // 1. ?„êµ° ë°??êµ° ?¬ì¼“ëª?Xì¢Œí‘œ / Yì¢Œí‘œ??ê°ê° ?‰ê· ê°?(?”ë©´ ì¤‘ì‹¬)
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 2. ?¬ì¼“ëª¬ë“¤??ê°€?¤ì?ì§€ ?Šê³  ? ëª…?˜ê²Œ ë³´ì¼ ???ˆëŠ” ìµœë? ?•ë? ë°°ìœ¨ ê³„ì‚°
    let spanX = (maxX - minX) + 3.8;
    let rawYSpan = (maxY - minY) + 2.8;
    
    // ?˜ë‹¨ ê³„ê¸°??UI ?¨ë„(??22% ?ì—­) ê³ ë ¤?˜ì—¬ ?ë‹¨ ê°€???ì—­??ê°€??ì°¨ë„ë¡?ê³„ì‚°
    let spanY = rawYSpan / 0.78;

    let reqXSpan = Math.max(spanX, spanY * aspect) * 1.18; // ì´ˆê¸° ì§„ì… ??ë°°ìœ¨ 1?¨ê³„ ì¶•ì†Œ(ì¤Œì•„??
    if (reqXSpan < 19) reqXSpan = 19;
    let reqYSpan = reqXSpan / aspect;

    // 3. ?˜ë‹¨ ê³„ê¸°??UI ?ì—­(22%)??ê°ì•ˆ???œê°??? íš¨ ?ì—­ ì¤‘ì•™???¬ì¼“ëª??‰ê·  ì¢Œí‘œ(centerX, centerY) ë°°ì¹˜
    X_MIN = centerX - reqXSpan / 2;
    X_MAX = centerX + reqXSpan / 2;
    Y_MIN = centerY - reqYSpan * 0.61;
    Y_MAX = Y_MIN + reqYSpan;

    resize();
}
window.resetView = resetView;

function changeZoom(factor) {
    const yRange = Y_MAX - Y_MIN;
    let newRange = yRange * factor;
    if (newRange < 5) newRange = 5;
    if (newRange > 150) newRange = 150;
    const yCenter = (Y_MIN + Y_MAX) / 2;
    Y_MIN = yCenter - newRange / 2;
    Y_MAX = yCenter + newRange / 2;
    resize();
}
window.changeZoom = changeZoom;

// ---------- Zoom / Drag ----------

function changeZoom(factor) {
    const yRange = Y_MAX - Y_MIN;
    let newRange = yRange * factor;
    if (newRange < 5) newRange = 5;
    if (newRange > 150) newRange = 150;
    const yCenter = (Y_MIN + Y_MAX) / 2;
    Y_MIN = yCenter - newRange / 2;
    Y_MAX = yCenter + newRange / 2;
    resize();
}
window.changeZoom = changeZoom;

window.addEventListener('wheel', (e) => {
    if (e.target !== canvas && e.target !== document.body) return;
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const yRange = Y_MAX - Y_MIN;
    let newRange = yRange * factor;
    if (newRange < 5) newRange = 5;
    if (newRange > 150) newRange = 150;
    const yCenter = (Y_MIN + Y_MAX) / 2;
    Y_MIN = yCenter - newRange / 2;
    Y_MAX = yCenter + newRange / 2;
    resize();
}, { passive: true });

let isDragging = false, dragStartX = 0, dragStartY = 0;
let dragStartXMin = 0, dragStartYMin = 0, dragStartYMax = 0;
let pointerTooltip = { active: false, x: 0, y: 0, gridX: 0, gridY: 0, alpha: 0 };

function updatePointerTooltip(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const mx = cx - rect.left, my = cy - rect.top;
    pointerTooltip = {
        active: true,
        x: mx, y: my,
        gridX: X_MIN + (mx / canvas.width) * (X_MAX - X_MIN),
        gridY: Y_MIN + (1 - my / canvas.height) * (Y_MAX - Y_MIN),
        alpha: pointerTooltip.alpha
    };
}
function startDrag(cx, cy) {
    if (GAME_STATE === 'FIRING') return;
    isDragging = true;
    dragStartX = cx; dragStartY = cy;
    dragStartXMin = X_MIN; dragStartYMin = Y_MIN; dragStartYMax = Y_MAX;
}
function doDrag(cx, cy) {
    if (!isDragging) return;
    const dxGrid = (cx - dragStartX) / canvas.width * (X_MAX - X_MIN);
    const yRange = dragStartYMax - dragStartYMin;
    const dyGrid = (cy - dragStartY) / canvas.height * yRange;
    X_MIN = dragStartXMin - dxGrid;
    X_MAX = X_MIN + (canvas.width / canvas.height) * yRange;
    Y_MIN = dragStartYMin + dyGrid;
    Y_MAX = Y_MIN + yRange;
    resize();
}
canvas.addEventListener('mousedown', (e) => { updatePointerTooltip(e.clientX, e.clientY); startDrag(e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => { if (isDragging) { updatePointerTooltip(e.clientX, e.clientY); doDrag(e.clientX, e.clientY); } });
window.addEventListener('mouseup', () => { pointerTooltip.active = false; isDragging = false; });
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { updatePointerTooltip(e.touches[0].clientX, e.touches[0].clientY); startDrag(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
window.addEventListener('touchmove', (e) => { if (e.touches.length === 1) { if (isDragging) doDrag(e.touches[0].clientX, e.touches[0].clientY); updatePointerTooltip(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
window.addEventListener('touchend', () => { pointerTooltip.active = false; isDragging = false; });

// ---------- Terrain ----------
let terrainSpikes = []; // ?¤í…Œ?´ì?ë§ˆë‹¤ ?œë¤?¼ë¡œ ?ì„±?˜ëŠ” ë¾°ì¡±???¸ë• ëª©ë¡

function getTerrainYAll(x) {
    const key = (Math.round(x * 10) / 10).toFixed(1);
    return terrainHeights[key] || [-100];
}

function getTerrainY(x, currentY) {
    const key = (Math.round(x * 10) / 10).toFixed(1);
    const ys = terrainHeights[key] || [-100];
    
    const currentTerrain = LEVELS[currentStage % LEVELS.length].terrain;
    if (TERRAINS[currentTerrain].isFloating || currentTerrain === 'sky') {
        if (currentY !== undefined) {
            const bs = terrainBottoms[key] || [];
            let bestY = -100;
            let minDiff = 9999;
            for (let i = 0; i < ys.length; i++) {
                const y = ys[i];
                const b = bs[i] !== undefined ? bs[i] : -1000;
                // ?”í‹°??Y?„ì¹˜(currentY) ?„ë˜???ˆëŠ” ??b <= currentY + 2.0) ì¤‘ì—??
                // currentY?€ ì§€ë©??ë‹¨(y) ?¬ì´??ê±°ë¦¬ê°€ ê°€??ê°€ê¹Œìš´ ì¸µì„ ? íƒ
                if (y !== -100 && b <= currentY + 2.0) {
                    const diff = Math.abs(currentY - y);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestY = y;
                    }
                }
            }
            if (bestY !== -100) return bestY;
            return -100; // No valid ground found below or near currentY; unit is falling into the void
        }
    }
    return Math.max(...ys);
}

// ë¶€??ë§µì—??? íƒ???¬ì˜ ë°”ë‹¥ ?’ì´ë¥?ë°˜í™˜. ë¹„ë???ë§µì´ê±°ë‚˜ ê°ì? ë¶ˆê? ??-1000.
function getTerrainBottom(x, currentY) {
    const key = (Math.round(x * 10) / 10).toFixed(1);
    const ys = terrainHeights[key] || [-100];
    const bs = terrainBottoms[key] || [];
    const currentTerrain = LEVELS[currentStage % LEVELS.length].terrain;
    if ((TERRAINS[currentTerrain].isFloating || currentTerrain === 'sky') && currentY !== undefined) {
        let bestB = -1000;
        let minDiff = 9999;
        for (let i = 0; i < ys.length; i++) {
            const y = ys[i];
            const b = bs[i] !== undefined ? bs[i] : -1000;
            if (y !== -100 && b <= currentY + 2.0) {
                const diff = Math.abs(currentY - y);
                if (diff < minDiff) { minDiff = diff; bestB = b; }
            }
        }
        return bestB;
    }
    return -1000;
}

// ë¶€??ë§µì—??getTerrainYê°€ ? íƒ???ˆì´?´ì˜ ?¸ë±?¤ë? ë°˜í™˜. ë¹„ë?? ë§µ/ê°ì?ë¶ˆê? = -1.
function getTerrainLayerIndex(x, currentY) {
    const key = (Math.round(x * 10) / 10).toFixed(1);
    const ys = terrainHeights[key] || [-100];
    const bs = terrainBottoms[key] || [];
    const currentTerrain = LEVELS[currentStage % LEVELS.length].terrain;
    if ((TERRAINS[currentTerrain].isFloating || currentTerrain === 'sky') && currentY !== undefined) {
        let bestIdx = -1, minDiff = 9999;
        for (let i = 0; i < ys.length; i++) {
            const y = ys[i], b = bs[i] !== undefined ? bs[i] : -1000;
            if (y !== -100 && b <= currentY + 2.0) {
                const diff = Math.abs(currentY - y);
                if (diff < minDiff) { minDiff = diff; bestIdx = i; }
            }
        }
        return bestIdx;
    }
    return -1;
}

function createCrater(cx, cy, radius) {
    const stage = LEVELS[currentStage % LEVELS.length];
    const isFloating = TERRAINS[stage.terrain].isFloating;
    
    if (typeof craters !== 'undefined') {
        craters.push({x: cx, y: cy, r: radius});
        // ?¼ë°˜ ì§€?•ì? terrainHeights ê¸°ë°˜ ?Œë”ë§ìœ¼ë¡?ìº?ë¬´ê?; ë¶€? Â·skyÂ·log_bridge??destination-out ë°©ì‹???¬ìš©?˜ë?ë¡?
        // ìº¡ì„ 100?¼ë¡œ ?’ì—¬ ?¤ë˜???¬ë ˆ?´í„° ?œê±°ë¡??¸í•œ ì§€??ë³µêµ¬ ë²„ê·¸ ë°©ì?
        if (craters.length > 100) craters.shift();
    }

    for (let x = cx - radius; x <= cx + radius; x += 0.1) {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        if (!terrainHeights[key]) continue;
        const dx = x - cx;
        const rSq = radius * radius - dx * dx;
        if (rSq < 0) continue;
        const halfHeight = Math.sqrt(rSq);
        const craterTopY = cy + halfHeight;
        const craterBottomY = cy - halfHeight;
        
        for (let i = 0; i < terrainHeights[key].length; i++) {
            const y = terrainHeights[key][i];
            // ??°œ êµ¬ì²´ ë²”ìœ„(craterBottomY ~ craterTopY) ?´ì— ?„ì¹˜???œë©´ ì§€?•ë§Œ ?Œê´´?˜ë„ë¡??•ë? ê²€ì¦?(?ë‹¨ ì²œì¥ ?¸ë• ? ì?ë¥??µí•´ ?œê°„?´ë™ ?¬ë¼?´ë”© ë²„ê·¸ ?ˆë°©)
            if (y !== -100 && y >= craterBottomY && y <= craterTopY + 0.3) {
                terrainHeights[key][i] = Math.min(y, craterBottomY);
                if (isFloating || stage.terrain === 'sky' || stage.terrain === 'log_bridge') {
                    // terrainBottoms??ë¶€? ë§µÂ·log_bridge ëª¨ë‘ buildTerrain?ì„œ ì´ˆê¸°?”ë¨
                    // ??°œ 1ë°?= ?œë©´ -0.5? ë‹›.
                    //   <  ì¡°ê±´: ë°”ë‹¥ë³´ë‹¤ 0.5 ?„ë˜ ê°”ì„ ????1ë°???Œ (?œê° 0?¸ë° ???¨ì–´ì§?
                    //   <= ì¡°ê±´: ?œë©´???•í™•??ë°”ë‹¥???¿ì„ ?????œê° ?ê»˜=0 ???€?´ë° ?•í™•
                    if (terrainBottoms[key] && terrainHeights[key][i] <= terrainBottoms[key][i]) {
                        terrainHeights[key][i] = -100;
                    }
                }
            }
        }
        
        if (TERRAINS[stage.terrain].hasCaveWall && typeof ceilHeights !== 'undefined') {
            if (ceilHeights[key] === undefined && TERRAINS[stage.terrain].ceilFunc) {
                ceilHeights[key] = TERRAINS[stage.terrain].ceilFunc(x);
            }
            if (ceilHeights[key] !== undefined) {
                if (ceilHeights[key] <= craterTopY && ceilHeights[key] >= craterBottomY - 0.3) {
                    ceilHeights[key] = Math.max(ceilHeights[key], craterTopY);
                    
                    if (Math.random() < 0.6 && typeof effects !== 'undefined') {
                        effects.push({
                            type: 'rock',
                            x: x + (Math.random()-0.5)*0.5,
                            y: craterTopY,
                            vx: (Math.random()-0.5)*2,
                            vy: -Math.random()*2,
                            life: 40 + Math.random()*20,
                            maxLife: 60,
                            size: 0.15 + Math.random()*0.15,
                            color: Math.random() < 0.5 ? '#595959' : '#404040'
                        });
                    }
                }
            }
        }
    }

    // ?¨ê²¨ì§????¬ì¼“ëª?ê·¼ì²˜(X ë°˜ê²½ 1.0, Y ë°˜ê²½ 2.0 ?´ë‚´)??ì§€?•ì´ ??°œë¡??Œì—¬ì§??Œë§Œ ?Œí—¤ì³ì§ ì²˜ë¦¬
    if (typeof enemies !== 'undefined') {
        enemies.forEach(ent => {
            if (ent.hp > 0 && ent.type === 'ground' && !ent.isSurfaced) {
                const xNear = Math.abs(ent.x - cx) <= 1.0;
                // ?€ê²?Yì¢Œí‘œê°€ ?¬ì¼“ëª?Y ê¸°ì? 2.0 ?´ë‚´(ì§€???œë©´ ë¶€ê·????Œë§Œ ?Œí—¤ì¹˜ê¸°
                const surfaceY = getTerrainY(ent.x, ent.y); // ?´ë‹¹ ?„ì¹˜??ì§€???œë©´ Y
                const yNear = Math.abs(cy - surfaceY) <= 2.0;
                if (xNear && yNear) {
                    ent.isSurfaced = true;
                    if (typeof effects !== 'undefined') {
                        effects.push({ type: 'text', x: ent.x, y: ent.y + 2, text: '?Œí—¤ì¹˜ê¸° ?±ê³µ!', color: '#fbbf24', life: 200 });
                    }
                }
            }
        });
    }
}

// ---------- UI Helpers ----------
function showMessage(title, desc, isError = true) {
    document.getElementById('msg-title').innerText = title;
    document.getElementById('msg-title').style.color = isError ? 'var(--danger)' : 'var(--success)';
    document.getElementById('message-overlay').style.borderColor = isError ? 'var(--danger)' : 'var(--success)';
    document.getElementById('msg-desc').innerHTML = desc;
    const btn = document.getElementById('msg-btn');
    btn.innerHTML = (GAME_STATE === 'OVER' && enemies.filter(e => e.hp <= 0).length >= 2) ? '?¤ìŒ ?¨ê³„ë¡?<span style="font-size:0.85rem;font-weight:normal;color:#ffffff;">[Enter]</span>' : '?¤ì‹œ ?œë„ <span style="font-size:0.85rem;font-weight:normal;color:#ffffff;">[Enter]</span>';
    document.getElementById('message-overlay').classList.add('show');
    document.getElementById('fire-btn').disabled = true;
    
    // ì°½ì´ ?¨ë©´ ì¦‰ì‹œ ë²„íŠ¼???¬ì»¤?¤ë? ì£¼ì–´ ?”í„°?¤ë¡œ ë°”ë¡œ ?«ì„ ???ˆê²Œ ??
    setTimeout(() => { btn.focus(); }, 10);
}
window.closeMessage = function () {
    document.getElementById('message-overlay').classList.remove('show');
    document.getElementById('fire-btn').disabled = false;
    if (GAME_STATE === 'OVER' && enemies.filter(e => e.hp <= 0).length >= 2) {
        playerGold += 200;
        document.getElementById('ui-player-gold').innerText = playerGold;
        currentStage++;
        initStage();
    } else {
        resetTurn();
    }
};
function updateHPUI() {
    document.getElementById('ui-player-hp-fill').style.width = `${Math.max(0, player.hp)}%`;
    document.getElementById('ui-player-hp-text').innerText = `HP: ${Math.floor(player.hp)}/${player.maxHp}`;
    const ap = document.getElementById('ui-player-ap-text');
    if (ap) ap.innerText = `?‰ë™?? ${player.movePoints.toFixed(1)}/${player.maxMovePoints.toFixed(1)}`;
}
function resetTurn() {
    GAME_STATE = 'IDLE';
    player.movePoints = player.maxMovePoints;
    updateHPUI();
    document.getElementById('fire-btn').disabled = false;
    
    // ?´ì´ ë¦¬ì…‹?????¤ì‹œ ?˜ì‹ì°½ìœ¼ë¡??¬ì»¤??
    const mf = document.getElementById('math-input');
    if (mf) mf.focus();
}

// ---------- Init Stage ----------
function initStage() {
    if (window.stageClearTimeout) {
        clearTimeout(window.stageClearTimeout);
        window.stageClearTimeout = null;
    }
    // ?¤ë²„?ˆì´ë¥?ë§?ë¨¼ì? ?„ì›Œ???¤ìŒ ?¤í…Œ?´ì?ê°€ ?¬ì© ë³´ì´???„ìƒ ë°©ì?
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
    GAME_STATE = 'LOADING';

    terrainSeed = Math.random() * 100;

    const stage = LEVELS[currentStage % LEVELS.length];
    const mathField = document.getElementById('math-input');
    if (mathField) mathField.value = '';

    // ? íƒ???¤í????¬ì¼“ëª¬ìœ¼ë¡??Œë ˆ?´ì–´ ?¤ì •
    const starterData = selectedStarter || STARTERS.pikachu;
    player.img        = loadSprite(starterData.img);
    player.isFlying      = false;
    player.hp            = player.maxHp = 100;
    player.movePoints    = player.maxMovePoints = 2.0;
    player.isKnockedBack = false;
    player.rotation      = 0;
    player.name          = starterData.name;
    player.visualScale   = 1.0;

    // ì§€???’ì´ë§?+ ?œë¤ ?¤íŒŒ?´í¬ ?¸ë• ?ì„±
    const tData = TERRAINS[stage.terrain];
    if (tData.init) tData.init(terrainSeed);
    terrainHeights = {};
    originalTerrainHeights = {};
    terrainBottoms = {};
    ceilHeights = {};
    terrainSpikes = [];
    craters = [];
    window.caveCeilOffset = 5.0 + Math.random() * 5.0; // ?™êµ´ ì²œì¥ ?’ì´ 5~10 ë¬´ì‘???ìŠ¹ ?¤í”„??
    window.lastElectricLightningTime = Date.now();
    window.lastCaveWarningTime = Date.now();
    window.caveStalactiteWarned = false;

    // ?Œë ˆ?´ì–´ ?¤í° ?„ì¹˜ ?¬ì „ ?°ì¶œ (?¤íŒŒ?´í¬ê°€ ?Œë ˆ?´ì–´ ì£¼ë? 8.0 ?´ë‚´???ê¸°??ê²?ë°©ì?)
    let approxPx = 0;
    if (stage.terrain === 'garden') {
        approxPx = 0;
    } else {
        const pxRoll = Math.random();
        if (pxRoll < 0.45)      approxPx =  (2 + Math.random() * 4);
        else if (pxRoll < 0.93) approxPx = -(2 + Math.random() * 4);
        else                    approxPx = 0;
    }

    // ?¤íŒŒ?´í¬: ?¼ìŒ ?¤ì‚°('ice')?ì„œ??50%, ê·???ì§€?•ì? 30% ?•ë¥ ë¡?ìµœë? 1ê°œì˜ ë¾°ì¡±???¸ë• ë°°ì¹˜ ('log_bridge' ?¸ë‚˜ë¬´ë‹¤ë¦?ë§µì? ?œì™¸)
    // ???¬ì¼“ëª?approxPx) ì£¼ë? ë°˜ê²½ 8.0 ?´ë‚´?ëŠ” ?¤íŒŒ?´í¬ê°€ ?ˆë? ?ì„±?˜ì? ?Šë„ë¡??œí•œ (?í­ ë°©ì?)
    terrainSpikes = [];
    const isNoSpikeTerrain = stage.terrain === 'log_bridge';
    const spikeProb = stage.terrain === 'ice' ? 0.5 : 0.3;
    const spikeCount = (!isNoSpikeTerrain && Math.random() < spikeProb) ? 1 : 0;
    for (let s = 0; s < spikeCount; s++) {
        let scx = 0;
        let tryCount = 0;
        do {
            scx = -15 + Math.random() * 30;
            tryCount++;
        } while (Math.abs(scx - approxPx) < 8.0 && tryCount < 40);

        terrainSpikes.push({
            cx: scx,
            height: 3 + Math.random() * 3,         // ?Ÿì•„?¤ë¥´???’ì´ ?„í™” (3~6)
            width:  1.0 + Math.random() * 1.0      // ?¤íŒŒ?´í¬ ?ˆë¹„
        });
    }

    const isFloatingMap = TERRAINS[stage.terrain].isFloating;
    const stageHeightOffset = isFloatingMap ? 0 : (1 + Math.random() * 3); // ê³µì¤‘?•ì› ?œì™¸ ë§?ì§€??1~4 ë¬´ì‘???’ì´ ?ìŠ¹

    for (let x = -60; x <= 60; x += 0.1) {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        if (tData.layers) {
            terrainHeights[key] = tData.layers.map(l => l(x));
            if (isFloatingMap) {
                terrainBottoms[key] = [];
                for (let i = 0; i < tData.layers.length; i++) {
                    let minBottom = 1000;
                    let found = false;
                    if (tData.islands && tData.islands[i]) {
                        for (const s of tData.islands[i]) {
                            if (x >= s.cx - s.rx && x <= s.cx + s.rx) {
                                const dx = x - s.cx;
                                const bY = s.cy - s.ry * Math.sqrt(1 - (dx * dx) / (s.rx * s.rx));
                                if (bY < minBottom) {
                                    minBottom = bY;
                                    found = true;
                                }
                            }
                        }
                    }
                    if (!found) minBottom = terrainHeights[key][i] - 4.0;
                    terrainBottoms[key].push(minBottom);
                }
            }
        } else {
            let y = tData.func(x) + stageHeightOffset;
            if (!isFloatingMap && stage.terrain !== 'sky') {
                // ????ê²½ì‚¬ ?’ì? ?¸ë• ì£¼ì„ ì²˜ë¦¬ (?”ì²­ ???¸ì œ??ë³µêµ¬ ê°€??
                // if (x < -20) { const dx = -20 - x; y += dx * dx * 5; }
                // else if (x > 20) { const dx = x - 20; y += dx * dx * 5; }

                // x = Â±60 ?¸ê³½ ê²½ê³„? ì—???˜ì§?¼ë¡œ ???¨ì–´ì§€ì§€ ?Šê³  ??– ?¬ì?ë¡??ì—°?¤ëŸ½ê²?ë¶€?œëŸ½ê²?ê¹ì´?„ë¡ ?˜í–¥ ?¬ë¡œ???ìš©
                if (x < -45) { const dx = -45 - x; y -= dx * dx * 0.15; }
                else if (x > 45) { const dx = x - 45; y -= dx * dx * 0.15; }
                const baseY = tData.func(x) + stageHeightOffset;
                for (const sp of terrainSpikes) {
                    const d = x - sp.cx;
                    y += sp.height * Math.exp(-(d * d) / (2 * sp.width * sp.width));
                }
                // ì§€??ìµœì??ê³¼???’ì´ì°¨ê? 20???˜ì? ?Šë„ë¡??ˆì „ ?œí•œ
                if (y - baseY > 20.0) {
                    y = baseY + 20.0;
                }
            }
            if (stage.terrain === 'sky') {
                  const roundedX = Math.round(x * 10) / 10;
                  if (roundedX < -30 || roundedX > 30) {
                      y = -100;
                      terrainHeights[key] = [-100];
                      terrainBottoms[key] = [-100];
                  } else {
                      terrainHeights[key] = [y];
                      terrainBottoms[key] = [y - 5.0];
                  }
              } else if (stage.terrain === 'log_bridge') {
                  const roundedX = Math.round(x * 10) / 10;
                  if (roundedX < -45 || roundedX > 45) {
                      y = -100;
                      terrainHeights[key] = [-100];
                      terrainBottoms[key] = [-100];
                  } else {
                      // ·»´õ¸µ thickness=5.0°ú ¹°¸® ¹Ù´Ú ÀÏÄ¡ (getThickness 4~7 °¡º¯ -> ºÒÀÏÄ¡ ¹æÁö)
                      terrainHeights[key] = [y];
                      terrainBottoms[key] = [y - 5.0];
                  }
              } else if (stage.terrain === 'grass' || stage.terrain === 'ice' || stage.terrain === 'lava' || stage.terrain === 'cave' || stage.terrain === 'electric' || stage.terrain === 'ocean' || stage.terrain === 'psychic') {
                  const roundedX = Math.round(x * 10) / 10;
                  // x < -20 ?ëŠ” x > 20?????œì„œ???¥ê?ê²?ê¹ì•„ì§€ë¥´ë„ë¡?(?´ë¦¬ë§?
                  if (x < -20) {
                      const dx = -20 - x;
                      y -= dx * dx * 4;
                  } else if (x > 20) {
                      const dx = x - 20;
                      y -= dx * dx * 4;
                  }
                  
                  terrainHeights[key] = [y];
              } else {
                  terrainHeights[key] = [y];
              }
        }
        originalTerrainHeights[key] = [...terrainHeights[key]];
        if (TERRAINS[stage.terrain].hasCaveWall && TERRAINS[stage.terrain].ceilFunc) {
            ceilHeights[key] = TERRAINS[stage.terrain].ceilFunc(x);
        }
    }

    // ?Œë ˆ?´ì–´??x ?„ì¹˜ ?¤ì • (?¤íŒŒ?´í¬ ?¸ë• ?•ìƒ?´ê±°??ì§€?˜ì¹˜ê²??’ì? ê³³ì? ?¼í•˜?„ë¡ ê²€ì¦?ë£¨í”„ ?ìš©)
    let px = 0;
    let attempts = 0;
    do {
        if (['garden', 'cloud_garden'].includes(stage.terrain)) {
            const midIslands = TERRAINS[stage.terrain].islands[1];
            // ì¤‘ì•™ë¶€(-15 ~ 15)??ê°€ê¹Œìš´ 2ì¸??¬ì„ ?°ì„  ? íƒ?˜ì—¬ 2ì¸µì— ?•ì • ?¤í°
            const centerIslands = midIslands.filter(s => s.cx >= -15 && s.cx <= 15);
            const targetIsland = centerIslands.length > 0 ? centerIslands[Math.floor(Math.random() * centerIslands.length)] : midIslands[0];
            px = targetIsland.cx + (Math.random() - 0.5) * (targetIsland.rx * 0.8);
        } else {
            const pxRoll = Math.random();
            if (pxRoll < 0.45)       px =  (2 + Math.random() * 4);
            else if (pxRoll < 0.93)  px = -(2 + Math.random() * 4);
            else                     px = 0;
        }

        // ?´ë‹¹ ?„ì¹˜??ì§€???’ì´ê°€ 3 ?´ìƒ ?Ÿì•„?¤ë¥¸ ?¤íŒŒ?´í¬ ?í–¥ê¶Œì¸ì§€ ì²´í¬
        const key = (Math.round(px * 10) / 10).toFixed(1);
        const yVal = terrainHeights[key] ? Math.max(...terrainHeights[key]) : (tData.layers ? Math.max(...tData.layers.map(l=>l(px))) : tData.func(px));
        const isSpikePeak = terrainSpikes.some(sp => Math.abs(px - sp.cx) < 8.0);

        // ê³¨ì§œê¸?Concave Valley: ì¢Œìš° ì£¼ë? ì§€?•ë³´??0.4 ?´ìƒ ?¨ì—¬ ?ˆëŠ” êµ¬ë©??ë°”ë‹¥) ê²€ì¶?
        const keyLeft = (Math.round((px - 1.8) * 10) / 10).toFixed(1);
        const keyRight = (Math.round((px + 1.8) * 10) / 10).toFixed(1);
        const yLeft = terrainHeights[keyLeft] ? Math.max(...terrainHeights[keyLeft]) : yVal;
        const yRight = terrainHeights[keyRight] ? Math.max(...terrainHeights[keyRight]) : yVal;
        const isValley = (yLeft > yVal + 0.4) && (yRight > yVal + 0.4);

        if (yVal !== -100 && (isFloatingMap || yVal < 5.0) && !isSpikePeak && !isValley) {
            break; // ??³  ?‰íƒ„???¥ì„ /?¸ë• ?ë‹¨?ë§Œ ë°°ì¹˜ (ê³¨ì§œê¸?ë°”ë‹¥ ë°?ê³¼ë„?˜ê²Œ ?’ì? ?¤íŒŒ?´í¬ ?œì™¸)
        }
        attempts++;
    } while (attempts < 60);

    // ê°•ì œ ë°°ì¹˜?˜ì—ˆ?”ë° ?ˆê³µ(-100)?´ë¼ë©?ì£¼ë? ?¬ìœ¼ë¡??´ë™
    if (getTerrainY(px) === -100) {
        for (let step = 0.5; step < 10; step += 0.5) {
            if (getTerrainY(px + step) !== -100) { px += step; break; }
            if (getTerrainY(px - step) !== -100) { px -= step; break; }
        }
    }

    player.x = px;
    player.facing = player.x >= 0 ? -1 : 1;
    player.y = getTerrainY(player.x) + 0.75;
    if (window.updateDirectionUI) window.updateDirectionUI();

    // ??ë°°ì¹˜ (?œë¤) ??x ê°„ê²© + y ê°„ê²© ëª¨ë‘ ë³´ì¥
    let stageEnemies = [];
    let fCount = stage.flyingCount || 0;
    let nCount = (stage.count || 3) - fCount;

    let fPool = [...FLYING_POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < fCount; i++) stageEnemies.push(fPool[i % fPool.length]);

    let nPool = [...ENEMY_POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < nCount; i++) stageEnemies.push(nPool[i % nPool.length]);

    // ?ë“¤???Œë ˆ?´ì–´ ?‘ìª½??ê³ ë¥´ê²?ë¶„ì‚°?˜ë„ë¡??¬ì´??ë°°ì •
    // ì´????˜ì˜ ?ˆë°˜?€ ?¼ìª½, ?ˆë°˜?€ ?¤ë¥¸ìª?(?€?˜ì´ë©??œìª½??1ê°???
    const totalCount = stageEnemies.length;
    const leftCount  = Math.floor(totalCount / 2);
    const rightCount = totalCount - leftCount;
    // 'L' ?ëŠ” 'R' ?¬ì´?œë? ?ì–´ ê°??ì—ê²?ë°°ì •
    const sideAssignments = [...Array(leftCount).fill('L'), ...Array(rightCount).fill('R')]
        .sort(() => Math.random() - 0.5);

    const isSkyMap = (stage.terrain === 'sky');
    const isFloatingMapLocal = TERRAINS[stage.terrain].isFloating;
    let flyingYPool = isSkyMap
        ? [8, 10, 12, 14, 16].sort(() => Math.random() - 0.5)
        : (isFloatingMapLocal
            ? [8, 10, 12, 13, 14].sort(() => Math.random() - 0.5)
            : [5, 7, 9, 11, 13].sort(() => Math.random() - 0.5));
    let flyingYIdx = 0;

    const barrierTypes = ['reflect', 'absorb', 'absolute', 'warp'].sort(() => Math.random() - 0.5);
    
    // ë°°ì¹˜???¬ì¼“ëª¬ë“¤??ì¢Œí‘œ(?Œë ˆ?´ì–´ ?¬í•¨)
    const placedPos = [{ x: player.x, y: player.y }];
    
    const checkValidPos = (rx, ry, isFlyingCheck = false, strictIslandCheck = true) => {
        const isFloating = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
        let leftBound = rx, rightBound = rx;
        if (isFloating) {
            while (leftBound > -35 && Math.max(...getTerrainYAll(leftBound)) > -50) leftBound -= 0.5;
            while (rightBound < 35 && Math.max(...getTerrainYAll(rightBound)) > -50) rightBound += 0.5;
        }

        for (const p of placedPos) {
            const dx = Math.abs(rx - p.x);
            const dy = Math.abs(ry - p.y);
            // 1. ? í´ë¦¬ë“œ ê±°ë¦¬ 6 ?´ìƒ
            if (Math.hypot(dx, dy) < 6.0) return false;
            // 2. xì¢Œí‘œ ?™ì¼ ë°©ì? (?¤ì°¨ 0.1)
            if (dx < 0.1) return false;
            // 3. yì¢Œí‘œ ?™ì¼ ë°©ì? (?¤ì°¨ 0.1)
            if (dy < 0.1) return false;
            
            // ê³µì¤‘?•ì› ë§µì—?œëŠ” ????island)????ë§ˆë¦¬ë§?(?Œë ˆ?´ì–´ ?¬í•¨)
            // ë¹„í–‰ ?¬ì¼“ëª¬ì´ê±°ë‚˜ strict ëª¨ë“œê°€ êº¼ì ¸?ˆìœ¼ë©???ê·œì¹™??ë¬´ì‹œ?©ë‹ˆ??
            if (strictIslandCheck && isFloating && !isFlyingCheck && !p.isFlying) {
                if (p.x >= leftBound && p.x <= rightBound) return false;
            }
        }
        return true;
    };

    enemies = stageEnemies.map((e, idx) => {
        const side = sideAssignments[idx]; // 'L': ?Œë ˆ?´ì–´ë³´ë‹¤ ?¼ìª½, 'R': ?¤ë¥¸ìª?
        let rx, ry, valid = false, attempts = 0;
        
        const tryPlacement = (isFlying) => {
            valid = false;
            attempts = 0;
            const isFloatingMapLocal = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
            const isGroundType = e.type === 'ground';
            const yOffset = (isGroundType && !isFloatingMapLocal) ? -1.3 : 0.75;
            
            do {
                const spread = 12 + (attempts / 20); 
                rx = side === 'L'
                    ? player.x - 5 - Math.random() * spread
                    : player.x + 5 + Math.random() * spread;
                const spawnLimitX = 18;
                rx = Math.max(-spawnLimitX, Math.min(spawnLimitX, rx));
                
                if (isFlying || isSkyMap) {
                    const terrainYAtRx = getTerrainY(rx);
                    if (terrainYAtRx > -50) {
                        // ëª¨ë“  ë§??¼ë°˜, ?¤íŒŒ?´í¬ ?¸ë•, ê³µì¤‘?•ì›): ì§€???¤íŒŒ?´í¬ ?œë©´(terrainYAtRx) ?„ë¡œ ìµœì†Œ +2.5~4.0 ê³µì¤‘ ë°°ì¹˜ (ì§€???Œë¬»???„ë²½ ë°©ì?)
                        ry = Math.max(terrainYAtRx + 2.5, flyingYPool[flyingYIdx % flyingYPool.length]) + Math.random() * 1.5;
                    } else {
                        ry = flyingYPool[flyingYIdx % flyingYPool.length] + (Math.random()-0.5)*4;
                    }
                    if (isSkyMap && ry >= 19.8) ry = 14.0 + Math.random() * 5.0; // ?±ì¸µê¶?ë§?y < 20 ë¯¸ë§Œ ?í•œ ìº?
                } else {
                    ry = getTerrainY(rx) + yOffset;
                    if (ry < -50) { attempts++; continue; }
                }
                
                // 300ë²??´ìƒ ?¤íŒ¨?˜ë©´ ???¬ì— ??ë§ˆë¦¬ ê·œì¹™???„í™”?˜ì—¬ ë¬´ì¡°ê±?ì§€?ì— ë°°ì¹˜?˜ê²Œ ? ë„
                const strictIsland = attempts < 300;
                valid = checkValidPos(rx, ry, (isFlying || isSkyMap), strictIsland);
                
                if (isFlying || isSkyMap) {
                    const terrainYAtRx = getTerrainY(rx);
                    if (terrainYAtRx > -50 && ry < terrainYAtRx + 2.0) {
                        valid = false; // ì§€???¤íŒŒ?´í¬ ?œë©´ê³?ê²¹ì¹˜ê±°ë‚˜ ?„ë˜ë¡?ì¹¨ë²” ??ì¦‰ì‹œ ?¬ë°°ì¹?
                    } else if (isFloatingMapLocal && terrainYAtRx <= -50) {
                        valid = false;
                    }
                }
                
                if (isFlying && !valid) {
                    ry += 2.0; // ?¤íŒ¨ ???„ìª½ ê³µì¤‘?¼ë¡œ ê³ ë„ ?´ë™
                    if (isSkyMap && ry >= 19.8) ry = 14.0 + Math.random() * 5.0;
                    valid = checkValidPos(rx, ry, true, strictIsland);
                }
                attempts++;
            } while (!valid && attempts < 500);
        };

        tryPlacement(e.isFlying);

        // 1ì°??¤íŒ¨ ?? ì§€??ëª¬ìŠ¤?°ì??¤ë©´ ê³µì¤‘ ëª¬ìŠ¤?°ë¡œ ë³€?˜í•˜???¬ì‹œ??
        if (!valid && !e.isFlying && !isSkyMap) {
            e.isFlying = true;
            e.hasCloud = true;
            tryPlacement(true);
            if (valid) flyingYIdx++; 
        }
        
        // 2ì°??¤íŒ¨ ??(?¹ì? ì²˜ìŒë¶€??ê³µì¤‘?´ì—ˆ?”ë° ?¤íŒ¨): ìµœí›„???˜ë‹¨?¼ë¡œ ê²¹ì¹˜ì§€ ?Šê²Œ ê°•ì œ ë¶„ì‚° ë°°ì¹˜
        if (!valid) {
            rx = side === 'L' ? player.x - 10 - idx*6 : player.x + 10 + idx*6;
            const spawnLimitX = 18;
            rx = Math.max(-spawnLimitX, Math.min(spawnLimitX, rx));
            const terrainYAtRx = getTerrainY(rx);
            if (e.isFlying) {
                ry = terrainYAtRx > -50 ? terrainYAtRx + 2.8 : 13 + idx * 2;
            } else {
                ry = terrainYAtRx + 0.75;
                if (ry < -50) { e.isFlying = true; e.hasCloud = true; ry = 13 + idx * 2; }
            }
        }
        
        if (e.isFlying || isSkyMap) {
            flyingYIdx++;
        }

        if (isSkyMap && ry >= 19.8) {
            ry = 13.0 + (idx % 4) * 1.8 + Math.random() * 1.0; // ?±ì¸µê¶?ë§?Y < 20 ë¯¸ë§Œ ?„ê²© ?œí•œ
        }

        placedPos.push({ x: rx, y: ry, isFlying: (e.isFlying || isSkyMap) });

        const isPsychic = (stage.terrain === 'psychic');
        const barrierType = isPsychic ? barrierTypes[idx % barrierTypes.length] : null;

        const currentTerrainData = TERRAINS[stage.terrain];
        const spawnDeathZoneY = currentTerrainData.deathZoneY !== undefined ? currentTerrainData.deathZoneY : -8;
        if (ry <= spawnDeathZoneY + 2.0) {
            // ?´ë‹¹ X ?„ì¹˜ ì§€???? ?†ìœ¼ë©?ê³µì¤‘?¼ë¡œ ?¬ë ¤ ë°°ì¹˜
            const safeTerrainY = getTerrainY(rx);
            ry = safeTerrainY > -50 ? safeTerrainY + 2.5 : spawnDeathZoneY + 8;
            e.isFlying = true;
            e.hasCloud = true;
        }
        if (stage.terrain === 'garden' && (e.isFlying || isSkyMap) && ry >= 15.0) {
            ry = 14.5;
        }

        return {
            x: rx, y: ry,
            w: 1.5, h: 1.5, hp: 100 + currentStage * 25, maxHp: 100 + currentStage * 25,
            img: loadSprite(e.img),
            isFlying: e.isFlying || isSkyMap,
            hasCloud: isSkyMap,
            shake: 0, vx: 0, vy: 0,
            rotation: 0, angularVelocity: 0, isKnockedBack: false, groundLayerIdx: -1,
            name: e.name, type: e.type,
            isSurfaced: TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating ? true : false,
            barrierType: barrierType,
            barrierStartTime: Date.now() + (isPsychic ? 3000 : 0) + idx * 2500
        };
    });

    // êµ¬ë¦„ ?Œë¼ë¯¸í„° ë¦¬ì…‹ (ê³µì¤‘?•ì› ë§µì? ??ì§€?•ê³¼ ê²¹ì¹˜ì§€ ?Šë„ë¡??ˆê³µ ?„ì¹˜ë¡??¬ì¡°??
    if (stage.terrain === 'garden') {
        cloudParams = [
            { bx: 6,   by: 11.0, speed: 3000, radius: 2.2, alpha: 0.6 },
            { bx: -18, by: 6.0,  speed: 5000, radius: 1.6, alpha: 0.4 },
            { bx: -2,  by: 5.0,  speed: 4000, radius: 0.8, alpha: 0.8, isPowerCloud: true, colorType: starterData.type }
        ];
    } else if (stage.terrain === 'sky') {
        cloudParams = [
            { bx: 4,  by: 14.0, speed: 4000, radius: 0.8, alpha: 0.8, isPowerCloud: true, colorType: starterData.type },
            { bx: -6, by: 20.0, speed: 4500, radius: 1.2, alpha: 0.8, isPowerCloud: true, colorType: starterData.type },
            { bx: 8,  by: 28.0, speed: 3500, radius: 1.4, stretchX: 1.8, alpha: 0.8, isPowerCloud: true, colorType: starterData.type },
            { bx: -3, by: 7.0,  speed: 3800, radius: 0.55, alpha: 0.8, isPowerCloud: true, colorType: starterData.type }
        ];
    } else if (stage.terrain === 'ocean') {
        cloudParams = [
            { bx: -8, by: 12, speed: 4200, radius: 0.7, alpha: 0.8, isPowerCloud: true, colorType: starterData.type },
            { bx: 5,  by: 19, speed: 3800, radius: 0.9, alpha: 0.8, isPowerCloud: true, colorType: starterData.type },
            { bx: 0,  by: 9, speed: 4500, radius: 0.6, alpha: 0.8, isPowerCloud: true, colorType: starterData.type }
        ];
    } else {
        cloudParams = [
            { bx: 5,  by: 18, speed: 3000, radius: 2.2, alpha: 0.6 },
            { bx: -4, by: 12, speed: 5000, radius: 1.6, alpha: 0.4 },
            { bx: 0,  by: 20, speed: 4000, radius: 0.8, alpha: 0.8, isPowerCloud: true, colorType: starterData.type }
        ];
    }

    // UI ?…ë°?´íŠ¸
    document.getElementById('stage-title').innerText = `Stage ${currentStage + 1}`;
    document.getElementById('terrain-info').innerText = TERRAINS[stage.terrain].name;
    document.getElementById('ui-player-name').innerText = starterData.name;
    document.getElementById('ui-player-img').src = player.img.src;

    // 'êµ¬ë¦„ ???˜ëŠ˜(sky)' ë°?'?¼ìŒ ?¤ì‚°(ice)' ë§µì—?œëŠ” ì¤?ë²„íŠ¼ ê¸€?ë? ?´ë‘???¤ìœ¼ë¡?ë³€ê²?
    const zoomControls = document.querySelector('.zoom-controls');
    if (zoomControls) {
        if (stage.terrain === 'sky' || stage.terrain === 'ice') {
            zoomControls.classList.add('dark-theme');
        } else {
            zoomControls.classList.remove('dark-theme');
        }
    }

    updateHPUI();
    missile.active = false; missile.trail = []; effects = [];
    baseDamageBoost = 1.0;  // ?¤í…Œ?´ì?ë§ˆë‹¤ ?Œì›Œ ë¶€?¤íŠ¸ ì´ˆê¸°??
    explosionRadius = 0.7;  // ??°œ ë°˜ê²½ ì´ˆê¸°??
    isFirstTurn = true;     // ?¤í…Œ?´ì?ë§ˆë‹¤ ì²???ì´ˆê¸°??(ì´ˆì‹¬?ì˜ ë²„í”„ ?¬í™œ?±í™”)

    // ?¬ì¼“ë³??ì„± (?„ë“œ??1ê°? y??3 ê³µì¤‘, ?Œë ˆ?´ì–´?€ ???¬ì´??xì¢Œí‘œ ë³´ì¥)
    balloons = [];
    const balloonTypes = ['gold', 'gold', 'power']; // ê¸ˆí™” 2ë°??•ë¥ , ?Œì›Œ 1ë°??•ë¥ 
    
    // ??ì¤??˜ë‚˜ë¥?ë¬´ì‘?„ë¡œ ? íƒ?˜ì—¬ ê·??ê³¼ ?Œë ˆ?´ì–´ ?¬ì´??xì¢Œí‘œ???ì„±
    let targetX = player.x + 8; // ?´ë°±??ê¸°ë³¸ ê±°ë¦¬
    if (enemies.length > 0) {
        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
        targetX = randomEnemy.x;
    }
    
    // ?Œë ˆ?´ì–´?€ ?€?????¬ì´??ë³´ê°„ê°?(35% ~ 65% ë¬´ì‘??ì§€??
    const ratio = 0.35 + Math.random() * 0.3;
    let bx = player.x + (targetX - player.x) * ratio;
    const by = 13 + Math.random() * 5; // y: 13 ~ 18 ê³µì¤‘

    // ì§€????ê³?ê²¹ì¹˜ì§€ ?Šë„ë¡?ê²€ì¦?(?µì…˜ 3: ê²¹ì¹˜ë©?xì¢Œí‘œ ?´ë™)
    let overlapAttempts = 0;
    let isOverlapping = true;
    while (isOverlapping && overlapAttempts < 50) {
        isOverlapping = false;
        const key = (Math.round(bx * 10) / 10).toFixed(1);
        if (terrainHeights[key]) {
            for (let i = 0; i < terrainHeights[key].length; i++) {
                const tY = terrainHeights[key][i];
                const bY = terrainBottoms[key] ? terrainBottoms[key][i] : -100;
                // ?¬ì¼“ë³?ë°˜ê²½(0.65)??ê³ ë ¤?˜ì—¬ ?½ê°„???¬ìœ (1.0)ë¥??ê³  ì¶©ëŒ ê²€??
                if (by <= tY + 1.0 && by >= bY - 1.0) {
                    isOverlapping = true;
                    break;
                }
            }
        }
        
        if (isOverlapping) {
            // ì§€?•ê³¼ ê²¹ì¹˜ë©?xë¥?1.5 ~ 3.5ë§Œí¼ ì¢Œìš° ë¬´ì‘?„ë¡œ ?´ë™
            bx += (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2.0);
            
            // ë§?ê²½ê³„ë¥?ë²—ì–´?˜ì? ?Šë„ë¡??ˆì „?¥ì¹˜
            const X_MIN_B = -50, X_MAX_B = 50;
            if (bx < X_MIN_B) bx = X_MIN_B + Math.random() * 5;
            if (bx > X_MAX_B) bx = X_MAX_B - Math.random() * 5;
        }
        overlapAttempts++;
    }

    const type = balloonTypes[Math.floor(Math.random() * balloonTypes.length)];
    balloons.push({ x: bx, y: by, type, active: true, radius: 0.65, phase: Math.random() * Math.PI * 2 });

    resetView();

    // ëª¨ë“  ?¤í”„?¼ì´???´ë?ì§€ê°€ ?¤ì œë¡?ë¡œë“œ ?„ë£Œ???œì ???¤ë²„?ˆì´ë¥??«ìŒ
    // (ê³ ì • ?€?´ë¨¸ ?€?? - ?? ìµœë? 1500ms ìº¡ìœ¼ë¡??ˆë¬´ ê¸¸ì–´ì§€ì§€ ?Šê²Œ ?œí•œ
    const allImages = [player.img, ...enemies.map(e => e.img)].filter(Boolean);

    const waitForImages = Promise.all(allImages.map(img =>
        new Promise(resolve => {
            if (img.complete && img.naturalWidth > 0) {
                resolve(); // ?´ë? ë¡œë“œ ?„ë£Œ (ìºì‹œ)
            } else {
                img.addEventListener('load',  resolve, { once: true });
                img.addEventListener('error', resolve, { once: true }); // ?¤ë¥˜??ê¸°ë‹¤ë¦?ì¢…ë£Œ
            }
        })
    ));

    const maxWait = new Promise(resolve => setTimeout(resolve, 1500)); // ìµœë? 1500ms ìº?

    Promise.race([waitForImages, maxWait]).then(() => {
        const finalizeStageInit = () => {
            GAME_STATE = 'IDLE';
            if (window.startGuideMessageRotation) window.startGuideMessageRotation();
            // ?¤í…Œ?´ì? ?œì‘ ì§í›„ ?ë™?¼ë¡œ ?˜ì‹?…ë ¥ì°½ì— ?¬ì»¤?¤ë? ì¤ë‹ˆ??
            const mf = document.getElementById('math-input');
            if (mf) mf.focus();
        };

        if (overlay) {
            overlay.classList.add('hiding');         // 0.4s fade-out ?œì‘
            setTimeout(() => {
                overlay.classList.remove('hiding');
                overlay.classList.add('hidden');     // ?„ì „???¨ê?
                finalizeStageInit();
            }, 400);
        } else {
            finalizeStageInit();
        }
    });
}

// ---------- Player Movement ----------
window.movePlayer = function (dir) {
    if (GAME_STATE !== 'IDLE' || player.isKnockedBack) return;
    const stage = LEVELS[currentStage % LEVELS.length];
    const isFloating = TERRAINS[stage.terrain].isFloating;
    const maxBound = isFloating ? 32 : 20;
    if (player.movePoints < 0.5) { showMessage('?´ë™ ë¶ˆê?', '?‰ë™?¥ì„ ëª¨ë‘ ?Œëª¨?ˆìŠµ?ˆë‹¤.', false); return; }
    player.x = Math.max(-maxBound, Math.min(maxBound, player.x + dir * 0.5));
    player.y = getTerrainY(player.x, player.y) + 0.75;
    player.movePoints -= 0.5;
    updateHPUI();
};

window.setPlayerFacing = function (dir) {
    if (GAME_STATE === 'FIRING') return;
    player.facing = dir;
    updateDirectionUI();
};

window.updateDirectionUI = function() {
    const leftBtn = document.getElementById('dir-left-btn');
    const rightBtn = document.getElementById('dir-right-btn');
    if (leftBtn && rightBtn) {
        if (player.facing === -1) {
            leftBtn.classList.add('active');
            rightBtn.classList.remove('active');
        } else {
            leftBtn.classList.remove('active');
            rightBtn.classList.add('active');
        }
    }

    // UI ?„ë¡œ???´ë?ì§€??ìºë¦­??ì¡°ì? ë°©í–¥??ë§ê²Œ ì¢Œìš° ë°˜ì „ (facing: -1 ?¼ìª½, facing: 1 ?¤ë¥¸ìª?
    const profileImg = document.getElementById('ui-player-img');
    if (profileImg) {
        if (player.facing === 1) {
            profileImg.style.transform = 'translate(-50%, -50%) scaleX(-1)';
        } else {
            profileImg.style.transform = 'translate(-50%, -50%) scaleX(1)';
        }
    }
};

// ---------- Cheat Keys & UI Shortcuts ----------
window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+A: ?¤í…Œ?´ì? ?¤í‚µ (?¤í????”ë©´ Q 3???°í? ì¹˜íŠ¸ ?´ê¸ˆ ?œë§Œ ?‘ë™)
    if (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        if (!window.isCheatUnlocked) return;
        e.preventDefault();
        e.stopPropagation();
        
        // ?˜ì‹?…ë ¥ì°½ì— ?«ìê°€ ?ˆìœ¼ë©??´ë‹¹ ?¤í…Œ?´ì?ë¡??´ë™
        const mathInput = document.getElementById('math-input');
        const inputVal = mathInput ? mathInput.value.trim() : '';
        const stageNum = parseInt(inputVal, 10);
        
        if (!isNaN(stageNum) && stageNum >= 1) {
            currentStage = stageNum - 1; // 0-indexed
            initStage();
            if (mathInput) mathInput.value = '';
            return;
        }
        
        // ?«ìê°€ ?†ìœ¼ë©??¤ìŒ ?¤í…Œ?´ì?ë¡?
        currentStage++;
        initStage();
        if (mathInput) mathInput.value = '';
        return;
    }
    // Ctrl+Shift+Q: ?•ë‹µ ?¨ìˆ˜ ?ë™ ê³„ì‚° & ì¦‰ì‹œ ë°œì‚¬ (?¤í????”ë©´ Q 3???°í? ì¹˜íŠ¸ ?´ê¸ˆ ?œë§Œ ?‘ë™)
    if (e.ctrlKey && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        const currentTerrainData = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain];
        const deathZoneY = currentTerrainData.deathZoneY !== undefined ? currentTerrainData.deathZoneY : -8;
        const aliveEnemies = enemies.filter(ent => ent.hp > 0 && ent.y >= deathZoneY);
        if (GAME_STATE !== 'IDLE' || aliveEnemies.length === 0) return;

        const p1 = { x: player.x, y: player.y };

        // a < 0 (?„ë¡œ ë³¼ë¡) ?˜í•™??100% ë³´ì¥: 2??+ ?•ì  ?’ì´ ê³µì‹
        // a = -((??H-y1)+??H-y2))/(x1-x2))^2 ????ƒ ?Œìˆ˜ (?„ë¡œ ë³¼ë¡ ??ëª¨ì–‘)
        const fit2Apex = (pt1, pt2, extraHeight = 5.0) => {
            if (Math.abs(pt1.x - pt2.x) < 0.001) return null;
            // ìµœê³ ??H???Œë ˆ?´ì–´?€ ??ì¤????’ì? Y?„ì¹˜ë³´ë‹¤ ??ƒ ìµœì†Œ extraHeight ?´ìƒ ?’ê²Œ ?•í•¨ (y1, y2ë³´ë‹¤ ?’ì? ?„ì¹˜)
            const maxY = Math.max(pt1.y, pt2.y);
            const H = Math.min(38.0, maxY + Math.max(1.5, extraHeight));
            const d1 = Math.sqrt(Math.max(0.001, H - pt1.y));
            const d2 = Math.sqrt(Math.max(0.001, H - pt2.y));
            const xv = (d1 * pt2.x + d2 * pt1.x) / (d1 + d2);
            const a = -Math.pow((d1 + d2) / (pt1.x - pt2.x), 2); // ??ƒ < 0 (?„ë¡œ ë³¼ë¡)
            const b = -2 * a * xv;
            const c = H + a * xv * xv;
            return { a, b, c };
        };

        // ?Œë ˆ?´ì–´ê°€ ë°”ë¼ë³´ëŠ” ë°©í–¥(player.facing)?????°ì„  ? íƒ
        // ???¬ë¬¼??ê¼?§“?ì´ ë°œì‚¬ ë°©í–¥ ?ì— ?„ì¹˜?´ì•¼ ë¯¸ì‚¬?¼ì´ ?¬ë¼ê°”ë‹¤ ?´ë ¤?¤ëŠ” ???•íƒœë¡?ë³´ì„
        const dir = player.facing || 1;
        const sameDir = aliveEnemies.filter(e => Math.sign(e.x - player.x) === dir);
        const chosenEnemy = sameDir.length > 0
            ? sameDir.reduce((a, b) => Math.abs(a.x - player.x) < Math.abs(b.x - player.x) ? a : b)  // ê°™ì? ë°©í–¥ ì¤?ê°€??ê°€ê¹Œìš´ ??
            : aliveEnemies.reduce((a, b) => Math.abs(a.x - player.x) < Math.abs(b.x - player.x) ? a : b); // ?†ìœ¼ë©??„ë°©??ì¤?ê°€??ê°€ê¹Œìš´ ??

        const tgt = chosenEnemy;
        // ? íƒ????ë°©í–¥?¼ë¡œ ê°•ì œ ?„í™˜ (ë°˜ë? ë°©í–¥ ë°œì‚¬ë¡??¸í•œ ê¶¤ë„ ?´íƒˆ ë°©ì?)
        player.facing = Math.sign(tgt.x - player.x) || 1;
        if (window.updateDirectionUI) window.updateDirectionUI();

        let result = null;
        const pt2 = { x: tgt.x, y: tgt.y };
        // H ?ìƒ‰ ë²”ìœ„ë¥??’ì—¬ ?¨ì”¬ ëª…í™•?˜ê³  ?ˆìœ '?„ë¡œ ë³¼ë¡(??' ?¬ë¬¼? ì´ ?˜ì˜¤?„ë¡ ì¡°ì •
        for (let h = 15.0; h >= 1.5; h -= 0.5) {
            const res = fit2Apex(p1, pt2, h);
            if (!res) continue;
            // ê¶¤ì  ?„ì²´ ?¤ìº”: ì²œì¥(y??5) ë°??°ìŠ¤ì¡?ì¹¨ë²” ?¬ë? ?•ì¸
            const minX = Math.min(p1.x, pt2.x) - 1;
            const maxX = Math.max(p1.x, pt2.x) + 1;
            let safe = true;
            for (let x = minX; x <= maxX; x += 0.5) {
                const y = res.a * x * x + res.b * x + res.c;
                if (y >= 35.0 || y <= deathZoneY + 0.5) { safe = false; break; }
            }
            if (safe) { result = res; break; }
        }
        // ìµœí›„??ë³´ë£¨: ??? ?¸ë¡œ?¼ë„ ?„ë¡œ ë³¼ë¡ ë³´ì¥
        if (!result) {
            result = fit2Apex(p1, pt2, 1.5) || { a: -0.05, b: 0, c: p1.y + 0.05 * p1.x * p1.x };
        }

        const { a, b, c } = result;
        let eq = `${a.toFixed(3)}x^2 + ${b.toFixed(3)}x + ${c.toFixed(3)}`.replace(/\+ -/g, '- ');
        document.getElementById('math-input').value = eq;
        fireMissile(true);
        return;
    }
    if (e.target.tagName.toLowerCase() === 'math-field') return;
}, { capture: true });

// ---------- Fire Missile ----------
function getMissileColor() {
    const type = selectedStarter ? selectedStarter.type : 'electric';
    const colors = { fire: '#ef4444', electric: '#fbbf24', water: '#3b82f6', flying: '#38bdf8', grass: '#22c55e', normal: '#a8a29e' };
    return colors[type] || '#fbbf24';
}

window.fireMissile = function (isCheat = false) {
    if (GAME_STATE !== 'IDLE') return;
    const latex = document.getElementById('math-input').value;
    const func = compileMathExpression(latex);
    if (!func) { showMessage('?¤ë¥˜', '?˜ì‹???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.'); return; }

    const py = player.y - 0.525; // ??ì¤‘ì‹¬ Y
    const VISUAL_R = 0.7;        // ??ë°˜ê²½

    // 1. Launch Point ?ì—­ (ì¢Œìš° Â±0.3) ?µê³¼ ?¬ë? ê²€ì¦?
    let passesLaunch = false;
    for (let x = player.x - 0.3; x <= player.x + 0.3; x += 0.002) {
        const y = func(x);
        if (!isNaN(y)) { passesLaunch = true; break; }
    }

    if (!passesLaunch) {
        showMessage('ë°œì‚¬ ë¶ˆê?', 'ê·¸ë˜?„ê? Launch Pointë¥?ì§€?˜ì•¼ ?©ë‹ˆ??');
        return;
    }

    // 2. ë¯¸ì‚¬???œì‘???¤ì •???„í•´ 0.7 ë°˜ê²½ ?ì˜ ?Œë‘ë¦?êµì  ê²€??
    let boundaryXs = [];
    let prevInside = null, lastX = null;

    for (let x = player.x - VISUAL_R - 0.01; x <= player.x + VISUAL_R + 0.01; x += 0.002) {
        const inside = (x - player.x) ** 2 + (func(x) - py) ** 2 <= VISUAL_R * VISUAL_R;
        if (prevInside !== null && inside !== prevInside) {
            boundaryXs.push(inside ? x : lastX);
        }
        prevInside = inside;
        lastX = x;
    }

    const dir = player.facing;
    // ë°”ë¼ë³´ëŠ” ë°©í–¥?¼ë¡œ ?„ë¡œ ? ì•„ê°€?”ì? ?ë³„
    const isFlyingUp = func(player.x + dir * 0.05) > func(player.x);

    // ë°œì‚¬ ë°©í–¥???°ë¼ ?ë‹¨ ?¹ì? ?˜ë‹¨ ?ì—­??êµì ë§??„í„°ë§?
    const correctHalfXs = boundaryXs.filter(bx => {
        const y = func(bx);
        return isFlyingUp ? (y >= py) : (y <= py);
    });

    // ë°©í–¥??ë§ëŠ” êµì ???†ìœ¼ë©??„ì²´ êµì  ì¤?? íƒ (?ˆì • ?¥ì¹˜)
    const finalXs = correctHalfXs.length > 0 ? correctHalfXs : boundaryXs;
    if (finalXs.length === 0) {
        showMessage('ë°œì‚¬ ë¶ˆê?', 'ê·¸ë˜?„ê? Launch Pointë¥?ì§€?˜ì•¼ ?©ë‹ˆ??');
        return;
    }

    // êµì  ì¤??„ë¡œ ?˜ë©´ Y ìµœë?, ?„ë˜ë¡??˜ë©´ Y ìµœì†Œ ? íƒ
    let startX = finalXs[0];
    let bestY = func(startX);
    for (let i = 1; i < finalXs.length; i++) {
        const y = func(finalXs[i]);
        if (isFlyingUp ? y > bestY : y < bestY) { bestY = y; startX = finalXs[i]; }
    }

    // startX, func(startX) ?ì„ ???Œë‘ë¦??„ë¡œ ?•í™•???¬ì˜ ??ë¯¸ì‚¬???œì‘?ì´ ???Œë‘ë¦¬ì? ???¼ì¹˜
    const rawStartX = startX;
    const rawStartY = func(startX);
    const sdx = rawStartX - player.x, sdy = rawStartY - py;
    const sLen = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    const projStartX = player.x + (sdx / sLen) * VISUAL_R;
    const projStartY = py + (sdy / sLen) * VISUAL_R;

    if (window.currentMissileType !== 'normal') {
        if (window.missileInventory[window.currentMissileType] <= 0) {
            showMessage('?˜ëŸ‰ ë¶€ì¡?, '?´ë‹¹ ë¯¸ì‚¬?¼ì„ ëª¨ë‘ ?Œì§„?ˆìŠµ?ˆë‹¤.');
            document.getElementById('fire-btn').disabled = false;
            return;
        }
        window.missileInventory[window.currentMissileType]--;
        if (window.updateInventoryUI) window.updateInventoryUI();
    }

    const deltaCheck = dir * 0.005;
    const launchSlope = Math.abs((func(projStartX + deltaCheck) - func(projStartX)) / 0.005);
    const launchBoost = Math.max(1.0, Math.min(2.2, 1.0 + (launchSlope - 0.3) * 0.4));

    GAME_STATE = 'FIRING';
    player.animFrame = 30; // 30 ?„ë ˆ??0.5ì´? ?™ì•ˆ ë°œì‚¬ ëª¨ì…˜
    Object.assign(missile, { 
        active: true, func, x: projStartX, y: projStartY, 
        trail: [{ x: projStartX, y: projStartY }], 
        maxY: projStartY, startX: projStartX, startY: projStartY, distanceTraveled: 0, 
        hasLeftPlayer: false, isCheat, dx: dir * 0.15,
        type: window.currentMissileType,
        hitTargets: new Set(),
        powerBoostCount: 0,
        isReflected: false,
        isHoming: false,
        homingTarget: null,
        hasClimbed: false,
        launchBoost: launchBoost
    });
    
    // ?Œì›Œ??êµ¬ë¦„ ?µê³¼ ?Œë˜ê·?ì´ˆê¸°??(ë§?ë°œì‚¬ë§ˆë‹¤ ë¦¬ì…‹)
    cloudParams.forEach(cp => { cp._hitByCurrentMissile = false; });
    
    document.getElementById('fire-btn').disabled = true;
};

// ---------- Barrier System ----------
function getBarrierColors(type, alphaMult = 1.0) {
    switch (type) {
        case 'reflect':
            return {
                fill: `rgba(0, 191, 255, ${0.15 * alphaMult})`,
                stroke: `rgba(0, 191, 255, ${0.8 * alphaMult})`,
                name: 'ë°˜ì‚¬'
            };
        case 'absorb':
            return {
                fill: `rgba(50, 205, 50, ${0.15 * alphaMult})`,
                stroke: `rgba(50, 205, 50, ${0.8 * alphaMult})`,
                name: '?¼í•´?¡ìˆ˜'
            };
        case 'absolute':
            return {
                fill: `rgba(255, 215, 0, ${0.15 * alphaMult})`,
                stroke: `rgba(255, 215, 0, ${0.8 * alphaMult})`,
                name: '?ˆë?ë°©ì–´'
            };
        case 'warp':
            return {
                fill: `rgba(186, 85, 211, ${0.15 * alphaMult})`,
                stroke: `rgba(186, 85, 211, ${0.8 * alphaMult})`,
                name: '?Œí”„'
            };
        default:
            return {
                fill: 'transparent',
                stroke: 'transparent',
                name: ''
            };
    }
}

function pathPolygon(ctx, sides, r, progress) {
    const startAngle = -Math.PI / 2;
    const limitAngle = startAngle + Math.PI * 2 * progress;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
        const angle = startAngle + (i / sides) * Math.PI * 2;
        if (angle > limitAngle && progress < 1.0) {
            const prevAngle = startAngle + ((i - 1) / sides) * Math.PI * 2;
            const ratio = (limitAngle - prevAngle) / (angle - prevAngle);
            if (ratio > 0) {
                const interAngle = prevAngle + (angle - prevAngle) * ratio;
                ctx.lineTo(Math.cos(interAngle) * r, Math.sin(interAngle) * r);
            }
            break;
        }
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
}

function pathHexagon(ctx, r, progress) {
    pathPolygon(ctx, 6, r, progress);
}

// 8ê°í˜• ê²½ë¡œ
function pathOctagon(ctx, r, progress) {
    pathPolygon(ctx, 8, r, progress);
}

// ?˜ì„ (?Œìš©?Œì´) ê²½ë¡œ
function pathSpiral(ctx, r, progress, rotSpeed = 1.0) {
    ctx.beginPath();
    const turns = 2.0;
    const steps = 100;
    const timeRot = (Date.now() / 250) * rotSpeed;
    
    for (let i = 0; i <= steps * progress; i++) {
        const theta = (i / steps) * Math.PI * 2 * turns;
        const currentR = r * (0.15 + 0.85 * (i / steps));
        const angle = theta + timeRot;
        const px = Math.cos(angle) * currentR;
        const py = Math.sin(angle) * currentR;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
}

function getBarrierTiming(type) {
    let genTime = 1.0;
    let activeTime = 3.0;
    if (type === 'absolute') activeTime = 4.0;
    if (type === 'absorb') activeTime = 4.5;
    let flashTime = 1.5;
    let noneTime = 4.0;
    return {
        gen: genTime,
        active: activeTime,
        flash: flashTime,
        none: noneTime,
        total: genTime + activeTime + flashTime + noneTime
    };
}

function checkBarrierCollision(mx, my, t) {
    if (!t.barrierType) return false;
    if (!t.barrierStartTime) t.barrierStartTime = Date.now();
    const elapsed = (Date.now() - t.barrierStartTime) / 1000;
    if (elapsed < 0) return false;
    
    const timing = getBarrierTiming(t.barrierType);
    const cycleTime = elapsed % timing.total;
    
    const isActive = (cycleTime >= timing.gen && cycleTime < timing.gen + timing.active + timing.flash);
    if (!isActive) return false;

    const offsetY = t.isFlying ? t.h * 0.15 : -t.h * 0.35;
    const ty = t.y + offsetY;
    const dist = Math.hypot(mx - t.x, my - ty);
    return dist <= 1.68; // ë°°ë¦¬??ë°˜ê²½ (?œê° ë°˜ê²½ê³??™ê¸°??
}

function handleBarrierCollision(e) {
    if (e.barrierType === 'reflect') {
        missile.isReflected = true;
        missile.dx = -missile.dx;
        
        for (let i = 0; i < 15; i++) {
            effects.push({
                type: 'particle',
                x: missile.x, y: missile.y,
                vx: (Math.random() - 0.5) * 0.4 - missile.dx,
                vy: (Math.random() - 0.5) * 0.4,
                life: 25,
                color: '#00bfff'
            });
        }
        effects.push({ type: 'text', x: missile.x, y: missile.y + 1, text: 'REFLECT!', color: '#00bfff', life: 60 });
    } 
    else if (e.barrierType === 'absorb') {
        missile.active = false;
        GAME_STATE = 'IDLE';
        
        const heal = 40;
        e.hp = Math.min(e.maxHp, e.hp + heal);
        updateHPUI();
        
        for (let i = 0; i < 20; i++) {
            effects.push({
                type: 'particle',
                x: missile.x, y: missile.y,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: 30,
                color: '#32cd32'
            });
        }
        effects.push({ type: 'text', x: e.x, y: e.y + 1, text: `+${heal} HP`, color: '#32cd32', life: 80 });
        
        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 800);
    } 
    else if (e.barrierType === 'absolute') {
        missile.active = false;
        GAME_STATE = 'IDLE';
        
        for (let i = 0; i < 20; i++) {
            effects.push({
                type: 'particle',
                x: missile.x, y: missile.y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                life: 30,
                color: '#ffd700'
            });
        }
        effects.push({ type: 'text', x: e.x, y: e.y + 1, text: 'BLOCK!', color: '#ffd700', life: 80 });
        
        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 800);
    } 
    else if (e.barrierType === 'warp') {
        missile.active = false;
        GAME_STATE = 'IDLE';
        
        for (let i = 0; i < 20; i++) {
            effects.push({
                type: 'particle',
                x: e.x, y: e.y,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                life: 30,
                color: '#ba55d3'
            });
        }
        
        let validX = false;
        let attempts = 0;
        let rx = e.x;
        const isFloatingMapLocal = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
        while (!validX && attempts < 100) {
            rx = -18 + Math.random() * 36;
            if (Math.abs(rx - player.x) >= 4) {
                if (!isFloatingMapLocal || getTerrainY(rx) > -50) {
                    validX = true;
                }
            }
            attempts++;
        }
        
        e.x = rx;
        e.y = getTerrainY(rx) + (e.isFlying ? 6 : (e.type === 'ground' ? -0.5 : 0.75));
        
        for (let i = 0; i < 20; i++) {
            effects.push({
                type: 'particle',
                x: e.x, y: e.y,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                life: 30,
                color: '#ba55d3'
            });
        }
        effects.push({ type: 'text', x: e.x, y: e.y + 1.5, text: 'WARP!', color: '#ba55d3', life: 80 });
        
        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 800);
    }
}

// ---------- Collision & Combat ----------
function checkCollision(mx, my, t) {
    // drawEntity?ì„œ ?”ë©´??ê·¸ë ¤ì§€??Y ?¤í”„???œê°??ë³´ì •ê°????¼ë¦¬???¼ê²© ë°•ìŠ¤(Hitbox)?ë„ ?‘ê°™??ë°˜ì˜?©ë‹ˆ??
    const offsetY = t.isFlying ? t.h * 0.1 : -t.h * 0.35;
    const ty = t.y + offsetY;
    const hitEntity = mx >= t.x - t.w/2 && mx <= t.x + t.w/2 && my >= ty - t.h/2 && my <= ty + t.h/2;
    
    if (t.hasCloud) {
        const cy = t.y - 0.75;
        const hitCloud = mx >= t.x - 0.75 && mx <= t.x + 0.75 && my >= cy - 0.3 && my <= cy + 0.3;
        if (hitCloud) return true;
    }
    return hitEntity;
}
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++)
        effects.push({ type: 'particle', x, y, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, life: 30, color });
    
    // ë°œì „??'electric') ë§??„ìš©: ?©ê¸ˆë¹?ë°©ì „ ?¤íŒŒ???´í™??
    if (LEVELS[currentStage % LEVELS.length].terrain === 'electric') {
        for (let sp = 0; sp < 14; sp++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = 0.3 + Math.random() * 0.45;
            effects.push({
                type: 'particle',
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: 35,
                color: sp % 2 === 0 ? '#fef08a' : '#fbbf24'
            });
        }
    }
}
function createCloudPop(x, y) {
    for (let i = 0; i < 25; i++) {
        effects.push({
            type: 'particle',
            x: x + (Math.random() - 0.5) * 1.0,
            y: y + (Math.random() - 0.5) * 0.5,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3 + 0.05,
            life: 30 + Math.random() * 20,
            color: 'rgba(255, 255, 255, 0.9)'
        });
    }
    effects.push({ type: 'ring', x: x, y: y, life: 20, maxLife: 20, color: 'rgba(255, 255, 255, 0.8)' });
}

function applyDamageAndEffects(target, mx, my) {
    if (target.type === 'ground' && !target.isSurfaced) {
        target.isSurfaced = true;
        effects.push({ type: 'text', x: target.x, y: target.y + 2, text: '?Œí—¤ì¹˜ê¸° ?±ê³µ!', color: '#fbbf24', life: 200 });
    }
    
    if (target.hasCloud) {
        target.hasCloud = false;
        createCloudPop(target.x, target.y - 0.75);
    }
    if (target.isFlying) {
        target.isFlying = false; // ê³µì¤‘??? ìˆ???¬ì¼“ëª¬ì´ ?¼ê²© ??ì¶”ë½?˜ì—¬ ì§€ë©´ì— ?•ìƒ?ìœ¼ë¡??•ì°©?˜ë„ë¡?ë¹„í–‰ ?íƒœ ?´ì œ
    }
    const dx = target.x - mx, dy = target.y - my;
    const dist = Math.sqrt(dx*dx + dy*dy);
    let hitQuality = 'GOOD', hitGold = 20;
    if (dist <= 0.5) { hitQuality = 'PERFECT'; hitGold = 50; }
    else if (dist <= explosionRadius) { hitQuality = 'GREAT'; hitGold = 30; }

    if (enemies.includes(target) || target === player) {
        updateHPUI();
    }
    if (enemies.includes(target)) {
        playerGold += hitGold;
        document.getElementById('ui-player-gold').innerText = playerGold;
    }

    const fallHeight = Math.max(0, missile.maxY - target.y);
    const stage = LEVELS[currentStage % LEVELS.length];
    let mult = 1.0;
    if (stage.terrain === 'lava' && (selectedStarter||{}).type === 'fire') mult = 1.2;
    if (stage.terrain === 'sky'  && (selectedStarter||{}).type === 'flying') mult = 1.2;
    // ?Œì›Œ??êµ¬ë¦„ ?„ì  ë¶€?¤íŠ¸: 1 + 0.5 * n^0.7 (?˜í™•ì²´ê°)
    const n = missile.powerBoostCount || 0;
    const boostMult = n > 0 ? 1 + 0.5 * Math.pow(n, 0.7) : 1.0;
    // ì´ˆì‹¬?ì˜ ë²„í”„: ?¤í…Œ?´ì? ì²??´ì— ?ì„ ë§íˆë©?2ë°??°ë?ì§€
    const firstTurnMult = (isFirstTurn && enemies.includes(target)) ? 2.0 : 1.0;
    const totalDamage = Math.floor((30 + fallHeight * 1.7) * mult * baseDamageBoost * boostMult * firstTurnMult);
    if (isFirstTurn && enemies.includes(target)) {
        isFirstTurn = false;
        player.visualScale = 1.4;
        player.hasAura = 'red';
        effects.push({ type: 'text', x: player.x, y: player.y - 1.8, text: '?’¥ ê¸°ì„  ?œì••!', color: '#ff4500', life: 240 });
    }

    target.hp -= totalDamage;
    target.shake = 20; screenShake = 15;
    // ?‰ë°± ë°©í–¥: ?€ê²??„ì¹˜ Â±1 grid ì§€???’ì´ ë¹„êµ ???´ë¦¬ë§???? ìª??¼ë¡œ ë°€?¤ë‚¨
    // ì°¨ì´ê°€ 0.3 ë¯¸ë§Œ(?‰íƒ„)?´ë©´ ê¸°ì¡´?€ë¡??Œë ˆ?´ì–´ ?„ì¹˜ ê¸°ì?
    const slopeCheckDist = 1.0;
    const terrainRight = getTerrainY(target.x + slopeCheckDist, target.y);
    const terrainLeft  = getTerrainY(target.x - slopeCheckDist, target.y);
    const slopeDiff = terrainRight - terrainLeft; // ?‘ìˆ˜: ?¤ë¥¸ìª½ì´ ??Œ, ?Œìˆ˜: ?¼ìª½????Œ
    let kbDir;
    if (Math.abs(slopeDiff) >= 0.3) {
        kbDir = slopeDiff > 0 ? 1 : -1; // ????? ìª??´ë¦¬ë§??¼ë¡œ ?‰ë°±
    } else {
        kbDir = target.x > player.x ? 1 : -1; // ?‰íƒ„: ?Œë ˆ?´ì–´ ê¸°ì?
    }
    if (target.hp <= 0) {
        // ?¬ë§ ???‰ë°± ?ë„ë¥?ì´ˆê¸°?”í•˜??ê·??ë¦¬(ì²´ë ¥ 0 ?????„ì¹˜)?ì„œ ?í˜¼ ? ë ¹ ?¨ê³¼ë¡??±ë¶ˆ (?°ìŠ¤ì¡?ì¶”ë½ ë°©ì?)
        Object.assign(target, { isKnockedBack: false, vx: 0, vy: 0, angularVelocity: 0, rotation: 0 });
    } else {
        const _kb_isFloatingMap = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
        // ë¶€? ë§µ: ?‰ë°± ???„ë¡œ ?€ì§€ ?Šë„ë¡?vy=0 (?˜í‰ ?‰ë°±ë§??ìš©)
        const _kb_vyInit = _kb_isFloatingMap ? 0 : 0.08 + Math.random() * 0.06;
        Object.assign(target, { isKnockedBack: true, vx: kbDir * (Math.random()*0.02+0.04), vy: _kb_vyInit, angularVelocity: kbDir*(Math.random()*0.02+0.02) });
    }
    if (missile.type !== 'pierce' && missile.type !== 'satellite') {
        createCrater(target.x, target.y - 0.75, explosionRadius);
        createExplosion(target.x, target.y, getMissileColor());
    }
    effects.push({ type: 'text', x: target.x, y: target.y+1.2, text: `-${totalDamage}`, color: '#ff4444', life: 180 });
    if (enemies.includes(target))
        effects.push({ type: 'text', x: target.x, y: target.y+2.8, text: `${hitQuality}! +${hitGold}G`, color: '#fbbf24', life: 180 });
    else
        effects.push({ type: 'text', x: target.x, y: target.y+2.8, text: 'OUCH!', color: '#ef4444', life: 180 });
    if (fallHeight * 1.7 > 20)
        effects.push({ type: 'text', x: target.x, y: target.y+4.4, text: 'FALL DMG!', color: '#fbbf24', life: 240 });
    updateHPUI();

    const deadEnemies = enemies.filter(e => e.hp <= 0).length;
    if (player.hp <= 0) {
        GAME_STATE = 'OVER';
        showMessage('GAME OVER', '?í­?ˆìŠµ?ˆë‹¤...');
    } else if (deadEnemies >= 2 && GAME_STATE !== 'OVER') {
        GAME_STATE = 'OVER';
        if (window.stageClearTimeout) clearTimeout(window.stageClearTimeout);
        window.stageClearTimeout = setTimeout(() => {
            showMessage('STAGE CLEAR!', '??2ë§ˆë¦¬ ì²˜ì¹˜ ?„ë£Œ!', false);
        }, 700);
    } else if (missile.type !== 'pierce' && !missile.active) {
        GAME_STATE = 'IDLE';
        document.getElementById('fire-btn').disabled = false;
    }
}

// ---------- Parabola Missile Step Helper (Constant 2D Speed + 1.3x Descent Acceleration) ----------
// [?ìƒë³µêµ¬ ?”ì²­ ???¬ìš© ê°€?¥í•œ ê¸°ì¡´ ì½”ë“œ]:
// missile.x += missile.dx / 3;
// missile.y = missile.func(missile.x);
function stepParabolaMissile() {
    const dirX = Math.sign(missile.dx) || 1;
    const currY = missile.func(missile.x);
    // ?„ì¬ ?„ì¹˜?ì„œ??ê²½ì‚¬??ê¸°ìš¸ê¸? ê³„ì‚°
    const deltaCheck = 0.005 * dirX;
    const nextYCheck = missile.func(missile.x + deltaCheck);
    const slope = (nextYCheck - currY) / deltaCheck;
    const absSlope = Math.abs(slope);
    
    // ìµœê³ ??Y ê°±ì‹ 
    if (missile.y > (missile.maxY || -Infinity)) {
        missile.maxY = missile.y;
    }

    // x ì§„í–‰ ë°©í–¥ ê¸°ì? yê°€ ê°ì†Œ ì¤‘ì´ë©??˜ê°• ?íƒœë¡?ê°„ì£¼
    const isDescending = (slope * dirX < 0);
    
    // 1. ìµœê³ ??ë¶€ê·??¼ê°?¨ìˆ˜(Sin) ê¸°ë°˜ ? ê¸°??ê°ì† ?¨ê³¼ (v1.2.47 ë°©ì‹ ?ìš©)
    // ë¯¸ë¶„ê°’ì´ 0??sin(t * PI/2) ì»¤ë¸Œë¥??ìš©?˜ì—¬ ìµœê³ ??êº¾ì„??ë¶€?œëŸ½ê²?ë°©ì?
    const apexProgress = Math.min(1.0, absSlope / 1.2);
    const apexFactor = 0.45 + 0.55 * Math.sin(apexProgress * Math.PI * 0.5);
    
    // 2. ?´ë™ ?ë„ ê³„ì‚°
    const baseDS = 0.18;
    let speedMult = 1.0;

    if (!isDescending) {
        // ?ìŠ¹ êµ¬ê°„: ì´ˆê¸° ë°œì‚¬ ê°ë„ ê°€???ìš©
        speedMult = missile.launchBoost || 1.0;
    } else {
        // ?˜ê°• êµ¬ê°„: 1.1ë°?-> 2.5ë°?-> ìµœë? 4.0ë°???† ?™í•˜ ê°€??
        const fallDistance = Math.max(0, (missile.maxY || missile.y) - missile.y);
        const descentAccel = 1.1 + Math.min(2.9, fallDistance * 0.55 + absSlope * 0.5);
        speedMult = descentAccel;
    }

    const targetDS = baseDS * speedMult * apexFactor;
    
    // 2D ê³¡ì„  ê±°ë¦¬ë¥?? ì??˜ë„ë¡?dx ê³„ì‚°: dx = targetDS / sqrt(1 + slope^2) * dirX
    const stepDx = (targetDS / Math.sqrt(1 + slope * slope)) * dirX;
    
    missile.x += stepDx;
    missile.y = missile.func(missile.x);
}

// ---------- Update Loop ----------
function updateGame() {
    if (screenShake > 0) screenShake--;
    enemies.forEach(e => { if (e.shake > 0) e.shake--; });
    if (player.shake > 0) player.shake--;

    // ë°œì „??'electric') ë§? 20ì´ˆë§ˆ??ë²ˆê°œê°€ ?´ë¦¬ì³????¬ì¼“ëª?ê°€ê²?(?‰ë°± ?†ìŒ)
    const currentTerrainKey = LEVELS[currentStage % LEVELS.length].terrain;
    if (currentTerrainKey === 'electric' && player.hp > 0 && GAME_STATE !== 'OVER') {
        const now = Date.now();
        if (!window.lastElectricLightningTime) window.lastElectricLightningTime = now;
        if (now - window.lastElectricLightningTime >= 20000) { // 20ì´ˆë§ˆ??(20000ms)
            window.lastElectricLightningTime = now;
            
            // ë²ˆê°œ ì§€ê·¸ì¬ê·???ê²½ë¡œ ?¬ì „ ê³„ì‚° (?˜ëŠ˜ y=45?ì„œ ???¬ì¼“ëª??„ì¹˜ê¹Œì?)
            const segments = [];
            const topY = 45;
            const bottomY = player.y;
            const stepY = (topY - bottomY) / 7;
            segments.push({ x: player.x, y: topY });
            for (let s = 1; s < 7; s++) {
                const segY = topY - stepY * s;
                const offsetX = player.x + (Math.random() - 0.5) * 2.2;
                segments.push({ x: offsetX, y: segY });
            }
            segments.push({ x: player.x, y: player.y });

            effects.push({
                type: 'lightning',
                x: player.x,
                y: player.y,
                segments: segments,
                life: 25,
                maxLife: 25
            });

            // ?ˆì´ ë¶€?œì? ?Šë„ë¡??€?¨íˆ ë¶€?œëŸ½ê³?ì°¨ë¶„??12% ?¬ëª…???¤í¬ë¦??Œë˜??
            effects.push({
                type: 'softFlash',
                life: 12,
                maxLife: 12
            });

            // ?¬ì¼“ëª?ë°œë°‘ ?€?´ì˜¤ë¥´ëŠ” ?©ê¸ˆë¹??„ê¸° ?¤íŒŒ???Œí‹°??
            for (let pi = 0; pi < 12; pi++) {
                effects.push({
                    type: 'particle',
                    x: player.x,
                    y: player.y + 0.5,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: Math.random() * 0.4 + 0.1,
                    life: 30,
                    color: (pi % 2 === 0) ? '#fbbf24' : '#fef08a'
                });
            }
            // ?ìŠ¤??& ?”ë©´ ?”ë“¤ë¦?& ?°ë?ì§€ (?‰ë°±?€ ?†ìŒ)
            effects.push({
                type: 'text',
                x: player.x,
                y: player.y + 2.8,
                text: '??ë²ˆê°œ ê°•í?! -5HP',
                color: '#fbbf24',
                life: 180
            });
            player.hp = Math.max(1, player.hp - 5); // 5 ?°ë?ì§€ (?¬ë§ ìµœì†Œ 1 ? ì?)
            player.shake = 15;
            screenShake = 12;
            updateHPUI();
        }
    }

    // ?”ì‚° ?©ì•”('lava') ë§?ê¸°ë?: 15ì´ˆë§ˆ??ë¬´ì‘??ì§€?•ì—???¬ë¬¼? ìœ¼ë¡?? ì•„?¤ëŠ” ?©ì•”??
    if (currentTerrainKey === 'lava' && player.hp > 0 && GAME_STATE !== 'OVER') {
        const now = Date.now();
        if (!window.lastLavaEruptionTime) window.lastLavaEruptionTime = now;
        if (now - window.lastLavaEruptionTime >= 15000) { // 15ì´ˆë§ˆ??ë¶„ì¶œ
            window.lastLavaEruptionTime = now;
            
            // ?Œë ˆ?´ì–´?€ 10~15 ê·¸ë¦¬???¨ì–´ì§??œë¤??ì§€?•ì—???œì‘
            const sign = Math.random() < 0.5 ? 1 : -1;
            const dist = 10 + Math.random() * 5;
            const startX = player.x + sign * dist;
            const startY = getTerrainY(startX) - 1.0; // ?…ë³´???´ì§ ?„ë˜?ì„œ ?€?´ë‚˜?¤ëŠ” ?ë‚Œ
            
            effects.push({
                type: 'lava_rock',
                startX: startX,
                startY: startY,
                targetX: player.x,
                targetY: player.y,
                height: 8 + Math.random() * 4, // ìµœê³ ??ì¶”ê? ?’ì´
                maxLife: 75,
                life: 75, // 1.25ì´?ë¹„í–‰
                x: startX,
                y: startY
            });
            
            // ë°œì‚¬ ?„ì¹˜ ?Œí‹°???¨ê³¼
            for (let pi = 0; pi < 15; pi++) {
                effects.push({
                    type: 'particle',
                    x: startX + (Math.random() - 0.5) * 2.0,
                    y: startY + 0.5,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: Math.random() * 0.7 + 0.3, // ?„ë¡œ ?Ÿêµ¬ì¹?
                    life: 45,
                    color: (pi % 2 === 0) ? '#ea580c' : '#dc2626' // ì§™ì? ì£¼í™©, ë¹¨ê°•
                });
            }
            screenShake = 5; // ë°œì‚¬ ???½í•œ ?”ë“¤ë¦?
        }
    }

    // ?´ë‘???™êµ´('cave') ë§?ê¸°ë?: 15ì´ˆë§ˆ???Œë ˆ?´ì–´ ë¨¸ë¦¬ ?„ë¡œ ì¢…ìœ ???™í•˜ (?‰ë°± ?†ìŒ)
    if (currentTerrainKey === 'cave' && player.hp > 0 && GAME_STATE !== 'OVER') {
        const now = Date.now();
        if (!window.lastCaveWarningTime) {
            window.lastCaveWarningTime = now;
            window.caveStalactiteWarned = false;
        }

        const elapsed = now - window.lastCaveWarningTime;

        // 13ì´?~ 15ì´??¬ì´: ì²œì¥?ì„œ ?™ë¨¼ì§€ ê²½ê³  ?´í™??
        if (elapsed >= 13000 && elapsed < 15000) {
            window.caveStalactiteWarned = true;
            // ?Œë ˆ?´ì–´ ë°”ë¡œ ??ì²œì¥ ë¶€ê·?
            const ceilY = TERRAINS['cave'].ceilFunc ? TERRAINS['cave'].ceilFunc(player.x) - 2.0 : 35;
            
            // ë§??„ë ˆ?„ë§ˆ???¼ì • ?•ë¥ ë¡??™ë¨¼ì§€ ?Œí‹°???ì„±
            if (Math.random() < 0.3) {
                effects.push({
                    type: 'particle',
                    x: player.x + (Math.random() - 0.5) * 1.5,
                    y: ceilY,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: -Math.random() * 0.8 - 0.2, // ?„ë˜ë¡??¨ì–´ì§?
                    life: 60,
                    color: Math.random() < 0.5 ? '#737373' : '#a3a3a3' // ?Œìƒ‰ ?™ë¨¼ì§€
                });
            }
        }

        if (elapsed >= 15000) {
            // ì¢…ìœ ???™í•˜ ?œì‘ (15ì´?ê²½ê³¼)
            window.lastCaveWarningTime = now;
            window.caveStalactiteWarned = false;
            
            const ceilY = TERRAINS['cave'].ceilFunc ? Math.max(TERRAINS['cave'].ceilFunc(player.x) - 2.0, player.y + 15) : player.y + 25;

            effects.push({
                type: 'stalactite',
                startX: player.x,
                startY: ceilY,
                targetX: player.x,
                targetY: player.y,
                life: 30, // 30?„ë ˆ???™ì•ˆ ?™í•˜
                maxLife: 30,
                x: player.x,
                y: ceilY
            });
        }
    }

    // ?Œë ˆ?´ì–´ ë°œì‚¬ ëª¨ì…˜ (?í”„ + ?œë°”???Œì „)
    if (player.animFrame > 0) {
        player.animFrame--;
        const p = (30 - player.animFrame) / 30; // 0.0 ~ 1.0
        player.yOffAnim = Math.sin(p * Math.PI) * scaleLength(1.0); // ?„ë¡œ ?•ê¸°ê¸?
        player.rotation = p * Math.PI * 2 * player.facing; // ?Œì „
        if (player.animFrame === 0) {
            player.rotation = 0;
            player.yOffAnim = 0;
        }
    }

    // êµ¬ë© ?œì„œ??ë³µêµ¬ (ë°˜ê²½ ì¶•ì†Œ)
    for (let i = cloudHoles.length - 1; i >= 0; i--) {
        const h = cloudHoles[i];
        h.life--;
        // ?¨ì? ?˜ëª… ë¹„ìœ¨???°ë¼ ë°˜ê²½??0?¼ë¡œ ì¤„ì„ (ë³µêµ¬ ?¨ê³¼)
        h.radius = h.maxRadius * (h.life / h.maxLife);
        if (h.life <= 0) cloudHoles.splice(i, 1);
    }

        for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.life--;
        if (e.type === 'text')     { /* do nothing, stay in place */ }
        if (e.type === 'particle') { e.x += e.vx; e.y += e.vy; e.vy -= 0.02; }
        if (e.type === 'ring')     { /* life ê°ì†Œ */ }
        
        if (e.type === 'lava_rock') {
            const p = 1.0 - (e.life / e.maxLife); // 0.0 ~ 1.0
            e.x = e.startX + (e.targetX - e.startX) * p;
            e.y = e.startY + (e.targetY - e.startY) * p + e.height * 4 * p * (1 - p);
            
            // ?”ë ¤??ë¶ˆê½ƒ ê¼¬ë¦¬ ?Œí‹°???ì„±
            for(let pt = 0; pt < 2; pt++) {
                effects.push({
                    type: 'particle',
                    x: e.x + (Math.random()-0.5)*0.7,
                    y: e.y + (Math.random()-0.5)*0.7,
                    vx: (e.startX - e.targetX) * 0.002 + (Math.random()-0.5)*0.1,
                    vy: Math.random() * 0.15,
                    life: 12 + Math.random() * 10,
                    color: Math.random() > 0.5 ? '#ea580c' : '#fef08a' // ì£¼í™©, ?¸ë‘ ?¼í•©
                });
            }

            if (e.life <= 0) {
                // ?©ì•”????°œ
                if (typeof createExplosion === 'function') createExplosion(e.x, e.y, '#ea580c');
                
                // ??°œ ë°˜ê²½(explosionRadius) ??ëª¨ë“  ?¬ì¼“ëª¬ì—ê²??°ë?ì§€ (?‰ë°± ?†ìŒ)
                [player, ...enemies].forEach(ent => {
                    if (ent.hp <= 0) return;
                    const dx = ent.x - e.x, dy = ent.y - e.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist <= explosionRadius + 0.5) {
                        ent.hp -= 5;
                        ent.shake = 18;
                        effects.push({ type: 'text', x: ent.x, y: ent.y + 2.8, text: '?”¥?©ì•” ??°œ! -5HP', color: '#ea580c', life: 180 });
                    }
                });
                screenShake = 15;
                if (typeof updateHPUI === 'function') updateHPUI();
                if (player.hp <= 0) {
                    GAME_STATE = 'OVER';
                    if (typeof showMessage === 'function') showMessage('GAME OVER', '?¨ê±°???©ì•”?„ì— ?°ëŸ¬ì¡ŒìŠµ?ˆë‹¤...');
                }
            }
        }
        
        if (e.type === 'stalactite') {
            const p = 1.0 - (e.life / e.maxLife); // 0.0 ~ 1.0
            e.x = e.startX;
            // ?™í•˜ ê°€???ë‚Œ???„í•´ p ?œê³± ?¬ìš© (?”ì§„ yì¶•ì? ?„ê? ?‘ìˆ˜)
            e.y = e.startY - (e.startY - e.targetY) * Math.pow(p, 1.5);
            
            if (e.life <= 0) {
                // ?°ë?ì§€ 5~10
                const dmg = 5 + Math.floor(Math.random() * 6);
                player.hp = Math.max(1, player.hp - dmg);
                player.shake = 15;
                screenShake = 15;
                if (typeof updateHPUI === 'function') updateHPUI();

                // ?Œí¸ ?´í™??(?„ë¡œ ?€???Œì¡°ê°ë“¤)
                for (let pi = 0; pi < 15; pi++) {
                    effects.push({
                        type: 'particle',
                        x: player.x,
                        y: player.y + 0.5,
                        vx: (Math.random() - 0.5) * 0.8,
                        vy: Math.random() * 0.6 + 0.2,
                        life: 40,
                        color: Math.random() < 0.5 ? '#525252' : '#737373'
                    });
                }

                // ë¨¼ì? êµ¬ë¦„ ?Œí‹°??(ì¶©ê²© ?¨ê³¼ ë³´ê°•)
                for (let pi = 0; pi < 8; pi++) {
                    effects.push({
                        type: 'particle',
                        x: player.x + (Math.random() - 0.5) * 2,
                        y: player.y + Math.random(),
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: Math.random() * 0.2,
                        life: 50,
                        color: Math.random() < 0.5 ? 'rgba(115,115,115,0.6)' : 'rgba(163,163,163,0.6)'
                    });
                }

                effects.push({
                    type: 'text',
                    x: player.x,
                    y: player.y + 3.0,
                    text: `?ª¨ ì¢…ìœ ???™í•˜! -${dmg}HP`,
                    color: '#d4d4d8',
                    life: 180
                });

                if (player.hp <= 0) {
                    GAME_STATE = 'OVER';
                    if (typeof showMessage === 'function') showMessage('GAME OVER', 'ì¢…ìœ ?ì— ê¹”ë ¤ ?°ëŸ¬ì¡ŒìŠµ?ˆë‹¤...');
                }
            }
        }
        
        if (e.life <= 0) effects.splice(i, 1);
    }

    [player, ...enemies].forEach(ent => {
        if (ent.hp <= 0) {
            ent.isKnockedBack = false; ent.vx = 0; ent.vy = 0; ent.rotation = 0;
            return;
        }
        if (ent.isKnockedBack) {
            // ??isFloatingMapLocal ë°˜ë“œ??ì²??¬ìš© ?´ì „??? ì–¸ ??TDZ ReferenceError ë°©ì?
            const isFloatingMapLocal = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
            // ?¤ìŒ x ?„ì¹˜??ì§€???’ì´ë¥?ë¯¸ë¦¬ ?•ì¸ ??ê¸‰ê²½???¸ë•/?¤íŒŒ?´í¬ ë²????¬ë¼?€???œê°„ ?í”„ ë°©ì?
            const nextX   = ent.x + ent.vx;
            const nextGY  = getTerrainY(nextX, ent.y) + 0.75;
            const currGY  = getTerrainY(ent.x, ent.y)  + 0.75;
            // ?¤ìŒ ?„ì¹˜??ì§€?•ì´ ?„ì¬ yë³´ë‹¤ 0.3 ?´ìƒ ?’ìœ¼ë©?"ë²??¼ë¡œ ê°„ì£¼ ??vx ë°˜ì‚¬, x??? ì?
            // ?? ë¶€??ë§?isFloating)?ì„œ ì°¨ì´ê°€ 3.0 ì´ˆê³¼??ê²½ìš°ë§?"?¤ë¥¸ ??ì¸??¼ë¡œ ê°„ì£¼?˜ì—¬ ?µê³¼ ?ˆìš©
            if (nextGY > ent.y + 0.3 && (nextGY <= ent.y + 3.0 || !isFloatingMapLocal)) {
                ent.vx *= -0.55;
            } else {
                ent.x = nextX;
            }
            ent.y += ent.vy;
            ent.rotation += ent.angularVelocity;
            ent.vy -= 0.03; // ì¤‘ë ¥ ê°€?ë„ 1.5ë°??í–¥ (-0.02 -> -0.03)
            const limitX = 60;
            if (ent.x - ent.w/2 < -limitX) { ent.x = -limitX + ent.w/2; ent.vx *= -0.8; }
            if (ent.x + ent.w/2 >  limitX) { ent.x =  limitX - ent.w/2; ent.vx *= -0.8; }
            const enemyGroundOffset = (ent !== player) ? 0.95 : 0.75; // ???¬ì¼“ëª¬ë§Œ 0.2 ?„ë¡œ ?¬ë ¤??ë°œì´ ì§€ë©´ì— ? ê¸°ì§€ ?Šê²Œ
            const groundY = getTerrainY(ent.x, ent.y) + enemyGroundOffset;
            const slopeRightY = getTerrainY(ent.x + 0.2, ent.y) + enemyGroundOffset; // groundY?€ ?™ì¼??offset ?¬ìš©?´ì•¼ isValleyBottom ?ì •???•í™•??
            const slopeLeftY = getTerrainY(ent.x - 0.2, ent.y) + enemyGroundOffset;
            const isValleyBottom = (slopeRightY > groundY + 0.01) && (slopeLeftY > groundY + 0.01);

            if (ent.y < groundY) {
                if (groundY - ent.y > 1.5) {
                    // ê°€?Œë¥¸ ?ˆë²½/?¬ë ˆ?´í„° ë²½ì— ?˜í‰?¼ë¡œ ë¶€?ªíŒ ê²½ìš°: ê³¨ì§œê¸??€??ë°˜ì‚¬ ê°ì‡„
                    ent.vx *= isValleyBottom ? -0.2 : -0.5; // ê³¨ì§œê¸??€??ë²?ë¶€?ªí˜ ??ë°˜ë°œ ?€??ê°ì†Œ
                    ent.x += ent.vx; // ë²½ì—??ë°€?´ë‚´???¼ì„ ë°©ì?
                    ent.vy *= 0.8; // ë²½ì— ë§ˆì°°?˜ì–´ ?¨ì–´ì§€???ë„ ê°ì‡„
                    if (isValleyBottom && Math.abs(ent.vx) < 0.25) {
                        ent.vx = 0; // ê³¨ì§œê¸?ë°”ë‹¥ ê°ì‡„
                    }
                    // ê°€?Œë¥¸ ê³¨ì§œê¸°ì—???ë„ê°€ ì¶©ë¶„???‘ìœ¼ë©?ê°•ì œ ?•ì? (ë¬´í•œì§„ë™ ë°©ì?)
                    if (Math.abs(ent.vx) < 0.08 && Math.abs(ent.vy) < 0.15) {
                        // ë¶€? ë§µ: ??ë°”ë‹¥ ?„ë˜?´ê±°?? ?˜ë‹¨?’ìƒ???ˆì´???í”„(?í–¥ ?”ë ˆ?¬íŠ¸) ì°¨ë‹¨
                        // groundLayerIdx=-1(flying ?? ë°?ê°™ì? ?ˆì´???ê±°ë¦??¤ëƒ…ê¹Œì? ì»¤ë²„?˜ëŠ” ê±°ë¦¬ ì°¨ë‹¨ ì¶”ê?
                        const _kb_islandB = getTerrainBottom(ent.x, ent.y);
                        const _kb_below = _kb_islandB !== -1000 && ent.y < _kb_islandB + 0.1;
                        const _kb_layerIdx = getTerrainLayerIndex(ent.x, ent.y);
                        const _kb_isFloating = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
                        // ?ˆì´???í”„ ì°¨ë‹¨ (groundLayerIdxê°€ ?ˆì„ ??
                        const _kb_layerJump = _kb_isFloating && ent.groundLayerIdx >= 0 && _kb_layerIdx >= 0 && _kb_layerIdx < ent.groundLayerIdx && (groundY - ent.y) > 1.5;
                        // ê±°ë¦¬ ì°¨ë‹¨: flying ??groundLayerIdx=-1)?´ë‚˜ ê°™ì? ?ˆì´???ê±°ë¦??¤ëƒ…ê¹Œì? ë³´ì™„
                        const _kb_distBlock = _kb_isFloating && (groundY - ent.y) > 1.5;
                        if (!_kb_below && !_kb_layerJump && !_kb_distBlock) { ent.y = groundY; if (_kb_layerIdx >= 0) ent.groundLayerIdx = _kb_layerIdx; }
                        ent.isKnockedBack = false; ent.vy = ent.vx = ent.rotation = ent.angularVelocity = 0;
                        // KB ?•ë¦¬ ?¤ëƒ… (ë¶€? ë§µ ?„ìš©): KB ì¢…ë£Œ ?„ì—??ê°™ì? ?ˆì´??êµ¬ë¦„ ?„ë˜(0.05~5? ë‹›)??
                        // ë¨¸ë¬¼???ˆëŠ” ê²½ìš° ì¦‰ì‹œ ì°©ì?. normal physics?ì„œ 4~5? ë‹› ?„ë¡œ ?œê°„?´ë™(?Ÿêµ¬ì¹??˜ê±°??
                        // ê·¸ë?ë¡?ì¶”ë½?˜ëŠ” ?‘ìª½ ë²„ê·¸ë¥??™ì‹œ??ì°¨ë‹¨?˜ëŠ” ?¨ì¼ ë³´ì • ?¤ëƒ….
                        if (_kb_isFloating && !_kb_below && _kb_layerIdx >= 0 && _kb_layerIdx === ent.groundLayerIdx) {
                            // ent.xê°€ steep wall ë°˜ì‚¬ë¡?ê°±ì‹ ?ìœ¼ë¯€ë¡?groundY ?¬ê³„??
                            const _kb_cleanupGY = getTerrainY(ent.x, ent.y) + enemyGroundOffset;
                            const _kb_cleanupDist = _kb_cleanupGY - ent.y;
                            if (_kb_cleanupDist > 0.05 && _kb_cleanupDist <= 5.5) {
                                ent.y = _kb_cleanupGY;
                                ent.groundLayerIdx = _kb_layerIdx;
                            }
                        }
                    }
                } else {
                    // ?¼ë°˜?ì¸ ë°”ë‹¥ ì¶©ëŒ
                    const snapDist = groundY - ent.y;
                    // ???˜í‰ ?´ë™?¼ë¡œ ê²½ì‚¬ë©??€ê³??Ÿêµ¬ì¹˜ëŠ” ë²„ê·¸ ë°©ì?
                    // ?¤ëƒ… ê±°ë¦¬ê°€ ?´ë²ˆ ?„ë ˆ???™í•˜?ë„(|vy|)+?¬ìœ (0.3)ë³´ë‹¤ ?¬ë©´
                    // ???„ì—???¨ì–´ì§?ê²??„ë‹ˆ???†ìœ¼ë¡?ë¹„íƒˆ???€ê³??ˆëŠ” ê²???ë²?ì²˜ë¦¬
                    if (snapDist > Math.abs(ent.vy) + 0.3) {
                        ent.vx *= -0.55;
                        // y???¤ëƒ…?˜ì? ?ŠìŒ (?¤ìŒ ?„ë ˆ?„ì—???ì—°?¤ëŸ½ê²?ì²˜ë¦¬)
                    } else {
                    // ë¶€? ë§µ: else branch?ì„œ dist????ƒ ??.5?´ë?ë¡??ë˜ dist>1.5 ì¡°ê±´?€ dead code
                    // ???œê±°?˜ì—¬ layerJump ?¤ì œ ?‘ë™: groundLayerIdxë³´ë‹¤ ???(?’ì? ê³ ë„) ?ˆì´???¤ëƒ… ì°¨ë‹¨
                    const _eb_isFloating = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
                    const _eb_layerIdx = _eb_isFloating ? getTerrainLayerIndex(ent.x, ent.y) : -1;
                    const _eb_layerJump = _eb_isFloating && ent.groundLayerIdx >= 0 && _eb_layerIdx >= 0 && _eb_layerIdx < ent.groundLayerIdx;
                    // dist>3.0 ?ˆë? ì°¨ë‹¨ ?œê±° (KB ì¢…ë£Œ ??êµ¬ë¦„ë³´ë‹¤ 3+? ë‹› ?„ë˜ entity???•ìƒ ?¤ëƒ…??ë§‰ëŠ” ?Œê? ? ë°œ)
                    const _eb_distBlock = _eb_isFloating && (groundY - ent.y) > 3.0;
                    if (_eb_layerJump || _eb_distBlock) {
                        ent.vx *= -0.55; // ?ë‹¨ êµ¬ë¦„?¼ë¡œ???œê°„?´ë™ ì°¨ë‹¨ ??ë²?ì²˜ë¦¬
                    } else {
                    ent.y = groundY; 
                    if (_eb_layerIdx >= 0) ent.groundLayerIdx = _eb_layerIdx;
                    ent.vy *= -0.4; 

                    
                    const slopeDiff = slopeRightY - slopeLeftY;
                    let safeSlopeDiff = slopeDiff;
                    if (safeSlopeDiff > 2.0) safeSlopeDiff = 2.0;
                    if (safeSlopeDiff < -2.0) safeSlopeDiff = -2.0;
                    
                    // ?„ì´??ë§? ê²½ì‚¬ ê°€??0.05 (?ë³¸ 0.15??1/3) ???„ì „?œê±° ??vx ë¶€ì¡±ìœ¼ë¡?ë²½ë°˜??ì§„ë™ ë°œìƒ
                    // ê·???ë§? ê²½ì‚¬?„ì— ë¹„ë???ê°€??0.15 ?ìš©
                    const isIceMap = LEVELS[currentStage % LEVELS.length].terrain === 'ice';
                    const slopeAccel = isIceMap ? 0.05 : 0.15;
                    if (Math.abs(safeSlopeDiff) > 0.05 && !isValleyBottom) {
                        ent.vx += -safeSlopeDiff * slopeAccel;
                    }
                    
                    const iceFriction = (LEVELS[currentStage % LEVELS.length].terrain === 'ice') ? 0.80 : 0.55;
                    let friction = isValleyBottom ? 0.3 : iceFriction;
                    // ê³¨ì§œê¸?ì§„ë™ ë°©ì?: ?¤ë¥´ë§‰ì„ ?¤ë? ???ë„ ë°©í–¥ê³?ê²½ì‚¬ ë°©í–¥??ê°™ì„ ?? ?´ë™?ë„ˆì§€ë¥??¬ê²Œ ê¹ìŒ
                    if (ent.vx * safeSlopeDiff > 0) friction = 0.2;
                    ent.vx *= friction;
                    ent.angularVelocity *= 0.5;
                    
                    // ê³¨ì§œê¸??€?ì´ê±°ë‚˜ ?ë„ê°€ ?ì„ ê²½ìš° ì¦‰ì‹œ ì°©ì? ?•ì?
                    const thresh = isValleyBottom ? 0.25 : 0.1;
                    if (Math.abs(ent.vy) < thresh && Math.abs(ent.vx) < thresh) {
                        if (isValleyBottom || Math.abs(slopeDiff) <= 0.15) {
                            ent.isKnockedBack = false; ent.vy = ent.vx = ent.rotation = 0;
                        }
                    }
                    } // _eb_layerJump ?„ë‹ ???•ìƒ ì°©ì?) else ì¢…ë£Œ
                    } // lateral-climb ?„ë‹ ???•ìƒ ì°©ì?) else ì¢…ë£Œ
                }
            }
        } else {
            const isGroundType = ent.type === 'ground' && !ent.isSurfaced;
            const groundOffset = (ent !== player) ? 0.95 : 0.75; // ???¬ì¼“ëª¬ë§Œ 0.2 ?„ë¡œ
            const groundY = getTerrainY(ent.x, ent.y) + (isGroundType ? -1.3 : groundOffset);
            // ë¹„í–‰ ?”í‹°?°ë¼??ë°œì•„??ì§€?•ì´ ?„ì „???Œê´´??ê²½ìš°(groundY < deathZone) ??ì¤‘ë ¥ ?ìš©?˜ì—¬ ?™í•˜
            const _curDeathZone = (TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].deathZoneY !== undefined)
                ? TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].deathZoneY : -8;
            const _isOverVoid = groundY < _curDeathZone;
            if (!ent.isFlying || _isOverVoid) {
                // ë¶€? ë§µ: ?”í‹°?°ê? ??ë°”ë‹¥ ?„ë˜???ˆìœ¼ë©??¤ëƒ… ê¸ˆì? (???„ë¡œ ?œê°„?´ë™ ë°©ì?)
                const _np_islandB = getTerrainBottom(ent.x, ent.y);
                const _np_below = _np_islandB !== -1000 && ent.y < _np_islandB + 0.1;
                const _np_layerIdx = getTerrainLayerIndex(ent.x, ent.y);
                const _np_isFloating = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain].isFloating;
                // ë¶€? ë§µ: ?´ì „ ì°©ì? ?ˆì´?´ë³´???’ì? ?ˆì´?´ê? ê°ì??˜ê³  ê±°ë¦¬ 1.5ì´ˆê³¼ ???ˆì´???í”„ ??ì¤‘ë ¥ ?ìš© (ê³ ì²´ ì§€?•ì? ??ƒ ?¤ëƒ…)
                const _np_layerJump = _np_isFloating && ent.groundLayerIdx >= 0 && _np_layerIdx >= 0 && _np_layerIdx < ent.groundLayerIdx && (groundY - ent.y) > 1.5;
                // ë¶€? ë§µ: ?¤ëƒ… ì°¨ë‹¨ ???¤ë¥¸ ?ˆì´?????’ì? êµ¬ë¦„)?´ë©´ ?ê±°ë¦??¤ëƒ… ì°¨ë‹¨
                // dist>3.0 ?ˆë?ê±°ë¦¬ ì°¨ë‹¨?€ ?œê±°: KB ì¢…ë£Œ ??entityê°€ êµ¬ë¦„ ?„ë˜ 3+? ë‹›???ˆì„ ???•ìƒ ?¤ëƒ…??ë§‰ëŠ” ?Œê? ? ë°œ
                const _np_distBlock = _np_isFloating && (groundY - ent.y) > 1.5 &&
                    (ent.groundLayerIdx < 0 || _np_layerIdx < 0 || _np_layerIdx !== ent.groundLayerIdx);
                if (ent.y > groundY + 0.1 || _np_below || _np_layerJump || _np_distBlock) { ent.vy -= 0.03; ent.y += ent.vy; }
                else { ent.y = Math.max(groundY, ent.y); ent.vy = 0; if (_np_layerIdx >= 0) ent.groundLayerIdx = _np_layerIdx; }
            }
        }
        const currentTerrainData = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain];
        const deathZoneY = currentTerrainData.deathZoneY !== undefined ? currentTerrainData.deathZoneY : -8;
        if (ent.y < deathZoneY && ent.hp > 0) {
            ent.hp = 0;
            createExplosion(ent.x, deathZoneY, '#ffffff');
            effects.push({ type: 'text', x: ent.x, y: deathZoneY + 2, text: 'FALL!', color: '#ef4444', life: 60 });
            updateHPUI();
            if (ent === player) { GAME_STATE = 'OVER'; setTimeout(() => showMessage('GAME OVER', '?Œë ˆ?´ì–´ê°€ ì¶”ë½?ˆìŠµ?ˆë‹¤!'), 1500); }
            else if (GAME_STATE !== 'OVER' && enemies.filter(e => e.hp <= 0).length >= 2) { GAME_STATE = 'OVER'; window.stageClearTimeout = setTimeout(() => showMessage('STAGE CLEAR!', '??2ë§ˆë¦¬ ì²˜ì¹˜ ?„ë£Œ!', false), 700); }
        }
    });

    if (GAME_STATE === 'FIRING' && missile.active) {
        for (let i = 0; i < 3; i++) {
            const distFromLaunch = Math.hypot(missile.x - missile.startX, missile.y - missile.startY);
            if (!missile.hasLeftPlayer && (!checkCollision(missile.x, missile.y, player) || distFromLaunch > 0.4)) {
                missile.hasLeftPlayer = true;
            }

            const prevStepX = missile.x;
            const prevStepY = missile.y;

// ...
            if (missile.type === 'homing') {
                if (missile.isHoming) {
                    if (missile.homingTarget && missile.homingTarget.hp > 0) {
                        const targetX = missile.homingTarget.x;
                        const targetY = missile.homingTarget.y;
                        const angle = Math.atan2(targetY - missile.y, targetX - missile.x);
                        const speed = Math.max(0.32, Math.abs(missile.dx) * 0.95); // ?½ì˜¨ ???¼ì§???Œì§„ ?ë„ ë¯¸ì„¸ ì¡°ìœ¨ (ë¶€?œëŸ½ê³??ì ˆ???ë„ê°?
                        missile.x += Math.cos(angle) * speed;
                        missile.y += Math.sin(angle) * speed;
                    } else {
                        // ?€ê²Ÿì´ ?´ë? ì£½ì—ˆ?¼ë©´ ê´€?±ìœ¼ë¡??™í•˜
                        missile.y -= 0.15;
                        missile.x += missile.dx / 3;
                    }
                } else {
                    const prevY = missile.y;
                    stepParabolaMissile();
                    
                    if (missile.y > missile.startY + 0.3) {
                        missile.hasClimbed = true;
                    }
                    
                    // ìµœê³ ??ê¼?§“?? ?„ë‹¬ ê²€ì¦?
                    // ?ìŠ¹ ???˜ê°•???œì‘?ˆê±°?? ìµœì†Œ 3.0 ê±°ë¦¬ ?´ìƒ ? ì•„ê°????˜ê°• ?œì‘ ?œì 
                    const isApexReached = (missile.hasClimbed && missile.y < prevY) ||
                                          (Math.abs(missile.x - missile.startX) >= 3.0 && missile.y < prevY);

                    if (isApexReached) {
                        let nearest = null;
                        let minDist = Infinity;
                        enemies.forEach(e => {
                            if (e.hp > 0) {
                                const dist = Math.hypot(e.x - missile.x, e.y - missile.y);
                                if (dist < minDist) { minDist = dist; nearest = e; }
                            }
                        });
                        if (nearest) {
                            missile.isHoming = true;
                            missile.homingTarget = nearest;
                            // ê¼?§“?ì—??ê°€??ê°€ê¹Œìš´ ?ì„ ?¥í•´ ì§ì§„ ?„í™˜ ???Œí‹°???°ì¶œ
                            effects.push({ type: 'text', x: missile.x, y: missile.y + 1.2, text: 'TARGET LOCK!', color: '#c084fc', life: 60 });
                            for (let pi = 0; pi < 15; pi++) {
                                effects.push({ type: 'particle', x: missile.x, y: missile.y, vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6, life: 35, color: '#c084fc' });
                            }
                        }
                    }
                }
            } else {
                stepParabolaMissile();
            }
            
            missile.distanceTraveled = Math.abs(missile.x - missile.startX);
            if (missile.y > missile.maxY) missile.maxY = missile.y;

            // ?Œì›Œ êµ¬ë¦„ ?µê³¼ ?¬ë? ì²´í¬ + êµ¬ë© ?ì„±
            cloudParams.forEach(cp => {
                const cx = cp.bx + Math.sin(Date.now() / cp.speed) * 1.5;
                const cy = cp.by + Math.cos(Date.now() / (cp.speed * 1.3)) * 0.5;
                const stretchX = cp.stretchX || 1.0;
                const dx = (missile.x - cx) / stretchX;
                const dy = missile.y - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const cloudLogicRadius = cp.radius * 1.5;

                // ?Œì›Œ??êµ¬ë¦„ ?µê³¼ ???Œì›Œë¶€?¤íŠ¸
                if (cp.isPowerCloud && !cp._hitByCurrentMissile && dist < cloudLogicRadius) {
                    cp._hitByCurrentMissile = true;
                    missile.powerBoostCount = (missile.powerBoostCount || 0) + 1;
                    // ?¬ì¼“ëª??ì„±???°ë¥¸ ?´í™???‰ìƒ
                    const eColors = { fire: '#ef4444', electric: '#fbbf24', water: '#3b82f6', flying: '#38bdf8', grass: '#22c55e', normal: '#a8a29e', psychic: '#ec4899' };
                    const eColor = eColors[cp.colorType] || '#fbbf24';
                    if (currentTerrainKey === 'ocean') {
                        // ë²„ë¸”???°ì????´í™??(?Œí‹°????ì¦ê?, ?¼ì§ ì¦ê?)
                        for (let pi=0; pi<15; pi++) {
                            effects.push({ type: 'particle', x: cx, y: cy, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, life: 30 + Math.random()*20, color: eColor });
                        }
                        // ë²„ë¸”???œë¤???¤ë¥¸ ê³³ìœ¼ë¡?ì¦‰ì‹œ ?¬ìƒ??
                        cp.bx = (Math.random() - 0.5) * 20; // -10 ~ 10
                        cp.by = 8 + Math.random() * 15;     // 8 ~ 23
                    } else {
                        // ?¼ë°˜ ?Œì›Œ??êµ¬ë¦„???µê³¼ ?´í™??
                        for (let pi=0; pi<5; pi++) {
                            effects.push({ type: 'particle', x: missile.x, y: missile.y, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, life: 40, color: eColor });
                        }
                    }
                }

                // êµ¬ë© ?ì„±: ê±°ë¦¬ ê¸°ë°˜ ?œí•œ?¼ë¡œ êµ¬ë© ??¦ ë°©ì? (ë³‘ëª©??ìµœì ??
                if (dist < cloudLogicRadius) {
                    const holeR = cp.radius * 0.4;
                    // ë§ˆì?ë§?êµ¬ë©ê³??¼ì • ê±°ë¦¬ ?´ìƒ ?¨ì–´?¸ì•¼ë§???êµ¬ë© ?ì„±
                    let shouldPunch = true;
                    if (cloudHoles.length > 0) {
                        const last = cloudHoles[cloudHoles.length - 1];
                        const hdx = last.x - missile.x;
                        const hdy = last.y - missile.y;
                        if (hdx * hdx + hdy * hdy < holeR * holeR * 0.64) {
                            shouldPunch = false;
                        }
                    }
                    if (shouldPunch) {
                        cloudHoles.push({
                            x: missile.x + (Math.random()-0.5) * 0.2,
                            y: missile.y + (Math.random()-0.5) * 0.2,
                            radius: holeR,
                            maxRadius: holeR,
                            life: 480,
                            maxLife: 480
                        });
                    }
                }
            });
            missile.trail.push({ x: missile.x, y: missile.y });

            // ---- ?ì„  ì¶©ëŒ ì²´í¬ (ë¯¸ì‚¬?¼ì? ê´€?µí•˜??ê³„ì† ì§„í–‰) ----
            for (const b of balloons) {
                if (!b.active) continue;
                const bdx = missile.x - b.x, bdy = missile.y - b.y;
                if (Math.sqrt(bdx * bdx + bdy * bdy) <= b.radius) {
                    b.active = false;
                    // ?? ?Œí‹°??+ ë§??´í™??
                    const bColor = b.type === 'gold' ? '#fbbf24' : '#ef4444';
                    for (let pi = 0; pi < 20; pi++)
                        effects.push({ type: 'particle', x: b.x, y: b.y,
                            vx: (Math.random()-0.5)*0.7, vy: (Math.random()-0.5)*0.7 + 0.1,
                            life: 40, color: bColor });
                    effects.push({ type: 'ring', x: b.x, y: b.y, life: 28, maxLife: 28, color: bColor });
                    // ë³´ìƒ ì§€ê¸?
                    if (b.type === 'gold') {
                        const gold = 40 + Math.floor(Math.random() * 41); // 40~80G
                        playerGold += gold;
                        document.getElementById('ui-player-gold').innerText = playerGold;
                        effects.push({ type: 'text', x: b.x, y: b.y + 1, text: `?ª™ +${gold}G`, color: '#fbbf24', life: 150 });
                    } else {
                        baseDamageBoost = Math.min(2.5, baseDamageBoost * 1.35);
                        effects.push({ type: 'text', x: b.x, y: b.y + 1, text: '??POWER UP!', color: '#f87171', life: 150 });
                    }
                }
            }

            if (missile.y > 40) {
                missile.active = false; GAME_STATE = 'OVER';
                createExplosion(missile.x, 40, '#ffffff');
                setTimeout(() => showMessage('OUT!', 'ê·¸ë˜?„ê? ì²œì¥ (<math-field read-only style="font-size:1.1rem; min-height:0; padding:2px 2px; border:none; background:rgba(0,0,0,0.5); display:inline-block; vertical-align:-1px;">y=40</math-field>)??ë²—ì–´?¬ìŠµ?ˆë‹¤.'), 500);
                return;
            }
            // ë°˜ì‚¬??ë¯¸ì‚¬?¼ì´ ?Œë ˆ?´ì–´?€ ì¶©ëŒ?˜ëŠ”ì§€ ì²´í¬
            if (missile.isReflected && checkCollision(missile.x, missile.y, player)) {
                missile.active = false;
                applyDamageAndEffects(player, missile.x, missile.y);
                return;
            }

            // ë°°ë¦¬??ì¶©ëŒ ì²´í¬
            let barrierHitEnemy = null;
            for (const e of enemies) {
                if (e.hp > 0 && e.barrierType) {
                    if (checkBarrierCollision(missile.x, missile.y, e)) {
                        barrierHitEnemy = e;
                        break;
                    }
                }
            }

            if (barrierHitEnemy) {
                handleBarrierCollision(barrierHitEnemy);
                return;
            }

            
            const stage = LEVELS[currentStage % LEVELS.length];
            const tData = TERRAINS[stage.terrain];
            const isFloatingMapLocal = tData.isFloating;
            
            const stepVx = missile.x - prevStepX;
            const stepVy = missile.y - prevStepY;
            const dist = Math.hypot(stepVx, stepVy);
            const stepSize = tData.islands ? 0.05 : 0.1;
            const steps = Math.max(1, Math.ceil(dist / stepSize));
            
            let hitPoint = null;
            let hitY = -100;
            let directHitTarget = null;
            
            for (let step = 1; step <= steps; step++) {
                const tx = prevStepX + (stepVx * step) / steps;
                const ty = prevStepY + (stepVy * step) / steps;
                
                // 1. ì§€??ì¶©ëŒ ê²€??(ì¹˜íŠ¸ ë¯¸ì‚¬?¼ì? ì§€?•ì— ë¬»íŒ ?ë„ ?€ê²?ê°€?¥í•˜?„ë¡ ì§€??ì¶©ëŒ ?°íšŒ)
                let insideTerrain = false;
                if (!missile.isCheat) {
                    if (tData.islands) {
                        for (let l = 0; l < tData.islands.length; l++) {
                            for (const s of tData.islands[l]) {
                                const dx0 = tx - s.cx;
                                const dy0 = ty - s.cy;
                                const rot = s.rot || 0;
                                const cosR = Math.cos(-rot);
                                const sinR = Math.sin(-rot);
                                const dx = dx0 * cosR - dy0 * sinR;
                                const dy = dx0 * sinR + dy0 * cosR;
                                if ((dx*dx)/(s.rx*s.rx) + (dy*dy)/(s.ry*s.ry) <= 1.0) { insideTerrain = true; break; }
                            }
                            if (insideTerrain) break;
                        }
                    } else {
                        const key = (Math.round(tx * 10) / 10).toFixed(1);
                        
                        if (tData.hasCaveWall && typeof ceilHeights !== 'undefined') {
                            if (ceilHeights[key] !== undefined) {
                                if (ty >= ceilHeights[key]) { insideTerrain = true; }
                            } else if (tData.ceilFunc) {
                                if (ty >= tData.ceilFunc(tx)) { insideTerrain = true; }
                            }
                        }

                        if (!insideTerrain) {
                            const origYs = originalTerrainHeights[key] || [];
                            for (let i = 0; i < origYs.length; i++) {
                                const origY = origYs[i];
                                if (ty <= origY && origY !== -100) {
                                    if (isFloatingMapLocal || stage.terrain === 'sky' || stage.terrain === 'log_bridge') {
                                        const bottomY = origY - 5.0; 
                                        if (ty >= bottomY) { insideTerrain = true; break; }
                                    } else {
                                        insideTerrain = true; break;
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (insideTerrain) {
                    let insideCrater = false;
                    if (typeof craters !== 'undefined') {
                        for (const c of craters) {
                            if (Math.hypot(tx - c.x, ty - c.y) <= c.r) { insideCrater = true; break; }
                        }
                    }
                    if (!insideCrater) { 
                        if (missile.type !== 'pierce') {
                            hitPoint = {x: tx, y: ty}; 
                            break; 
                        }
                    }
                }

                // 2. ???¬ì¼“ëª?ì¶©ëŒ ê²€??
                let directHit = null;
                let targetsToCheck = [...enemies];
                if (missile.isReflected) targetsToCheck.push(player);
                for (const e of targetsToCheck) {
                    if (e.hp > 0 && checkCollision(tx, ty, e)) {
                        if (missile.type === 'pierce') {
                            if (!missile.hitTargets.has(e)) {
                                missile.hitTargets.add(e);
                                // ì§€?????”ê·¸???? ?œë©´ ?¤ëƒ…
                                const pierceSurfY = getTerrainY(e.x, e.y) + 0.75;
                                if (e.y < pierceSurfY - 0.1) { e.y = pierceSurfY; e.vy = 0; }
                                applyDamageAndEffects(e, tx, ty);
                                effects.push({ type: 'text', x: e.x, y: e.y + 1.8, text: 'PIERCE!', color: '#00e5ff', life: 120 });
                                effects.push({ type: 'ring', x: e.x, y: e.y, color: '#00e5ff', life: 25, maxLife: 25 });
                                for (let pi = 0; pi < 15; pi++) {
                                    const ang = (pi / 15) * Math.PI * 2;
                                    const spd = 0.25 + Math.random() * 0.45;
                                    effects.push({ type: 'particle', x: e.x, y: e.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 30, color: pi % 2 === 0 ? '#00e5ff' : '#ffffff' });
                                }
                                screenShake = 12;
                            }
                        } else {
                            directHit = e; break;
                        }
                    }
                }
                
                if (directHit && missile.type !== 'pierce') {
                    hitPoint = {x: tx, y: ty};
                    directHitTarget = directHit;
                    break;
                }
            }
            
            if (hitPoint) {
                missile.x = hitPoint.x;
                missile.y = hitPoint.y;
                hitY = hitPoint.y;
            }
            
            // ì¹˜íŠ¸ ë¯¸ì‚¬?? ??ì§ê²© ???°ë?ì§€ + ë¯¸ì‚¬???•ì? (?„ì„±??ê·¸ë¬¼???¹ìˆ˜?¨ê³¼ ì§€??
            if (missile.isCheat && directHitTarget && directHitTarget.hp > 0) {
                missile.active = false; GAME_STATE = 'IDLE';
                const chtX = missile.x, chtY = missile.y;
                
                if (missile.type === 'satellite') {
                    document.getElementById('fire-btn').disabled = true;
                    const fixedSatCraterY = Math.min(chtY, getTerrainY(chtX));
                    for (let i = 0; i < 4; i++) {
                        setTimeout(() => {
                            if (GAME_STATE === 'OVER') return;
                            effects.push({ type: 'laser', x: chtX, y: fixedSatCraterY, life: 15 });
                            screenShake = 15;
                            if (i === 0) {
                                createCrater(chtX, fixedSatCraterY, explosionRadius);
                            }
                            const targets = [player, ...enemies];
                            targets.forEach(ent => {
                                const inRadius = Math.hypot(ent.x - chtX, ent.y - chtY) <= explosionRadius + 1.5;
                                const inColumn = Math.abs(ent.x - chtX) <= explosionRadius + 0.5 && ent.y >= chtY;
                                if (ent.hp > 0 && (inRadius || inColumn)) {
                                    // ì§€?˜ì— ?ˆëŠ” ???”ê·¸?????€ ì§€ë©??„ë¡œ ë¨¼ì? ?¬ë ¤ì¤?
                                    const surfaceY = getTerrainY(ent.x, ent.y) + 0.75;
                                    if (ent.y < surfaceY - 0.1) { ent.y = surfaceY; ent.vy = 0; }
                                    applyDamageAndEffects(ent, chtX, chtY);
                                }
                            });
                            if (i === 3 && GAME_STATE !== 'OVER') {
                                setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                            }
                        }, i * 250);
                    }
                    return;
                } else if (missile.type === 'net') {
                    document.getElementById('fire-btn').disabled = true;
                    const netRadius = 3;
                    effects.push({ type: 'netPull', x: chtX, y: chtY, life: 40, maxLife: 40 });
                    screenShake = 8;
                    let pulled = [];
                    enemies.forEach(ent => {
                        if (ent.hp <= 0) return;
                        if (Math.hypot(ent.x - chtX, ent.y - chtY) <= netRadius) pulled.push(ent);
                    });
                    setTimeout(() => {
                        pulled.forEach(ent => {
                            if (ent.hp <= 0) return;
                            ent.x = chtX;
                            ent.y = Math.max(getTerrainY(chtX, ent.y) + 0.75, chtY);
                            ent.isKnockedBack = false; ent.vx = 0; ent.vy = 0;
                            applyDamageAndEffects(ent, chtX, chtY);
                        });
                        if (player.hp > 0 && Math.hypot(player.x - chtX, player.y - chtY) <= netRadius) {
                            applyDamageAndEffects(player, chtX, chtY);
                        }
                        createExplosion(chtX, chtY, '#2dd4bf');
                        createCrater(chtX, chtY - 0.5, explosionRadius);
                        if (GAME_STATE !== 'OVER') {
                            setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                        }
                    }, 400);
                    return;
                } else {
                    createExplosion(chtX, chtY, getMissileColor());
                    createCrater(chtX, chtY, explosionRadius);
                    // ì§€?????”ê·¸???? ?œë©´ ?¤ëƒ…
                    const dtSurfY = getTerrainY(directHitTarget.x, directHitTarget.y) + 0.75;
                    if (directHitTarget.y < dtSurfY - 0.1) { directHitTarget.y = dtSurfY; directHitTarget.vy = 0; }
                    applyDamageAndEffects(directHitTarget, chtX, chtY);
                    const allChtTargets = [player, ...enemies];
                    allChtTargets.forEach(ent => {
                        if (ent === directHitTarget || ent.hp <= 0) return;
                        const edx = ent.x - chtX, edy = ent.y - chtY;
                        if (Math.sqrt(edx*edx + edy*edy) <= explosionRadius) {
                            const sfY = getTerrainY(ent.x, ent.y) + 0.75;
                            if (ent.y < sfY - 0.1) { ent.y = sfY; ent.vy = 0; }
                            applyDamageAndEffects(ent, chtX, chtY);
                        }
                    });
                    if (GAME_STATE !== 'OVER') {
                        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 1000);
                    }
                    return;
                }
            }

            if (hitY !== -100 && !missile.isCheat) {
                if (missile.type === 'pierce') {
                    // ê´€??ë¯¸ì‚¬?¼ì? ì§€?•ì„ ë¬´ì‹œ?˜ê³  ì§€?˜ê°
                } else if (missile.type === 'satellite') {
                    missile.active = false; GAME_STATE = 'IDLE';
                    document.getElementById('fire-btn').disabled = true;
                    const targetX = missile.x;
                    const targetY = hitY !== -100 ? hitY : missile.y;
                    const fixedSatCraterY = Math.min(targetY, getTerrainY(targetX));
                    for (let i = 0; i < 4; i++) {
                        setTimeout(() => {
                            if (GAME_STATE === 'OVER') return;
                            effects.push({ type: 'laser', x: targetX, y: fixedSatCraterY, life: 15 });
                            screenShake = 15;
                            if (i === 0) {
                                createCrater(targetX, fixedSatCraterY, explosionRadius);
                            }
                            const targets = [player, ...enemies];
                            targets.forEach(ent => {
                                const inRadius = Math.hypot(ent.x - targetX, ent.y - targetY) <= explosionRadius + 1.5;
                                const inColumn = Math.abs(ent.x - targetX) <= explosionRadius + 0.5 && ent.y >= targetY;
                                if (ent.hp > 0 && (inRadius || inColumn)) {
                                    // ì§€?˜ì— ?ˆëŠ” ???”ê·¸?????€ ì§€ë©??„ë¡œ ë¨¼ì? ?¬ë ¤ì¤?
                                    const surfaceY = getTerrainY(ent.x, ent.y) + 0.75;
                                    if (ent.y < surfaceY - 0.1) { ent.y = surfaceY; ent.vy = 0; }
                                    applyDamageAndEffects(ent, targetX, targetY);
                                }
                            });
                            if (i === 3) {
                                if (enemies.filter(e => e.hp <= 0).length >= 2) {
                                    GAME_STATE = 'OVER'; window.stageClearTimeout = setTimeout(() => showMessage('STAGE CLEAR!', '??2ë§ˆë¦¬ ì²˜ì¹˜ ?„ë£Œ!', false), 700);
                                } else {
                                    setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                                }
                            }
                        }, i * 250);
                    }
                    return;
                } else if (missile.type === 'net') {
                    // ---- ê·¸ë¬¼ ë¯¸ì‚¬?? ì§€??ì¶©ëŒ ?œì—???™ì¼???Œì–´?¹ê¸°ê¸?----
                    missile.active = false; GAME_STATE = 'IDLE';
                    document.getElementById('fire-btn').disabled = true;
                    const netRadius = 3;
                    const targetX = missile.x, targetY = hitY !== -100 ? hitY : missile.y;
                    effects.push({ type: 'netPull', x: targetX, y: targetY, life: 40, maxLife: 40 });
                    screenShake = 8;
                    let pulled = [];
                    enemies.forEach(ent => {
                        if (ent.hp <= 0) return;
                        if (Math.hypot(ent.x - targetX, ent.y - targetY) <= netRadius) pulled.push(ent);
                    });
                    setTimeout(() => {
                        pulled.forEach(ent => {
                            if (ent.hp <= 0) return;
                            ent.x = targetX;
                            ent.y = Math.max(getTerrainY(targetX, ent.y) + 0.75, targetY);
                            ent.isKnockedBack = false; ent.vx = 0; ent.vy = 0;
                            applyDamageAndEffects(ent, targetX, targetY);
                        });
                        if (player.hp > 0 && Math.hypot(player.x - targetX, player.y - targetY) <= netRadius) {
                            applyDamageAndEffects(player, targetX, targetY);
                        }
                        createExplosion(targetX, targetY, '#2dd4bf');
                        createCrater(targetX, targetY - 0.5, explosionRadius);
                        if (enemies.filter(e => e.hp <= 0).length >= 2) {
                            GAME_STATE = 'OVER'; window.stageClearTimeout = setTimeout(() => showMessage('STAGE CLEAR!', '??2ë§ˆë¦¬ ì²˜ì¹˜ ?„ë£Œ!', false), 700);
                        } else {
                            setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                        }
                    }, 400);
                    return;
                } else {
                    missile.active = false; GAME_STATE = 'IDLE';
                    const targetX = missile.x;
                    const targetY = missile.y;
                    createExplosion(targetX, targetY, getMissileColor());
                    createCrater(targetX, targetY, explosionRadius);
                    let hitSomeone = false;
                    // ì§ê²©(ê³µì¤‘ ?¬ì¼“ëª??¬í•¨) ì²˜ë¦¬: directHitTarget???ˆìœ¼ë©??°ì„  ?ìš©
                    if (directHitTarget && directHitTarget.hp > 0) {
                        // ì§€?????œë©´ ?¤ëƒ…
                        const dtSurfY = getTerrainY(directHitTarget.x, directHitTarget.y) + 0.75;
                        if (directHitTarget.y < dtSurfY - 0.1) { directHitTarget.y = dtSurfY; directHitTarget.vy = 0; }
                        applyDamageAndEffects(directHitTarget, targetX, targetY);
                        hitSomeone = true;
                        const allTargets = [player, ...enemies];
                        allTargets.forEach(ent => {
                            if (ent === directHitTarget || ent.hp <= 0) return;
                            const edx = ent.x - targetX, edy = ent.y - targetY;
                            if (Math.sqrt(edx*edx + edy*edy) <= explosionRadius) {
                                const sfY = getTerrainY(ent.x, ent.y) + 0.75;
                                if (ent.y < sfY - 0.1) { ent.y = sfY; ent.vy = 0; }
                                applyDamageAndEffects(ent, targetX, targetY);
                            }
                        });
                    } else {
                        const allTargets = [player, ...enemies];
                        allTargets.forEach(ent => {
                            if (ent.hp <= 0) return;
                            const edx = ent.x - targetX, edy = ent.y - targetY;
                            if (Math.sqrt(edx*edx + edy*edy) <= explosionRadius) {
                                const sfY = getTerrainY(ent.x, ent.y) + 0.75;
                                if (ent.y < sfY - 0.1) { ent.y = sfY; ent.vy = 0; }
                                applyDamageAndEffects(ent, targetX, targetY); hitSomeone = true;
                            }
                        });
                    }
                    if (!hitSomeone) {
                        effects.push({ type: 'text', x: missile.x, y: missile.y+1, text: 'MISS', color: '#fff', life: 40 });
                        screenShake = 10;
                    }
                    if (enemies.filter(e => e.hp <= 0).length >= 2) {
                        GAME_STATE = 'OVER'; window.stageClearTimeout = setTimeout(() => showMessage('STAGE CLEAR!', '??2ë§ˆë¦¬ ì²˜ì¹˜ ?„ë£Œ!', false), 700);
                    } else {
                        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 1000);
                    }
                    return;
                }
            }

            // ?”ë©´??ë²—ì–´?˜ë©´ (ê´€??ë¯¸ì‚¬???¬í•¨) ë¹„í™œ?±í™” ??ëª¨ë“  ë§µì—??x = Â±60 ?ì—­ê¹Œì? ê¶¤ì ???œí˜„?˜ë„ë¡??•ì¥
            const limitX = 60;
            const limitMinY = -30;
            if (Math.abs(missile.x) > limitX || missile.y < limitMinY) {
                missile.active = false; GAME_STATE = 'IDLE';
                if (enemies.filter(e => e.hp <= 0).length >= 2) {
                    GAME_STATE = 'OVER'; window.stageClearTimeout = setTimeout(() => showMessage('STAGE CLEAR!', '??2ë§ˆë¦¬ ì²˜ì¹˜ ?„ë£Œ!', false), 700);
                } else {
                    document.getElementById('fire-btn').disabled = false;
                }
                
                // ë§Œì•½ ë§ˆì?ë§??¹ìˆ˜ ë¯¸ì‚¬?¼ì´?ˆë‹¤ë©??ë™?¼ë¡œ 'normal'ë¡??„í™˜
                if (window.currentMissileType !== 'normal' && window.missileInventory[window.currentMissileType] <= 0) {
                    window.currentMissileType = 'normal';
                    const btns = document.querySelectorAll('.missile-btn');
                    btns.forEach(btn => btn.classList.remove('active'));
                    if(btns[0]) btns[0].classList.add('active'); // ë³´í†µ ë¯¸ì‚¬???œì„±??
                }
                return;
            }
        }
    }
}

// ---------- Rendering ----------
function drawEntity(ent) {
    const sc = gridToScreen(ent.x, ent.y);
    const vScale = ent.visualScale || 1.0;
    const drawW = scaleLength(ent.w * 1.5 * vScale), drawH = scaleLength(ent.h * 1.5 * vScale);
    const sw = scaleLength(ent.w), sh = scaleLength(ent.h);
    ctx.save();
    if (ent.shake > 0) { sc.x += (Math.random()-0.5)*10; sc.y += (Math.random()-0.5)*10; }
    const isSkyTerrain = (LEVELS[currentStage % LEVELS.length].terrain === 'sky');
    let bobY = 0;
    if (ent.hasCloud && ent.hp > 0) {
        const ph = ent.x * 1.7; // ê³ ìœ  ?„ìƒ
        bobY = Math.sin(Date.now() / 400 + ph) * scaleLength(0.12);
    }
    // ë¹„í–‰?˜ì? ?ŠëŠ” ?¬ì¼“ëª¬ì? ë°”ë‹¥????ë¶™ê²Œ ?¤í”„??ì¡°ì • (?ë˜?€ë¡?0.35ë¡?ë³µêµ¬)
    const yOff = ent.isFlying ? -sh * 0.1 : sh * 0.35;
    const animY = ent.yOffAnim ? -ent.yOffAnim : 0;
    let visualYOffset = 0;
    if (ent.name === '?Œì´ë¦?) visualYOffset = scaleLength(0.2); // ?Œì´ë¦??„ì²´(?¤ë¼ ?¬í•¨) ?¤í”„??
    ctx.translate(sc.x, sc.y + yOff + animY + bobY - visualYOffset);
    // ?ë“¤?€ ?Œë ˆ?´ì–´ë¥?ë°”ë¼ë³´ê²Œ (?ë™), ?Œë ˆ?´ì–´???˜ë™ ë°©í–¥
    if (ent !== player) {
        if (ent.x < player.x) ctx.scale(-1, 1);
    }
    if (ent.rotation) ctx.rotate(ent.rotation);
    
    // ì²´ë ¥??0 ?´í•˜???¬ë§ ê°œì²´: ê°œì„± ?ˆëŠ” ? ë ¹ ?¨ê³¼
    if (ent.hp <= 0) {
        // ìµœì´ˆ ?¬ë§ ???”í‹°?°ë³„ ?œë¤ ?„ìƒ(phase)ê³??¬ë§ ?œê° ê¸°ë¡ ??? ë ¹?¼ë¦¬ ?™ê¸°??ë°©ì?
        if (ent._ghostPhase === undefined) {
            ent._ghostPhase  = Math.random() * Math.PI * 2;
            ent._deathTime   = Date.now();
        }
        const t     = Date.now() / 1000;
        const ph    = ent._ghostPhase;
        const lived = (Date.now() - ent._deathTime) / 1000; // ?¬ë§ ??ê²½ê³¼ ?œê°„(ì´?

        // ?´ì¤‘ ì£¼íŒŒ???ŒíŒŒ ë§¥ë°• (0.10 ~ 0.58 ë²”ìœ„, ë¶ˆê·œì¹™í•œ ?¸í¡ ?ë‚Œ)
        const pulse = 0.34
            + Math.sin(t * 2.1 + ph)          * 0.16
            + Math.sin(t * 0.7 + ph * 1.3)    * 0.08;
        ctx.globalAlpha = Math.max(0.10, Math.min(0.58, pulse));

        // ?œì„œ??ë³€?˜ëŠ” ì±„ë„/?‰ì¡° (? ë ¹ë¹?ì²?¡?’ë³´???¬ì´ë¥?ì²œì²œ???œí™˜)
        const hue = 140 + Math.sin(t * 0.4 + ph) * 35;
        ctx.filter = `brightness(85%) saturate(220%) hue-rotate(${hue.toFixed(0)}deg) blur(0.7px)`;

        // ?„ì•„???¥ì‹¤ (?´ì¤‘ ì£¼íŒŒ?? + ì¢Œìš° ë¯¸ì„¸ ?”ë“¤ë¦?
        const floatY = Math.sin(t * 2.0 + ph) * scaleLength(0.22)
                     + Math.sin(t * 0.85 + ph) * scaleLength(0.10);
        const floatX = Math.sin(t * 1.4 + ph * 0.8) * scaleLength(0.06);
        ctx.translate(floatX, floatY);

        // ?Œì „ ?”ë“¤ë¦?(?´ì¤‘ ì£¼íŒŒ??
        ctx.rotate(Math.sin(t * 1.8 + ph) * 0.10 + Math.sin(t * 0.6 + ph) * 0.04);

        // ?¨ì‰¬????•œ ?¬ê¸° ë§¥ë°•
        const breathe = 1.0 + Math.sin(t * 1.2 + ph) * 0.07;
        ctx.scale(breathe, breathe);
    } else if (ent.shake > 0) {
        ctx.filter = 'brightness(200%) sepia(100%) hue-rotate(-50deg) saturate(500%)';
    }
    // HP bar for enemies
    if (enemies.includes(ent) && ent.hp > 0) {
        const hpPct = Math.max(0, ent.hp / ent.maxHp);
        const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#eab308' : '#ef4444';
        
        const barX = -20;
        const barY = -drawH/2 - 5;
        const barW = 40;
        const barH = 6;
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hpColor;           ctx.fillRect(barX, barY, barW * hpPct, barH);
        
        // ë§ˆìš°???¸ë²„ ?¬ë? ?•ì¸ (?¤í¬ë¦?ì¢Œí‘œ ê¸°ì?)
        let isHovered = false;
        if (window.gameMouseX !== -1000) {
            const actualBarY = sc.y + yOff + animY + (typeof bobY !== 'undefined' ? bobY : 0) + barY;
            if (window.gameMouseX >= sc.x + barX - 10 && window.gameMouseX <= sc.x + barX + barW + 10 &&
                window.gameMouseY >= actualBarY - 15 && window.gameMouseY <= actualBarY + barH + 15) {
                isHovered = true;
            }
        }
        
        if (isHovered || window.showAllEnemyHP) {
            ctx.save();
            // ???¬ì¼“ëª¬ì´ ?¼ìª½??ë³´ê³  ?ˆì–´??ì¢Œìš°ë°˜ì „???íƒœ?¼ë©´, ?ìŠ¤?¸ë? ê·¸ë¦´ ?ŒëŠ” ?¤ì‹œ ë°˜ì „?´ì„œ ?‘ë°”ë¡?ë³´ì´ê²???
            if (ent !== player && ent.x < player.x) ctx.scale(-1, 1);
            
            const hpText = `${Math.floor(ent.hp)}/${ent.maxHp}`;
            const textY = barY - 9; // ì²´ë ¥ë°”ì???? ê²©???´ì§ ?˜ë ¤ ê²¹ì¹¨ ?„ë²½ ë°©ì? (-6 -> -9)
            
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            
            // ?œë…???•ë³´: ê²€?€???êº¼???Œë‘ë¦?Outline)ë¥?ë¨¼ì? ê·¸ë¦° ???°ìƒ‰ ê¸€??ì¶œë ¥
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeText(hpText, 0, textY);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(hpText, 0, textY);
            ctx.restore();
        }
    }
    // Facing flip for player
    // ?¤í”„?¼ì´??ê¸°ë³¸ ë°©í–¥??ì¢Œì¸¡?´ë?ë¡??°ì¸¡(1)????ì¢Œìš° ë°˜ì „
    if (ent === player && player.facing === 1) ctx.scale(-1, 1);
    // Draw image (?´ë?ì§€ê°€ ?„ì§ ë¡œë“œ?˜ì? ?Šì? ?íƒœ?¼ë©´ ?„ì‹œ ë¹¨ê°„ ë°•ìŠ¤ ?€??ê·¸ë¦¬ê¸°ë? ?€ê¸°í•˜ê³? ë¡œë“œ ?„ë£Œ ?„ì—ë§?ê·¸ë¦½?ˆë‹¤)
    const domImg = ent === player ? document.getElementById('ui-player-img') : null;
    // 'êµ¬ë¦„ ???˜ëŠ˜' ë§µì—??ëª¬ìŠ¤???„ë˜???¥ì‹¤?¥ì‹¤ êµ¬ë¦„ ë°›ì¹¨ ê·¸ë¦¬ê¸?
    if (ent.hasCloud && ent.hp > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        // êµ¬ë¦„ ë°›ì¹¨ shadowBlur: ë°œì‚¬ ì¤‘ì—???„ì „??ë¹„í™œ?±í™”?˜ì—¬ ??ë°©ì?
        // if (isFiring) { ctx.shadowColor = 'rgba(255, 255, 255, 0.6)'; ctx.shadowBlur = 10; }
        
        const cloudW = drawW * 0.85;
        const cloudH = drawH * 0.32;
        const cyBase = drawH / 2 - scaleLength(0.1);
        
        const drawCircle = (cx, cy, r) => {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        };
        drawCircle(0, cyBase, cloudH * 0.8);
        drawCircle(-cloudW * 0.35, cyBase + cloudH * 0.15, cloudH * 0.6);
        drawCircle(cloudW * 0.35, cyBase + cloudH * 0.15, cloudH * 0.6);
        
        ctx.beginPath();
        ctx.rect(-cloudW * 0.3, cyBase - cloudH * 0.2, cloudW * 0.6, cloudH * 0.8);
        ctx.fill();
        ctx.restore();
    }

    const srcImg = (domImg && domImg.complete && domImg.naturalWidth > 0) ? domImg : ent.img;
    if (srcImg && srcImg.complete && srcImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        // Aura circle removed as requested
        ctx.drawImage(srcImg, -drawW/2, -drawH/2, drawW, drawH);
    } else {
        // ?´ë?ì§€ê°€ ë¡œë“œ ?¤íŒ¨(?ëŸ¬) ?íƒœ?´ê±°???„ì˜ˆ ?´ë?ì§€ê°€ ?†ëŠ” ê²½ìš°?ë§Œ ?€ì²??„í˜•??ê·¸ë¦½?ˆë‹¤.
        // ë¡œë”© ì¤‘ì¼ ?ŒëŠ” ê¹œë¹¡?´ëŠ” ë°•ìŠ¤ë¥?ê·¸ë¦¬ì§€ ?Šì•„ ?”ìƒ??ë°©ì??©ë‹ˆ??
        if (!srcImg || srcImg.naturalWidth === 0) {
            ctx.fillStyle = ent === player ? '#3b82f6' : '#ef4444';
            ctx.fillRect(-sw/2, -sh/2, sw, sh);
        }
    }

    // ë°°ë¦¬??ê·¸ë¦¬ê¸?ë°??ìŠ¤???œì‹œ (?œê°„ ê¸°ë°˜)
    if (ent.hp > 0 && ent.barrierType) {
        if (!ent.barrierStartTime) ent.barrierStartTime = Date.now();
        const elapsed = (Date.now() - ent.barrierStartTime) / 1000;
        
        if (elapsed < 0) {
            ctx.restore();
            return;
        }
        
        const timing = getBarrierTiming(ent.barrierType);
        const cycleTime = elapsed % timing.total;
        
        let drawType = 'none'; // 'none' | 'generating' | 'active' | 'flashing'
        let progress = 1.0;
        let isFlashVisible = true;
        
        if (cycleTime < timing.gen) {
            drawType = 'generating';
            progress = cycleTime / timing.gen;
        } else if (cycleTime < timing.gen + timing.active) {
            drawType = 'active';
        } else if (cycleTime < timing.gen + timing.active + timing.flash) {
            drawType = 'flashing';
            const flashTime = cycleTime - (timing.gen + timing.active);
            isFlashVisible = (flashTime % 0.5) < 0.25;
        } else {
            drawType = 'none';
        }

        const info = getBarrierColors(ent.barrierType);
        
        // ?´ë“œ ??ë°??¸ê³½ ê°€?¥ìë¦?ê·¸ë¦¬ê¸?
        if (drawType !== 'none' && (drawType !== 'flashing' || isFlashVisible)) {
            ctx.save();
            ctx.strokeStyle = info.stroke;
            ctx.fillStyle = info.fill;
            const r = scaleLength(1.68); // 1.4 * 1.2ë°?

            if (ent.barrierType === 'reflect') {
                // ë°˜ì‚¬ ë°°ë¦¬?? ? ì¹´ë¡œìš´ ?¡ê°??+ ê¼?§“??ê°€???Œì¶œ??
                ctx.lineWidth = 2.5;
                pathHexagon(ctx, r, progress);
                ctx.fill();
                ctx.stroke();
                
                // ?ì„± ì¤‘ì´ ?„ë‹ ?Œë§Œ ê°€???Œë”ë§?
                if (drawType !== 'generating') {
                    ctx.beginPath();
                    const sides = 6;
                    const startAngle = -Math.PI / 2;
                    for (let i = 0; i < sides; i++) {
                        const angle = startAngle + (i / sides) * Math.PI * 2;
                        const px = Math.cos(angle) * r;
                        const py = Math.sin(angle) * r;
                        const spikeX = Math.cos(angle) * (r + scaleLength(0.22));
                        const spikeY = Math.sin(angle) * (r + scaleLength(0.22));
                        ctx.moveTo(px, py);
                        ctx.lineTo(spikeX, spikeY);
                    }
                    ctx.strokeStyle = info.stroke;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }
            } 
            else if (ent.barrierType === 'absorb') {
                // ?¡ìˆ˜ ë°°ë¦¬?? ë§¥ë™?˜ëŠ” ?´ì¤‘ ?¤ê°??
                const pulse = drawType === 'generating' ? 1.0 : 1.0 + Math.sin(Date.now() / 200) * 0.08;
                ctx.lineWidth = 2.5;
                
                // ?¸ê³½ ?¤ê°??
                pathPolygon(ctx, 5, r * pulse, progress);
                ctx.fill();
                ctx.stroke();
                
                // ?´ë? ?¤ê°??(?‡ë°•??ë§¥ë™)
                if (drawType !== 'generating') {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(50, 205, 50, 0.45)';
                    ctx.lineWidth = 1.5;
                    const innerPulse = 1.0 + Math.cos(Date.now() / 200) * 0.06;
                    pathPolygon(ctx, 5, r * 0.65 * innerPulse, 1.0);
                    ctx.stroke();
                    ctx.restore();
                }
            } 
            else if (ent.barrierType === 'absolute') {
                // ?ˆë?ë°©ì–´ ë°°ë¦¬?? ?¼íŠ¼???”ê°???±ë²½ + ê²©ì??ì°¨ë‹¨ì¸?
                ctx.lineWidth = 3.5;
                pathOctagon(ctx, r, progress);
                ctx.fill();
                ctx.stroke();
                
                // ?´ë? ê²©ì ?´ë“œ ë¬´ëŠ¬
                if (drawType !== 'generating') {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    
                    // ?”ê°???´ë? ?´ë¦¬??
                    pathOctagon(ctx, r, 1.0);
                    ctx.clip();
                    
                    // ê²©ì„  ê·¸ë¦¬ê¸?
                    ctx.beginPath();
                    const spacing = scaleLength(0.35);
                    for (let d = -r; d <= r; d += spacing) {
                        ctx.moveTo(-r, d);
                        ctx.lineTo(r, d);
                        ctx.moveTo(d, -r);
                        ctx.lineTo(d, r);
                    }
                    ctx.stroke();
                    ctx.restore();
                }
            } 
            else if (ent.barrierType === 'warp') {
                // ?Œí”„ ë°°ë¦¬?? ë§¥ë™?˜ëŠ” ?´ì¤‘ ??(?¼í•´?¡ìˆ˜ ë°°ë¦¬?´ì˜ ë°ì? ë³´ë¼??ë²„ì „)
                const pulse = drawType === 'generating' ? 1.0 : 1.0 + Math.sin(Date.now() / 200) * 0.08;
                ctx.lineWidth = 2.5;
                
                // ?¸ê³½ ??
                ctx.beginPath();
                ctx.arc(0, 0, r * pulse, 0, Math.PI * 2 * progress);
                ctx.fill();
                ctx.stroke();
                
                // ?´ë? ??(?‡ë°•??ë§¥ë™)
                if (drawType !== 'generating') {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(186, 85, 211, 0.45)';
                    ctx.lineWidth = 1.5;
                    const innerPulse = 1.0 + Math.cos(Date.now() / 200) * 0.06;
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.65 * innerPulse, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            ctx.restore();
        }
        
        // ë°°ë¦¬???´ë¦„ ?ìŠ¤??(?œì„±/?ì„±/ê¹œë¹¡???œì—ë§??œì‹œ, ê¹œë¹¡?????¨ê»˜ ê¹œë¹¡?? ?ì„± ??fade-in, ë°˜ì „ ë³´ì •)
        if (drawType !== 'none' && (drawType !== 'flashing' || isFlashVisible)) {
            ctx.save();
            if (ent !== player && ent.x < player.x) {
                ctx.scale(-1, 1);
            }
            
            // ?ì„± ì¤‘ì¼ ?ŒëŠ” progress???°ë¼ ?œì„œ???˜í???(fade in)
            const textAlpha = drawType === 'generating' ? progress : 1.0;
            ctx.globalAlpha = textAlpha;
            
            ctx.font = 'bold 12px Arial'; // ?¬ê¸° 1?¨ê³„ ?•ë?
            const tw = ctx.measureText(info.name).width;
            const textYOffset = (ent.barrierType === 'absorb') ? 1.48 : 1.68;
            const textY = scaleLength(textYOffset) + 14;
            
            // ê²€?€???ìŠ¤???ì ë°°ê²½ (?????¬ë°± ê· í˜• ?¡íŒ ?¥ê·¼ ?¬ê°??
            const boxPaddingX = 6;
            const boxHeight = 20;
            const boxY = textY - 11;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(-tw/2 - boxPaddingX, boxY, tw + boxPaddingX * 2, boxHeight, 4);
                ctx.fill();
            } else {
                ctx.fillRect(-tw/2 - boxPaddingX, boxY, tw + boxPaddingX * 2, boxHeight);
            }
            
            // ?ìŠ¤??ì¶œë ¥ (?œê? ?œê°??ì¤‘ì•™ ?„ì¹˜ ë³´ì •)
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = info.stroke;
            ctx.fillText(info.name, 0, textY + 1);
            ctx.restore();
        }
    }

    ctx.restore();
}

// ---------------------------------------------------------
// ì§€???Œë”ë§ìš© ê³ ì • ?¬ì‚¬???¤í”„?¤í¬ë¦?ìº”ë²„??(ë§??„ë ˆ??createElement ???„ë²½ ë°©ì?)
// ---------------------------------------------------------
let sharedTerrainCanvas = null;
function getSharedTerrainCtx() {
    if (!sharedTerrainCanvas) {
        sharedTerrainCanvas = document.createElement('canvas');
    }
    if (sharedTerrainCanvas.width !== canvas.width || sharedTerrainCanvas.height !== canvas.height) {
        sharedTerrainCanvas.width = canvas.width;
        sharedTerrainCanvas.height = canvas.height;
    }
    const offCtxGround = sharedTerrainCanvas.getContext('2d');
    offCtxGround.clearRect(0, 0, sharedTerrainCanvas.width, sharedTerrainCanvas.height);
    return { offCanvasGround: sharedTerrainCanvas, offCtxGround };
}

function render() {
    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10);

    const stage = LEVELS[currentStage % LEVELS.length];
    const tData = TERRAINS[stage.terrain];
    if (stage.terrain === 'cave') {
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        tData.bg.forEach((c, i) => grad.addColorStop(i / (tData.bg.length - 1), c));
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ?¸ë¥¸ ?¤íŒ('grass') ì§€??ë¶„ìœ„ê¸? ë¯¼ë“¤???€?¨ê? ë°”ëŒ???´ë‘?´ë‘ ? ë¦¬???¨ê³¼ (?”ë“œ ì¢Œí‘œ ?°ë™)
    if (stage.terrain === 'grass') {
        ctx.save();
        const now = Date.now();
        for (let i = 0; i < 12; i++) {
            const seed = i * 4219;
            // ?˜í‰ ?´ë™: ?¼ìª½?’ì˜¤ë¥¸ìª½ ê¸°ë³¸ ë°”ëŒ + ë¶ˆê·œì¹??ë„ ?¸ì°¨
            const driftSpeed = 0.00025 + (seed % 7) * 0.00006;
            // ?˜ì§ ?”ë“¤ë¦? ?´ë‘?´ë‘ ?„ì•„???ˆìš¸
            const bobAmp = 0.4 + (seed % 5) * 0.15;
            const bobFreq = 0.0006 + (seed % 3) * 0.0002;

            // gx: ?¼â†’?¤ë¥¸ ë°”ëŒ ë°©í–¥ + ì¢Œìš° ?´ë‘ ?”ë“¤ë¦?
            const cycleLen = 55.0; // ê·¸ë¦¬???¨ìœ„ ?œí™˜ ê¸¸ì´
            const baseGx = -25.0 + ((now * driftSpeed + (seed % 1000) * 0.06) % cycleLen);
            const gx = baseGx + Math.sin(now * bobFreq * 0.7 + i * 3.1) * 0.5;

            // gy: ?„ì•„???´ë‘?´ë‘ ?ˆìš¸ (ì§€????ê³µì¤‘)
            const baseGy = 2.0 + (seed % 800) * 0.025; // 2~22 ë²”ìœ„ ë¶„ì‚°
            const gy = baseGy + Math.sin(now * bobFreq + i * 2.5) * bobAmp;

            const sc = gridToScreen(gx, gy);

            // ?”ë©´ ë°??Œí‹°???¤í‚µ
            if (sc.x < -30 || sc.x > canvas.width + 30 || sc.y < -30 || sc.y > canvas.height + 30) continue;

            // ?€???¬ê¸° (?‘ì? ??+ ??ì¤„ê¸°)
            const sizeGroup = i % 3;
            const r = scaleLength(0.04 + sizeGroup * 0.015);

            // ?€?€??ê¹œë¹¡??(?¬ëª…??ë³€??
            const flicker = Math.sin(now * 0.0015 + i * 1.7) * 0.15;
            const alpha = Math.max(0.35, 0.65 + sizeGroup * 0.08 + flicker);

            // ?˜ì? ?°ìœ ë¹??€??ë³¸ì²´
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, Math.max(0.8, r), 0, Math.PI * 2);
            ctx.fill();

            // ?€?¨ì—??ë»—ì–´?˜ê???ë¯¸ì„¸??ë°©ì‚¬???œí„¸(3~4ê°ˆë˜)
            const tuftCount = 3 + (i % 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            ctx.lineWidth = 0.6;
            for (let t = 0; t < tuftCount; t++) {
                const angle = (t / tuftCount) * Math.PI * 2 + Math.sin(now * 0.001 + i + t) * 0.3;
                const tuftLen = r * 2.5 + Math.sin(now * 0.002 + t * 1.5) * r * 0.5;
                ctx.beginPath();
                ctx.moveTo(sc.x, sc.y);
                ctx.lineTo(sc.x + Math.cos(angle) * tuftLen, sc.y + Math.sin(angle) * tuftLen);
                ctx.stroke();
                // ?œí„¸ ??ë¯¸ì„¸ ??
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.45})`;
                ctx.beginPath();
                ctx.arc(sc.x + Math.cos(angle) * tuftLen, sc.y + Math.sin(angle) * tuftLen, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // ?¸ë‚˜ë¬´ë‹¤ë¦?'log_bridge') ì§€??ë¶„ìœ„ê¸? ì´ˆë¡ ?˜ë­‡?ì´ ë°”ëŒ???˜ë‚ ë¦¬ë©° ?¨ì–´ì§€???¨ê³¼ (?”ë“œ ì¢Œí‘œ ?°ë™)
    if (stage.terrain === 'log_bridge') {
        ctx.save();
        const now = Date.now();
        const leafColors = [
            '34, 139, 34',   // ?¬ë ˆ?¤íŠ¸ ê·¸ë¦°
            '50, 205, 50',   // ?¼ì„ ê·¸ë¦°
            '60, 179, 71',   // ?ë©”?„ë“œ ê·¸ë¦°
            '107, 142, 35',  // ?¬ë¦¬ë¸??œë© (?°ë‘)
            '144, 238, 144', // ?¼ì´??ê·¸ë¦°
        ];
        for (let i = 0; i < 10; i++) {
            const seed = i * 5381;
            // ?˜í‰: ?¤ë¥¸ìª?ë°”ëŒ + ë¶ˆê·œì¹??”ë“¤ë¦?
            const driftSpeed = 0.0003 + (seed % 7) * 0.00005;
            // ?˜ì§: ?ë¦° ?™í•˜ + ?„ì•„???ˆìš¸
            const fallSpeed = 0.00012 + (seed % 5) * 0.00003;
            const swayAmp = 0.6 + (seed % 4) * 0.2;
            const swayFreq = 0.0005 + (seed % 3) * 0.00015;

            // gx: ?¤ë¥¸ìª?ë°”ëŒ + ì¢Œìš° ?´ë‘ ?”ë“¤ë¦?
            const cycleX = 55.0;
            const baseGx = -25.0 + ((now * driftSpeed + (seed % 1000) * 0.055) % cycleX);
            const gx = baseGx + Math.sin(now * swayFreq + i * 2.7) * swayAmp;

            // gy: ?„ì—???„ë˜ë¡?ì²œì²œ???™í•˜ + ?ˆìš¸
            const cycleY = 30.0;
            const baseGy = 22.0 - ((now * fallSpeed + (seed % 800) * 0.04) % cycleY);
            const gy = baseGy + Math.sin(now * swayFreq * 1.3 + i * 1.9) * 0.3;

            const sc = gridToScreen(gx, gy);

            // ?”ë©´ ë°??¤í‚µ
            if (sc.x < -40 || sc.x > canvas.width + 40 || sc.y < -40 || sc.y > canvas.height + 40) continue;

            const color = leafColors[i % leafColors.length];
            const flicker = Math.sin(now * 0.0012 + i * 2.1) * 0.12;
            const alpha = Math.max(0.4, 0.7 + flicker);

            // ?˜ë­‡???Œì „ ê°ë„ (ë°”ëŒ???¤ì§‘?ˆëŠ” ?¨ê³¼)
            const rotation = (now * 0.0015 + seed) % (Math.PI * 2);

            ctx.save();
            ctx.translate(sc.x, sc.y);
            ctx.rotate(rotation);

            // ?˜ë­‡???•íƒœ: ?€??+ ì¤‘ì‹¬ ?ë§¥??
            const leafW = scaleLength(0.18 + (i % 3) * 0.04);
            const leafH = leafW * 0.5;

            ctx.fillStyle = `rgba(${color}, ${alpha})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, leafW, leafH, 0, 0, Math.PI * 2);
            ctx.fill();

            // ?ë§¥ ì¤‘ì‹¬??
            ctx.strokeStyle = `rgba(20, 80, 20, ${alpha * 0.5})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-leafW * 0.8, 0);
            ctx.lineTo(leafW * 0.8, 0);
            ctx.stroke();

            ctx.restore();
        }
        ctx.restore();
    }

    // ?œê³¡??ì°¨ì›('psychic') ì§€??ë¶„ìœ„ê¸? ë°˜ì¤‘?¥ìœ¼ë¡?ì²œì²œ???„ë¡œ ? ì˜¤ë¥´ëŠ” ëª½í™˜?ì¸ ë³´ë¼???‘í¬??ë¹›êµ¬?¬ë“¤
    if (stage.terrain === 'psychic') {
        ctx.save();
        const now = Date.now();
        const orbColors = [
            '217, 70, 239',   // ë°ì? ?ì£¼/ë¶„í™
            '192, 38, 211',   // ë§ˆì  ?€
            '168, 85, 247',   // ?°í•œ ë³´ë¼
            '232, 121, 249',  // ?‘í¬
            '139, 92, 246'    // ë³´ë¼
        ];
        
        ctx.globalCompositeOperation = 'screen';
        
        for (let i = 0; i < 22; i++) {
            const seed = i * 7231;
            const riseSpeed = 0.0005 + (seed % 5) * 0.0002; // ?„ë¡œ ? ì˜¤ë¥´ëŠ” ?ë„
            const swayAmp = 1.0 + (seed % 4) * 0.5; // ì¢Œìš° ?”ë“¤ë¦?ì§„í­
            const swayFreq = 0.0005 + (seed % 3) * 0.0002;
            
            const cycleY = 60.0;
            const cycleX = 60.0;
            
            // X??ê³ ì •???„ì¹˜ ë² ì´?? Y???œê°„ ?ë¦„???°ë¼ ì¦ê?(?„ë¡œ ? ì˜¤ë¦?
            const baseY = -15.0 + ((now * riseSpeed + (seed % 1000) * 0.06) % cycleY);
            const baseX = -30.0 + ((seed % 600) * 0.1);
            
            const gx = baseX + Math.sin(now * swayFreq + i * 1.3) * swayAmp;
            const gy = baseY; // gyê°€ ì»¤ì?ë©??”ë©´?ì„œ ?„ë¡œ ?¬ë¼ê°?(ë°˜ì¤‘??
            
            const sc = gridToScreen(gx, gy);
            const radius = scaleLength(0.1 + (seed % 4) * 0.1); // ?¬ê¸° ?¤ì–‘??(0.1 ~ 0.4)
            
            if (sc.x < -radius*2 || sc.x > canvas.width + radius*2 || 
                sc.y < -radius*2 || sc.y > canvas.height + radius*2) continue;

            const color = orbColors[i % orbColors.length];
            const pulse = Math.sin(now * 0.001 + i * 2.1);
            const alpha = 0.4 + pulse * 0.3; // 0.1 ~ 0.7
            
            // êµ¬ìŠ¬ ë³¸ì²´ (ë¸”ëŸ¬/ê¸€ë¡œìš° ?ë‚Œ) - ?€??ì¶•ì†Œ
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, radius * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${alpha})`;
            ctx.fill();
            
            // êµ¬ìŠ¬ ë°ì? ì½”ì–´ (ì¤‘ì‹¬) - ?´ì§ ì¶•ì†Œ
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, radius * 0.32, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha + 0.3)})`;
            ctx.fill();
        }
        ctx.restore();
    }

    // ?´ë‘???™êµ´('cave') ì§€??ë¶„ìœ„ê¸? ? ë¹„ë¡œìš´ ?¸ë¥¸ë¹?ë³´ëë¹??•ê´‘ ë²Œë ˆê°€ ? ë‹¤?ˆëŠ” ?¨ê³¼
    if (stage.terrain === 'cave') {
        ctx.save();
        const now = Date.now();
        const caveBugColors = [
            '100, 150, 255',  // ?…ì? ?¸ë¥¸ë¹?
            '150, 100, 255',  // ë³´ëë¹?
            '50,  200, 255',  // ì²?¡ë¹?
            '200, 150, 255',  // ?°ë³´?ë¹›
            '100, 200, 200'   // ? ë¹„ë¡œìš´ ?¥ìƒ‰
        ];

        ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < 12; i++) {
            const seed = i * 7321;
            // ?•ê´‘ ë²Œë ˆ???ë¦¬ê²?ë§´ë (?•ì›ë³´ë‹¤ ì¡°ê¸ˆ ???ë¦¬ê³??“ê²Œ)
            const orbitSpeed = 0.0002 + (seed % 4) * 0.00008;
            const orbitRadX = 2.5 + (seed % 5) * 1.0;
            const orbitRadY = 1.5 + (seed % 3) * 0.8;

            const baseX = -22.0 + (seed % 440) * 0.1;
            const baseY = 2.0 + (seed % 200) * 0.08;

            const gx = baseX + Math.sin(now * orbitSpeed + i * 1.7) * orbitRadX;
            const gy = baseY + Math.cos(now * orbitSpeed * 0.7 + i * 2.3) * orbitRadY;

            const sc = gridToScreen(gx, gy);
            const coreR = scaleLength(0.06 + (seed % 3) * 0.05); // ì½”ì–´ ë°˜ê²½ 0.06 ~ 0.16 (ì¡°ê¸ˆ ?‘ê²Œ)

            if (sc.x < -coreR*6 || sc.x > canvas.width + coreR*6 ||
                sc.y < -coreR*6 || sc.y > canvas.height + coreR*6) continue;

            const color = caveBugColors[i % caveBugColors.length];
            // ê¹œë¹¡?? ?´ë‘  ?ì—????ê·¹ì ?¼ë¡œ ë³´ì„
            const blink = Math.sin(now * 0.0018 + i * 4.1);
            const alpha = Math.max(0.05, 0.4 + blink * 0.4); // 0.05 ~ 0.80

            // ê¸€ë¡œìš°: ì½”ì–´ ?¬ê¸°?ì„œ ì¶œë°œ ??ì»¤ì¡Œ??ì¤„ì–´?œëŠ” ë§¥ë°•
            const glowPulse = (Math.sin(now * 0.0012 + i * 3.7) + 1.0) / 2.0; // 0 ~ 1
            const glowR = coreR * (1.2 + glowPulse * 1.5); // ê¸€ë¡œìš° ?“ê²Œ ?¼ì§

            ctx.beginPath();
            ctx.arc(sc.x, sc.y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${alpha * 0.25})`;
            ctx.fill();

            // ì½”ì–´
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, coreR * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 230, 255, ${Math.min(1, alpha + 0.1)})`;
            ctx.fill();
        }
        ctx.restore();
    }

    // ë¶€? í•˜????'garden') ì§€??ë¶„ìœ„ê¸? ? ë¹„ë¡œìš´ ë°˜ë”§ë¶ˆì´ê°€ ?ë¦¿?ë¦¿ ë§´ëŒë©?ë°˜ì§?´ëŠ” ?¨ê³¼
    if (stage.terrain === 'garden') {
        ctx.save();
        const now = Date.now();
        const fireflyColors = [
            '180, 230, 60',   // ?©ë¡
            '210, 240, 80',   // ?°ë…¸??
            '160, 255, 90',   // ë°ì? ?°ë‘
            '230, 250, 120',  // ?ˆëª¬ë¹?
            '140, 220, 70'    // ì´ˆë¡ë¹?
        ];

        ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < 10; i++) {
            const seed = i * 5413;
            // ë°˜ë”§ë¶ˆì´???ë¦¬ê²??í˜•~8??ê¶¤ì ?¼ë¡œ ë§´ë
            const orbitSpeed = 0.0003 + (seed % 4) * 0.0001;
            const orbitRadX = 2.0 + (seed % 5) * 0.8;
            const orbitRadY = 1.5 + (seed % 3) * 0.6;

            const baseX = -22.0 + (seed % 440) * 0.1;
            const baseY = 3.0 + (seed % 200) * 0.08;

            const gx = baseX + Math.sin(now * orbitSpeed + i * 1.7) * orbitRadX;
            const gy = baseY + Math.cos(now * orbitSpeed * 0.7 + i * 2.3) * orbitRadY;

            const sc = gridToScreen(gx, gy);
            const coreR = scaleLength(0.08 + (seed % 3) * 0.06); // ì½”ì–´ ë°˜ê²½ 0.08 ~ 0.20

            if (sc.x < -coreR*6 || sc.x > canvas.width + coreR*6 ||
                sc.y < -coreR*6 || sc.y > canvas.height + coreR*6) continue;

            const color = fireflyColors[i % fireflyColors.length];
            // ê¹œë¹¡?? ë°ì•„ì¡Œë‹¤ ?´ë‘?Œì¡Œ??ë°˜ë³µ (ë°˜ë”§ë¶ˆì´ ?ë‚Œ)
            const blink = Math.sin(now * 0.002 + i * 4.1);
            const alpha = Math.max(0.05, 0.35 + blink * 0.35); // 0.05 ~ 0.70

            // ê¸€ë¡œìš°: ì½”ì–´ ?¬ê¸°?ì„œ ì¶œë°œ ??ì»¤ì¡Œ??ì¤„ì–´?œëŠ” ë§¥ë°• (1.0x ~ 2.0x)
            const glowPulse = (Math.sin(now * 0.0015 + i * 3.7) + 1.0) / 2.0; // 0 ~ 1
            const glowR = coreR * (1.0 + glowPulse * 1.0);

            ctx.beginPath();
            ctx.arc(sc.x, sc.y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${alpha * 0.2})`;
            ctx.fill();

            // ì½”ì–´ (ë°ì? ì¤‘ì‹¬??- ê³ ì • ?¬ê¸°)
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, coreR * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 230, ${Math.min(1, alpha + 0.2)})`;
            ctx.fill();
        }
        ctx.restore();
    }

    // ?œì‚¬??'cloud_garden') ì§€??ë¶„ìœ„ê¸? ë°˜ì§?´ëŠ” ë³?ë¨¼ì?ê°€ ì²œì²œ???´ë ¤?¤ëŠ” ?¨ê³¼
    if (stage.terrain === 'cloud_garden') {
        ctx.save();
        const now = Date.now();
        const dustColors = [
            '255, 255, 255',  // ?œë°±
            '255, 220, 240',  // ?°ë¶„??
            '255, 200, 230',  // ?‘í¬
            '240, 230, 255',  // ?°ë³´??
            '255, 240, 250'   // ?¬ë¦¼?‘í¬
        ];

        ctx.globalCompositeOperation = 'screen';

        for (let i = 0; i < 10; i++) {
            const seed = i * 6317;
            const fallSpeed = 0.0003 + (seed % 4) * 0.00008; // ?ë¦¬ê²??´ë ¤??
            const swayAmp = 1.2 + (seed % 3) * 0.5;
            const swayFreq = 0.0004 + (seed % 5) * 0.00015;

            const cycleY = 50.0;
            // ?„ì—???„ë˜ë¡??´ë ¤??(ë°˜ì¤‘?¥ì˜ ë°˜ë?)
            const baseY = 25.0 - ((now * fallSpeed + (seed % 1000) * 0.05) % cycleY);
            const baseX = -25.0 + (seed % 500) * 0.1;

            const gx = baseX + Math.sin(now * swayFreq + i * 2.1) * swayAmp;
            const gy = baseY;

            const sc = gridToScreen(gx, gy);
            const coreR = scaleLength(0.06 + (seed % 3) * 0.04); // 0.06 ~ 0.14

            if (sc.x < -coreR*5 || sc.x > canvas.width + coreR*5 ||
                sc.y < -coreR*5 || sc.y > canvas.height + coreR*5) continue;

            const color = dustColors[i % dustColors.length];
            // ë°˜ì§?? ë³„ì²˜??ê¹œë¹¡
            const twinkle = Math.sin(now * 0.003 + i * 5.3);
            const alpha = Math.max(0.1, 0.4 + twinkle * 0.4); // 0.1 ~ 0.8

            // ê¸€ë¡œìš° (?€?€??ë¹?ë²ˆì§)
            const glowPulse = (Math.sin(now * 0.002 + i * 3.1) + 1.0) / 2.0;
            const glowR = coreR * (1.0 + glowPulse * 1.0);

            ctx.beginPath();
            ctx.arc(sc.x, sc.y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${alpha * 0.15})`;
            ctx.fill();

            // ì½”ì–´ (ë°ì? ë³???
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, coreR * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha + 0.2)})`;
            ctx.fill();
        }
        ctx.restore();
    }

    // ?”ì‚° ?©ì•”('lava') ì§€??ë¶„ìœ„ê¸? ê°€ë²¼ìš´ ë¶ˆí‹° ?Œí‹°??
    if (stage.terrain === 'lava') {
        ctx.save();


        // 3. ê°€ë²¼ìš´ ë¶ˆí‹°(Ember) ?Œí‹°???œìŠ¤??(?”ë“œ ì¢Œí‘œ ?°ë™??
        // 35ê°??•ë„ë¡??œí•œ?˜ì—¬ ??ë°©ì?. ?„ë˜?ì„œ ?„ë¡œ ?œì„œ??? ì˜¤ë¥´ë©° ì¢Œìš°ë¡??´ë‘ê±°ë¦¼
        const now = Date.now();
        for (let i = 0; i < 35; i++) {
            const seed = i * 31337;
            const riseSpeed = 0.0008 + (seed % 7) * 0.00015;
            const swayAmp = 0.6 + (seed % 5) * 0.2;
            const swayFreq = 0.001 + (seed % 3) * 0.0003;

            // X ?„ì¹˜ ë¶„ì‚° (?”ë“œ ê·¸ë¦¬?????“ê²Œ ?¼ì??„ë¡)
            const baseGx = -25.0 + (seed % 600) * 0.1;
            const gx = baseGx + Math.sin(now * swayFreq + i * 1.5) * swayAmp;
            
            // Y ?„ì¹˜ ë¶„ì‚° (?„ë¡œ ?ìŠ¹, ?¬ì´??ë°˜ë³µ)
            const cycleLen = 40.0;
            // ?„ë¡œ ? ì˜¤ë¥´ë?ë¡?Yê°’ì´ ê³„ì† ê°ì†Œ?˜ë„ë¡??ëŠ” ?Œë”ë§ìƒ gyê°€ ì¦ê??˜ë„ë¡?ê³„ì‚°)
            // gridToScreen?ì„œ??gyê°’ì´ ?´ìˆ˜ë¡??”ë©´ ?ë‹¨???Œë”ë§ë¨
            const gy = -10.0 + ((now * riseSpeed + (seed % 1000) * 0.05) % cycleLen);

            const sc = gridToScreen(gx, gy);
            
            // ?”ë©´ ë°–ìœ¼ë¡??¬ê²Œ ë²—ì–´???Œí‹°?´ì? ê·¸ë¦¬ì§€ ?Šì•„ ìµœì ??
            if (sc.x < -20 || sc.x > canvas.width + 20 || sc.y < -20 || sc.y > canvas.height + 20) {
                continue;
            }
            
            // ?Œí‹°???¬ê¸° ë°??¬ëª…??
            const sizeGroup = i % 3;
            const r = scaleLength(0.04 + sizeGroup * 0.02); // ?‘ì? ë¶ˆí‹°
            
            // ê¹œë¹¡???¨ê³¼ (Flicker)
            const flicker = Math.sin(now * 0.004 + i) * 0.25;
            const alpha = Math.max(0.1, 0.5 + sizeGroup * 0.15 + flicker);
            
            // ?‰ìƒ ë³€??(ì£¼í™© ~ ë¶‰ì? ì£¼í™© ~ ì§™ì? ì£¼í™©)
            const colors = ['255, 165, 0', '255, 85, 0', '253, 186, 116'];
            const color = colors[i % 3];

            ctx.fillStyle = `rgba(${color}, ${alpha})`;
            // ë¶ˆí‹°???ì²´ ë°œê´‘ ?¨ê³¼ (?½ê°„??ë¸”ëŸ¬)
            ctx.shadowBlur = 4;
            ctx.shadowColor = `rgba(${color}, ${alpha})`;
            
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, Math.max(0.5, r), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0; // ê·¸ë¦¼???´í™??ì´ˆê¸°??

        ctx.restore();
    }

    // ?¼ìŒ ?¤ì‚°('ice') ì§€??ë¶„ìœ„ê¸? ?„ì—???„ë˜ë¡??´ë¦¬???ˆë°œ (?”ë“œ ê·¸ë¦¬??ì¢Œí‘œ ?™ê¸°??
    if (stage.terrain === 'ice') {
        ctx.save();
        const now = Date.now();
        for (let i = 0; i < 35; i++) {
            // ê°??ˆì†¡?´ë§ˆ??ê³ ìœ  ?œë“œë¡??ë„/?„ì¹˜ ë¶„ì‚°
            const seed = i * 7919;
            const fallSpeed = 0.0004 + (seed % 7) * 0.00008; // ê°œë³„ ?™í•˜ ?ë„ (?ˆë°˜ ê°ì†)
            const swayAmp = 1.0 + (seed % 5) * 0.3;          // ì¢Œìš° ?”ë“¤ë¦???(?½ê°„ ì¶•ì†Œ)
            const swayFreq = 0.0008 + (seed % 3) * 0.00025;  // ì¢Œìš° ?”ë“¤ë¦?ì£¼ê¸° (?ˆë°˜ ê°ì†)

            // gx: ì¢Œìš°ë¡??´ë‘?´ë‘ ?”ë“¤ë¦¬ë©° ?˜í‰ ?´ë™
            const baseGx = -25.0 + (seed % 500) * 0.11;
            const gx = baseGx + Math.sin(now * swayFreq + i * 2.3) * swayAmp;

            // gy: ?„ì—???„ë˜ë¡?ì²œì²œ???´ë ¤??(?’ì? ê°?????? ê°?
            const cycleLen = 32.0; // ê·¸ë¦¬???¨ìœ„ ?œí™˜ ê¸¸ì´
            const gy = 30.0 - ((now * fallSpeed + (seed % 1000) * 0.032) % cycleLen);

            const sc = gridToScreen(gx, gy);
            const sizeGroup = i % 3;
            const r = scaleLength(0.06 + sizeGroup * 0.04);
            const alpha = 0.6 + sizeGroup * 0.15; // ?¬ê¸°ë³??¬ëª…??ì°¨ì´ (?ê·¼ê°?

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, Math.max(1, r), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ë°œì „??'electric') ì§€??ë¶„ìœ„ê¸? ?Œë¼ì¦ˆë§ˆ ?ë„ˆì§€ êµ¬ì²´ & ?ë ¥???…ì ?Œë”ë§?
    if (LEVELS[currentStage % LEVELS.length].terrain === 'electric') {
        ctx.save();
        const now = Date.now();

        // 0. ?€?€?˜ê²Œ ê³µì¤‘??? ë‹¤?ˆë©° ?´ê?ê±°ë¦¬???Œë¼ì¦ˆë§ˆ ?ë„ˆì§€ êµ¬ì²´ (8ê°? ?”ë“œ ê·¸ë¦¬??ì¢Œí‘œ ?™ê¸°??
        const plasmaPositions = [];
        for (let i = 0; i < 8; i++) {
            // ?”ë“œ ê·¸ë¦¬??ì¢Œí‘œ (gx, gy) ?ì—???œë¥˜?˜ë„ë¡?ì§€?•í•˜??ë§??œë˜ê·???ì¶??¬ì¼“ëª¬ê³¼ ?¨ê»˜ ?°ë™ ?´ë™
            const gx = -22.0 + (i * 6.5 + Math.sin(now * 0.0004 + i) * 3.0);
            const gy = 3.0 + ((i * 3.2 + Math.cos(now * 0.0005 + i * 2) * 2.0) % 22.0);
            const sc = gridToScreen(gx, gy);
            const orbX = sc.x;
            const orbY = sc.y;

            const baseR = scaleLength(0.28 + (i % 3) * 0.12); // ?”ë©´ ?´ìƒ?„ì— ë¹„ë??˜ëŠ” ë°˜ì?ë¦?
            const pulseR = baseR + Math.sin(now * 0.0015 + i) * scaleLength(0.06);
            
            plasmaPositions.push({ x: orbX, y: orbY });

            // ?¸ê³½ ê¸€ë¡œìš°
            ctx.shadowBlur = 14;
            ctx.shadowColor = (i % 2 === 0) ? 'rgba(251, 146, 60, 0.8)' : 'rgba(245, 158, 11, 0.8)';

            // ì½”ì–´ ê·¸ë¼?°ì´??êµ¬ì²´
            const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, Math.max(1, pulseR));
            orbGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');   // ?©ê¸ˆë¹?ì¤‘ì‹¬ ì½”ì–´
            orbGrad.addColorStop(0.5, (i % 2 === 0) ? 'rgba(251, 146, 60, 0.45)' : 'rgba(245, 158, 11, 0.45)');
            orbGrad.addColorStop(1, 'rgba(127, 29, 29, 0)');      // ë²„ê±´??ë°”ê¹¥ ê°€?¥ìë¦??¬ëª… ì²˜ë¦¬

            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(orbX, orbY, Math.max(1, pulseR), 0, Math.PI * 2);
            ctx.fill();

            // êµ¬ì²´ ì£¼ë????Œì „?˜ëŠ” ?ë ¥??ë§ˆì´?¬ë¡œ ?„ì„± ?…ì
            const satAngle = now * 0.002 + i;
            const satDist = pulseR + 6;
            const satX = orbX + Math.cos(satAngle) * satDist;
            const satY = orbY + Math.sin(satAngle) * satDist;
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(satX, satY, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 1. ê°€ê¹Œìš´ ?Œë¼ì¦ˆë§ˆ êµ¬ì²´ ê°??€?€?˜ê²Œ ?°ê²°?˜ëŠ” ?ë ¥??ë°©ì „??(Magnetic Flux Arcs)
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
        ctx.setLineDash([4, 6]);
        for (let a = 0; a < plasmaPositions.length; a++) {
            for (let b = a + 1; b < plasmaPositions.length; b++) {
                const dx = plasmaPositions[a].x - plasmaPositions[b].x;
                const dy = plasmaPositions[a].y - plasmaPositions[b].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 140) {
                    ctx.beginPath();
                    ctx.moveTo(plasmaPositions[a].x, plasmaPositions[a].y);
                    ctx.quadraticCurveTo(
                        (plasmaPositions[a].x + plasmaPositions[b].x) / 2 + Math.sin(now * 0.003 + a) * 15,
                        (plasmaPositions[a].y + plasmaPositions[b].y) / 2 + Math.cos(now * 0.003 + b) * 15,
                        plasmaPositions[b].x, plasmaPositions[b].y
                    );
                    ctx.stroke();
                }
            }
        }
        ctx.setLineDash([]); // ?ì„  ì´ˆê¸°??

        // 2. ??5~6ì´?ê°„ê²©(?•ë¥  0.003)?¼ë¡œ ?€?€?˜ê²Œ ?€?´ì˜¤ë¥´ëŠ” ?¨ì¼ ë²ˆê°œ ?„í¬
        if (Math.random() < 0.003) {
            const sparkGridX = -25 + Math.random() * 50;
            const sparkGridY = getTerrainY(sparkGridX);
            if (sparkGridY !== -100) {
                const p = gridToScreen(sparkGridX, sparkGridY);
                ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(251, 191, 36, 0.8)' : 'rgba(245, 158, 11, 0.8)';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 10;
                ctx.shadowColor = ctx.strokeStyle;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + (Math.random() - 0.5) * 12, p.y - 8 - Math.random() * 12);
                ctx.lineTo(p.x + (Math.random() - 0.5) * 18, p.y - 18 - Math.random() * 15);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // ê¹Šì? ë°”ë‹·??'ocean') ì§€??ë¶„ìœ„ê¸? ?´ì? 'ë½€ë¥´ë¥µ' ê³µê¸°ë°©ìš¸ ë¶„ì¶œ & '??' ?Œë©¸ ?°ì¶œ (?”ë“œ ê·¸ë¦¬??ì¢Œí‘œ ?™ê¸°??
    if (LEVELS[currentStage % LEVELS.length].terrain === 'ocean') {
        ctx.save();
        const now = Date.now();

        // ?™ì‹œ????2ê³³ì—?œë§Œ ??9.5ì´?ê°„ê²©?¼ë¡œ ?´ì©Œ????ë²ˆì”© ë½€ë¥´ë¥µ... ?? ?˜ê³  ?€?€?˜ê²Œ ?°ì¶œ
        for (let k = 0; k < 2; k++) {
            const burstPeriod = 9500; // 9.5ì´?ì£¼ê¸° (?¬ìœ ë¡?³  ?€?€??
            const rawTime = now + k * 4750; // 2ê³³ì´ ??4.7ì´??œì°¨ë¥??ê³  ë²ˆê°ˆ??ë¶„ì¶œ
            const cycle = Math.floor(rawTime / burstPeriod);
            const cycleProgress = (rawTime % burstPeriod) / burstPeriod; // 0.0 ~ 1.0

            // ?´ë‹¹ ?¬ì´?´ì˜ ?´ì? ë¶„ì¶œ ?„ì¹˜ gx ë°?ë¬´ì‘??ë°©ìš¸ ê°œìˆ˜ (2~4ê°?
            const seed = (k * 7919 + cycle * 3571) % 1000;
            const spawnGx = -20.0 + (seed / 1000.0) * 40.0;
            const bubbleCount = 2 + (seed % 3); // 2, 3, ?ëŠ” 4ê°œì˜ ë°©ìš¸??ë¬´ì‘?„ë¡œ ë¶„ì¶œ!
            const startGy = 0.5; // ?´ì? ì§€??ë¶€ê·?

            // 1ê°œì˜ ?¥ì??ì„œ ë¬´ì‘??2~4ê°œì˜ ë°©ìš¸??'ë½€-ë¥?ë¥? ?œì°¨ë¥??ê³  ?¼ì–´?¤ë¦„
            for (let b = 0; b < bubbleCount; b++) {
                const bDelay = b * 0.10; // ë½€ê¸€, ë½€ê¸€, ë½€ê¸€ ?œì°¨
                const bLifeProgress = (cycleProgress - bDelay) / 0.45; // ë°©ìš¸ ?˜ëª… (0.0 ~ 1.0)

                if (bLifeProgress >= 0 && bLifeProgress <= 1.0) {
                    // ?˜ëª… ì§„í–‰ë¥ ì— ?°ë¼ 0 ~ 2.8 ê²©ìë§?ì§§ê²Œ ?ìŠ¹
                    const riseHeight = bLifeProgress * (2.4 + b * 0.3);
                    const gy = startGy + riseHeight;
                    const wobble = Math.sin(now * 0.002 + b * 2.0) * 0.2;
                    const gx = spawnGx + (b - (bubbleCount - 1) / 2) * 0.3 + wobble;

                    const sc = gridToScreen(gx, gy);

                    // 0.0 ~ 0.75: ?ìŠ¹ êµ¬ê°„ (ë½€ë¥´ë¥µ ?¼ì–´?¤ë¦„)
                    if (bLifeProgress < 0.75) {
                        const r = scaleLength(0.08 + b * 0.025);
                        ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
                        ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
                        ctx.lineWidth = 1.3;
                        ctx.beginPath();
                        ctx.arc(sc.x, sc.y, Math.max(1, r), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();

                        // ?‡ë¹› ë°˜ì‚¬ ?˜ì´?¼ì´????
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                        ctx.beginPath();
                        ctx.arc(sc.x - r * 0.3, sc.y - r * 0.3, Math.max(0.5, r * 0.25), 0, Math.PI * 2);
                        ctx.fill();
                    } 
                    // 0.75 ~ 1.0: ?Œë©¸ êµ¬ê°„ ('??' ?˜ê³  ê¹”ë”?˜ê²Œ ?Œë©¸)
                    else {
                        const popFactor = (bLifeProgress - 0.75) / 0.25; // 0.0 ~ 1.0
                        const popR = scaleLength((0.08 + b * 0.025) * (1.0 + popFactor * 1.1));
                        const popAlpha = Math.max(0, 0.65 * (1.0 - popFactor));

                        // ???°ì????Œí˜• ?•ì¥ ë§?
                        ctx.strokeStyle = `rgba(186, 230, 253, ${popAlpha})`;
                        ctx.lineWidth = 1.0;
                        ctx.beginPath();
                        ctx.arc(sc.x, sc.y, Math.max(1, popR), 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
        }
        ctx.restore();
    }

    // Clouds with hole effect via offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');

    const drawCloudOff = (octx, cx, cy, baseRadius, alpha, isPower, colorType, pulse, stretchX = 1.0) => {
        octx.save();
        
        // êµ¬ë¦„ ?•íƒœ ?¨ìŠ¤ êµ¬ì„±
        octx.beginPath();
        octx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
        
        const w08 = baseRadius * 0.8 * stretchX;
        const w14 = baseRadius * 1.4 * stretchX;
        
        octx.moveTo(cx - w08 + baseRadius * 0.7, cy + baseRadius * 0.3);
        octx.arc(cx - w08, cy + baseRadius * 0.3, baseRadius * 0.7, 0, Math.PI * 2);
        octx.moveTo(cx + w08 + baseRadius * 0.7, cy + baseRadius * 0.3);
        octx.arc(cx + w08, cy + baseRadius * 0.3, baseRadius * 0.7, 0, Math.PI * 2);
        octx.moveTo(cx - w14 + baseRadius * 0.5, cy + baseRadius * 0.5);
        octx.arc(cx - w14, cy + baseRadius * 0.5, baseRadius * 0.5, 0, Math.PI * 2);
        octx.moveTo(cx + w14 + baseRadius * 0.5, cy + baseRadius * 0.5);
        octx.arc(cx + w14, cy + baseRadius * 0.5, baseRadius * 0.5, 0, Math.PI * 2);
        octx.rect(cx - w14, cy + baseRadius * 0.3, w14 * 2.0, baseRadius * 0.7);
        
        if (isPower) {
            const colors = { fire: '239, 68, 68', water: '59, 130, 246', grass: '45, 106, 79', electric: '250, 204, 21', poison: '168, 85, 247', ground: '217, 119, 6', normal: '200, 200, 200', psychic: '168, 85, 247' };
            const rgb = colors[colorType] || '200, 200, 200';
            
            // 1. ë² ì´???‰ìƒ ?¨ë‹¨?˜ê²Œ ì±„ìš°ê¸?
            octx.fillStyle = `rgba(${rgb}, ${alpha})`;
            // ë°œì‚¬ ì¤?shadowBlur ë¹„í™œ?±í™”
            // if (isFiring) { octx.shadowColor = `rgba(${rgb}, 0.8)`; octx.shadowBlur = 15 + (pulse || 0) * 5; }
            octx.fill();
            
            // 2. ?€?€???ŒìŠ¤??ì§„ì£¼?? ?¨ê³¼ë§??§ì…?ˆê¸°
            octx.shadowBlur = 0;
            const shift = Math.sin(Date.now() / 1500) * baseRadius * 0.6;
            const grad = octx.createLinearGradient(
                cx - baseRadius * 1.5 + shift, cy - baseRadius * 0.8 + shift, 
                cx + baseRadius * 1.5 + shift, cy + baseRadius * 1.0 + shift
            );
            
            grad.addColorStop(0.0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.3, `rgba(255, 200, 220, ${alpha * 0.35})`);
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.7, `rgba(200, 255, 240, ${alpha * 0.35})`);
            grad.addColorStop(0.9, `rgba(230, 210, 255, ${alpha * 0.35})`);
            grad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
            
            octx.fillStyle = grad;
            octx.fill();
        } else {
            octx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            octx.fill();
        }
        octx.restore();
    };

    cloudParams.forEach(cp => {
        const c = gridToScreen(cp.bx + Math.sin(Date.now() / cp.speed) * 1.5, cp.by + Math.cos(Date.now() / (cp.speed * 1.3)) * 0.5);
        let currentRadius = cp.radius;
        let pulse = 0;
        if (cp.isPowerCloud) {
            pulse = Math.sin(Date.now() / 400);
            currentRadius = cp.radius * (1 + pulse * 0.055);
        }

        // ocean ë§µì—?œëŠ” ?Œì›Œ??êµ¬ë¦„??ê±°í’ˆ(ë²„ë¸”) ëª¨ì–‘?¼ë¡œ ?Œë”ë§?
        if (stage.terrain === 'ocean' && cp.isPowerCloud) {
            const r = scaleLength(currentRadius);
            const typeColors = {
                fire:    { main: 'rgba(255, 120, 50, 0.35)', rim: 'rgba(255, 180, 100, 0.6)', highlight: 'rgba(255, 220, 180, 0.8)' },
                water:   { main: 'rgba(80, 160, 255, 0.35)',  rim: 'rgba(130, 200, 255, 0.6)', highlight: 'rgba(200, 235, 255, 0.8)' },
                grass:   { main: 'rgba(80, 200, 100, 0.35)',  rim: 'rgba(140, 230, 140, 0.6)', highlight: 'rgba(200, 255, 210, 0.8)' },
                flying:  { main: 'rgba(160, 180, 255, 0.35)', rim: 'rgba(190, 210, 255, 0.6)', highlight: 'rgba(230, 240, 255, 0.8)' },
                psychic: { main: 'rgba(200, 100, 240, 0.35)', rim: 'rgba(220, 160, 255, 0.6)', highlight: 'rgba(240, 210, 255, 0.8)' }
            };
            // ?¬í•´ ë§µì˜ ë²„ë¸”?€ ??ƒ ë°”ë‹·???ë‚Œ(ë¬??ì„± ?‰ìƒ)?¼ë¡œ ê³ ì •
            const colors = typeColors.water;

            offCtx.save();
            // ê±°í’ˆ ë³¸ì²´ (ë°˜íˆ¬ëª???
            offCtx.beginPath();
            offCtx.arc(c.x, c.y, r, 0, Math.PI * 2);
            offCtx.fillStyle = colors.main;
            offCtx.fill();

            // ê±°í’ˆ ?Œë‘ë¦?(?‡ì? ë§?
            offCtx.beginPath();
            offCtx.arc(c.x, c.y, r, 0, Math.PI * 2);
            offCtx.strokeStyle = colors.rim;
            offCtx.lineWidth = Math.max(1.5, r * 0.08);
            offCtx.stroke();

            // ?˜ì´?¼ì´??ë°˜ì§??(?¼ìª½ ?ë‹¨ ?‘ì? ??
            offCtx.beginPath();
            offCtx.arc(c.x - r * 0.3, c.y - r * 0.3, r * 0.22, 0, Math.PI * 2);
            offCtx.fillStyle = colors.highlight;
            offCtx.fill();

            offCtx.restore();
        } else {
            drawCloudOff(offCtx, c.x, c.y, scaleLength(currentRadius), cp.alpha, cp.isPowerCloud, cp.colorType, pulse, cp.stretchX || 1.0);
        }
    });

    // destination-out?¼ë¡œ êµ¬ë© ?«ê¸°
    if (cloudHoles.length > 0) {
        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-out';
        cloudHoles.forEach(h => {
            const sc = gridToScreen(h.x, h.y);
            const sr = scaleLength(h.radius);
            if (sr <= 0) return;
            // ë¶€?œëŸ¬???˜ë”ë§ì„ ?„í•œ ë°©ì‚¬??ê·¸ë¼?°ì´??
            const hGrad = offCtx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, sr);
            hGrad.addColorStop(0, 'rgba(0,0,0,1)');
            hGrad.addColorStop(1, 'rgba(0,0,0,0)');
            offCtx.fillStyle = hGrad;
            offCtx.beginPath();
            offCtx.arc(sc.x, sc.y, sr, 0, Math.PI * 2);
            offCtx.fill();
        });
        offCtx.restore();
    }

    // ?„ì„±???¤í”„?¤í¬ë¦??´ë?ì§€ë¥?ë©”ì¸ ìº”ë²„?¤ì— ?©ì„±
    ctx.drawImage(offCanvas, 0, 0);


    // Cave ceiling/wall overlay (?™êµ´ ?¸ë²½ ?Œë”ë§?
    const getCeilY = (x) => {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        return (typeof ceilHeights !== 'undefined' && ceilHeights[key] !== undefined) ? ceilHeights[key] : (tData.ceilFunc ? tData.ceilFunc(x) : 1000);
    };
    if (tData.hasCaveWall && tData.ceilFunc) {
        if (needsCaveRedraw || !caveCeilingCanvas) {
            if (!caveCeilingCanvas) {
                caveCeilingCanvas = document.createElement('canvas');
            }
            caveCeilingCanvas.width = canvas.width;
            caveCeilingCanvas.height = canvas.height;
            const cCtx = caveCeilingCanvas.getContext('2d');
            const caveMinX = -60, caveMaxX = 60;

            // 1. ?¸ê³½ ?´ë‘???ì—­ (evenodd ë°©ì‹ ?¬ìš©) - ?¨ìƒ‰ #0d0d0d ë°°ê²½ ì²˜ë¦¬
            cCtx.save();
            cCtx.beginPath();
            cCtx.rect(-10, -10, caveCeilingCanvas.width + 20, caveCeilingCanvas.height + 20); // ?„ì²´ ?”ë©´
            
            // êµ¬ë© ?Œê¸° (CCW)
            const sp2 = gridToScreen(caveMinX, getCeilY(caveMinX));
            cCtx.moveTo(-10, caveCeilingCanvas.height + 10);
            cCtx.lineTo(caveCeilingCanvas.width + 10, caveCeilingCanvas.height + 10);
            const ep2 = gridToScreen(caveMaxX, getCeilY(caveMaxX));
            cCtx.lineTo(ep2.x, ep2.y);
            for (let x = caveMaxX; x >= caveMinX; x -= 0.5) { // 0.2 -> 0.5ë¡?ìºì‹œ ?Œë”ë§?ìµœì ??
                const p = gridToScreen(Math.max(x, caveMinX), getCeilY(Math.max(x, caveMinX)));
                cCtx.lineTo(p.x, p.y);
            }
            cCtx.lineTo(-10, caveCeilingCanvas.height + 10);
            cCtx.closePath();

            cCtx.fillStyle = '#0d0d0d';
            cCtx.fill('evenodd');
            cCtx.restore();
            
            // 2. ì²œì¥ ë°”ìœ„(?”ì„) ?´ë? ì±„ìš°ê¸?(?”ë©´ ?ë‹¨?¼ë¡œ)
            cCtx.save();
            cCtx.beginPath();
            const cEdge2 = gridToScreen(caveMinX, getCeilY(caveMinX));
            cCtx.moveTo(cEdge2.x, cEdge2.y);
            for (let x = caveMinX; x <= caveMaxX; x += 0.5) {
                const p = gridToScreen(Math.min(x, caveMaxX), getCeilY(Math.min(x, caveMaxX)));
                cCtx.lineTo(p.x, p.y);
            }
            cCtx.lineTo(caveCeilingCanvas.width + 10, -10);
            cCtx.lineTo(-10, -10);
            cCtx.closePath();
            cCtx.fillStyle = tData.color || '#595959';
            cCtx.fill();
            cCtx.restore();

            // 3. ì²œì¥ ?Œë‘ë¦¬ì„  (?”ì„ ?¤ê³½)
            cCtx.save();
            cCtx.beginPath();
            const cEdge = gridToScreen(caveMinX, getCeilY(caveMinX));
            cCtx.moveTo(cEdge.x, cEdge.y);
            for (let x = caveMinX; x <= caveMaxX; x += 0.5) {
                const p = gridToScreen(Math.min(x, caveMaxX), getCeilY(Math.min(x, caveMaxX)));
                cCtx.lineTo(p.x, p.y);
            }
            cCtx.strokeStyle = 'rgba(130,130,130,0.7)';
            cCtx.lineWidth = 3;
            cCtx.stroke();
            cCtx.restore();

            needsCaveRedraw = false;
        }
        
        ctx.drawImage(caveCeilingCanvas, 0, 0);
    }

    // Terrain polygon
    ctx.fillStyle = tData.color;
    ctx.lineWidth = 2; 
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    
    if (tData.isFloating) {
        let inIsland = false;
        let islandPoints = [];
        let islandThickness = 4.0; // ê¸°ë³¸ê°?
        
        const drawIslandPoly = (pts, thickness) => {
            if (pts.length === 0) return;
            ctx.beginPath();
            let p = gridToScreen(pts[0].x, pts[0].y);
            ctx.moveTo(p.x, p.y);
            for (let i = 1; i < pts.length; i++) {
                p = gridToScreen(pts[i].x, pts[i].y);
                ctx.lineTo(p.x, p.y);
            }
            const n = pts.length;
            const R = 2.5; // ê°€?¥ìë¦??¥ê?ê¸?ë°˜ê²½ (?ˆë? ê¸¸ì´)
            for (let i = n - 1; i >= 0; i--) {
                const distToEdge = Math.min(pts[i].x - pts[0].x, pts[n-1].x - pts[i].x);
                let taper = 1;
                if (distToEdge < R) {
                    // ê°€?¥ìë¦?R ë²”ìœ„ ?´ì—?œë§Œ ?ì˜ ë°©ì •?ì„ ?´ìš©???¥ê?ê²?ë§ˆê°
                    taper = Math.sqrt(Math.max(0, 1 - Math.pow(1 - distToEdge / R, 2)));
                }
                const wave = Math.sin(pts[i].x * 1.8) * 0.4 + Math.cos(pts[i].x * 3.2) * 0.2;
                // taperê°€ 1??ì¤‘ê°„ ë¶€ë¶„ì? ?ˆë? ì¢Œí‘œ(x) ê¸°ë°˜??waveë§??ìš©?˜ì–´ ?Œê´´ ?œì—??ëª¨ì–‘??ë³€?˜ì? ?ŠìŒ
                const actualThickness = thickness * taper + wave * taper;
                let bottomY = pts[i].origY - Math.max(0, actualThickness);
                // ?Œí¸??ë°©ì?: ?¬ë ˆ?´í„°ë¡?ê¹ì—¬?˜ê°„ ?—ë©´(y)???ë˜ ë°”ë‹¥ë©´ë³´????•„ì§€ë©? ë°”ë‹¥ë©´ë„ ê·??—ë©´ ?´í•˜ë¡??´ë ¤ê°€???¤ê°?•ì´ ??ê¼¬ì„
                bottomY = Math.min(bottomY, pts[i].y);
                p = gridToScreen(pts[i].x, bottomY);
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
            ctx.lineJoin = 'round';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.stroke();
        };

        const numLayers = tData.layers ? tData.layers.length : 1;
        
    if (tData.islands) {
            // ?í˜•/?€???„í˜•) ê¸°ë°˜ ?Œë”ë§?+ ?¬ë ˆ?´í„° ì§€?°ê¸° (êµ¬ë¦„ ë°©ì‹)
            const islandCanvas = document.createElement('canvas');
            islandCanvas.width = canvas.width;
            islandCanvas.height = canvas.height;
            const ictx = islandCanvas.getContext('2d');
            
            const scaleX = canvas.width / (X_MAX - X_MIN);
            const scaleY = canvas.height / (Y_MAX - Y_MIN);

            // 1. ?Œë‘ë¦??„ì›ƒ?¼ì¸ (outColor)
            if (tData.outColor) {
                ictx.fillStyle = tData.outColor;
                for (let l = 0; l < tData.islands.length; l++) {
                    for (const s of tData.islands[l]) {
                        const p = gridToScreen(s.cx, s.cy);
                        const prx = (s.rx + 0.06) * scaleX;
                        const pry = (s.ry + 0.06) * scaleY;
                        ictx.beginPath();
                        if (s.type === 'ellipse' || s.rx !== s.ry) {
                            ictx.ellipse(p.x, p.y, prx, pry, s.rot || 0, 0, Math.PI * 2);
                        } else {
                            ictx.arc(p.x, p.y, prx, 0, Math.PI * 2);
                        }
                        ictx.fill();
                    }
                }
            }

            // 2. ë³¸ì²´ ?„í˜• ?‰ìƒ (color)
            ictx.fillStyle = tData.color || '#22c55e';
            for (let l = 0; l < tData.islands.length; l++) {
                for (const s of tData.islands[l]) {
                    const p = gridToScreen(s.cx, s.cy);
                    const prx = s.rx * scaleX;
                    const pry = s.ry * scaleY;
                    ictx.beginPath();
                    if (s.type === 'ellipse' || s.rx !== s.ry) {
                        ictx.ellipse(p.x, p.y, prx, pry, s.rot || 0, 0, Math.PI * 2);
                    } else {
                        ictx.arc(p.x, p.y, prx, 0, Math.PI * 2);
                    }
                    ictx.fill();
                }
            }

            // 3. ?¬ë ˆ?´í„° ì§€?°ê¸°
            if (typeof craters !== 'undefined' && craters.length > 0) {
                ictx.globalCompositeOperation = 'destination-out';
                for (const crater of craters) {
                    const p = gridToScreen(crater.x, crater.y);
                    const pr = crater.r * scaleX;
                    ictx.beginPath();
                    ictx.arc(p.x, p.y, pr, 0, Math.PI * 2);
                    ictx.fill();
                }
                ictx.globalCompositeOperation = 'source-over';
            }
            ctx.drawImage(islandCanvas, 0, 0);
        } else {
            for (let l = 0; l < numLayers; l++) {
                let inIsland = false;
                let islandPoints = [];
                let islandThickness = 4.0;
                for (let x = -35; x <= 35.2; x += 0.2) {
                    let cx = Math.min(x, 35);
                    let y = getTerrainYAll(cx)[l];
                    let origY = tData.layers ? tData.layers[l](cx) : (tData.func ? tData.func(cx) : y);
                    // ë¶€?™ì†Œ?˜ì  ?¤ì°¨ë¡?origYê°€ -100???˜ê±°??yë³´ë‹¤ ?¬í•˜ê²???•„ì§€???„ìƒ ë°©ì–´
                    if (origY !== undefined && y !== undefined) origY = Math.max(origY, y);
                    
                    if (y !== undefined && y > -50) {
                        if (!inIsland) { 
                            inIsland = true; 
                            islandPoints = []; 
                            islandThickness = tData.getThickness ? tData.getThickness(cx) : 4.0;
                        }
                        islandPoints.push({x: cx, y: y, origY: origY});
                    } else {
                        if (inIsland) {
                            drawIslandPoly(islandPoints, islandThickness);
                            inIsland = false;
                        }
                    }
                }
                if (inIsland) drawIslandPoly(islandPoints, islandThickness);
            }
        }
    } else if (stage.terrain === 'sky') {
        const skyStartX = -30;
        const skyEndX = 30;
        const thickness = 5.0;

        let targetCtx = ctx;
        let craterCanvas = null;
        if (typeof craters !== 'undefined' && craters.length > 0) {
            const cc = getCraterCanvas(canvas.width, canvas.height);
            craterCanvas = cc.canvas; targetCtx = cc.ctx;
        }

        const getOrigY = (x) => {
            const key = (Math.round(x * 10) / 10).toFixed(1);
            return (originalTerrainHeights[key] && originalTerrainHeights[key].length > 0) ? originalTerrainHeights[key][0] : -100;
        };

        // 1. ?ë‹¨ ?œë©´ ê³¡ì„  (skyStartX -> skyEndX)
        targetCtx.beginPath();
        const startP = gridToScreen(skyStartX, getOrigY(skyStartX));
        targetCtx.moveTo(startP.x, startP.y);
        for (let x = skyStartX; x <= skyEndX; x = Math.min(skyEndX, x + 0.2)) {
            const p = gridToScreen(x, getOrigY(x));
            targetCtx.lineTo(p.x, p.y);
            if (x >= skyEndX) break;
        }

        // 2. ?°ì¸¡ ??ë­‰íˆ­??ë³¼ë¡ ?¥ê·¼ ê³¡ì„  ìº?ë§ˆê°
        const rightTopY = getOrigY(skyEndX);
        const rightMidP = gridToScreen(skyEndX + 2.0, rightTopY - thickness / 2);
        const rightBotP = gridToScreen(skyEndX, rightTopY - thickness);
        targetCtx.quadraticCurveTo(rightMidP.x, rightMidP.y, rightBotP.x, rightBotP.y);

        // 3. ?˜ë‹¨ ?œë©´ ê³¡ì„  (skyEndX -> skyStartX)
        for (let x = skyEndX; x >= skyStartX; x = Math.max(skyStartX, x - 0.2)) {
            const p = gridToScreen(x, getOrigY(x) - thickness);
            targetCtx.lineTo(p.x, p.y);
            if (x <= skyStartX) break;
        }

        // 4. ì¢Œì¸¡ ??ë­‰íˆ­??ë³¼ë¡ ?¥ê·¼ ê³¡ì„  ìº?ë§ˆê°
        const leftTopY = getOrigY(skyStartX);
        const leftMidP = gridToScreen(skyStartX - 2.0, leftTopY - thickness / 2);
        const leftTopP = gridToScreen(skyStartX, leftTopY);
        targetCtx.quadraticCurveTo(leftMidP.x, leftMidP.y, leftTopP.x, leftTopP.y);

        targetCtx.closePath();

        targetCtx.fillStyle = tData.color;
        targetCtx.fill();
        // êµ¬ë¦„ ???˜ëŠ˜ ë§µì? ???Œë‘ë¦???stroke)???œê±°?˜ì—¬ x=38 ë¶€ê·??????„ë²½ ?? œ

        // 5. ??°œ êµ¬ë©(craters) ?€ê³?
        if (craterCanvas) {
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
    } else if (stage.terrain === 'log_bridge') {
        const skyStartX = -30;
        const skyEndX = 30;
        const thickness = 5.0; // ê³ ì • ?ê»˜ë¡??˜ë‹¨ ?¼ì¸??xì¶•ê³¼ ?‰í–‰?˜ê³  ê¹”ë”?˜ê²Œ ?Œë”ë§?(?°ì‚° ë¶€???œê±°)

        let targetCtx = ctx;
        let craterCanvas = null;
        if (typeof craters !== 'undefined' && craters.length > 0) {
            const cc = getCraterCanvas(canvas.width, canvas.height);
            craterCanvas = cc.canvas; targetCtx = cc.ctx;
        }

        const getOrigY = (x) => {
            const key = (Math.round(x * 10) / 10).toFixed(1);
            return (originalTerrainHeights[key] && originalTerrainHeights[key].length > 0) ? originalTerrainHeights[key][0] : -100;
        };

        // ?µë‚˜ë¬??„ì²´ ?¸í˜• ?¨ìŠ¤ (?ë‹¨ ?œë©´ -> ?°ì¸¡ ìº?-> ?‰í–‰ ?˜ë‹¨ ?¼ì¸ -> ì¢Œì¸¡ ìº?
        targetCtx.beginPath();
        const startP = gridToScreen(skyStartX, getOrigY(skyStartX));
        targetCtx.moveTo(startP.x, startP.y);
        for (let x = skyStartX; x <= skyEndX; x = Math.min(skyEndX, x + 0.4)) {
            const p = gridToScreen(x, getOrigY(x));
            targetCtx.lineTo(p.x, p.y);
            if (x >= skyEndX) break;
        }

        // ?°ì¸¡ ?¥ê·¼ ?˜ì´???¨ë©´ ìº?ë§ˆê° (?˜ì§?¼ë¡œ ?˜ë¦° ?ë‚Œ???†ì• ê¸??„í•´ ?¥ê?ê²??°ì¥)
        const rightTopY = getOrigY(skyEndX);
        const rightMidP = gridToScreen(skyEndX + 2.5, rightTopY - thickness / 2);
        const rightBotP = gridToScreen(skyEndX, rightTopY - thickness);
        targetCtx.quadraticCurveTo(rightMidP.x, rightMidP.y, rightBotP.x, rightBotP.y);

        // ?˜ë‹¨ ê»ì§ˆ ?¼ì¸ (xì¶•ê³¼ ?‰í–‰???¼ì§??ë°”ë‹¥, ê³ ì • ?ê»˜ 5.0)
        for (let x = skyEndX; x >= skyStartX; x = Math.max(skyStartX, x - 0.4)) {
            const p = gridToScreen(x, getOrigY(x) - thickness);
            targetCtx.lineTo(p.x, p.y);
            if (x <= skyStartX) break;
        }

        // ì¢Œì¸¡ ?¥ê·¼ ?˜ì´???¨ë©´ ìº?ë§ˆê° (?˜ì§?¼ë¡œ ?˜ë¦° ?ë‚Œ???†ì• ê¸??„í•´ ?¥ê?ê²??°ì¥)
        const leftTopY = getOrigY(skyStartX);
        const leftMidP = gridToScreen(skyStartX - 2.5, leftTopY - thickness / 2);
        const leftTopP = gridToScreen(skyStartX, leftTopY);
        targetCtx.quadraticCurveTo(leftMidP.x, leftMidP.y, leftTopP.x, leftTopP.y);
        targetCtx.closePath();

        // 1. ?µë‚˜ë¬?ê¸°ë³¸ ë°”íƒ• (?´ë‘??ê³„ì—´ ?˜ì§ ê·¸ë¼?°ì´?? ?ë‹¨ ì¤‘ê°„ ê°ˆìƒ‰ ???˜ë‹¨ ì§™ì? ?¤í¬ë¸Œë¼??
        {
            const logTop = gridToScreen(0, 0);
            const logBot = gridToScreen(0, -6);
            const logGrad = targetCtx.createLinearGradient(0, logTop.y, 0, logBot.y);
            logGrad.addColorStop(0.0, '#6b2d10'); // ?ë‹¨ ì¤‘ê°„ ê°ˆìƒ‰
            logGrad.addColorStop(0.55, '#3d1207'); // ì¤‘ê°„ ??ë¸Œë¼??
            logGrad.addColorStop(1.0, '#1e0803'); // ?˜ë‹¨ ë§¤ìš° ì§™ì? ?¤í¬ë¸Œë¼??
            targetCtx.fillStyle = logGrad;
            targetCtx.fill();
        }

        // 2. ?˜ë¬´ ê»ì§ˆ ë°?ê²??¨í„´ ?Œë”ë§?(ê²€?€ ?¸ë¡œ ?ˆê¸ˆ???œê±° ??? ê¸°?ì¸ ?˜ë­‡ê²?ë°??¹ì´ ?Œë”ë§?
        targetCtx.save();
        targetCtx.clip();

        // ?˜í‰ ?˜ë­‡ê²??ë¦„??(? ê¸°?ì¸ ë¬´ëŠ¬, ë°˜ë³µ ?Ÿìˆ˜ ì¶•ì†Œ?˜ì—¬ ìµœì ??
        for (let relRatio = 0.2; relRatio < 0.9; relRatio += 0.25) {
            targetCtx.beginPath();
            for (let x = skyStartX - 2; x <= skyEndX + 2; x += 0.4) {
                const curThick = thickness;
                const yVal = getOrigY(x) - curThick * relRatio + Math.sin(x * 0.7 + relRatio * 10) * 0.2;
                const p = gridToScreen(x, yVal);
                if (x === skyStartX - 2) targetCtx.moveTo(p.x, p.y);
                else targetCtx.lineTo(p.x, p.y);
            }
            targetCtx.strokeStyle = (Math.round(relRatio * 100) % 2 === 0) ? 'rgba(61, 21, 6, 0.45)' : 'rgba(122, 47, 18, 0.35)';
            targetCtx.lineWidth = 2.5;
            targetCtx.stroke();
        }

        // 2-B. ?˜ë¬´ ?¹ì´ (Wood Knots) ??ê°œìˆ˜ë¥??€??ì¶•ì†Œ?˜ì—¬ 3ê°œë§Œ ?œë¬¸?œë¬¸ ?ì—°?¤ëŸ½ê²?ë°°ì¹˜
        const knotPositions = [-22, 2, 26];
        knotPositions.forEach((kx, kIdx) => {
            const ky = getOrigY(kx) - thickness * (0.3 + (kIdx % 3) * 0.2);
            const kp = gridToScreen(kx, ky);
            const krx = scaleLength(0.85 + (kIdx % 2) * 0.25);
            const kry = scaleLength(0.5 + (kIdx % 2) * 0.15);
            const angle = 0.18 * (kIdx % 2 === 0 ? 1 : -1);

            targetCtx.save();

            // 1) ?¹ì´ ì£¼ë? ?˜ë­‡ê²??˜ì–´ì§??Œë™ (Grain Warp Lines)
            targetCtx.beginPath();
            const warpR = krx * 2.2;
            for (let t = -Math.PI; t <= Math.PI; t += 0.2) {
                const wx = kp.x + Math.cos(t) * warpR * (1 + Math.sin(t * 2) * 0.15);
                const wy = kp.y + Math.sin(t) * (kry * 2.2) * (1 + Math.cos(t) * 0.1);
                if (t === -Math.PI) targetCtx.moveTo(wx, wy);
                else targetCtx.lineTo(wx, wy);
            }
            targetCtx.strokeStyle = 'rgba(40, 12, 4, 0.4)';
            targetCtx.lineWidth = 1.8;
            targetCtx.stroke();

            // 2) ?¹ì´ ë³¸ì²´ ë°©ì‚¬??3D ê·¸ë¼?°ì´??(ì¤‘ì‹¬ ì§™ì? ê°ˆìƒ‰ -> ?¸ê³½ ? ê¸°???ê°ˆ??
            const knotGrad = targetCtx.createRadialGradient(kp.x - krx * 0.2, kp.y - kry * 0.2, 2, kp.x, kp.y, krx);
            knotGrad.addColorStop(0.0, '#1c0701'); // ì¤‘ì‹¬ ê¹Šì? ?Œì˜
            knotGrad.addColorStop(0.55, '#3a1304'); // ì¤‘ê°„ ?ê°ˆ??
            knotGrad.addColorStop(1.0, '#240a02'); // ?¸ê³½ ?Œë‘ë¦?

            targetCtx.beginPath();
            targetCtx.ellipse(kp.x, kp.y, krx, kry, angle, 0, Math.PI * 2);
            targetCtx.fillStyle = knotGrad;
            targetCtx.fill();
            targetCtx.strokeStyle = '#170501';
            targetCtx.lineWidth = 2.2;
            targetCtx.stroke();

            // 3) ?Œì˜¤ë¦??˜ì´??(Spiral Ring)
            targetCtx.beginPath();
            const rings = 3;
            for (let r = 1; r <= rings; r++) {
                const ringRatio = r / (rings + 0.5);
                const rx = krx * ringRatio;
                const ry = kry * ringRatio;
                targetCtx.moveTo(kp.x + rx, kp.y);
                targetCtx.ellipse(kp.x, kp.y, rx, ry, angle, 0, Math.PI * 2);
            }
            targetCtx.strokeStyle = 'rgba(20, 5, 1, 0.55)';
            targetCtx.lineWidth = 1.2;
            targetCtx.stroke();

            // 4) ?¸ë????˜ë¬´ ê· ì—´ (Wood Crack)
            targetCtx.beginPath();
            const crackDir = (kIdx % 2 === 0) ? 1 : -1;
            targetCtx.moveTo(kp.x, kp.y);
            targetCtx.lineTo(kp.x + krx * 0.7 * crackDir, kp.y - kry * 0.3);
            targetCtx.lineTo(kp.x + krx * 0.9 * crackDir, kp.y - kry * 0.1);
            targetCtx.strokeStyle = '#0d0300';
            targetCtx.lineWidth = 1.5;
            targetCtx.stroke();

            targetCtx.restore();
        });

        // 3. ?µë‚˜ë¬??ë‹¨ ?”ë”” ?€ë°??ˆì´??(?ê»˜ ?ˆë°˜ 0.1625 ?¬ë¦¼?? #22c55e -> #15803d 2??ê·¸ë¼?°ì´??
        targetCtx.save();
        targetCtx.beginPath();
        const gStartP = gridToScreen(skyStartX, getOrigY(skyStartX));
        targetCtx.moveTo(gStartP.x, gStartP.y);
        for (let x = skyStartX; x <= skyEndX; x = Math.min(skyEndX, x + 0.4)) {
            const p = gridToScreen(x, getOrigY(x));
            targetCtx.lineTo(p.x, p.y);
            if (x >= skyEndX) break;
        }
        for (let x = skyEndX; x >= skyStartX; x = Math.max(skyStartX, x - 0.4)) {
            const p = gridToScreen(x, getOrigY(x) - 0.1625);
            targetCtx.lineTo(p.x, p.y);
            if (x <= skyStartX) break;
        }
        targetCtx.closePath();

        // ë¶€?œëŸ¬??3???˜ì§ ê·¸ë¼?°ì´??(?ë‹¨ #22c55e -> ì¤‘ì•™ #16a34a -> ?˜ë‹¨ #15803d)
        const topScreenP = gridToScreen(0, 0);
        const botScreenP = gridToScreen(0, -0.1625);
        const grassGrad = targetCtx.createLinearGradient(0, topScreenP.y - 2, 0, botScreenP.y + 2);
        grassGrad.addColorStop(0.0, '#22c55e');  // ?ë‹¨ ?±ê·¸?¬ìš´ ê·¸ë¦°
        grassGrad.addColorStop(0.5, '#16a34a');  // ì¤‘ì•™ ì¤‘ê°„ ê·¸ë¦°
        grassGrad.addColorStop(1.0, '#15803d');  // ?˜ë‹¨ ì°¨ë¶„????ê·¸ë¦°
        targetCtx.fillStyle = grassGrad;
        targetCtx.fill();

        // Dot Rim: 2ê°€ì§€ ?‰ìƒ ë°°ì¹˜ pathë¡?ë¬¶ì–´ fill() 2?Œë§Œ ?¸ì¶œ (300????GPU flush ?ˆê°)
        {
            const microDotStep = 0.4;
            targetCtx.beginPath();
            for (let x = skyStartX; x <= skyEndX; x += microDotStep * 2) {
                const topY = getOrigY(x);
                const p = gridToScreen(x, topY);
                const microDotR = scaleLength(0.01 + Math.abs(Math.sin(x * 6.3)) * 0.01);
                targetCtx.moveTo(p.x + microDotR, p.y + (Math.sin(x * 11) > 0 ? 0.3 : -0.3));
                targetCtx.arc(p.x, p.y + (Math.sin(x * 11) > 0 ? 0.3 : -0.3), microDotR, 0, Math.PI * 2);
            }
            targetCtx.fillStyle = 'rgba(20, 83, 45, 0.45)';
            targetCtx.fill();

            targetCtx.beginPath();
            for (let x = skyStartX + microDotStep; x <= skyEndX; x += microDotStep * 2) {
                const topY = getOrigY(x);
                const p = gridToScreen(x, topY);
                const microDotR = scaleLength(0.01 + Math.abs(Math.sin(x * 6.3)) * 0.01);
                targetCtx.moveTo(p.x + microDotR, p.y + (Math.sin(x * 11) > 0 ? 0.3 : -0.3));
                targetCtx.arc(p.x, p.y + (Math.sin(x * 11) > 0 ? 0.3 : -0.3), microDotR, 0, Math.PI * 2);
            }
            targetCtx.fillStyle = 'rgba(22, 101, 52, 0.35)';
            targetCtx.fill();
        }

        // ?µë‚˜ë¬?ê²½ê³„ ?‡ì? ???´ë¼ ??(Soil Border)
        targetCtx.beginPath();
        for (let x = skyStartX; x <= skyEndX; x += 0.4) {
            const bp = gridToScreen(x, getOrigY(x) - 0.1625);
            if (x === skyStartX) targetCtx.moveTo(bp.x, bp.y);
            else targetCtx.lineTo(bp.x, bp.y);
        }
        targetCtx.strokeStyle = 'rgba(35, 15, 5, 0.45)';
        targetCtx.lineWidth = 1.2;
        targetCtx.stroke();

        targetCtx.restore(); // ?”ë”” ?ˆì´??save ?´ì œ
        targetCtx.restore(); // ?´ë¦¬???´ì œ

        // 5. ??°œ êµ¬ë©(craters) ?€ê³???ëª¨ë“  ì§€???”ì†Œ(?µë‚˜ë¬? ?”ë””, Dot Rim, ????ë¥?ê·¸ë¦¬ê³??????¼ê´„ ?€ê³µí•˜???«ë¦° êµ¬ë© ???”ìƒ ?„ë²½ ?œê±°
        if (craterCanvas) {
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
    } else {
        // ì§€???°ì´?°ëŠ” -60~60 ë²”ìœ„?ì„œë§?ì´ˆê¸°?”ë¨.
        // ??terrainHeights(?¬ë ˆ?´í„°ë¡??êµ¬ ?˜ì •??ê°? ?¬ìš© ??craters ë°°ì—´ ìº??¤ë²„?Œë¡œ?°ì? ë¬´ê??˜ê²Œ
        //    ?Œê´´??ì§€?•ì´ ?ˆë? ë³µêµ¬?˜ì? ?ŠìŒ. destination-out ?€ê³??¨ê³„ ë¶ˆí•„??
        const getTerrainYForRender = (x) => {
            const key = (Math.round(x * 10) / 10).toFixed(1);
            const curr = terrainHeights[key];
            if (curr && curr.length > 0 && curr[0] !== -100) return curr[0];
            const orig = originalTerrainHeights[key];
            return (orig && orig.length > 0) ? orig[0] : getTerrainY(x);
        };
        const TERRAIN_DATA_MIN = -60;
        const TERRAIN_DATA_MAX = 60;
        const drawMinX = Math.max(X_MIN, TERRAIN_DATA_MIN);
        const drawMaxX = Math.min(X_MAX, TERRAIN_DATA_MAX);

        ctx.beginPath();
        if (drawMinX <= drawMaxX) {
            const startP = gridToScreen(drawMinX, getTerrainYForRender(drawMinX));
            ctx.moveTo(startP.x, startP.y);
            for (let x = drawMinX; x <= drawMaxX; x += 0.2) {
                const p = gridToScreen(x, getTerrainYForRender(x));
                ctx.lineTo(p.x, p.y);
            }
            const br = gridToScreen(drawMaxX, -1000);
            const bl = gridToScreen(drawMinX, -1000);
            ctx.lineTo(br.x, br.y);
            ctx.lineTo(bl.x, bl.y);
        }
        ctx.closePath();
        ctx.fillStyle = tData.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();
    }


    // Grid & Axes
    const isBright = ['sky', 'ice'].includes(LEVELS[currentStage % LEVELS.length].terrain);
    const gridColor = isBright ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    const thickLine = isBright ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
    const thinLine  = isBright ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)';
    const axisLine  = isBright ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)';
    ctx.font = "16px 'Cambria Math','Times New Roman',serif";
    ctx.fillStyle = gridColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // isFiring ?Œë˜ê·?ê°±ì‹  (ëª¨ë“ˆ ?ˆë²¨ ë³€??- drawEntity?ì„œ??ì°¸ì¡°)
    isFiring = GAME_STATE === 'FIRING' || effects.length > 0;
    ctx.shadowBlur = 0; // ê·¸ë¦¬???ˆì´ë¸?shadowBlur ?œê±° (?ì‹œ ë¶€???ì¸)

    for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
        const p0 = gridToScreen(x, Y_MIN), p1 = gridToScreen(x, Y_MAX);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.lineWidth = (x % 5 === 0 && x !== 0) ? 2.5 : 1.5;
        ctx.strokeStyle = (x % 5 === 0 && x !== 0) ? thickLine : thinLine;
        ctx.stroke();
        if (x % 5 === 0 && x !== 0) ctx.fillText(x < 0 ? '?? + Math.abs(x) : x, p0.x, gridToScreen(x, 0).y + 20);
    }
    for (let y = Math.ceil(Y_MIN); y <= Math.floor(Y_MAX); y++) {
        const p0 = gridToScreen(X_MIN, y), p1 = gridToScreen(X_MAX, y);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.lineWidth = (y % 5 === 0 && y !== 0) ? 2.5 : 1.5;
        ctx.strokeStyle = (y % 5 === 0 && y !== 0) ? thickLine : thinLine;
        ctx.stroke();
        if (y % 5 === 0 && y !== 0) ctx.fillText(y < 0 ? '?? + Math.abs(y) : y, gridToScreen(0, y).x - 20, p0.y);
    }
    ctx.shadowBlur = 0; // ì¶??Œë” ??ì´ˆê¸°??

    // Axes
    ctx.strokeStyle = axisLine; ctx.lineWidth = isBright ? 3 : 4;
    const origin = gridToScreen(0, 0);
    ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height); ctx.stroke();
    ctx.font = "18px 'Cambria Math','Times New Roman',serif";
    ctx.fillStyle = gridColor; ctx.fillText('O', origin.x - 15, origin.y + 15);

    // Death Zone
    const currentTerrainData = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain];
    const dzValue = currentTerrainData.deathZoneY !== undefined ? currentTerrainData.deathZoneY : -8;
    const dTop = gridToScreen(0, dzValue);
    if (Y_MIN < dzValue) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, dTop.y, canvas.width, canvas.height - dTop.y);
        ctx.strokeStyle = 'rgba(239,68,68,0.8)'; ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(0, dTop.y); ctx.lineTo(canvas.width, dTop.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(239,68,68,0.8)';
        
        ctx.textAlign = "left";
        const dTxt1 = "DEATH ZONE ( ";
        const dTxt2 = `y = ??{Math.abs(dzValue)}`; // U+2212 Minus Sign
        const dTxt3 = " )";
        
        ctx.font = "bold 16px 'Outfit', sans-serif";
        const dw1 = ctx.measureText(dTxt1).width;
        ctx.font = "bold 17px 'KaTeX_Math', 'Cambria Math','Times New Roman',serif";
        const dw2 = ctx.measureText(dTxt2).width;
        ctx.font = "bold 16px 'Outfit', sans-serif";
        const dw3 = ctx.measureText(dTxt3).width;
        
        const dStartX = canvas.width/2 - (dw1 + dw2 + dw3)/2;
        ctx.fillText(dTxt1, dStartX, dTop.y + 15);
        ctx.font = "bold 17px 'KaTeX_Math', 'Cambria Math','Times New Roman',serif";
        ctx.fillText(dTxt2, dStartX + dw1, dTop.y + 15);
        ctx.font = "bold 16px 'Outfit', sans-serif";
        ctx.fillText(dTxt3, dStartX + dw1 + dw2, dTop.y + 15);
        ctx.textAlign = "center";
    }

    // OUT Line
    const outSc = gridToScreen(0, 40);
    ctx.strokeStyle = 'rgba(239,68,68,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([15, 10]);
    ctx.beginPath(); ctx.moveTo(0, outSc.y); ctx.lineTo(canvas.width, outSc.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239,68,68,0.8)';
    
    ctx.textAlign = "left";
    const oTxt1 = "DANGER / OUT LINE ( ";
    const oTxt2 = "y = 40";
    const oTxt3 = " )";
    
    ctx.font = "bold 16px 'Outfit', sans-serif";
    const ow1 = ctx.measureText(oTxt1).width;
    ctx.font = "bold 17px 'KaTeX_Math', 'Cambria Math','Times New Roman',serif";
    const ow2 = ctx.measureText(oTxt2).width;
    ctx.font = "bold 16px 'Outfit', sans-serif";
    const ow3 = ctx.measureText(oTxt3).width;
    
    const oStartX = canvas.width/2 - (ow1 + ow2 + ow3)/2;
    ctx.fillText(oTxt1, oStartX, outSc.y - 15);
    ctx.font = "bold 17px 'KaTeX_Math', 'Cambria Math','Times New Roman',serif";
    ctx.fillText(oTxt2, oStartX + ow1, outSc.y - 15);
    ctx.font = "bold 16px 'Outfit', sans-serif";
    ctx.fillText(oTxt3, oStartX + ow1 + ow2, outSc.y - 15);
    ctx.textAlign = "center";

    // ---- ?¬ì¼“ë³??Œë”ë§?----
    const tNow = Date.now() / 1000;
    balloons.forEach(b => {
        if (!b.active) return;
        const floatOff = Math.sin(tNow * 1.1 + b.phase) * scaleLength(0.22)
                       + Math.sin(tNow * 0.6 + b.phase) * scaleLength(0.08);
        const sc     = gridToScreen(b.x, b.y);
        const sz     = scaleLength(1.3); // ?¬ì¼“ë³??¬ê¸° (?”ë©´ ?½ì?)
        const cx     = sc.x;
        const cy     = sc.y + floatOff;

        ctx.save();
        // ê¸€ë¡œìš° (ì¢…ë¥˜???°ë¼ ?‰ìƒ)
        // ?¬ì¼“ë³?ê¸€ë¡œìš°: ë°œì‚¬ ì¤‘ì—??ë°œê´‘ ?„ê¸° (?±ëŠ¥ ìµœì ??
        ctx.shadowColor = b.type === 'gold' ? '#fbbf24' : '#ef4444';
        ctx.shadowBlur  = isFiring ? 0 : 8;
        // ?¬ì¼“ë³??´ë?ì§€ ê·¸ë¦¬ê¸?
        if (pokeballImg && pokeballImg.complete && pokeballImg.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            if (b.type === 'gold') {
                // ê³¨ë“œ ?ì„ ??ê²½ìš° ë¹¨ê°„??ëª¬ìŠ¤?°ë³¼???©ê¸ˆ?‰ìœ¼ë¡?ë³€??(filter ë¬¸ì??ìºì‹±)
                ctx.filter = 'hue-rotate(50deg) saturate(200%) brightness(130%)';
            }
            ctx.drawImage(pokeballImg, cx - sz / 2, cy - sz / 2, sz, sz);
            if (b.type === 'gold') ctx.filter = 'none'; // ê³¨ë“œ???Œë§Œ ì´ˆê¸°??
        } else {
            // ?´ë?ì§€ ë¡œë“œ ???€ì²???
            ctx.fillStyle = b.type === 'gold' ? '#fbbf24' : '#ef4444';
            ctx.beginPath(); ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ?„ì´???€???¼ë²¨ (?¬ì¼“ë³??˜ë‹¨)
        ctx.fillStyle    = b.type === 'gold' ? '#fde68a' : '#fca5a5';
        ctx.font         = `bold ${Math.round(scaleLength(0.45))}px Outfit`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor  = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur   = 6;
        ctx.fillText(b.type === 'gold' ? '?ª™ GOLD' : '??POWER', cx, cy + sz / 2 + 4);
        ctx.shadowBlur = 0;
        ctx.restore();
    });

    // Entities
    if (player.hp > 0) drawEntity(player);
    enemies.forEach(e => { drawEntity(e); }); // ?¬ë§??? ë ¹ ?í¬ì¼“ëª¬??ê³„ì† ?Œë”ë§ë˜ê²?ë³€ê²?

    // Player radius (ë°œì‚¬ ê°€??ë°˜ê²½ ?œì‹œ - ë§¥ë°• ?°ë“¯ ?€?€?˜ê²Œ)
    const pCenter = gridToScreen(player.x, player.y - 0.525), pRad = scaleLength(0.7);
    if (player.name === '?Œì´ë¦?) pCenter.y -= scaleLength(0.2);
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.08; // ?€?€???·ë°°ê²?ì±„ìš°ê¸?
    ctx.fillStyle = getMissileColor();
    ctx.beginPath(); ctx.arc(pCenter.x, pCenter.y, pRad, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Missile
    if (missile.active || missile.trail.length > 0) {
        const mColor = typeof getMissileColor === 'function' ? getMissileColor() : '#fff';
        ctx.lineWidth = 4; ctx.strokeStyle = mColor; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        missile.trail.forEach((p, i) => {
            const sc = gridToScreen(p.x, p.y);
            i === 0 ? ctx.moveTo(sc.x, sc.y) : ctx.lineTo(sc.x, sc.y);
        });
        ctx.stroke();
        
        if (missile.active) {
            const head = gridToScreen(missile.x, missile.y);
            window.drawMissileHead(ctx, missile, head, gridToScreen);
        }
    }

    // Effects
    effects.forEach(e => {
        if (e.type === 'text') {
            const sc = gridToScreen(e.x, e.y);
            ctx.globalAlpha = Math.max(0, e.life / 150);
            ctx.fillStyle = e.color; ctx.font = '900 28px Outfit'; ctx.textAlign = 'center';
            ctx.fillText(e.text, sc.x, sc.y);
            ctx.globalAlpha = 1;
        } else if (e.type === 'stalactite') {
            const sc = gridToScreen(e.x, e.y);
            const w = scaleLength(0.7); // ì¢…ìœ ???ˆë¹„
            const h = scaleLength(2.0); // ì¢…ìœ ???’ì´
            
            ctx.save();
            ctx.translate(sc.x, sc.y);
            
            // ë¾°ì¡±???”ì‚´ì´?ëª¨ì–‘ ?€???”íƒ?˜ê³  ?¥ê??¥ê???ë°”ìœ„ ëª¨ì–‘?¼ë¡œ ë³€ê²?
            ctx.beginPath();
            ctx.moveTo(0, h/2.5);
            ctx.lineTo(-w/1.2, h/4);
            ctx.lineTo(-w/1.2, -h/4);
            ctx.lineTo(-w/2.5, -h/2.5);
            ctx.lineTo(w/2.5, -h/2.5);
            ctx.lineTo(w/1.2, -h/4);
            ctx.lineTo(w/1.2, h/4);
            ctx.closePath();
            
            // ë°”ìœ„??ê·¸ë¼?°ì´??
            const grad = ctx.createLinearGradient(0, -h/2, 0, h/2);
            grad.addColorStop(0, '#3f3f46');
            grad.addColorStop(1, '#a1a1aa');
            ctx.fillStyle = grad;
            
            // ê·¸ë¦¼???¨ê³¼ë¡??…ì²´ê°?
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 4;
            ctx.fill();
            
            // ?¼ìª½ ë°ì? ?˜ì´?¼ì´?¸ë¡œ ?”í…Œ??ì¶”ê?
            ctx.beginPath();
            ctx.moveTo(0, h/2 * 0.9);
            ctx.lineTo(-w/2.2, -h/2);
            ctx.lineTo(-w/6, -h/2);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.shadowColor = 'transparent';
            ctx.fill();
            
            ctx.restore();
        } else if (e.type === 'lava_rock') {
            const sc = gridToScreen(e.x, e.y);
            const rot = (e.maxLife - e.life) * 0.25;
            const r = scaleLength(0.65); // ?¥ê·¼ ?ë³´??ì¡°ê¸ˆ ?????¬ê¸°

            ctx.save();
            ctx.translate(sc.x, sc.y);
            ctx.rotate(rot);

            // ?¸ê³½ ë¶‰ì? ë°œê´‘ ?¨ê³¼
            ctx.shadowBlur = 18;
            ctx.shadowColor = '#ea580c';

            // ë¶ˆê·œì¹™í•œ ì¹ ê°??(?”ì‚°???•íƒœ)
            ctx.fillStyle = '#270808'; // ê²€ë¶‰ì? ?”ì„ ??
            ctx.beginPath();
            const sides = 7;
            for (let s = 0; s < sides; s++) {
                const angle = (s / sides) * Math.PI * 2;
                const rad = r * (0.65 + 0.35 * Math.sin(s * 1.8 + (e.startX||0)));
                if (s === 0) ctx.moveTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
                else ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
            }
            ctx.closePath();
            ctx.fill();
            
            ctx.shadowBlur = 0; // ?ˆìª½?€ ê¸€ë¡œìš° ?†ì´

            // ë°”ìœ„ ?ˆìƒˆ ?©ì•” ?ìŠ¤ì²???
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-r * 0.3, -r * 0.4);
            ctx.lineTo(r * 0.1, -r * 0.1);
            ctx.lineTo(r * 0.4, r * 0.3);
            ctx.stroke();

            ctx.restore();
        } else if (e.type === 'particle') {
            const sc = gridToScreen(e.x, e.y);
            ctx.globalAlpha = Math.max(0, e.life / 40);
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(sc.x, sc.y, 4, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        } else if (e.type === 'ring') {
            // ?ì„  ?°ì????•ì‚° ë§??´í™??
            const sc   = gridToScreen(e.x, e.y);
            const prog = 1 - e.life / e.maxLife;          // 0??
            const rad  = scaleLength(0.3 + 2.5 * prog);   // ì»¤ì???ë°˜ê²½
            ctx.globalAlpha = Math.max(0, e.life / e.maxLife) * 0.85;
            ctx.strokeStyle  = e.color;
            ctx.lineWidth    = 5 * (e.life / e.maxLife);
            ctx.beginPath(); ctx.arc(sc.x, sc.y, rad, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha  = 1;
        } else if (e.type === 'laser') {
            const scBottom = gridToScreen(e.x, e.y);
            const scTop = gridToScreen(e.x, 40); // y=40 (?˜ëŠ˜ ?’ì´)
            ctx.globalAlpha = Math.max(0, e.life / 15);
            ctx.lineWidth = 15 + Math.random() * 10;
            ctx.strokeStyle = '#10b981'; // ?ë©”?„ë“œ ê·¸ë¦° ?ˆì´?€
            ctx.shadowBlur = 0; ctx.shadowColor = '#34d399';
            ctx.beginPath(); ctx.moveTo(scTop.x, scTop.y); ctx.lineTo(scBottom.x, scBottom.y); ctx.stroke();
            
            // ë°”ë‹¥ ì¶©ëŒ ê´‘ì›
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(scBottom.x, scBottom.y, 25 + Math.random()*10, 0, Math.PI*2); ctx.fill();
            
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        } else if (e.type === 'lightning') {
            // ??ì§€ê·¸ì¬ê·?ë²ˆê°œ ì¤„ê¸° ?Œë”ë§?
            const alpha = Math.max(0, e.life / e.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#fef08a'; // ?°ëœ»???©ê¸ˆë¹?ë²ˆê°œ
            ctx.lineWidth = 4;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#fbbf24';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            e.segments.forEach((pt, idx) => {
                const sc = gridToScreen(pt.x, pt.y);
                if (idx === 0) ctx.moveTo(sc.x, sc.y);
                else ctx.lineTo(sc.x, sc.y);
            });
            ctx.stroke();

            // ?´ë? ë°ì? ì½”ì–´ ì¤‘ì‹¬??
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            e.segments.forEach((pt, idx) => {
                const sc = gridToScreen(pt.x, pt.y);
                if (idx === 0) ctx.moveTo(sc.x, sc.y);
                else ctx.lineTo(sc.x, sc.y);
            });
            ctx.stroke();
            ctx.restore();
        } else if (e.type === 'softFlash') {
            // ?ˆë???ë°©ì?: 12% ?´í•˜???€?€?˜ê³  ì°¨ë¶„???¤í¬ë¦??Œë˜??
            const alpha = (e.life / e.maxLife) * 0.12;
            ctx.save();
            ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        } else if (e.type === 'netPull') {
            // ---- ê·¸ë¬¼ ?¹ê¸°ê¸??´í™?? ?˜ì¶•?˜ëŠ” ??+ ë°©ì‚¬????----
            const sc = gridToScreen(e.x, e.y);
            const netRadius3 = 3;
            const prog = 1 - e.life / e.maxLife; // 0??
            const rad = scaleLength(netRadius3 * (1 - prog)); // ì¤„ì–´?œëŠ” ë°˜ê²½
            ctx.globalAlpha = Math.max(0, e.life / e.maxLife) * 0.85;
            ctx.strokeStyle = '#2dd4bf';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 0; ctx.shadowColor = '#2dd4bf';
            ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.arc(sc.x, sc.y, rad, 0, Math.PI * 2); ctx.stroke();
            // ë°©ì‚¬????(8ê°?
            ctx.lineWidth = 1.5;
            for (let ri = 0; ri < 8; ri++) {
                const ang = (ri / 8) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(sc.x + Math.cos(ang) * rad, sc.y + Math.sin(ang) * rad);
                ctx.lineTo(sc.x + Math.cos(ang) * rad * 0.3, sc.y + Math.sin(ang) * rad * 0.3);
                ctx.stroke();
            }
            ctx.setLineDash([]);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
    });

    // Pointer tooltip
    if (pointerTooltip.active) pointerTooltip.alpha = Math.min(1, pointerTooltip.alpha + 0.1);
    else pointerTooltip.alpha = Math.max(0, pointerTooltip.alpha - 0.05);
    if (pointerTooltip.alpha > 0) {
        ctx.save(); ctx.globalAlpha = pointerTooltip.alpha;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const formatNum = (n) => n.toFixed(1).replace('-', '??);
        const text = `(${formatNum(pointerTooltip.gridX)}, ${formatNum(pointerTooltip.gridY)})`;
        ctx.font = "18px 'Cambria Math','Times New Roman',serif";
        const tw = ctx.measureText(text).width;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pointerTooltip.x + 15, pointerTooltip.y - 30, tw + 20, 30, 8);
        else ctx.rect(pointerTooltip.x + 15, pointerTooltip.y - 30, tw + 20, 30);
        ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, pointerTooltip.x + 25, pointerTooltip.y - 15);
        ctx.restore();
    }

    ctx.restore();
}

let lastGameLoopTime = 0;
function gameLoop(timestamp) {
    if (!lastGameLoopTime) lastGameLoopTime = timestamp;
    const dt = timestamp - lastGameLoopTime;
    
    // 60FPS Capping (16.6ms) - ê³ ì£¼?¬ìœ¨ ëª¨ë‹ˆ?°ì—??ë¯¸ì‚¬?¼ì´ ?ˆë¬´ ë¹¨ë¼???Šê²¨ë³´ì´???„ìƒ ë°©ì?
    if (dt < 16) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // ?„ë ˆ???„ì  ë³´ì • (ì°?ìµœì†Œ???±ìœ¼ë¡?dtê°€ ?ˆë¬´ ì»¤ì§„ ê²½ìš° ë°©ì?)
    if (dt > 100) {
        lastGameLoopTime = timestamp - 16;
    } else {
        // ?„ë²½??60fps ì£¼ê¸°ë¥?ë§ì¶”ê¸??„í•´ 16ms???”í•¨ (?¨ì¼ ?„ë ˆ???œë ë³´ì •)
        lastGameLoopTime += 16; 
    }

    try { updateGame(); render(); } catch (err) { console.error('Game loop error:', err); }
    requestAnimationFrame(gameLoop);
}
