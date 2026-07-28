const LEVELS = [
    { title: "Stage 1", terrain: 'grass',    count: 3, flyingCount: 1 },
    { title: "Stage 2", terrain: 'ice',      count: 3, flyingCount: 1 },
    { title: "Stage 3", terrain: 'log_bridge', count: 3, flyingCount: 1 },
    { title: "Stage 4", terrain: 'sky',      count: 3, flyingCount: 3 },
    { title: "Stage 5", terrain: 'lava',     count: 3, flyingCount: 1 },
    { title: "Stage 6", terrain: 'cave',     count: 3, flyingCount: 2 },
    { title: "Stage 7", terrain: 'electric', count: 4, flyingCount: 1 },
    { title: "Stage 8", terrain: 'ocean',    count: 4, flyingCount: 1 },
    { title: "Stage 9", terrain: 'psychic',  count: 4, flyingCount: 2 },
    { title: "Stage 10", terrain: 'garden',   count: 4, flyingCount: 2 },
    { title: "Stage 11", terrain: 'cloud_garden', count: 4, flyingCount: 3 },
    { title: "Stage 11", terrain: 'cloud_garden2', count: 4, flyingCount: 3 },
];

let terrainSeed = 0;

const TERRAINS = {
    grass: {
        name: "푸른 들판",
        bg: ["#1a4a2e", "#4a8f62", "#87ceeb"],
        color: "#2d6a4f", outColor: "#1a4a2e",
        func: (x) => Math.sin((x + terrainSeed) / 2) * 1.5 + Math.cos((x - terrainSeed) / 5) * 3 - 2
    },
    log_bridge: {
        name: "외나무다리",
        bg: ["#38bdf8", "#7dd3fc", "#bae6fd"],
        color: "#652810", outColor: "#3d1708",
        deathZoneY: -8,
        func: (x) => Math.sin((x + terrainSeed) / 5) * 0.8 + Math.cos((x - terrainSeed) / 3) * 0.4 + 0.7,
        getThickness: (x) => {
            // 4.0 단위 블록 기반 해시 → 블록 경계에서만 두께 변화 (파도 너울 방지)
            const seed = terrainSeed || 0;
            const blockIdx = Math.floor((x + seed * 1.7) / 4.0);
            const h1 = Math.abs(Math.sin(blockIdx * 13.7 + seed * 0.5) * 43758.5453) % 1;
            const h2 = Math.abs(Math.cos(blockIdx * 7.3 - seed * 0.3) * 19234.1234) % 1;
            return 4.0 + h1 * 1.5 + h2 * 1.5; // 4.0 ~ 7.0
        }
    },
    sky: {
        name: "성층권",
        bg: ["#4ca1af", "#c4e0e5"],
        color: "rgba(255,255,255,0.8)", outColor: "#4ca1af",
        deathZoneY: -30,
        func: (x) => Math.sin((x + terrainSeed) / 4) * 2 + Math.sin((x - terrainSeed) / 1.5) * 0.5 - 2
    },
    lava: {
        name: "화산",
        bg: ["#2a0000", "#5c0000", "#a52a2a"],
        color: "#1a0505", outColor: "#0a0202",
        func: (x) => Math.cos((x + terrainSeed) / 2.5) * 2.5 + Math.sin((x - terrainSeed) / 1.2) * 1 - 3
    },
    ice: {
        name: "눈 덮인 산",
        bg: ["#001428", "#003d66", "#66adff", "#d9eaff"],
        color: "rgba(179, 217, 255, 0.95)", outColor: "#002b4d",
        func: (x) => {
            const seed = terrainSeed || 0;
            // 뾰족하고 가파른 얼음 봉우리와 깊은 크레바스(빙혈) 구덩이가 조화롭게 섞인 만년설 지형
            const peak = Math.abs(Math.sin((x + seed) / 2.5)) * 6.0;
            const crevasse = Math.sin((x - seed) / 3.8) * 3.5;
            const detail = Math.sin(x * 1.8 + seed) * 0.8;
            return -4.0 + peak + crevasse + detail;
        }
    },
    cave: {
        name: "어두운 동굴",
        bg: ["#0d0d0d", "#262626", "#404040"],
        color: "#595959", outColor: "#0d0d0d",
        hasCaveWall: true,
        func: (x) => Math.sin((x + terrainSeed) / 4) * Math.cos((x - terrainSeed) / 2) * 3 - 2,
        ceilFunc: (x) => {
            const offset = (typeof window !== 'undefined' && window.caveCeilOffset !== undefined) ? window.caveCeilOffset : 7.5;
            let y = -(Math.sin((x + terrainSeed) / 4) * Math.cos((x - terrainSeed) / 2) * 3 - 2) + 24 + offset;
            if (x < -20) {
                const dx = -20 - x;
                y -= dx * dx * 0.08;
            } else if (x > 20) {
                const dx = x - 20;
                y -= dx * dx * 0.08;
            }
            return y;
        }
    },
    electric: {
        name: "발전소",
        bg: ["#0f0507", "#270e12", "#451a21"], // 신비롭고 차분한 딥 버건디 카본 그라데이션 배경
        color: "#7f1d1d", outColor: "#450a0a", // 동굴/바닷속과 확연히 구분되는 고급 무광 코퍼 구리선/버건디 지형
        func: (x) => {
            const seed = terrainSeed || 0;
            // 완만하고 쾌적한 발전소 지형: 자폭 위험이 없도록 경사를 완화하고 부드러운 1~2개의 넓은 플랫폼만 배치
            const baseWave = Math.sin((x + seed) / 3.5) * 1.8;
            const lowStep = Math.floor(Math.sin((x + seed) / 6) * 2) * 0.8;
            return -2.0 + baseWave + lowStep;
        }
    },
    ocean: {
        name: "깊은 바닷속",
        bg: ["#020617", "#0c3460", "#0e7490"], // 해저 하단 칠흑 → 짙은 청남 → 상단 청록 3단 그라데이션
        color: "#0284c7", outColor: "#0369a1", // 선명하고 맑은 네온 사이안 해저 모래 언덕 지형
        func: (x) => {
            const seed = terrainSeed || 0;
            // 완만하게 굽이치는 해저 모래 언덕 물결 지형
            const wave1 = Math.sin((x + seed) / 4) * 2.2;
            const wave2 = Math.cos((x - seed) / 2.5) * 1.0;
            return -2.5 + wave1 + wave2;
        }
    },
    psychic: {
        name: "왜곡된 차원",
        bg: ["#3b0764", "#581c87", "#f472b6"],
        color: "#3e1b5d", outColor: "#1d0333", // 약간만 더 연하고 부드러운 딥 바이올렛 톤으로 조정
        func: (x) => Math.sin((x + terrainSeed) / 3) * 3 + Math.cos((x - terrainSeed) / 3) * 1.5 - 2
    },
    garden: {
        name: "부유하는 섬",
        bg: ["#0ea5e9", "#7dd3fc", "#e0f2fe"],
        color: "#22c55e", outColor: "#15803d",
        // isFloating 없음 - sky(성층권)와 동일한 단일 func 방식으로 3개 섬 구현
        deathZoneY: -25,

        // 섬별 x 범위를 저장 (buildTerrain에서 사용)
        islands3: null, // {left:{x0,x1,baseY}, mid:{x0,x1,baseY}, right:{x0,x1,baseY}}

        init: function(seed) {
            const rnd = (min, max) => Math.random() * (max - min) + min;
            this.islands3 = {
                left:  { x0: -24, x1: -10, baseY: rnd(-1.0, 1.0)  },
                mid:   { x0:  -6, x1:   6, baseY: rnd(-4.0, -2.5) },
                right: { x0:  10, x1:  24, baseY: rnd( 2.0, 3.5)  }
            };
        },

        // 특정 x에서 y값 반환 (섬 위 = 부드러운 sin/cos 파형, 섬 밖 = -100)
        func: function(x) {
            const isl = TERRAINS.garden.islands3; // this 바인딩 손실 방지
            if (!isl) return -100;
            // 어느 섬에 속하는지 확인 (부동소수점 오차 방지를 위해 0.1 여유)
            let island = null;
            if (x >= isl.left.x0 - 0.1 && x <= isl.left.x1 + 0.1) island = isl.left;
            else if (x >= isl.mid.x0 - 0.1 && x <= isl.mid.x1 + 0.1) island = isl.mid;
            else if (x >= isl.right.x0 - 0.1 && x <= isl.right.x1 + 0.1) island = isl.right;
            if (!island) return -100;

            const { x0, x1, baseY } = island;
            const t = (x - (x0 + x1) / 2) / ((x1 - x0) / 2); // -1 ~ +1
            // 가장자리로 갈수록 부드럽게 떨어지는 코사인 곡선 적용 (더 예쁜 섬 모양)
            const edgeFade = Math.cos(Math.max(-1, Math.min(1, t)) * Math.PI / 2.2);

            // 섬 위 지형 굴곡 (적당히 자연스럽게)
            const bumps = Math.sin(x * 0.55) * 0.6 + Math.cos(x * 0.9 + 1.0) * 0.4;
            return (baseY + bumps) * edgeFade + (1 - edgeFade) * (baseY - 1.5);
        }
    }
    ,cloud_garden: {
        name: "솜사탕",
        bg: ["#0284c7", "#38bdf8", "#bae6fd"],
        color: "rgba(255, 228, 235, 0.95)",   // 파스텔 솜사탕 핑크 구름 (흰색 축/숫자와 뚜렷이 구별됨)
        outColor: "rgba(244, 114, 182, 0.95)", // 아련한 파스텔 핑크 테두리
        isFloating: true,
        deathZoneY: -25,
        init: function(seed) {
            this.islands = [[], [], []];
            const rnd = (min, max) => Math.random() * (max - min) + min;

            const addCloudCluster = (layer, startX, endX, baseY) => {
                const width = endX - startX;
                const midX = (startX + endX) / 2;
                
                // 중심 타원
                this.islands[layer].push({
                    type: 'ellipse',
                    cx: midX,
                    cy: baseY,
                    rx: width / 2 + 0.5,
                    ry: 1.8 + (Math.abs(Math.sin(midX * 0.7 + seed)) * 0.4),
                    rot: 0
                });
                
                // 폭신폭신 원형 구름 뭉치 배치
                for (let x = startX; x <= endX; x += 1.6) {
                    const progress = (x - startX) / Math.max(1, width);
                    const edgeFactor = Math.sin(progress * Math.PI);
                    
                    const rTop = 1.5 + edgeFactor * 1.3 + (Math.cos(x * 1.5 + seed) * 0.4);
                    const yOff = Math.sin(x * 1.1 + seed) * 0.4;
                    this.islands[layer].push({
                        type: 'circle',
                        cx: x,
                        cy: baseY + yOff,
                        rx: rTop,
                        ry: rTop,
                        rot: 0
                    });

                    if (Math.random() > 0.3) {
                        const rxSub = 1.8 + Math.random() * 1.2;
                        const rySub = 0.9 + Math.random() * 1.5;
                        this.islands[layer].push({
                            type: 'ellipse',
                            cx: x + (Math.random() - 0.5) * 1.2,
                            cy: baseY - 0.6 + (Math.random() - 0.5) * 0.8,
                            rx: rxSub,
                            ry: rySub,
                            rot: 0
                        });
                    }
                }
            };

            // 사진 형태 상단/중단/하단 지그재그 구름섬 6개 무작위 생성
            // Top Layer (1개)
            addCloudCluster(0, rnd(-12, -8), rnd(10, 14), rnd(11, 13));

            // Middle Layer (3개)
            addCloudCluster(1, rnd(-32, -30), rnd(-18, -16), rnd(1, 3));
            addCloudCluster(1, rnd(-6, -4), rnd(6, 8), rnd(-1, 1));
            addCloudCluster(1, rnd(16, 18), rnd(30, 32), rnd(3, 5));

            // Bottom Layer (2개)
            addCloudCluster(2, rnd(-24, -22), rnd(-6, -4), rnd(-12, -10));
            addCloudCluster(2, rnd(8, 10), rnd(26, 28), rnd(-14, -12));
        },
        layers: [
            (x) => {
                let maxY = -100;
                if (!TERRAINS.cloud_garden.islands || !TERRAINS.cloud_garden.islands[0]) return maxY;
                for (let s of TERRAINS.cloud_garden.islands[0]) {
                    const dx = Math.abs(x - s.cx);
                    if (dx <= s.rx) {
                        const topY = s.cy + s.ry * Math.sqrt(Math.max(0, 1 - (dx * dx) / (s.rx * s.rx)));
                        if (topY > maxY) maxY = topY;
                    }
                }
                return maxY;
            },
            (x) => {
                let maxY = -100;
                if (!TERRAINS.cloud_garden.islands || !TERRAINS.cloud_garden.islands[1]) return maxY;
                for (let s of TERRAINS.cloud_garden.islands[1]) {
                    const dx = Math.abs(x - s.cx);
                    if (dx <= s.rx) {
                        const topY = s.cy + s.ry * Math.sqrt(Math.max(0, 1 - (dx * dx) / (s.rx * s.rx)));
                        if (topY > maxY) maxY = topY;
                    }
                }
                return maxY;
            },
            (x) => {
                let maxY = -100;
                if (!TERRAINS.cloud_garden.islands || !TERRAINS.cloud_garden.islands[2]) return maxY;
                for (let s of TERRAINS.cloud_garden.islands[2]) {
                    const dx = Math.abs(x - s.cx);
                    if (dx <= s.rx) {
                        const topY = s.cy + s.ry * Math.sqrt(Math.max(0, 1 - (dx * dx) / (s.rx * s.rx)));
                        if (topY > maxY) maxY = topY;
                    }
                }
                return maxY;
            }
        ],
        func: (x) => -100
    }
};

