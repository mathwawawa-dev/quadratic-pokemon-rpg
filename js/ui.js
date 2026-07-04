// ============================================================
// ui.js  —  UI Events & Intro Screen logic
// ============================================================

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

    // 백틱(`) 누르면 포커스
    window.addEventListener('keydown', (e) => {
        if (e.key === '`') {
            e.preventDefault();
            if (document.activeElement !== mf) mf.focus();
        }
    });

    // MathLive 자동변환 방지 (xx 가 곱하기로 변하는 것 방지)
    try { mf.inlineShortcuts = Object.assign({}, mf.inlineShortcuts || {}, { 'xx': 'xx' }); } catch(e) {}

    // 한글 IME 차단 및 'ㅌ' -> 'x' 자동 변환
    const blockKorean = (e) => {
        // 물리적인 'X' 키를 눌렀을 때 (한글 상태에서 ㅌ 누름)
        if (e.type === 'keydown' && e.code === 'KeyX' && (e.keyCode === 229 || e.key === 'ㅌ')) {
            e.preventDefault(); e.stopPropagation();
            mf.executeCommand(['insert', 'x']);
            return;
        }
        // 물리적인 'Y' 키를 눌렀을 때 (한글 상태에서 ㅛ 누름)
        if (e.type === 'keydown' && e.code === 'KeyY' && (e.keyCode === 229 || e.key === 'ㅛ')) {
            e.preventDefault(); e.stopPropagation();
            mf.executeCommand(['insert', 'y']);
            return;
        }
        if (e.keyCode === 229 || e.key === 'Process' || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key) || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.data)) {
            e.preventDefault(); e.stopPropagation();
        }
    };
    mf.addEventListener('keydown',     blockKorean, { capture: true });
    mf.addEventListener('beforeinput', blockKorean, { capture: true });
    mf.addEventListener('compositionstart',  e => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    mf.addEventListener('compositionupdate', e => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    mf.addEventListener('input', () => {
        const val = mf.getValue();
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(val)) mf.setValue(val.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, ''));
    }, true);

    // Enter 키 → 발사 (document 레벨 capture로 MathLive 이전에 잡음)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const overlay = document.getElementById('message-overlay');
        if (overlay && overlay.classList.contains('show')) {
            e.preventDefault();
            closeMessage();
            return;
        }
        // math-field 또는 fire-btn에 포커스가 있을 때만 발사
        const active = document.activeElement;
        const mfEl = document.getElementById('math-input');
        const fireEl = document.getElementById('fire-btn');
        if (active === mfEl || active === fireEl || (mfEl && mfEl.contains(active))) {
            e.preventDefault();
            if (!fireEl.disabled && GAME_STATE === 'IDLE') fireMissile();
        }
    }, { capture: true });
}

// ---------- Entry Point ----------
window.addEventListener('load', () => {
    setupMathInput();
    showIntro();
});
