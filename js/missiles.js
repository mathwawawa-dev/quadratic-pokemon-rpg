// =================================================================
// 🚀 포켓몬 포트리스 - 미사일 데이터 및 전용 연출 모듈 (js/missiles.js)
// =================================================================

// ---------- 미사일 마스터 사전 정의 ----------
window.MISSILE_TYPES = {
    normal: {
        id: 'normal',
        name: '보통탄',
        key: 'Q',
        icon: '💣',
        color: '#fbbf24',
        shadowColor: '#fbbf24',
        description: '기본 포탄입니다. 적이나 지형에 닿으면 폭발합니다.'
    },
    pierce: {
        id: 'pierce',
        name: '관통탄',
        key: 'W',
        icon: '☄️',
        color: '#38bdf8',
        shadowColor: '#38bdf8',
        description: '지형과 적을 뚫고 끝까지 궤적을 그리며 지나갑니다.'
    },
    homing: {
        id: 'homing',
        name: '유도탄',
        key: 'E',
        icon: '🎯',
        color: '#c084fc',
        shadowColor: '#a855f7',
        description: '적 방향으로 유도 기동을 하며 추적합니다.'
    },
    satellite: {
        id: 'satellite',
        name: '위성탄',
        key: 'R',
        icon: '🛰️',
        color: '#34d399',
        shadowColor: '#10b981',
        description: '적 피격 시 하늘에서 강력한 위성 레이저가 연쇄 조사됩니다.'
    },
    net: {
        id: 'net',
        name: '그물탄',
        key: 'T',
        icon: '🕸️',
        color: '#2dd4bf',
        shadowColor: '#2dd4bf',
        description: '피격 지점 주변 3칸 내의 적들을 피격 위치로 당겨모읍니다.'
    }
};

// 미사일 타입별 고유 발광 색상 반환
window.getMissileColor = function(type) {
    const t = type || window.currentMissileType || 'normal';
    return (window.MISSILE_TYPES[t] || window.MISSILE_TYPES.normal).color;
};

// ---------- 미사일 헤드(머리) 시각 연출 그리기 ----------
window.drawMissileHead = function(ctx, missile, head, gridToScreenFunc) {
    const type = missile.type || 'normal';
    const mColor = window.getMissileColor(type);

    if (type === 'pierce') {
        // [관통탄] 얇고 긴 바늘/레이저 형태
        ctx.save();
        ctx.translate(head.x, head.y);
        if (missile.trail && missile.trail.length >= 2) {
            const p1 = gridToScreenFunc(missile.trail[missile.trail.length - 2].x, missile.trail[missile.trail.length - 2].y);
            const p2 = gridToScreenFunc(missile.trail[missile.trail.length - 1].x, missile.trail[missile.trail.length - 1].y);
            ctx.rotate(Math.atan2(p2.y - p1.y, p2.x - p1.x));
        }
        ctx.beginPath();
        if (ctx.ellipse) {
            ctx.ellipse(0, 0, 12, 1.5, 0, 0, Math.PI * 2);
        } else {
            ctx.rect(-12, -1.5, 24, 3);
        }
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = mColor;
        ctx.fill();
        ctx.restore();

    } else if (type === 'homing') {
        // [유도탄] 날렵한 다이아몬드 형태
        ctx.save();
        ctx.translate(head.x, head.y);
        if (missile.trail && missile.trail.length >= 2) {
            const p1 = gridToScreenFunc(missile.trail[missile.trail.length - 2].x, missile.trail[missile.trail.length - 2].y);
            const p2 = gridToScreenFunc(missile.trail[missile.trail.length - 1].x, missile.trail[missile.trail.length - 1].y);
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
        ctx.shadowColor = '#a855f7';
        ctx.fill();
        ctx.restore();

    } else if (type === 'satellite') {
        // [위성탄] 큐브/코어 형태
        ctx.save();
        ctx.translate(head.x, head.y);
        if (missile.trail && missile.trail.length >= 2) {
            const p1 = gridToScreenFunc(missile.trail[missile.trail.length - 2].x, missile.trail[missile.trail.length - 2].y);
            const p2 = gridToScreenFunc(missile.trail[missile.trail.length - 1].x, missile.trail[missile.trail.length - 1].y);
            ctx.rotate(Math.atan2(p2.y - p1.y, p2.x - p1.x));
        }
        ctx.beginPath();
        ctx.rect(-6, -6, 12, 12);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#10b981';
        ctx.fill();
        ctx.restore();

    } else if (type === 'net') {
        // [그물탄] 회전하는 6각 별/거미줄 코어
        ctx.save();
        ctx.translate(head.x, head.y);
        ctx.rotate(Date.now() / 300);
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
        ctx.shadowColor = '#2dd4bf';
        ctx.fill();
        ctx.restore();

    } else {
        // [보통탄] 둥근 원형 머리
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = mColor;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
};
