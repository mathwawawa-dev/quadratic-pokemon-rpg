// ============================================================
// engine.js  —  Core game loop, physics, rendering
// ============================================================

// ---------- Canvas & Context ----------
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ---------- Coordinate System ----------
let X_MIN = -10, X_MAX = 20, Y_MIN = -15, Y_MAX = 25;
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
    isKnockedBack: false, facing: 1,
    name: '', movePoints: 2, maxMovePoints: 2
};
let enemies = [];

// ---------- Projectile ----------
let missile = { active: false, x: 0, y: 0, trail: [], maxY: 0, func: null, dx: 0.1, distanceTraveled: 0, startX: 0, isCheat: false };

// ---------- Effects & Globals ----------
let effects = [];
let screenShake = 0;
let terrainHeights = {};
let explosionRadius = 0.5; // let으로 변경 — 파워업 풍선으로 일시 증가 가능
let playerGold = 0;
let baseDamageBoost = 1.0; // 파워업 풍선 획득 시 데미지 배율 증가
let balloons = [];          // 공중 풍선 목록
let cloudParams = [
    { bx: 5,  by: 18, speed: 3000, radius: 2.2, alpha: 0.6 },
    { bx: -4, by: 12, speed: 5000, radius: 1.6, alpha: 0.4 }
];

// 구름 구멍 데이터 (미사일 관통 시 생성)
let cloudHoles = []; // { x, y, radius, maxRadius, life, maxLife }

// ---------- 포켓볼 이미지 프리로드 ----------
const pokeballImg = new Image();
pokeballImg.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';

// ---------- Sprite Cache ----------
const spriteCache = {};
function loadSprite(idOrName) {
    if (spriteCache[idOrName]) return spriteCache[idOrName];
    const img = new Image();
    const primarySrc  = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${idOrName}`;
    const fallbackSrc = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${idOrName}`;
    img.src = primarySrc;
    img.onerror = () => { if (img.src !== fallbackSrc) img.src = fallbackSrc; };
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
    if (!window.innerWidth) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const aspect = canvas.width / canvas.height;
    const yRange = Y_MAX - Y_MIN;
    const xCenter = (X_MIN + X_MAX) / 2;
    const xRange = yRange * aspect;
    X_MIN = xCenter - xRange / 2;
    X_MAX = xCenter + xRange / 2;
    CELL_SIZE = canvas.height / yRange;
}
window.addEventListener('resize', resize);

