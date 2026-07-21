// ============================================================
// ui.js  —  UI Events & Intro Screen logic
// ============================================================

// ---------- Global Navigation Prevention ----------
window.addEventListener('keydown', (e) => {
    // F5, Ctrl+R, Ctrl+Shift+R 방지
    if (e.key === 'F5' || (e.ctrlKey && (e.key.toLowerCase() === 'r'))) {
        e.preventDefault();
        e.stopPropagation();
    }
    // 백스페이스 및 Alt+Left 뒤로가기 방지
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'MATH-FIELD';
    if ((e.altKey && e.key === 'ArrowLeft') || (e.key === 'Backspace' && !isInput)) {
        e.preventDefault();
        e.stopPropagation();
    }
}, { capture: true });

// 브라우저 뒤로가기 버튼 방지
history.pushState(null, null, location.href);
window.addEventListener('popstate', () => {
    history.pushState(null, null, location.href);
});

// 창 닫기/새로고침 시도 시 브라우저 기본 경고창 띄우기
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
});

// ---------- Intro Screen ----------
function showIntro() {
    const intro = document.getElementById('intro-screen');
    const game  = document.getElementById('game-screen');
    intro.classList.remove('hidden');
    game.classList.add('hidden');

    // 스타팅 포켓몬 이미지를 jsDelivr CDN에서 미리 로드하여 카드에 표시
    document.querySelectorAll('.starter-card').forEach(card => {
        const id = card.dataset.id;
        const img = card.querySelector('img');
        const primary  = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${id}.png`;
        const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
        img.src = primary;
        img.onerror = () => { if (img.src !== fallback) img.src = fallback; };
    });
}

// 로딩 화면 연출 상태 옵션: 'overlay' | 'fade' | 'none'
let loadingOption = 'overlay';

function setLoadingOption(opt) {
    loadingOption = opt;
    document.querySelectorAll('.btn-option').forEach(btn => btn.classList.remove('active'));
    const map = { overlay: 'opt-load-overlay', fade: 'opt-load-fade', mosaic: 'opt-load-mosaic', none: 'opt-load-none' };
    if (map[opt]) document.getElementById(map[opt]).classList.add('active');
}
window.setLoadingOption = setLoadingOption;

// 시계방향 모자이크 전환 효과
function playMosaicTransition(onPeakCallback) {
    const COLS = 12, ROWS = 8;
    const container = document.getElementById('mosaic-overlay');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
    container.innerHTML = '';

    // 타일 생성
    const tiles = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tile = document.createElement('div');
            tile.className = 'mosaic-tile';
            container.appendChild(tile);
            tiles.push({ el: tile, r, c });
        }
    }

    // 중심에서 각 타일까지 시계방향 각도 계산
    const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
    tiles.forEach(t => {
        let angle = Math.atan2(t.r - cy, t.c - cx); // -π ~ π
        if (angle < -Math.PI / 2) angle += 2 * Math.PI; // 12시(위)를 기준으로 시계방향
        const startAngle = -Math.PI / 2;
        let cw = angle - startAngle;
        if (cw < 0) cw += 2 * Math.PI;
        t.cwAngle = cw;
    });
    tiles.sort((a, b) => a.cwAngle - b.cwAngle);

    const STAGGER = 15; // ms per tile
    const HOLD = 300;   // 완전히 덮힌 후 대기 (ms)

    container.classList.remove('hidden');

    // Phase 1: 시계방향으로 타일을 어둡게 채우기
    tiles.forEach((t, i) => {
        setTimeout(() => t.el.classList.add('show'), i * STAGGER);
    });

    const totalIn = tiles.length * STAGGER + HOLD;

    // Phase 2: 화면이 완전히 가려진 시점에 콜백 (여기서 스테이지 IDLE 전환 등)
    setTimeout(() => {
        if (onPeakCallback) onPeakCallback();
        // Phase 3: 타일을 역순으로 제거 (반시계방향으로 열기)
        [...tiles].reverse().forEach((t, i) => {
            setTimeout(() => t.el.classList.remove('show'), i * STAGGER);
        });
        // Phase 4: 완전히 제거 후 컨테이너 숨김
        setTimeout(() => {
            container.classList.add('hidden');
            container.innerHTML = '';
        }, tiles.length * STAGGER + 200);
    }, totalIn);
}
window.playMosaicTransition = playMosaicTransition;


function startGame(starterKey) {
    selectedStarter = STARTERS[starterKey];

    document.getElementById('intro-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // 게임 초기화
    currentStage = 0;
    playerGold   = 0;
    document.getElementById('ui-player-gold').innerText = '0';

    initStage();
    gameLoop();
}
window.startGame = startGame;

// ---------- Math Input Event Setup ----------
function setupMathInput() {
    const mf = document.getElementById('math-input');
    if (!mf) return;

    // 우클릭 금지 (강제 차단)
    mf.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
    }, { capture: true });
    mf.oncontextmenu = () => false;

    // 마우스 클릭 시 수식입력창 강제 포커스
    mf.addEventListener('pointerdown', () => {
        mf.focus();
    });

    // 백틱(`) 토글: 수식창 <-> 좌표평면(캔버스)
    window.addEventListener('keydown', (e) => {
        if (e.key === '`') {
            e.preventDefault();
            const mfEl = document.getElementById('math-input');
            const canvas = document.getElementById('game-canvas');
            const isInMathField = (document.activeElement === mfEl || (mfEl && mfEl.contains(document.activeElement)));
            if (isInMathField) {
                // 수식창 → 캔버스로 포커스 이동
                mfEl.blur();
                if (canvas) canvas.focus();
            } else {
                // 캔버스(또는 그 외) → 수식창으로 포커스 이동
                mfEl.focus();
            }
        }
    });

    // MathLive 자동변환 방지 (xx 가 곱하기로 변하는 것 방지)
    try { mf.inlineShortcuts = Object.assign({}, mf.inlineShortcuts || {}, { 'xx': 'xx' }); } catch(e) {}

    // 한글 IME 차단 및 'ㅌ' -> 'x', 'ㅛ' -> 'y' 자동 변환
    const blockKorean = (e) => {
        // 'ㅌ', 'ㅛ' 키를 누르면 강제로 한글 IME 조합을 깨고 x, y를 삽입합니다.
        if (e.type === 'keydown' && e.code === 'KeyX' && (e.keyCode === 229 || e.key === 'ㅌ' || e.key === 'Process')) {
            e.preventDefault(); e.stopPropagation();
            const textarea = mf.shadowRoot ? mf.shadowRoot.querySelector('textarea') : null;
            if (textarea) {
                textarea.disabled = true; // IME 조합(Composition) 강제 종료를 위한 확실한 트릭
                textarea.disabled = false;
                textarea.focus();
            }
            setTimeout(() => {
                mf.executeCommand(['insert', 'x']);
            }, 10);
            return;
        }
        if (e.type === 'keydown' && e.code === 'KeyY' && (e.keyCode === 229 || e.key === 'ㅛ' || e.key === 'Process')) {
            e.preventDefault(); e.stopPropagation();
            const textarea = mf.shadowRoot ? mf.shadowRoot.querySelector('textarea') : null;
            if (textarea) {
                textarea.disabled = true;
                textarea.disabled = false;
                textarea.focus();
            }
            setTimeout(() => {
                mf.executeCommand(['insert', 'y']);
            }, 10);
            return;
        }

        if (e.keyCode === 229 || e.key === 'Process' || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key) || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.data)) {
            e.preventDefault(); e.stopPropagation();
        }
    };
    mf.addEventListener('keydown',     blockKorean, { capture: true });
    // 수식입력창 포커스 상태에서도 [, ] 단축키 작동 및 입력 방지
    mf.addEventListener('keydown', (e) => {
        if (e.key === '[' || e.key === ']') {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === '[') setPlayerFacing(-1);
            if (e.key === ']') setPlayerFacing(1);
        }
    }, { capture: true });
    mf.addEventListener('beforeinput', blockKorean, { capture: true });
    mf.addEventListener('compositionstart',  e => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    mf.addEventListener('compositionupdate', e => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    mf.addEventListener('input', () => {
        const val = mf.getValue();
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(val)) mf.setValue(val.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, ''));
    }, true);

    // 미사일 단축키 (Q,W,E,R,T) 및 발사(Enter)
    document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('message-overlay');
        if (overlay && overlay.classList.contains('show')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                closeMessage();
            }
            return;
        }

        const mfEl = document.getElementById('math-input');
        const active = document.activeElement;
        const isInputFocused = (active === mfEl || (mfEl && mfEl.contains(active)));

        // 발사 단축키 (Enter)
        // - 수식창 포커스: 항상 발사 가능
        // - 그 외 위치(캔버스 포커스 등): 발사 가능
        if (e.key === 'Enter') {
            const fireEl = document.getElementById('fire-btn');
            e.preventDefault();
            if (fireEl && !fireEl.disabled && GAME_STATE === 'IDLE') fireMissile();
            return;
        }

        if (isInputFocused) return;

        const keyMap = { 'q': 'normal', 'w': 'pierce', 'e': 'homing', 'r': 'satellite', 't': 'net' };
        const k = e.key.toLowerCase();

        if (keyMap[k]) {
            e.preventDefault();
            e.stopPropagation();
            selectMissile(keyMap[k]);
            return;
        }

        // 조준방향 단축키 ([: 왼쪽, ]: 오른쪽)
        if (e.key === '[') {
            e.preventDefault();
            e.stopPropagation();
            setPlayerFacing(-1);
            return;
        }
        if (e.key === ']') {
            e.preventDefault();
            e.stopPropagation();
            setPlayerFacing(1);
            return;
        }

        // 이동 단축키 (A: 왼쪽, D: 오른쪽)
        if (k === 'a') {
            e.preventDefault();
            e.stopPropagation();
            movePlayer(-1);
            return;
        }
        if (k === 'd') {
            e.preventDefault();
            e.stopPropagation();
            movePlayer(1);
            return;
        }

        // 화면 복구 단축키 (Ctrl)
        if (e.key === 'Control') {
            e.preventDefault();
            e.stopPropagation();
            resetView();
            return;
        }
    }, { capture: true });
}

