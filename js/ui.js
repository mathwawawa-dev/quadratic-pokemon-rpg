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

window.isCheatUnlocked = false;
let introQCount = 0;

// ---------- Intro Screen ----------
function showIntro() {
    const intro = document.getElementById('intro-screen');
    const game  = document.getElementById('game-screen');
    intro.classList.remove('hidden');
    game.classList.add('hidden');

    introQCount = 0;
    window.isCheatUnlocked = false;

    // 스타팅 포켓몬 이미지를 로컬 파일에서 우선 로딩하여 0ms 인스턴트 표시
    document.querySelectorAll('.starter-card').forEach(card => {
        const id = card.dataset.id;
        const img = card.querySelector('img');
        const localSrc = `assets/starters/${id}.png`;
        const primary  = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/${id}.png`;
        img.src = localSrc;
        img.onerror = () => { if (img.src !== primary) img.src = primary; };
    });
}

function startGame(starterKey) {
    selectedStarter = STARTERS[starterKey];

    document.getElementById('intro-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // 치트모드 해금 시 99개 지급, 기본은 1개 지급
    if (window.isCheatUnlocked) {
        window.missileInventory = { pierce: 99, homing: 99, satellite: 99, net: 99 };
    } else {
        window.missileInventory = { pierce: 1, homing: 1, satellite: 1, net: 1 };
    }

    // 게임 초기화
    currentStage = 0;
    playerGold   = 0;
    document.getElementById('ui-player-gold').innerText = '0';

    initStage();
    if (window.updateInventoryUI) window.updateInventoryUI();
    gameLoop();
}
window.startGame = startGame;

// ---------- Math Input Event Setup (Separated to js/mathInput.js) ----------
// 수식입력창 로직은 js/mathInput.js 파일로 완전히 격리 분리되었습니다.

let isCtrlAlone = false;

function setupGlobalShortcuts() {
    // 글로벌 단축키 (Q,W,E,R,T 미사일 / A,D 이동 / [, ] 방향 / Enter 발사)
    // 수식입력창에 포커스가 있어도 우선적으로 단축키가 작동하도록 capture 단계에서 처리합니다.
    document.addEventListener('keydown', (e) => {
        // 스타팅 포켓몬 선택 화면에서 Q/ㅂ 키 3회 누르면 치트모드 해금
        const introScreen = document.getElementById('intro-screen');
        if (introScreen && !introScreen.classList.contains('hidden')) {
            const keyLower = e.key ? e.key.toLowerCase() : '';
            if (keyLower === 'q' || keyLower === 'ㅂ' || keyLower === 'ㅃ' || e.code === 'KeyQ') {
                introQCount++;
                if (introQCount >= 3) {
                    window.isCheatUnlocked = true;
                    const tip = document.querySelector('.intro-tip');
                    if (tip) {
                        tip.innerHTML = '포켓몬을 클릭하여 모험을 시작하세요 <span id="cheat-sparkle" style="display:inline-block; transition: opacity 0.2s ease-in-out; opacity: 0.1;">✨</span>';
                        setTimeout(() => {
                            const sparkle = document.getElementById('cheat-sparkle');
                            if (sparkle) {
                                sparkle.style.opacity = '1';
                            }
                        }, 250);
                    }
                }
            }
            return;
        }

        if (e.key === 'Control') {
            if (!e.repeat) {
                isCtrlAlone = true;
            }
        } else {
            isCtrlAlone = false;
        }

        const overlay = document.getElementById('message-overlay');
        if (overlay && overlay.classList.contains('show')) {
            if (e.key === 'Enter') {
                e.preventDefault(); e.stopPropagation();
                closeMessage();
            }
            return;
        }

        // 발사 단축키 (Enter) - 어디서든 발사 가능
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            const fireEl = document.getElementById('fire-btn');
            e.preventDefault(); e.stopPropagation();
            if (fireEl && !fireEl.disabled && GAME_STATE === 'IDLE') fireMissile();
            return;
        }

        // 이동 단축키 (Ctrl + Left/Right) - 최우선 처리 (수식창 포커스 무시)
        if (e.ctrlKey && !e.metaKey && !e.altKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
            e.preventDefault(); e.stopPropagation();
            if (e.code === 'ArrowLeft') movePlayer(-1);
            if (e.code === 'ArrowRight') movePlayer(1);
            return;
        }

        // 화면 복구 단축키 (Ctrl 누르는 순간은 대기)
        if (e.key === 'Control') {
            return;
        }

        // 그 외 보조키가 눌린 상태면 무시 (Ctrl+C, Ctrl+V 등 방해 방지)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // 물리적 키보드 코드를 기반으로 한글 모드(ㅂ,ㅈ,ㄷ,ㄱ,ㅅ,ㅁ,ㅇ)에서도 동일하게 작동하도록 함
        const code = e.code;
        const keyMap = { 'KeyQ': 'normal', 'KeyW': 'pierce', 'KeyE': 'homing', 'KeyR': 'satellite', 'KeyT': 'net' };
        
        // 미사일 변경 (Q,W,E,R,T)
        if (keyMap[code]) {
            e.preventDefault(); e.stopPropagation();
            selectMissile(keyMap[code]);
            return;
        }

        // 조준방향 단축키 ([, ])
        if (code === 'BracketLeft') {
            e.preventDefault(); e.stopPropagation();
            setPlayerFacing(-1);
            return;
        }
        if (code === 'BracketRight') {
            e.preventDefault(); e.stopPropagation();
            setPlayerFacing(1);
            return;
        }

    }, { capture: true });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control') {
            if (isCtrlAlone && !e.shiftKey && !e.altKey && !e.metaKey) {
                resetView();
            }
            isCtrlAlone = false;
        }
    }, { capture: true });
}

// ---------- Entry Point ----------
window.addEventListener('load', () => {
    setupGlobalShortcuts();
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
    { msg: "<kbd>[</kbd> / <kbd>]</kbd> 키를 눌러 조준 방향을 전환합니다." },
    { msg: "<kbd>Ctrl</kbd> + <kbd>◀</kbd> / <kbd>▶</kbd> 키를 눌러 좌우로 이동합니다." }
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
