/* ================================================================================= */
/* 🛑 STRICTLY FROZEN MODULE: DO NOT MODIFY THIS FILE OR MATH INPUT PROPERTIES       */
/* 🛑 수식입력창 전용 독립 모듈: 사용자의 명시적 요청 없이 절대 수정 금지             */
/* ================================================================================= */

// ---------- Math Input Event Setup (v1.2.62 Exact Replica) ----------
function setupMathInput() {
    const mf = document.getElementById('math-input');
    if (!mf) return;

    // 지수에 연속으로 숫자를 쓸 때 자동으로 지수 밖으로 커서가 빠져나가는 기본 동작 방지
    mf.smartSuperscript = false;

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
            if (e.ctrlKey) {
                e.preventDefault();
                window.showAllEnemyHP = !window.showAllEnemyHP;
                return;
            }
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

    // 한글 IME 차단 및 자동 영문 변환
    const blockKorean = (e) => {
        if (e.type === 'keydown' && (e.keyCode === 229 || e.key === 'Process' || /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.key))) {
            
            // 1. 영문자 입력 (KeyA ~ KeyZ)
            if (e.code && e.code.startsWith('Key')) {
                e.preventDefault(); e.stopPropagation();
                // 사용자가 입력한 키보드 물리 키(e.code)를 바탕으로 해당 영문자를 강제 삽입
                const engChar = e.code.replace('Key', '').toLowerCase();
                mf.executeCommand(['insert', engChar]);
                
                // 문자(Letter)인 경우에만 포커스를 완전히 풀어서 IME 조합 상태를 파괴합니다.
                mf.blur();
                setTimeout(() => {
                    mf.focus();
                }, 10);
                return;
            }
            
            // 2. 영문자가 아닌 숫자, 기호 등은 브라우저 및 MathLive의 기본 동작에 완전히 맡깁니다.
            // 이렇게 해야 x^23 처럼 지수에 연속으로 숫자를 쓸 때 커서가 지수를 빠져나오는 문제가 발생하지 않습니다.
            return;
        }

        if (e.type === 'beforeinput' && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(e.data)) {
            e.preventDefault(); e.stopPropagation();
        }
    };
    mf.addEventListener('keydown',     blockKorean, { capture: true });
    // 수식입력창 포커스 상태에서 발생할 수 있는 찌꺼기 방지 이벤트
    mf.addEventListener('beforeinput', blockKorean, { capture: true });
    mf.addEventListener('compositionstart',  e => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    mf.addEventListener('compositionupdate', e => { e.preventDefault(); e.stopPropagation(); }, { capture: true });
    mf.addEventListener('input', () => {
        const val = mf.getValue();
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(val)) mf.setValue(val.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, ''));
    }, true);
}

// 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMathInput);
} else {
    setupMathInput();
}