// ---------- Entry Point ----------
window.addEventListener('load', () => {
    setupMathInput();
    showIntro();
});

window.currentMissileType = 'normal';
window.missileInventory = { pierce: 1, homing: 1, satellite: 1, net: 1 };

// 미사일 타입 → 버튼 ID 매핑
const MISSILE_BTN_ID = { normal: 'btn-msl-normal', pierce: 'btn-msl-pierce', homing: 'btn-msl-homing', satellite: 'btn-msl-satellite', net: 'btn-msl-net' };

window.selectMissile = function(type) {
    if (type !== 'normal' && window.missileInventory[type] <= 0) {
        showMessage('수량 부족', '해당 미사일을 모두 소진했습니다.');
        return;
    }
    window.currentMissileType = type;
    // 모든 버튼 active 해제 후, 해당 타입 버튼에 active 부여
    document.querySelectorAll('.missile-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.getElementById(MISSILE_BTN_ID[type]);
    if (targetBtn) targetBtn.classList.add('active');
};

window.updateInventoryUI = function() {
    const map = { pierce: ['W', '☄️ 관통'], homing: ['E', '🎯 유도'], satellite: ['R', '🛰️ 위성'], net: ['T', '🕸️ 그물'] };
    const btns = document.querySelectorAll('.missile-btn');
    btns.forEach(btn => {
        const text = btn.innerText;
        for (const [key, [shortcut, name]] of Object.entries(map)) {
            if (text.includes(name)) {
                btn.innerHTML = `<kbd>${shortcut}</kbd> ${name}: ${window.missileInventory[key]}`;
                if (window.missileInventory[key] <= 0) btn.style.opacity = 0.5;
            }
        }
    });
};

let guideInterval = null;

// 스테이지 1에서만 한 번 등장하는 문구
const GUIDE_MESSAGES_STAGE1_ONLY = [
    { msg: "이차함수 식을 입력하여 미사일을 발사하세요!", blink: true },
    { msg: "<kbd>[</kbd> 키를 눌러 조준 방향을 왼쪽으로 전환합니다." },
    { msg: "<kbd>A</kbd> 키를 눌러 왼쪽으로 이동합니다." },
    { msg: "<kbd>]</kbd> 키를 눌러 조준 방향을 오른쪽으로 전환합니다." },
    { msg: "<kbd>D</kbd> 키를 눌러 오른쪽으로 이동합니다." },
];

// 모든 스테이지 공통 문구 (무한 순환)
const GUIDE_MESSAGES_COMMON = [
    "<kbd>`</kbd> 키를 눌러 수식 입력창과 계기판을 전환할 수 있습니다.",
    "<kbd>Ctrl</kbd> 로 화면 배율 복구, <kbd>Enter</kbd> 로 발사합니다.",
    "💣 보통탄은 그래프가 적에게 닿으면 피해를 줍니다.",
    "☄️ 관통탄은 지형을 통과할 수 있습니다.",
    "🎯 유도탄은 가장 가까운 적에게 자동으로 유도됩니다.",
    "🛰️ 위성탄은 강력한 레이저를 4회 연속 발사합니다.",
    "🕸️ 그물탄은 반경 3 이내의 적들을 끌어당깁니다."
];

window.startGuideMessageRotation = function() {
    const el = document.getElementById('guide-msg');
    if (!el) return;
    if (guideInterval) clearInterval(guideInterval);

    // 스테이지 1이면 초기 시퀀스: [S1-1, C1, S1-2, S1-3, S1-4, S1-5, C2~C7]
    // 이후: 공통 문구만 무한 순환
    const isStage1 = currentStage === 0;

    // 초기 시퀀스 구성
    const initialSequence = isStage1 ? [
        GUIDE_MESSAGES_STAGE1_ONLY[0],                              // S1-1 (blink)
        { msg: GUIDE_MESSAGES_COMMON[0] },                          // C1
        GUIDE_MESSAGES_STAGE1_ONLY[1],                              // S1-2
        GUIDE_MESSAGES_STAGE1_ONLY[2],                              // S1-3
        GUIDE_MESSAGES_STAGE1_ONLY[3],                              // S1-4
        GUIDE_MESSAGES_STAGE1_ONLY[4],                              // S1-5
        ...GUIDE_MESSAGES_COMMON.slice(1).map(m => ({ msg: m }))    // C2~C7
    ] : [];

    let initIndex = 0;         // 초기 시퀀스 커서 (stage1만)
    let cycleIndex = 0;        // 공통 순환 커서
    let phase = isStage1 ? 'initial' : 'cycle';

    const applyMessage = (text, blink) => {
        el.innerHTML = text;
        el.classList.remove('hidden-opacity');
        if (blink) el.classList.add('guide-blink');
        else el.classList.remove('guide-blink');
    };

    const fadeToNext = (text, blink = false) => {
        el.classList.add('hidden-opacity');
        setTimeout(() => applyMessage(text, blink), 500);
    };

    // 첫 번째 메시지 즉시 표시
    if (phase === 'initial') {
        applyMessage(initialSequence[0].msg, initialSequence[0].blink || false);
    } else {
        applyMessage(GUIDE_MESSAGES_COMMON[0], false);
    }

    guideInterval = setInterval(() => {
        if (phase === 'initial') {
            initIndex++;
            if (initIndex < initialSequence.length) {
                const item = initialSequence[initIndex];
                fadeToNext(item.msg, item.blink || false);
            } else {
                // 초기 시퀀스 완료 → 공통 순환으로 전환 (C1부터)
                phase = 'cycle';
                cycleIndex = 0;
                fadeToNext(GUIDE_MESSAGES_COMMON[0], false);
            }
        } else {
            cycleIndex = (cycleIndex + 1) % GUIDE_MESSAGES_COMMON.length;
            fadeToNext(GUIDE_MESSAGES_COMMON[cycleIndex], false);
        }
    }, 9000);
};