// ── 솜사탕(2): 성층권 렌더링 방식(isFloating: false) + 수학적 둥근 구름 모양 ──
const TERRAINS_cloud_garden2 = {
    cloud_garden2: {
        name: "솜사탕(2)",
        bg: ["#0284c7", "#38bdf8", "#bae6fd"],
        color: "rgba(255, 228, 235, 0.95)",
        outColor: "rgba(244, 114, 182, 0.95)",
        deathZoneY: -25,
        islands3: null,  // { sole: {x0, x1, baseY} }
        init: function(seed) {
            const rnd = (min, max) => Math.random() * (max - min) + min;
            this.islands3 = {
                sole: { x0: -26, x1: 26, baseY: rnd(-6.0, -4.5) }
            };
        },
        func: function(x) {
            // 뒤집기: 기존 아랫면 dip → 위로 반전하여 걷는 면의 언덕이 됨
            const isl = TERRAINS.cloud_garden2.islands3;
            if (!isl || !isl.sole) return -100;
            const { x0, x1, baseY } = isl.sole;
            if (x < x0 - 0.1 || x > x1 + 0.1) return -100;

            const W = x1 - x0;
            const s = baseY;

            // 기존 아랫면 dip 위치(0.13,0.28,0.45,0.62,0.78,0.90)를 위로 반전
            // 우측(0.78, 0.90)은 +0.7 추가로 더 높게
            const bumps = [
                { relX: 0.13, h: 0.9 + Math.cos(s * 2.3) * 0.3,        w: 5.0 },
                { relX: 0.28, h: 1.2 + Math.sin(s * 3.7) * 0.3,        w: 5.5 },
                { relX: 0.45, h: 1.1 + Math.cos(s * 1.7) * 0.2,        w: 6.0 },
                { relX: 0.62, h: 1.3 + Math.sin(s * 2.9) * 0.3,        w: 5.5 },
                { relX: 0.78, h: 1.0 + Math.cos(s * 4.3) * 0.2 + 0.7,  w: 5.0 }, // 우측 +0.7
                { relX: 0.90, h: 0.7 + Math.sin(s * 1.3) * 0.2 + 0.7,  w: 4.0 }, // 우측 +0.7
            ];

            let topY = baseY;
            for (const p of bumps) {
                const cx = x0 + W * p.relX;
                const d  = (x - cx) / p.w;
                if (Math.abs(d) < 1.0) {
                    const t    = 1 - d * d;
                    const bump = p.h * t * t; // 위로 볼록
                    if (baseY + bump > topY) topY = baseY + bump;
                }
            }

            // 좌측: cosine 이등변삼각형 테이퍼 (normT -0.50~-1.0)
            // 우측: 선형 수렴으로 점점 얇아짐
            const _mid = x0 + W / 2;
            const _nT  = (x - _mid) / (W / 2);
            if (_nT < -0.50) {
                const _t    = (-0.50 - _nT) / 0.50; // 0→1
                const _fade = 0.5 * (1 + Math.cos(_t * Math.PI)); // cosine 1→0
                const _topTargetL = baseY - 1.0; // 좌측 끝 상단 수렴점 (살짝 체짐)
                topY = _topTargetL + (topY - _topTargetL) * _fade;
            } else if (_nT > 0.80) {
                // 우측: cosine 수렴, 끝점은 baseY+0.8로 (일정 두께 유지)
                const _t      = (_nT - 0.80) / 0.20;
                const _cosFade = 0.5 * (1 + Math.cos(_t * Math.PI));
                const _topTarget = baseY + 0.4; // 끝점 상단 최소값 (1.2→0.4)
                topY = _topTarget + (topY - _topTarget) * _cosFade;
            }

            return topY;
        },
        // 아랫면: 기존 윗면(완만한 물결)을 아래로 반전 + 좌측 dip 강화 + 끝 모양 차별화
        funcBottom: function(x) {
            const isl = TERRAINS.cloud_garden2.islands3;
            if (!isl || !isl.sole) return -100;
            const { x0, x1, baseY } = isl.sole;
            if (x < x0 - 0.1 || x > x1 + 0.1) return -100;

            const W = x1 - x0;
            const s = baseY;
            const cloudThickness = 5.0;

             // 좌측 dip 적당히 강화, 나머지 완만
            const dips = [
                { relX: 0.08, h: 0.90 + Math.sin(s * 3.1) * 0.15, w: 5.5 }, // 완화 (2.0→0.9)
                { relX: 0.22, h: 1.00 + Math.cos(s * 2.7) * 0.15, w: 6.0 }, // 완화 (2.5→1.0)
                { relX: 0.38, h: 0.80 + Math.sin(s * 1.9) * 0.1,  w: 8.0 },
                { relX: 0.52, h: 0.90 + Math.cos(s * 4.1) * 0.08, w: 8.5 },
                { relX: 0.66, h: 0.75 + Math.sin(s * 2.3) * 0.12, w: 7.5 },
                { relX: 0.80, h: 0.55 + Math.cos(s * 3.7) * 0.1,  w: 7.0 },
                { relX: 0.93, h: 0.30 + Math.sin(s * 1.7) * 0.08, w: 5.5 },
            ];

            let botY = baseY - cloudThickness;
            for (const p of dips) {
                const cx = x0 + W * p.relX;
                const d  = (x - cx) / p.w;
                if (Math.abs(d) < 1.0) {
                    const t    = 1 - d * d;
                    const dip  = p.h * t * t;
                    const candidate = baseY - cloudThickness - dip;
                    if (candidate < botY) botY = candidate;
                }
            }

            const mid = x0 + W / 2;
            const normT = (x - mid) / (W / 2);

            if (normT < -0.50) {
                // 좌측: cosine으로 수렴 + 끝 하단에 작은 굴곡
                const _t    = (-0.50 - normT) / 0.50;
                const _fade = 0.5 * (1 + Math.cos(_t * Math.PI));
                // 수렴점에 sine 굴곡 추가 (진폭 0.7, 끝으로 갈수록 굴곡 비중 커짐)
                const _ripple   = Math.sin((x - x0) * 1.8 + s * 2.3) * 0.3 * _t;
                const _botTarget = baseY - 4.5 - _ripple;
                botY = _botTarget + (botY - _botTarget) * _fade;
            } else if (normT > 0.80) {
                // 우측: cosine 수렴, 끝점은 baseY-1.0으로 (야래에 남는 두께 유지)
                const _t      = (normT - 0.80) / 0.20;
                const _cosFade = 0.5 * (1 + Math.cos(_t * Math.PI));
                const _botTarget2 = baseY - 3.0; // 끝점 하단 최소값 (-1.5→-3.0)
                botY = _botTarget2 + (botY - _botTarget2) * _cosFade;
            }

            return botY;
        }
    }
};
Object.assign(TERRAINS, TERRAINS_cloud_garden2);