function resetView() {
    if (!window.innerWidth) return;
    const aspect = window.innerWidth / window.innerHeight;
    let minX = player.x, maxX = player.x;
    let minY = player.y, maxY = player.y;
    enemies.forEach(e => {
        if (e.x < minX) minX = e.x; if (e.x > maxX) maxX = e.x;
        if (e.y < minY) minY = e.y; if (e.y > maxY) maxY = e.y;
    });

    // y축(x=0)을 중앙에 두기 위해 원점 기준 가장 먼 포켓몬과의 거리로 범위 설정
    let maxAbsX = Math.max(Math.abs(minX), Math.abs(maxX));
    let reqXSpan = 2 * (maxAbsX + 4); 
    let reqYSpan = reqXSpan / aspect;
    const neededYSpan = (maxY - minY + 4) / 0.5;
    if (reqYSpan < neededYSpan) { reqYSpan = neededYSpan; reqXSpan = reqYSpan * aspect; }
    if (reqYSpan < 25) { reqYSpan = 25; reqXSpan = reqYSpan * aspect; }

    // 한 단계 안으로 확대된 배율 적용 (스팬을 0.8배로 축소하여 더 크게 보이게 설정)
    reqXSpan *= 0.8;
    reqYSpan *= 0.8;

    Y_MIN = minY - reqYSpan * 0.35;
    Y_MAX = Y_MIN + reqYSpan;
    X_MIN = -reqXSpan / 2;
    X_MAX = reqXSpan / 2;
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
}
canvas.addEventListener('mousedown', (e) => { updatePointerTooltip(e.clientX, e.clientY); startDrag(e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => { if (isDragging) { updatePointerTooltip(e.clientX, e.clientY); doDrag(e.clientX, e.clientY); } });
window.addEventListener('mouseup', () => { pointerTooltip.active = false; isDragging = false; });
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { updatePointerTooltip(e.touches[0].clientX, e.touches[0].clientY); startDrag(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
window.addEventListener('touchmove', (e) => { if (e.touches.length === 1) { if (isDragging) doDrag(e.touches[0].clientX, e.touches[0].clientY); updatePointerTooltip(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: true });
window.addEventListener('touchend', () => { pointerTooltip.active = false; isDragging = false; });

// ---------- Terrain ----------
let terrainSpikes = []; // 스테이지마다 랜덤으로 생성되는 뾰족한 언덕 목록

function getTerrainY(x) {
    const stage = LEVELS[currentStage % LEVELS.length];
    let y = TERRAINS[stage.terrain].func(x);
    if (x < -20) { const dx = -20 - x; y += dx * dx * 5; return y; }
    if (x >  20) { const dx =  x - 20; y += dx * dx * 5; return y; }
    const key = (Math.round(x * 10) / 10).toFixed(1);
    return terrainHeights[key] !== undefined ? terrainHeights[key] : y;
}
function createCrater(cx, cy, radius) {
    for (let x = cx - radius; x <= cx + radius; x += 0.1) {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        if (terrainHeights[key] === undefined) continue;
        const dx = x - cx;
        const craterY = cy - Math.sqrt(radius * radius - dx * dx);
        if (craterY < terrainHeights[key]) terrainHeights[key] = craterY;
    }
}

// ---------- UI Helpers ----------
function showMessage(title, desc, isError = true) {
    document.getElementById('msg-title').innerText = title;
    document.getElementById('msg-title').style.color = isError ? 'var(--danger)' : 'var(--success)';
    document.getElementById('message-overlay').style.borderColor = isError ? 'var(--danger)' : 'var(--success)';
    document.getElementById('msg-desc').innerHTML = desc;
    const btn = document.getElementById('msg-btn');
    btn.innerHTML = (GAME_STATE === 'OVER' && enemies.filter(e => e.hp <= 0).length >= 2) ? '다음 단계로 <span style="font-size:0.85rem;font-weight:normal;color:#ffffff;">[Enter]</span>' : '다시 시도 <span style="font-size:0.85rem;font-weight:normal;color:#ffffff;">[Enter]</span>';
    document.getElementById('message-overlay').classList.add('show');
    document.getElementById('fire-btn').disabled = true;
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
    if (ap) ap.innerText = `행동력: ${player.movePoints.toFixed(1)}/${player.maxMovePoints.toFixed(1)}`;
}
function resetTurn() {
    GAME_STATE = 'IDLE';
    player.movePoints = player.maxMovePoints;
    updateHPUI();
    document.getElementById('fire-btn').disabled = false;
}

// ---------- Init Stage ----------
function initStage() {
    // 오버레이를 맨 먼저 띄워서 다음 스테이지가 슬쩍 보이는 현상 방지
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
    GAME_STATE = 'LOADING';

    terrainSeed = Math.random() * 100;
    const stage = LEVELS[currentStage % LEVELS.length];
    const mathField = document.getElementById('math-input');
    if (mathField) mathField.value = '';

    // 선택된 스타팅 포켓몬으로 플레이어 설정
    const starterData = selectedStarter || STARTERS.pikachu;
    player.img        = loadSprite(starterData.img);
    player.isFlying      = false;
    player.hp            = player.maxHp = 100;
    player.movePoints    = player.maxMovePoints = 2.0;
    player.isKnockedBack = false;
    player.rotation      = 0;
    player.name          = starterData.name;

    // 지형 높이맵 + 랜덤 스파이크 언덕 생성
    const tFunc = TERRAINS[stage.terrain].func;
    terrainHeights = {};

    // 스파이크: 얼음 설산('ice')에서는 50%, 그 외 지형은 30% 확률로 1~3개의 뾰족한 언덕 배치
    terrainSpikes = [];
    const spikeProb = stage.terrain === 'ice' ? 0.5 : 0.3;
    const spikeCount = Math.random() < spikeProb ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let s = 0; s < spikeCount; s++) {
        terrainSpikes.push({
            cx: -12 + Math.random() * 24,          // 스파이크 중심 x
            height: 6 + Math.random() * 10,        // 솟아오르는 높이 (6~16)
            width:  0.8 + Math.random() * 1.2      // 스파이크 너비 (좁을수록 뾰족)
        });
    }

    for (let x = -20; x <= 20; x += 0.1) {
        const key = (Math.round(x * 10) / 10).toFixed(1);
        let y = tFunc(x);
        // 스파이크 적용: 가우시안 형태로 솟아오르는 언덕
        for (const sp of terrainSpikes) {
            const d = x - sp.cx;
            y += sp.height * Math.exp(-(d * d) / (2 * sp.width * sp.width));
        }
        terrainHeights[key] = y;
    }

    // 플레이어의 x 위치 설정 (스파이크 언덕 정상이거나 지나치게 높은 곳은 피하도록 검증 루프 적용)
    let px = 0;
    let attempts = 0;
    do {
        const pxRoll = Math.random();
        if (pxRoll < 0.45)       px =  (2 + Math.random() * 4);  // 45% x>0
        else if (pxRoll < 0.93)  px = -(2 + Math.random() * 4);  // 48% x<0
        else                     px = 0;                          //  7% x=0

        // 해당 위치의 지형 높이가 3 이상 솟아오른 스파이크 영향권인지 체크
        const key = (Math.round(px * 10) / 10).toFixed(1);
        const yVal = terrainHeights[key] !== undefined ? terrainHeights[key] : tFunc(px);
        const isSpikePeak = terrainSpikes.some(sp => Math.abs(px - sp.cx) < sp.width * 1.5 && sp.height >= 5);

        if (yVal < 1.5 && !isSpikePeak) {
            break; // 낮고 평탄한 곳에만 배치 (높은 언덕 파묻힘 방지)
        }
        attempts++;
    } while (attempts < 50);

    player.x = px;
    player.facing        = player.x >= 0 ? -1 : 1;
    player.y = getTerrainY(player.x) + 0.75;
    if (window.updateDirectionUI) window.updateDirectionUI();

    // 적 배치 (랜덤) — x 간격 + y 간격 모두 보장
    let stageEnemies = [];
    let fCount = stage.flyingCount || 0;
    let nCount = (stage.count || 3) - fCount;

    let fPool = [...FLYING_POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < fCount; i++) stageEnemies.push(fPool[i % fPool.length]);

    let nPool = [...ENEMY_POOL].sort(() => Math.random() - 0.5);
    for (let i = 0; i < nCount; i++) stageEnemies.push(nPool[i % nPool.length]);

    const MIN_X_GAP = 4;
    const MIN_Y_GAP = 2.0; // 지상 포켓몬끼리 y좌표 최소 간격
    const placedX = [];
    const placedY = [];
    // 비행 포켓몬 배치 높이도 분산 (모두 y=8이 되지 않도록)
    const isSkyMap = (stage.terrain === 'sky');
    let flyingYPool = isSkyMap 
        ? [12, 14, 16, 18, 20].sort(() => Math.random() - 0.5)
        : [5, 7, 9, 11, 13].sort(() => Math.random() - 0.5);
    let flyingYIdx = 0;

    // 적들이 플레이어 양쪽에 고르게 분산되도록 사이드 배정
    // 총 적 수의 절반은 왼쪽, 절반은 오른쪽 (홀수이면 한쪽이 1개 더)
    const totalCount = stageEnemies.length;
    const leftCount  = Math.floor(totalCount / 2);
    const rightCount = totalCount - leftCount;
    // 'L' 또는 'R' 사이드를 섞어 각 적에게 배정
    const sideAssignments = [...Array(leftCount).fill('L'), ...Array(rightCount).fill('R')]
        .sort(() => Math.random() - 0.5);

    const barrierTypes = ['reflect', 'absorb', 'absolute', 'warp'].sort(() => Math.random() - 0.5);
    enemies = stageEnemies.map((e, idx) => {
        const side = sideAssignments[idx]; // 'L': 플레이어보다 왼쪽, 'R': 오른쪽
        let rx, ry, valid, attempts = 0;

        const isSkyMap = (stage.terrain === 'sky');
        if (e.isFlying || isSkyMap) {
            do {
                // 배정된 사이드에서만 x 샘플링
                rx = side === 'L'
                    ? player.x - MIN_X_GAP - Math.random() * 12   // 왼쪽 영역
                    : player.x + MIN_X_GAP + Math.random() * 12;  // 오른쪽 영역
                rx = Math.max(-8, Math.min(18, rx));
                valid = Math.abs(rx - player.x) >= MIN_X_GAP &&
                        placedX.every(px => Math.abs(rx - px) >= MIN_X_GAP);
                attempts++;
            } while (!valid && attempts < 300);
            if (!valid) rx = side === 'L' ? player.x - 6 : player.x + 6;
            ry = flyingYPool[flyingYIdx % flyingYPool.length];
            flyingYIdx++;
        } else {
            const isGroundType = e.type === 'ground';
            const yOffset = isGroundType ? -0.5 : 0.75; // 땅포켓몬은 언덕선보다 아래에 생성
            do {
                rx = side === 'L'
                    ? player.x - MIN_X_GAP - Math.random() * 12
                    : player.x + MIN_X_GAP + Math.random() * 12;
                rx = Math.max(-8, Math.min(18, rx));
                ry = getTerrainY(rx) + yOffset;
                valid = Math.abs(rx - player.x) >= MIN_X_GAP &&
                        placedX.every(px => Math.abs(rx - px) >= MIN_X_GAP) &&
                        placedY.filter(py => !py.isFlying).every(py => Math.abs(ry - py.y) >= MIN_Y_GAP);
                attempts++;
            } while (!valid && attempts < 400);
            if (!valid) {
                rx = side === 'L' ? player.x - 6 : player.x + 6;
                ry = getTerrainY(rx) + yOffset;
            }
        }
        placedX.push(rx);
        placedY.push({ y: ry, isFlying: e.isFlying || isSkyMap });

        const isPsychic = (stage.terrain === 'psychic');
        const barrierType = isPsychic ? barrierTypes[idx % barrierTypes.length] : null;

        return {
            x: rx, y: ry,
            w: 1.5, h: 1.5, hp: 100 + currentStage * 25, maxHp: 100 + currentStage * 25,
            img: loadSprite(e.img),
            isFlying: e.isFlying || isSkyMap,
            hasCloud: isSkyMap,
            shake: 0, vx: 0, vy: 0,
            rotation: 0, angularVelocity: 0, isKnockedBack: false,
            name: e.name, type: e.type,
            barrierType: barrierType,
            barrierStartTime: Date.now() + idx * 2500
        };
    });

    // 구름 파라미터 리셋
    cloudParams = [
        { bx: 5,  by: 18, speed: 3000, radius: 2.2, alpha: 0.6 },
        { bx: -4, by: 12, speed: 5000, radius: 1.6, alpha: 0.4 },
        { bx: 0,  by: 20, speed: 4000, radius: 0.8, alpha: 0.8, isPowerCloud: true, colorType: starterData.type }
    ];

    // UI 업데이트
    document.getElementById('stage-title').innerText = `Stage ${currentStage + 1}`;
    document.getElementById('terrain-info').innerText = TERRAINS[stage.terrain].name;
    document.getElementById('ui-player-name').innerText = starterData.name;
    document.getElementById('ui-player-img').src = player.img.src;

    // '구름 위 하늘(sky)' 및 '얼음 설산(ice)' 맵에서는 줌 버튼 글자를 어두운 톤으로 변경
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
    baseDamageBoost = 1.0;  // 스테이지마다 파워 부스트 초기화
    explosionRadius = 0.5;  // 폭발 반경 초기화

    // 포켓볼 생성 (필드당 1개, y≥13 공중, 플레이어와 적 사이의 x좌표 보장)
    balloons = [];
    const balloonTypes = ['gold', 'gold', 'power']; // 금화 2배 확률, 파워 1배 확률
    
    // 적 중 하나를 무작위로 선택하여 그 적과 플레이어 사이의 x좌표에 생성
    let targetX = player.x + 8; // 폴백용 기본 거리
    if (enemies.length > 0) {
        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
        targetX = randomEnemy.x;
    }
    
    // 플레이어와 대상 적 사이의 보간값 (35% ~ 65% 무작위 지점)
    const ratio = 0.35 + Math.random() * 0.3;
    const bx = player.x + (targetX - player.x) * ratio;
    const by = 13 + Math.random() * 5; // y: 13 ~ 18 공중
    const type = balloonTypes[Math.floor(Math.random() * balloonTypes.length)];
    balloons.push({ x: bx, y: by, type, active: true, radius: 0.65, phase: Math.random() * Math.PI * 2 });

    resetView();

    // 모든 스프라이트 이미지가 실제로 로드 완료된 시점에 오버레이를 닫음
    // (고정 타이머 대신) - 단, 최대 1500ms 캡으로 너무 길어지지 않게 제한
    const allImages = [player.img, ...enemies.map(e => e.img)].filter(Boolean);

    const waitForImages = Promise.all(allImages.map(img =>
        new Promise(resolve => {
            if (img.complete && img.naturalWidth > 0) {
                resolve(); // 이미 로드 완료 (캐시)
            } else {
                img.addEventListener('load',  resolve, { once: true });
                img.addEventListener('error', resolve, { once: true }); // 오류도 기다림 종료
            }
        })
    ));

    const maxWait = new Promise(resolve => setTimeout(resolve, 1500)); // 최대 1500ms 캡

    Promise.race([waitForImages, maxWait]).then(() => {
        if (overlay) {
            overlay.classList.add('hiding');         // 0.4s fade-out 시작
            setTimeout(() => {
                overlay.classList.remove('hiding');
                overlay.classList.add('hidden');     // 완전히 숨김
                GAME_STATE = 'IDLE';
                if (window.startGuideMessageRotation) window.startGuideMessageRotation();
            }, 400);
        } else {
            GAME_STATE = 'IDLE';
            if (window.startGuideMessageRotation) window.startGuideMessageRotation();
        }
    });
}

// ---------- Player Movement ----------
window.movePlayer = function (dir) {
    if (GAME_STATE !== 'IDLE' || player.isKnockedBack) return;
    if (player.movePoints < 0.5) { showMessage('이동 불가', '행동력을 모두 소모했습니다.', false); return; }
    player.x = Math.max(-20, Math.min(20, player.x + dir * 0.5));
    player.y = getTerrainY(player.x) + 0.75;
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
    if (!leftBtn || !rightBtn) return;
    if (player.facing === -1) {
        leftBtn.classList.add('active');
        rightBtn.classList.remove('active');
    } else {
        leftBtn.classList.remove('active');
        rightBtn.classList.add('active');
    }
};

// ---------- Cheat Keys & UI Shortcuts ----------
window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+A: 스테이지 스킵 (탭 검색 방지, 수식입력창 숫자로 특정 스테이지 이동)
    if (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        e.stopPropagation();
        
        // 수식입력창에 숫자가 있으면 해당 스테이지로 이동
        const mathInput = document.getElementById('math-input');
        const inputVal = mathInput ? mathInput.value.trim() : '';
        const stageNum = parseInt(inputVal, 10);
        
        if (!isNaN(stageNum) && stageNum >= 1) {
            currentStage = stageNum - 1; // 0-indexed
            initStage();
            if (mathInput) mathInput.value = '';
            return;
        }
        
        // 숫자가 없으면 다음 스테이지로
        currentStage++;
        initStage();
        if (mathInput) mathInput.value = '';
        return;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        if (GAME_STATE !== 'IDLE' || enemies.length < 2) return;
        const p1 = { x: player.x, y: player.y };
        const p2 = { x: enemies[0].x, y: enemies[0].y };
        const p3 = { x: enemies[1].x, y: enemies[1].y };
        const denom = (p1.x - p2.x) * (p1.x - p3.x) * (p2.x - p3.x);
        if (Math.abs(denom) < 0.001) return;
        const a = (p3.x * (p2.y - p1.y) + p2.x * (p1.y - p3.y) + p1.x * (p3.y - p2.y)) / denom;
        const b = (p3.x**2 * (p1.y - p2.y) + p2.x**2 * (p3.y - p1.y) + p1.x**2 * (p2.y - p3.y)) / denom;
        const c = (p2.x * p3.x * (p2.x - p3.x) * p1.y + p3.x * p1.x * (p3.x - p1.x) * p2.y + p1.x * p2.x * (p1.x - p2.x) * p3.y) / denom;
        let eq = `${a.toFixed(3)}x^2 + ${b.toFixed(3)}x + ${c.toFixed(3)}`.replace(/\+ -/g, '- ');
        document.getElementById('math-input').value = eq;
        fireMissile(true);
        return;
    }
    if (e.target.tagName.toLowerCase() === 'math-field') return;
    if (e.key === 'a' || e.key === 'A') window.movePlayer(-1);
    if (e.key === 'd' || e.key === 'D') window.movePlayer(1);
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
    if (!func) { showMessage('오류', '수식이 올바르지 않습니다.'); return; }

    const py = player.y - 0.525; // 원 중심 Y
    const VISUAL_R = 0.7;        // 원 반경

    // 1. Launch Point 영역 (좌우 ±0.3) 통과 여부 검증
    let passesLaunch = false;
    for (let x = player.x - 0.3; x <= player.x + 0.3; x += 0.002) {
        const y = func(x);
        if (!isNaN(y)) { passesLaunch = true; break; }
    }

    if (!passesLaunch) {
        showMessage('발사 불가', '그래프가 Launch Point를 지나야 합니다.');
        return;
    }

    // 2. 미사일 시작점 설정을 위해 0.7 반경 원의 테두리 교점 검색
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
    // 바라보는 방향으로 위로 날아가는지 판별
    const isFlyingUp = func(player.x + dir * 0.05) > func(player.x);

    // 발사 방향에 따라 상단 혹은 하단 영역의 교점만 필터링
    const correctHalfXs = boundaryXs.filter(bx => {
        const y = func(bx);
        return isFlyingUp ? (y >= py) : (y <= py);
    });

    // 방향에 맞는 교점이 없으면 전체 교점 중 선택 (안정 장치)
    const finalXs = correctHalfXs.length > 0 ? correctHalfXs : boundaryXs;
    if (finalXs.length === 0) {
        showMessage('발사 불가', '그래프가 Launch Point를 지나야 합니다.');
        return;
    }

    // 교점 중 위로 쏘면 Y 최대, 아래로 쏘면 Y 최소 선택
    let startX = finalXs[0];
    let bestY = func(startX);
    for (let i = 1; i < finalXs.length; i++) {
        const y = func(finalXs[i]);
        if (isFlyingUp ? y > bestY : y < bestY) { bestY = y; startX = finalXs[i]; }
    }

    // startX, func(startX) 점을 원 테두리 위로 정확히 투영 → 미사일 시작점이 원 테두리와 딱 일치
    const rawStartX = startX;
    const rawStartY = func(startX);
    const sdx = rawStartX - player.x, sdy = rawStartY - py;
    const sLen = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    const projStartX = player.x + (sdx / sLen) * VISUAL_R;
    const projStartY = py + (sdy / sLen) * VISUAL_R;

    if (window.currentMissileType !== 'normal') {
        if (window.missileInventory[window.currentMissileType] <= 0) {
            showMessage('수량 부족', '해당 미사일을 모두 소진했습니다.');
            document.getElementById('fire-btn').disabled = false;
            return;
        }
        window.missileInventory[window.currentMissileType]--;
        if (window.updateInventoryUI) window.updateInventoryUI();
    }

    GAME_STATE = 'FIRING';
    player.animFrame = 30; // 30 프레임(0.5초) 동안 발사 모션
    Object.assign(missile, { 
        active: true, func, x: projStartX, y: projStartY, 
        trail: [{ x: projStartX, y: projStartY }], 
        maxY: projStartY, startX: projStartX, startY: projStartY, distanceTraveled: 0, 
        hasLeftPlayer: false, isCheat, dx: dir * 0.15,
        type: window.currentMissileType,
        hitTargets: new Set(),
        powerBoosted: false,
        isReflected: false
    });
    
    document.getElementById('fire-btn').disabled = true;
};

// ---------- Barrier System ----------
function getBarrierColors(type, alphaMult = 1.0) {
    switch (type) {
        case 'reflect':
            return {
                fill: `rgba(0, 191, 255, ${0.15 * alphaMult})`,
                stroke: `rgba(0, 191, 255, ${0.8 * alphaMult})`,
                name: '반사'
            };
        case 'absorb':
            return {
                fill: `rgba(50, 205, 50, ${0.15 * alphaMult})`,
                stroke: `rgba(50, 205, 50, ${0.8 * alphaMult})`,
                name: '피해흡수'
            };
        case 'absolute':
            return {
                fill: `rgba(255, 215, 0, ${0.15 * alphaMult})`,
                stroke: `rgba(255, 215, 0, ${0.8 * alphaMult})`,
                name: '절대방어'
            };
        case 'warp':
            return {
                fill: `rgba(186, 85, 211, ${0.15 * alphaMult})`,
                stroke: `rgba(186, 85, 211, ${0.8 * alphaMult})`,
                name: '워프'
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

// 8각형 경로
function pathOctagon(ctx, r, progress) {
    pathPolygon(ctx, 8, r, progress);
}

// 나선(소용돌이) 경로
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

function checkBarrierCollision(mx, my, t) {
    if (!t.barrierType) return false;
    if (!t.barrierStartTime) {
        t.barrierStartTime = Date.now();
        if (t.barrierType === 'warp') t.barrierStartTime += 2000;
    }
    const elapsed = (Date.now() - t.barrierStartTime) / 1000;
    if (elapsed < 0) return false;
    
    const cycleTime = elapsed % 9.5;
    
    // 1.0초 ~ 5.5초(유지 b초 + 깜빡임 1.5초) 구간에만 배리어가 물리적으로 타격 차단(활성)됨
    const isActive = (cycleTime >= 1.0 && cycleTime < 5.5);
    if (!isActive) return false;

    const offsetY = t.isFlying ? t.h * 0.15 : -t.h * 0.35;
    const ty = t.y + offsetY;
    const dist = Math.hypot(mx - t.x, my - ty);
    return dist <= 1.68; // 배리어 반경 (시각 반경과 동기화)
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
        while (!validX && attempts < 100) {
            rx = -18 + Math.random() * 36;
            if (Math.abs(rx - player.x) >= 4) {
                validX = true;
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
    // drawEntity에서 화면에 그려지는 Y 오프셋(시각적 보정값)을 논리적 피격 박스(Hitbox)에도 똑같이 반영합니다.
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
    if (target.hasCloud) {
        target.hasCloud = false;
        target.isFlying = false;
        createCloudPop(target.x, target.y - 0.75);
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
    const boostMult = missile.powerBoosted ? 1.5 : 1.0;
    const totalDamage = Math.floor((30 + fallHeight * 1.7) * mult * baseDamageBoost * boostMult);

    target.hp -= totalDamage;
    target.shake = 20; screenShake = 15;
    const kbDir = target.x > player.x ? 1 : -1;
    Object.assign(target, { isKnockedBack: true, vx: kbDir * (Math.random()*0.03+0.05), vy: 0.1+Math.random()*0.08, angularVelocity: kbDir*(Math.random()*0.03+0.02) });
    createCrater(target.x, target.y - 0.75, explosionRadius + 0.5);
    createExplosion(target.x, target.y, getMissileColor());
    effects.push({ type: 'text', x: target.x, y: target.y+1, text: `-${totalDamage}`, color: '#ff4444', life: 180 });
    if (enemies.includes(target))
        effects.push({ type: 'text', x: target.x, y: target.y+2, text: `${hitQuality}! +${hitGold}G`, color: '#fbbf24', life: 180 });
    else
        effects.push({ type: 'text', x: target.x, y: target.y+2, text: 'OUCH!', color: '#ef4444', life: 180 });
    if (fallHeight * 1.7 > 20)
        effects.push({ type: 'text', x: target.x, y: target.y+3, text: 'FALL DMG!', color: '#fbbf24', life: 240 });
    updateHPUI();

    const deadEnemies = enemies.filter(e => e.hp <= 0).length;
    if (target.hp <= 0) {
        createExplosion(target.x, target.y, '#ffffff');
        if (player.hp <= 0) { GAME_STATE = 'OVER'; showMessage('GAME OVER', '자폭했습니다...'); }
        else if (deadEnemies >= 2) { GAME_STATE = 'OVER'; showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false); }
        else { GAME_STATE = 'IDLE'; document.getElementById('fire-btn').disabled = false; }
    } else {
        GAME_STATE = 'IDLE';
        document.getElementById('fire-btn').disabled = false;
    }
}

// ---------- Update Loop ----------
function updateGame() {
    if (screenShake > 0) screenShake--;
    enemies.forEach(e => { if (e.shake > 0) e.shake--; });
    if (player.shake > 0) player.shake--;

    // 플레이어 발사 모션 (점프 + 한바퀴 회전)
    if (player.animFrame > 0) {
        player.animFrame--;
        const p = (30 - player.animFrame) / 30; // 0.0 ~ 1.0
        player.yOffAnim = Math.sin(p * Math.PI) * scaleLength(1.0); // 위로 튕기기
        player.rotation = p * Math.PI * 2 * player.facing; // 회전
        if (player.animFrame === 0) {
            player.rotation = 0;
            player.yOffAnim = 0;
        }
    }

    // 구멍 서서히 복구 (반경 축소)
    for (let i = cloudHoles.length - 1; i >= 0; i--) {
        const h = cloudHoles[i];
        h.life--;
        // 남은 수명 비율에 따라 반경을 0으로 줄임 (복구 효과)
        h.radius = h.maxRadius * (h.life / h.maxLife);
        if (h.life <= 0) cloudHoles.splice(i, 1);
    }

    for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        e.life--;
        if (e.type === 'text')     { e.y += 0.03; }
        if (e.type === 'particle') { e.x += e.vx; e.y += e.vy; e.vy -= 0.02; }
        if (e.type === 'ring')     { /* 위치 고정, life만 감소 */ }
        if (e.life <= 0) effects.splice(i, 1);
    }

    [player, ...enemies].forEach(ent => {
        if (ent.hp <= 0) return;
        if (ent.isKnockedBack) {
            // 다음 x 위치의 지형 높이를 미리 확인 — 급경사(언덕/스파이크 벽)에 올라타는 순간 점프 방지
            const nextX   = ent.x + ent.vx;
            const nextGY  = getTerrainY(nextX) + 0.75;
            const currGY  = getTerrainY(ent.x)  + 0.75;
            // 다음 위치의 지형이 현재 y보다 0.3 이상 높으면 "벽"으로 간주 → vx 반사, x는 유지
            if (nextGY > ent.y + 0.3) {
                ent.vx *= -0.55;
            } else {
                ent.x = nextX;
            }
            ent.y += ent.vy;
            ent.rotation += ent.angularVelocity;
            ent.vy -= 0.02;
            if (ent.x - ent.w/2 < -20) { ent.x = -20 + ent.w/2; ent.vx *= -0.8; }
            if (ent.x + ent.w/2 >  20) { ent.x =  20 - ent.w/2; ent.vx *= -0.8; }
            const groundY = getTerrainY(ent.x) + 0.75;
            if (ent.y < groundY) {
                ent.y = groundY; ent.vy *= -0.5; ent.vx *= 0.6; ent.angularVelocity *= 0.6;
                if (Math.abs(ent.vy) < 0.05 && Math.abs(ent.vx) < 0.05) {
                    ent.isKnockedBack = false; ent.vy = ent.vx = ent.rotation = 0;
                }
            }
        } else if (!ent.isFlying) {
            const isGroundType = ent.type === 'ground';
            const groundY = getTerrainY(ent.x) + (isGroundType ? -0.5 : 0.75);
            if (ent.y > groundY + 0.1) { ent.vy -= 0.02; ent.y += ent.vy; }
            else { ent.y = Math.max(groundY, ent.y); ent.vy = 0; }
        }
        if (ent.y < -8 && ent.hp > 0) {
            ent.hp = 0;
            createExplosion(ent.x, -8, '#ffffff');
            effects.push({ type: 'text', x: ent.x, y: -6, text: 'FALL!', color: '#ef4444', life: 60 });
            updateHPUI();
            if (ent === player) { GAME_STATE = 'OVER'; setTimeout(() => showMessage('GAME OVER', '플레이어가 추락했습니다!'), 1500); }
            else if (enemies.filter(e => e.hp <= 0).length >= 2) { GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500); }
        }
    });

    if (GAME_STATE === 'FIRING' && missile.active) {
        for (let i = 0; i < 3; i++) {
            const distFromLaunch = Math.hypot(missile.x - missile.startX, missile.y - missile.startY);
            if (!missile.hasLeftPlayer && (!checkCollision(missile.x, missile.y, player) || distFromLaunch > 0.4)) {
                missile.hasLeftPlayer = true;
            }
            
            if (missile.type === 'homing') {
                if (missile.isHoming) {
                    if (missile.homingTarget && missile.homingTarget.hp > 0) {
                        const targetX = missile.homingTarget.x;
                        const targetY = missile.homingTarget.y;
                        const angle = Math.atan2(targetY - missile.y, targetX - missile.x);
                        const speed = Math.abs(missile.dx / 3) * 1.5; // 약간 빠른 유도 속도
                        missile.x += Math.cos(angle) * speed;
                        missile.y += Math.sin(angle) * speed;
                    } else {
                        // 타겟이 이미 죽었으면 관성으로 낙하
                        missile.y -= 0.15;
                        missile.x += missile.dx / 3;
                    }
                } else {
                    const prevY = missile.y;
                    missile.x += missile.dx / 3;
                    missile.y = missile.func(missile.x);
                    
                    // 최고점 도달 후 하강 시작 시점 (꼭짓점)
                    if (missile.y < prevY) {
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
                            // 꼭짓점에서 꺾이는 순간 파티클 방출
                            for(let pi=0; pi<10; pi++) {
                                effects.push({ type: 'particle', x: missile.x, y: missile.y, vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6, life: 35, color: '#a855f7' });
                            }
                        }
                    }
                }
            } else {
                missile.x += missile.dx / 3;
                missile.y = missile.func(missile.x);
            }
            
            missile.distanceTraveled = Math.abs(missile.x - missile.startX);
            if (missile.y > missile.maxY) missile.maxY = missile.y;

            // 파워 구름 통과 여부 체크 + 구멍 생성
            cloudParams.forEach(cp => {
                const cx = cp.bx + Math.sin(Date.now() / cp.speed) * 1.5;
                const cy = cp.by + Math.cos(Date.now() / (cp.speed * 1.3)) * 0.5;
                const dx = missile.x - cx;
                const dy = missile.y - cy;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const cloudLogicRadius = cp.radius * 1.5;

                // 파워업 구름 통과 시 파워부스트
                if (cp.isPowerCloud && !missile.powerBoosted && dist < cloudLogicRadius) {
                    missile.powerBoosted = true;
                    for (let pi=0; pi<5; pi++) {
                        effects.push({ type: 'particle', x: missile.x, y: missile.y, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, life: 40, color: '#fbbf24' });
                    }
                }

                // 구멍 생성: 구름 반경 내에 있을 때 매 서브프레임마다 추가
                if (dist < cloudLogicRadius) {
                    const holeR = cp.radius * 0.4;
                    cloudHoles.push({
                        x: missile.x + (Math.random()-0.5) * 0.2,
                        y: missile.y + (Math.random()-0.5) * 0.2,
                        radius: holeR,
                        maxRadius: holeR,
                        life: 480,
                        maxLife: 480
                    });
                }
            });
            missile.trail.push({ x: missile.x, y: missile.y });

            // ---- 풍선 충돌 체크 (미사일은 관통하여 계속 진행) ----
            for (const b of balloons) {
                if (!b.active) continue;
                const bdx = missile.x - b.x, bdy = missile.y - b.y;
                if (Math.sqrt(bdx * bdx + bdy * bdy) <= b.radius) {
                    b.active = false;
                    // 팡! 파티클 + 링 이펙트
                    const bColor = b.type === 'gold' ? '#fbbf24' : '#ef4444';
                    for (let pi = 0; pi < 20; pi++)
                        effects.push({ type: 'particle', x: b.x, y: b.y,
                            vx: (Math.random()-0.5)*0.7, vy: (Math.random()-0.5)*0.7 + 0.1,
                            life: 40, color: bColor });
                    effects.push({ type: 'ring', x: b.x, y: b.y, life: 28, maxLife: 28, color: bColor });
                    // 보상 지급
                    if (b.type === 'gold') {
                        const gold = 40 + Math.floor(Math.random() * 41); // 40~80G
                        playerGold += gold;
                        document.getElementById('ui-player-gold').innerText = playerGold;
                        effects.push({ type: 'text', x: b.x, y: b.y + 1, text: `🪙 +${gold}G`, color: '#fbbf24', life: 150 });
                    } else {
                        baseDamageBoost = Math.min(2.5, baseDamageBoost * 1.35);
                        effects.push({ type: 'text', x: b.x, y: b.y + 1, text: '⚡ POWER UP!', color: '#f87171', life: 150 });
                    }
                }
            }

            if (missile.y > 30) {
                missile.active = false; GAME_STATE = 'OVER';
                createExplosion(missile.x, 30, '#ffffff');
                setTimeout(() => showMessage('OUT!', '그래프가 천장 (<math-field read-only style="font-size:1.1rem; min-height:0; padding:2px 2px; border:none; background:rgba(0,0,0,0.5); display:inline-block; vertical-align:-1px;">y=30</math-field>)을 벗어났습니다.'), 500);
                return;
            }
            // 반사된 미사일이 플레이어와 충돌하는지 체크
            if (missile.isReflected && checkCollision(missile.x, missile.y, player)) {
                missile.active = false;
                applyDamageAndEffects(player, missile.x, missile.y);
                return;
            }

            // 배리어 충돌 체크
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

            if (missile.type === 'pierce') {
                const targets = missile.hasLeftPlayer ? [player, ...enemies] : enemies;
                for (const e of targets) {
                    if (e.hp > 0 && checkCollision(missile.x, missile.y, e)) {
                        if (!missile.hitTargets.has(e)) {
                            missile.hitTargets.add(e);
                            applyDamageAndEffects(e, missile.x, missile.y);
                        }
                    }
                }
            } else {
                let directHit = null;
                let targetsToCheck = [...enemies];
                if (missile.isReflected) targetsToCheck.push(player);
                for (const e of targetsToCheck) { if (e.hp > 0 && checkCollision(missile.x, missile.y, e)) { directHit = e; break; } }
                if (directHit) {
                    missile.active = false;
                    const targetX = directHit.x;
                    const targetY = directHit.y;
                    
                    if (missile.type === 'satellite') {
                        GAME_STATE = 'IDLE';
                        document.getElementById('fire-btn').disabled = true;
                        for (let i = 0; i < 4; i++) {
                            setTimeout(() => {
                                if (GAME_STATE === 'OVER') return;
                                effects.push({ type: 'laser', x: targetX, y: targetY, life: 15 });
                                screenShake = 15;
                                createCrater(targetX, targetY - 0.75, explosionRadius);
                                const targets = [player, ...enemies];
                                targets.forEach(ent => {
                                    if (ent.hp > 0 && Math.abs(ent.x - targetX) <= explosionRadius + 0.5) {
                                        applyDamageAndEffects(ent, targetX, targetY);
                                    }
                                });
                                if (i === 3) {
                                    if (enemies.filter(e => e.hp <= 0).length >= 2) {
                                        GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500);
                                    } else {
                                        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                                    }
                                }
                            }, i * 250);
                        }
                    } else if (missile.type === 'net') {
                        // ---- 그물 미사일: 반경 3 이내 적을 폭탄 위치로 끌어당김 ----
                        missile.active = false; GAME_STATE = 'IDLE';
                        document.getElementById('fire-btn').disabled = true;
                        const netRadius = 3;
                        // 그물 이펙트 (링 + 파티클)
                        effects.push({ type: 'netPull', x: targetX, y: targetY, life: 40, maxLife: 40 });
                        screenShake = 8;
                        // 범위 내 적 끌어당기기
                        let pulled = [];
                        enemies.forEach(ent => {
                            if (ent.hp <= 0) return;
                            const dist = Math.hypot(ent.x - targetX, ent.y - targetY);
                            if (dist <= netRadius) pulled.push(ent);
                        });
                        // 0.3초 후 위치 이동 + 데미지
                        setTimeout(() => {
                            pulled.forEach(ent => {
                                if (ent.hp <= 0) return;
                                ent.x = targetX;
                                ent.y = Math.max(getTerrainY(targetX) + 0.75, targetY);
                                ent.isKnockedBack = false; ent.vx = 0; ent.vy = 0;
                                applyDamageAndEffects(ent, targetX, targetY);
                            });
                            if (player.hp > 0 && Math.hypot(player.x - targetX, player.y - targetY) <= netRadius) {
                                applyDamageAndEffects(player, targetX, targetY);
                            }
                            createExplosion(targetX, targetY, '#2dd4bf');
                            createCrater(targetX, targetY - 0.5, explosionRadius);
                            if (enemies.filter(e => e.hp <= 0).length >= 2) {
                                GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500);
                            } else {
                                setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                            }
                        }, 400);
                    } else {
                        createExplosion(targetX, targetY, getMissileColor());
                        createCrater(targetX, targetY - 0.75, explosionRadius + 0.5);

                        const targets = [player, ...enemies];
                        targets.forEach(ent => {
                            if (ent.hp <= 0) return;
                            const edx = ent.x - targetX, edy = ent.y - targetY;
                            if (ent === directHit || Math.sqrt(edx*edx + edy*edy) <= explosionRadius + 0.5) {
                                applyDamageAndEffects(ent, targetX, targetY);
                            }
                        });
                    }
                    return;
                }
            }

            if (missile.y < getTerrainY(missile.x) && !missile.isCheat) {
                if (missile.type === 'pierce') {
                    // 관통 미사일은 지형을 무시하고 지나감
                } else if (missile.type === 'satellite') {
                    missile.active = false; GAME_STATE = 'IDLE';
                    document.getElementById('fire-btn').disabled = true;
                    const targetX = missile.x;
                    const targetY = getTerrainY(missile.x);
                    for (let i = 0; i < 4; i++) {
                        setTimeout(() => {
                            if (GAME_STATE === 'OVER') return;
                            effects.push({ type: 'laser', x: targetX, y: targetY, life: 15 });
                            screenShake = 15;
                            createCrater(targetX, targetY, explosionRadius);
                            const targets = [player, ...enemies];
                            targets.forEach(ent => {
                                if (ent.hp > 0 && Math.abs(ent.x - targetX) <= explosionRadius + 0.5) {
                                    applyDamageAndEffects(ent, targetX, targetY);
                                }
                            });
                            if (i === 3) {
                                if (enemies.filter(e => e.hp <= 0).length >= 2) {
                                    GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500);
                                } else {
                                    setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                                }
                            }
                        }, i * 250);
                    }
                    return;
                } else if (missile.type === 'net') {
                    // ---- 그물 미사일: 지형 충돌 시에도 동일한 끌어당기기 ----
                    missile.active = false; GAME_STATE = 'IDLE';
                    document.getElementById('fire-btn').disabled = true;
                    const netRadius = 3;
                    const targetX = missile.x, targetY = getTerrainY(missile.x);
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
                            ent.y = Math.max(getTerrainY(targetX) + 0.75, targetY);
                            ent.isKnockedBack = false; ent.vx = 0; ent.vy = 0;
                            applyDamageAndEffects(ent, targetX, targetY);
                        });
                        if (player.hp > 0 && Math.hypot(player.x - targetX, player.y - targetY) <= netRadius) {
                            applyDamageAndEffects(player, targetX, targetY);
                        }
                        createExplosion(targetX, targetY, '#2dd4bf');
                        createCrater(targetX, targetY - 0.5, explosionRadius);
                        if (enemies.filter(e => e.hp <= 0).length >= 2) {
                            GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500);
                        } else {
                            setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 500);
                        }
                    }, 400);
                    return;
                } else {
                    missile.active = false; GAME_STATE = 'IDLE';
                    const targetX = missile.x;
                    const targetY = getTerrainY(missile.x);
                    createExplosion(targetX, targetY, getMissileColor());
                    createCrater(targetX, targetY, explosionRadius);
                    let hitSomeone = false;
                    const targets = [player, ...enemies];
                    targets.forEach(ent => {
                        if (ent.hp <= 0) return;
                        const edx = ent.x - targetX, edy = ent.y - targetY;
                        if (Math.sqrt(edx*edx + edy*edy) <= explosionRadius + 0.5) {
                            applyDamageAndEffects(ent, targetX, targetY); hitSomeone = true;
                        }
                    });
                    if (!hitSomeone) {
                        effects.push({ type: 'text', x: missile.x, y: missile.y+1, text: 'MISS', color: '#fff', life: 40 });
                        screenShake = 10;
                    }
                    if (enemies.filter(e => e.hp <= 0).length >= 2) {
                        GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500);
                    } else {
                        setTimeout(() => { document.getElementById('fire-btn').disabled = false; }, 1000);
                    }
                    return;
                }
            }

            // 화면을 벗어나면 (관통 미사일 포함) 비활성화
            if (missile.x < -30 || missile.x > 30 || missile.y < -20) {
                missile.active = false; GAME_STATE = 'IDLE';
                if (enemies.filter(e => e.hp <= 0).length >= 2) {
                    GAME_STATE = 'OVER'; setTimeout(() => showMessage('STAGE CLEAR', '적을 처치했습니다! (+200G)', false), 1500);
                } else {
                    document.getElementById('fire-btn').disabled = false;
                }
                
                // 만약 마지막 특수 미사일이었다면 자동으로 'normal'로 전환
                if (window.currentMissileType !== 'normal' && window.missileInventory[window.currentMissileType] <= 0) {
                    window.currentMissileType = 'normal';
                    const btns = document.querySelectorAll('.missile-btn');
                    btns.forEach(btn => btn.classList.remove('active'));
                    if(btns[0]) btns[0].classList.add('active'); // 보통 미사일 활성화
                }
                return;
            }
        }
    }
}

// ---------- Rendering ----------
function drawEntity(ent) {
    const sc = gridToScreen(ent.x, ent.y);
    const drawW = scaleLength(ent.w * 1.5), drawH = scaleLength(ent.h * 1.5);
    const sw = scaleLength(ent.w), sh = scaleLength(ent.h);
    ctx.save();
    if (ent.shake > 0) { sc.x += (Math.random()-0.5)*10; sc.y += (Math.random()-0.5)*10; }
    // 비행하지 않는 포켓몬은 바닥에 딱 붙게 (0.35), 비행하는 포켓몬은 공중에 띄우기 (-0.1)
    const isSkyTerrain = (LEVELS[currentStage % LEVELS.length].terrain === 'sky');
    let bobY = 0;
    if (ent.hasCloud && ent.hp > 0) {
        const ph = ent.x * 1.7; // 고유 위상
        bobY = Math.sin(Date.now() / 400 + ph) * scaleLength(0.12);
    }

    const yOff = ent.isFlying ? -sh * 0.1 : sh * 0.35;
    const animY = ent.yOffAnim ? -ent.yOffAnim : 0; // 발사 모션 (위로 뜀)
    ctx.translate(sc.x, sc.y + yOff + animY + bobY);
    // 적들은 플레이어를 바라보게 (자동), 플레이어는 수동 방향
    if (ent !== player) {
        if (ent.x < player.x) ctx.scale(-1, 1);
    }
    if (ent.rotation) ctx.rotate(ent.rotation);
    
    // 체력이 0 이하인 사망 개체: 개성 있는 유령 효과
    if (ent.hp <= 0) {
        // 최초 사망 시 엔티티별 랜덤 위상(phase)과 사망 시각 기록 → 유령끼리 동기화 방지
        if (ent._ghostPhase === undefined) {
            ent._ghostPhase  = Math.random() * Math.PI * 2;
            ent._deathTime   = Date.now();
        }
        const t     = Date.now() / 1000;
        const ph    = ent._ghostPhase;
        const lived = (Date.now() - ent._deathTime) / 1000; // 사망 후 경과 시간(초)

        // 이중 주파수 알파 맥박 (0.10 ~ 0.58 범위, 불규칙한 호흡 느낌)
        const pulse = 0.34
            + Math.sin(t * 2.1 + ph)          * 0.16
            + Math.sin(t * 0.7 + ph * 1.3)    * 0.08;
        ctx.globalAlpha = Math.max(0.10, Math.min(0.58, pulse));

        // 서서히 변하는 채도/색조 (유령빛 청록→보라 사이를 천천히 순환)
        const hue = 140 + Math.sin(t * 0.4 + ph) * 35;
        ctx.filter = `brightness(85%) saturate(220%) hue-rotate(${hue.toFixed(0)}deg) blur(0.7px)`;

        // 위아래 둥실 (이중 주파수) + 좌우 미세 흔들림 + 사망 후 서서히 위로 떠오름
        const floatY = Math.sin(t * 2.0 + ph) * scaleLength(0.22)
                     + Math.sin(t * 0.85 + ph) * scaleLength(0.10);
        const floatX = Math.sin(t * 1.4 + ph * 0.8) * scaleLength(0.06);
        const driftUp = Math.min(lived * scaleLength(0.12), scaleLength(2.5)); // 최대 2.5 unit 위로
        ctx.translate(floatX, floatY - driftUp);

        // 회전 흔들림 (이중 주파수)
        ctx.rotate(Math.sin(t * 1.8 + ph) * 0.10 + Math.sin(t * 0.6 + ph) * 0.04);

        // 숨쉬는 듯한 크기 맥박
        const breathe = 1.0 + Math.sin(t * 1.2 + ph) * 0.07;
        ctx.scale(breathe, breathe);
    } else if (ent.shake > 0) {
        ctx.filter = 'brightness(200%) sepia(100%) hue-rotate(-50deg) saturate(500%)';
    }
    // HP bar for enemies
    if (enemies.includes(ent) && ent.hp > 0) {
        const hpPct = Math.max(0, ent.hp / ent.maxHp);
        const hpColor = hpPct > 0.5 ? '#22c55e' : hpPct > 0.2 ? '#eab308' : '#ef4444';
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-20, -drawH/2 - 5, 40, 6);
        ctx.fillStyle = hpColor;           ctx.fillRect(-20, -drawH/2 - 5, 40 * hpPct, 6);
    }
    // Facing flip for player
    // 스프라이트 기본 방향이 좌측이므로 우측(1)일 때 좌우 반전
    if (ent === player && player.facing === 1) ctx.scale(-1, 1);
    // Draw image (이미지가 아직 로드되지 않은 상태라면 임시 빨간 박스 대신 그리기를 대기하고, 로드 완료 후에만 그립니다)
    const domImg = ent === player ? document.getElementById('ui-player-img') : null;
    // '구름 위 하늘' 맵에서 몬스터 아래에 둥실둥실 구름 받침 그리기
    if (ent.hasCloud && ent.hp > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 10;
        
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
        ctx.drawImage(srcImg, -drawW/2, -drawH/2, drawW, drawH);
    } else {
        // 이미지가 로드 실패(에러) 상태이거나 아예 이미지가 없는 경우에만 대체 도형을 그립니다.
        // 로딩 중일 때는 깜빡이는 박스를 그리지 않아 잔상을 방지합니다.
        if (!srcImg || srcImg.naturalWidth === 0) {
            ctx.fillStyle = ent === player ? '#3b82f6' : '#ef4444';
            ctx.fillRect(-sw/2, -sh/2, sw, sh);
        }
    }

    // 배리어 그리기 및 텍스트 표시 (시간 기반)
    if (ent.hp > 0 && ent.barrierType) {
        if (!ent.barrierStartTime) {
            ent.barrierStartTime = Date.now();
            if (ent.barrierType === 'warp') ent.barrierStartTime += 2000;
        }
        const elapsed = (Date.now() - ent.barrierStartTime) / 1000;
        
        if (elapsed < 0) {
            ctx.restore();
            return;
        }
        
        const cycleTime = elapsed % 9.5;
        
        let drawType = 'none'; // 'none' | 'generating' | 'active' | 'flashing'
        let progress = 1.0;
        let isFlashVisible = true;
        
        if (cycleTime < 1.0) {
            drawType = 'generating';
            progress = cycleTime / 1.0;
        } else if (cycleTime < 4.0) {
            drawType = 'active';
        } else if (cycleTime < 5.5) {
            drawType = 'flashing';
            const flashTime = cycleTime - 4.0; // 0.0 ~ 1.5
            isFlashVisible = (flashTime % 0.5) < 0.25; // 0.5초 주기 중 앞의 0.25초만 보임 (총 3번 깜빡)
        } else {
            drawType = 'none';
        }

        const info = getBarrierColors(ent.barrierType);
        
        // 쉴드 원 및 외곽 가장자리 그리기
        if (drawType !== 'none' && (drawType !== 'flashing' || isFlashVisible)) {
            ctx.save();
            ctx.strokeStyle = info.stroke;
            ctx.fillStyle = info.fill;
            const r = scaleLength(1.68); // 1.4 * 1.2배

            if (ent.barrierType === 'reflect') {
                // 반사 배리어: 날카로운 육각형 + 꼭짓점 가시 돌출형
                ctx.lineWidth = 2.5;
                pathHexagon(ctx, r, progress);
                ctx.fill();
                ctx.stroke();
                
                // 생성 중이 아닐 때만 가시 렌더링
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
                // 흡수 배리어: 맥동하는 이중 오각형
                const pulse = drawType === 'generating' ? 1.0 : 1.0 + Math.sin(Date.now() / 200) * 0.08;
                ctx.lineWidth = 2.5;
                
                // 외곽 오각형
                pathPolygon(ctx, 5, r * pulse, progress);
                ctx.fill();
                ctx.stroke();
                
                // 내부 오각형 (엇박자 맥동)
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
                // 절대방어 배리어: 튼튼한 팔각형 성벽 + 격자형 차단층
                ctx.lineWidth = 3.5;
                pathOctagon(ctx, r, progress);
                ctx.fill();
                ctx.stroke();
                
                // 내부 격자 쉴드 무늬
                if (drawType !== 'generating') {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    
                    // 팔각형 내부 클리핑
                    pathOctagon(ctx, r, 1.0);
                    ctx.clip();
                    
                    // 격선 그리기
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
                // 워프 배리어: 맥동하는 이중 원 (피해흡수 배리어의 밝은 보라색 버전)
                const pulse = drawType === 'generating' ? 1.0 : 1.0 + Math.sin(Date.now() / 200) * 0.08;
                ctx.lineWidth = 2.5;
                
                // 외곽 원
                ctx.beginPath();
                ctx.arc(0, 0, r * pulse, 0, Math.PI * 2 * progress);
                ctx.fill();
                ctx.stroke();
                
                // 내부 원 (엇박자 맥동)
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
        
        // 배리어 이름 텍스트 (활성/생성/깜빡임 시에만 표시, 깜빡임 시 함께 깜빡임, 생성 시 fade-in, 반전 보정)
        if (drawType !== 'none' && (drawType !== 'flashing' || isFlashVisible)) {
            ctx.save();
            if (ent !== player && ent.x < player.x) {
                ctx.scale(-1, 1);
            }
            
            // 생성 중일 때는 progress에 따라 서서히 나타남 (fade in)
            const textAlpha = drawType === 'generating' ? progress : 1.0;
            ctx.globalAlpha = textAlpha;
            
            ctx.font = 'bold 12px Arial'; // 크기 1단계 확대
            const tw = ctx.measureText(info.name).width;
            const textY = scaleLength(1.68) + 14; // 글꼴 크기에 맞춘 Y 오프셋 조정
            
            // 검은색 텍스트 상자 배경 (둥근 사각형)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(-tw/2 - 6, textY - 9, tw + 12, 16, 4);
                ctx.fill();
            } else {
                ctx.fillRect(-tw/2 - 6, textY - 9, tw + 12, 16);
            }
            
            // 텍스트 출력
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = info.stroke;
            ctx.fillText(info.name, 0, textY - 1);
            ctx.restore();
        }
    }

    ctx.restore();
}

function render() {
    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10);

    // Background
    const tData = TERRAINS[LEVELS[currentStage % LEVELS.length].terrain];
    const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
    tData.bg.forEach((c, i) => grad.addColorStop(i / (tData.bg.length - 1), c));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clouds with hole effect via offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');

    const drawCloudOff = (octx, cx, cy, baseRadius, alpha, isPower, colorType, pulse) => {
        octx.save();
        if (isPower) {
            const colors = { fire: '239, 68, 68', water: '59, 130, 246', grass: '45, 106, 79', electric: '250, 204, 21', poison: '168, 85, 247', ground: '217, 119, 6', normal: '200, 200, 200', psychic: '168, 85, 247' };
            const rgb = colors[colorType] || '200, 200, 200';
            octx.fillStyle = `rgba(${rgb}, ${alpha})`;
            octx.shadowColor = `rgba(${rgb}, 0.8)`;
            octx.shadowBlur = 15 + (pulse || 0) * 5;
        } else {
            octx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        }
        octx.beginPath();
        octx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
        octx.moveTo(cx - baseRadius * 0.8 + baseRadius * 0.7, cy + baseRadius * 0.3);
        octx.arc(cx - baseRadius * 0.8, cy + baseRadius * 0.3, baseRadius * 0.7, 0, Math.PI * 2);
        octx.moveTo(cx + baseRadius * 0.8 + baseRadius * 0.7, cy + baseRadius * 0.3);
        octx.arc(cx + baseRadius * 0.8, cy + baseRadius * 0.3, baseRadius * 0.7, 0, Math.PI * 2);
        octx.moveTo(cx - baseRadius * 1.4 + baseRadius * 0.5, cy + baseRadius * 0.5);
        octx.arc(cx - baseRadius * 1.4, cy + baseRadius * 0.5, baseRadius * 0.5, 0, Math.PI * 2);
        octx.moveTo(cx + baseRadius * 1.4 + baseRadius * 0.5, cy + baseRadius * 0.5);
        octx.arc(cx + baseRadius * 1.4, cy + baseRadius * 0.5, baseRadius * 0.5, 0, Math.PI * 2);
        octx.rect(cx - baseRadius * 1.4, cy + baseRadius * 0.3, baseRadius * 2.8, baseRadius * 0.7);
        octx.fill();
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
        drawCloudOff(offCtx, c.x, c.y, scaleLength(currentRadius), cp.alpha, cp.isPowerCloud, cp.colorType, pulse);
    });

    // destination-out으로 구멍 뚫기
    if (cloudHoles.length > 0) {
        offCtx.save();
        offCtx.globalCompositeOperation = 'destination-out';
        cloudHoles.forEach(h => {
            const sc = gridToScreen(h.x, h.y);
            const sr = scaleLength(h.radius);
            if (sr <= 0) return;
            // 부드러운 페더링을 위한 방사형 그라데이션
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

    // 완성된 오프스크린 이미지를 메인 캔버스에 합성
    ctx.drawImage(offCanvas, 0, 0);

    // Terrain polygon
    ctx.beginPath();
    const startP = gridToScreen(X_MIN, getTerrainY(X_MIN));
    ctx.moveTo(startP.x, startP.y);
    for (let x = X_MIN; x <= X_MAX; x += 0.2) { const p = gridToScreen(x, getTerrainY(x)); ctx.lineTo(p.x, p.y); }
    const br = gridToScreen(X_MAX, Y_MIN - 10), bl = gridToScreen(X_MIN, Y_MIN - 10);
    ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath();
    ctx.fillStyle = tData.color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();

    // Grid & Axes
    const isBright = ['sky', 'ice'].includes(LEVELS[currentStage % LEVELS.length].terrain);
    const gridColor = isBright ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    const thickLine = isBright ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
    const thinLine  = isBright ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)';
    const axisLine  = isBright ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)';
    ctx.font = "16px 'Cambria Math','Times New Roman',serif";
    ctx.fillStyle = gridColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = isBright ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;

    for (let x = Math.ceil(X_MIN); x <= Math.floor(X_MAX); x++) {
        const p0 = gridToScreen(x, Y_MIN), p1 = gridToScreen(x, Y_MAX);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.lineWidth = (x % 5 === 0 && x !== 0) ? 2.5 : 1.5;
        ctx.strokeStyle = (x % 5 === 0 && x !== 0) ? thickLine : thinLine;
        ctx.stroke();
        if (x % 5 === 0 && x !== 0) ctx.fillText(x < 0 ? '−' + Math.abs(x) : x, p0.x, gridToScreen(x, 0).y + 20);
    }
    for (let y = Math.ceil(Y_MIN); y <= Math.floor(Y_MAX); y++) {
        const p0 = gridToScreen(X_MIN, y), p1 = gridToScreen(X_MAX, y);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.lineWidth = (y % 5 === 0 && y !== 0) ? 2.5 : 1.5;
        ctx.strokeStyle = (y % 5 === 0 && y !== 0) ? thickLine : thinLine;
        ctx.stroke();
        if (y % 5 === 0 && y !== 0) ctx.fillText(y < 0 ? '−' + Math.abs(y) : y, gridToScreen(0, y).x - 20, p0.y);
    }
    ctx.shadowBlur = 0;

    // Axes
    ctx.strokeStyle = axisLine; ctx.lineWidth = isBright ? 3 : 4;
    const origin = gridToScreen(0, 0);
    ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height); ctx.stroke();
    ctx.font = "18px 'Cambria Math','Times New Roman',serif";
    ctx.fillStyle = gridColor; ctx.fillText('O', origin.x - 15, origin.y + 15);

    // Death Zone
    const dTop = gridToScreen(0, -8);
    if (Y_MIN < -8) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, dTop.y, canvas.width, canvas.height - dTop.y);
        ctx.strokeStyle = 'rgba(239,68,68,0.8)'; ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(0, dTop.y); ctx.lineTo(canvas.width, dTop.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(239,68,68,0.8)';
        // 기존 소스 유지
        // ctx.font = "italic bold 16px 'Cambria Math','Times New Roman',serif";
        // ctx.fillText('DEATH ZONE (y = -8)', canvas.width/2, dTop.y + 15);
        
        ctx.textAlign = "left";
        const dTxt1 = "DEATH ZONE ( ";
        const dTxt2 = "y = −8"; // U+2212 Minus Sign
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
    const outSc = gridToScreen(0, 30);
    ctx.strokeStyle = 'rgba(239,68,68,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([15, 10]);
    ctx.beginPath(); ctx.moveTo(0, outSc.y); ctx.lineTo(canvas.width, outSc.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239,68,68,0.8)';
    // 기존 소스 유지
    // ctx.font = "italic bold 16px 'Cambria Math','Times New Roman',serif";
    // ctx.fillText('DANGER / OUT LINE (y = 30)', canvas.width/2, outSc.y - 15);
    
    ctx.textAlign = "left";
    const oTxt1 = "DANGER / OUT LINE ( ";
    const oTxt2 = "y = 30";
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

    // ---- 포켓볼 렌더링 ----
    const tNow = Date.now() / 1000;
    balloons.forEach(b => {
        if (!b.active) return;
        const floatOff = Math.sin(tNow * 1.1 + b.phase) * scaleLength(0.22)
                       + Math.sin(tNow * 0.6 + b.phase) * scaleLength(0.08);
        const sc     = gridToScreen(b.x, b.y);
        const sz     = scaleLength(1.3); // 포켓볼 크기 (화면 픽셀)
        const cx     = sc.x;
        const cy     = sc.y + floatOff;

        ctx.save();
        // 글로우 (종류에 따라 색상)
        ctx.shadowColor = b.type === 'gold' ? '#fbbf24' : '#ef4444';
        ctx.shadowBlur  = 18 + Math.sin(tNow * 2.0 + b.phase) * 6;
        // 포켓볼 이미지 그리기
        if (pokeballImg && pokeballImg.complete && pokeballImg.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(pokeballImg, cx - sz / 2, cy - sz / 2, sz, sz);
        } else {
            // 이미지 로드 전 대체 원
            ctx.fillStyle = b.type === 'gold' ? '#fbbf24' : '#ef4444';
            ctx.beginPath(); ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;

        // 아이템 타입 라벨 (포켓볼 하단)
        ctx.fillStyle    = b.type === 'gold' ? '#fde68a' : '#fca5a5';
        ctx.font         = `bold ${Math.round(scaleLength(0.45))}px Outfit`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor  = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur   = 6;
        ctx.fillText(b.type === 'gold' ? '🪙 GOLD' : '⚡ POWER', cx, cy + sz / 2 + 4);
        ctx.shadowBlur = 0;
        ctx.restore();
    });

    // Entities
    if (player.hp > 0) drawEntity(player);
    enemies.forEach(e => { drawEntity(e); }); // 사망한 유령 적포켓몬도 계속 렌더링되게 변경

    // Player radius (발사 가능 반경 표시 - 맥박 뛰듯 은은하게)
    const pCenter = gridToScreen(player.x, player.y - 0.525), pRad = scaleLength(0.7);
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.08; // 은은한 뒷배경 채우기
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
            
            if (missile.type === 'pierce') {
                // 관통 미사일 얇은 머리 (별도 블록 처리로 복구 용이)
                ctx.save();
                ctx.translate(head.x, head.y);
                
                // 진행 방향으로 회전
                if (missile.trail.length >= 2) {
                    const p1 = gridToScreen(missile.trail[missile.trail.length - 2].x, missile.trail[missile.trail.length - 2].y);
                    const p2 = gridToScreen(missile.trail[missile.trail.length - 1].x, missile.trail[missile.trail.length - 1].y);
                    ctx.rotate(Math.atan2(p2.y - p1.y, p2.x - p1.x));
                }
                
                ctx.beginPath(); 
                if (ctx.ellipse) {
                    ctx.ellipse(0, 0, 12, 1.5, 0, 0, Math.PI * 2); // 얇고 긴 바늘/레이저 형태
                } else {
                    ctx.rect(-12, -1.5, 24, 3);
                }
                ctx.fillStyle = '#fff'; 
                ctx.shadowBlur = 10; 
                ctx.shadowColor = mColor; 
                ctx.fill();
                ctx.restore();
            } else if (missile.type === 'homing') {
                // 유도탄 머리 (다이아몬드 형태 - 복구 용이하게 분리)
                ctx.save();
                ctx.translate(head.x, head.y);
                
                if (missile.trail.length >= 2) {
                    const p1 = gridToScreen(missile.trail[missile.trail.length - 2].x, missile.trail[missile.trail.length - 2].y);
                    const p2 = gridToScreen(missile.trail[missile.trail.length - 1].x, missile.trail[missile.trail.length - 1].y);
                    ctx.rotate(Math.atan2(p2.y - p1.y, p2.x - p1.x));
                }
                
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.lineTo(0, 6);
                ctx.lineTo(-10, 0);
                ctx.lineTo(0, -6);
                ctx.closePath();
                
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#a855f7'; // 보라색 후광
                ctx.fill();
                ctx.restore();
            } else if (missile.type === 'satellite') {
                // 위성 미사일 머리 (사각형/십자 형태 - 복구 용이하게 분리)
                ctx.save();
                ctx.translate(head.x, head.y);
                if (missile.trail.length >= 2) {
                    const p1 = gridToScreen(missile.trail[missile.trail.length - 2].x, missile.trail[missile.trail.length - 2].y);
                    const p2 = gridToScreen(missile.trail[missile.trail.length - 1].x, missile.trail[missile.trail.length - 1].y);
                    ctx.rotate(Math.atan2(p2.y - p1.y, p2.x - p1.x));
                }
                ctx.beginPath();
                ctx.rect(-6, -6, 12, 12); // 사각형 큐브 형태
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#10b981'; // 에메랄드 후광
                ctx.fill();
                ctx.restore();
            } else if (missile.type === 'net') {
                // ---- 그물 미사일 머리 (별 / 거미줄 형태 - 복구 용이하게 분리) ----
                ctx.save();
                ctx.translate(head.x, head.y);
                ctx.rotate(Date.now() / 300); // 천천히 회전
                
                // 6각 별 (거미줄 느낌)
                ctx.beginPath();
                for (let si = 0; si < 6; si++) {
                    const angle = (si / 6) * Math.PI * 2;
                    const or = 11, ir = 5;
                    ctx.lineTo(Math.cos(angle) * or, Math.sin(angle) * or);
                    ctx.lineTo(Math.cos(angle + Math.PI / 6) * ir, Math.sin(angle + Math.PI / 6) * ir);
                }
                ctx.closePath();
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 18;
                ctx.shadowColor = '#2dd4bf'; // 옥색 후광
                ctx.fill();
                ctx.restore();
            } else {
                // 일반 미사일 둥근 머리
                ctx.beginPath(); ctx.arc(head.x, head.y, 8, 0, Math.PI*2);
                ctx.fillStyle = '#fff'; ctx.shadowBlur = 15; ctx.shadowColor = mColor; ctx.fill(); ctx.shadowBlur = 0;
            }
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
        } else if (e.type === 'particle') {
            const sc = gridToScreen(e.x, e.y);
            ctx.globalAlpha = Math.max(0, e.life / 40);
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(sc.x, sc.y, 4, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        } else if (e.type === 'ring') {
            // 풍선 터지는 확산 링 이펙트
            const sc   = gridToScreen(e.x, e.y);
            const prog = 1 - e.life / e.maxLife;          // 0→1
            const rad  = scaleLength(0.3 + 2.5 * prog);   // 커지는 반경
            ctx.globalAlpha = Math.max(0, e.life / e.maxLife) * 0.85;
            ctx.strokeStyle  = e.color;
            ctx.lineWidth    = 5 * (e.life / e.maxLife);
            ctx.beginPath(); ctx.arc(sc.x, sc.y, rad, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha  = 1;
        } else if (e.type === 'laser') {
            const scBottom = gridToScreen(e.x, e.y);
            const scTop = gridToScreen(e.x, 40); // y=40 (하늘 높이)
            ctx.globalAlpha = Math.max(0, e.life / 15);
            ctx.lineWidth = 15 + Math.random() * 10;
            ctx.strokeStyle = '#10b981'; // 에메랄드 그린 레이저
            ctx.shadowBlur = 30; ctx.shadowColor = '#34d399';
            ctx.beginPath(); ctx.moveTo(scTop.x, scTop.y); ctx.lineTo(scBottom.x, scBottom.y); ctx.stroke();
            
            // 바닥 충돌 광원
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(scBottom.x, scBottom.y, 25 + Math.random()*10, 0, Math.PI*2); ctx.fill();
            
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        } else if (e.type === 'netPull') {
            // ---- 그물 당기기 이펙트: 수축하는 원 + 방사형 선 ----
            const sc = gridToScreen(e.x, e.y);
            const netRadius3 = 3;
            const prog = 1 - e.life / e.maxLife; // 0→1
            const rad = scaleLength(netRadius3 * (1 - prog)); // 줄어드는 반경
            ctx.globalAlpha = Math.max(0, e.life / e.maxLife) * 0.85;
            ctx.strokeStyle = '#2dd4bf';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10; ctx.shadowColor = '#2dd4bf';
            ctx.setLineDash([8, 8]);
            ctx.beginPath(); ctx.arc(sc.x, sc.y, rad, 0, Math.PI * 2); ctx.stroke();
            // 방사형 선 (8개)
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
        const formatNum = (n) => n.toFixed(1).replace('-', '−');
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

function gameLoop() {
    try { updateGame(); render(); } catch (err) { console.error('Game loop error:', err); }
    requestAnimationFrame(gameLoop);
}
