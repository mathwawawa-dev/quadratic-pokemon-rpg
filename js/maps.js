const LEVELS = [
    { title: "Stage 1", terrain: 'grass',    count: 3, flyingCount: 1 },
    { title: "Stage 2", terrain: 'ice',      count: 3, flyingCount: 1 },
    { title: "Stage 3", terrain: 'sky',      count: 3, flyingCount: 3 },
    { title: "Stage 4", terrain: 'lava',     count: 3, flyingCount: 1 },
    { title: "Stage 5", terrain: 'cave',     count: 3, flyingCount: 2 },
    { title: "Stage 6", terrain: 'electric', count: 4, flyingCount: 1 },
    { title: "Stage 7", terrain: 'ocean',    count: 4, flyingCount: 1 },
    { title: "Stage 8", terrain: 'psychic',  count: 4, flyingCount: 2 },
    { title: "Stage 9", terrain: 'garden',   count: 4, flyingCount: 2 },
];

let terrainSeed = 0;

const TERRAINS = {
    grass: {
        name: "푸른 들판",
        bg: ["#1a4a2e", "#4a8f62", "#87ceeb"],
        color: "#2d6a4f", outColor: "#1a4a2e",
        func: (x) => Math.sin((x + terrainSeed) / 2) * 1.5 + Math.cos((x - terrainSeed) / 5) * 3 - 2
    },
    sky: {
        name: "구름 위 하늘",
        bg: ["#4ca1af", "#c4e0e5"],
        color: "rgba(255,255,255,0.8)", outColor: "#4ca1af",
        func: (x) => Math.sin((x + terrainSeed) / 4) * 2 + Math.sin((x - terrainSeed) / 1.5) * 0.5 - 2
    },
    lava: {
        name: "화산 용암",
        bg: ["#2a0000", "#5c0000", "#a52a2a"],
        color: "#1a0505", outColor: "#0a0202",
        func: (x) => Math.cos((x + terrainSeed) / 2.5) * 2.5 + Math.sin((x - terrainSeed) / 1.2) * 1 - 3
    },
    ice: {
        name: "얼음 설산",
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
        func: (x) => Math.sin((x + terrainSeed) / 4) * Math.cos((x - terrainSeed) / 2) * 3 - 2
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
        bg: ["#020617", "#075985", "#0c4a6e"], // 깊은 딥블루 에메랄드 해저 배경
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
        name: "공중정원",
        bg: ["#0ea5e9", "#7dd3fc", "#e0f2fe"],
        color: "#22c55e", outColor: "#15803d",
        isFloating: true,
        deathZoneY: -12,
        init: function(seed) {
            this.islands = [[], [], []];
            
            const addIslandCluster = (layer, startX, endX, baseY) => {
                const width = endX - startX;
                const midX = (startX + endX) / 2;
                
                // 1. Central main ellipse
                this.islands[layer].push({
                    type: 'ellipse',
                    cx: midX,
                    cy: baseY,
                    rx: width / 2 + 0.6,
                    ry: 2.2 + (Math.abs(Math.sin(midX * 0.7 + seed)) * 0.6),
                    rot: 0
                });
                
                // 2. Overlapping circles & ellipses along the island body
                for (let x = startX; x <= endX; x += 1.8) {
                    const progress = (x - startX) / Math.max(1, width);
                    const edgeFactor = Math.sin(progress * Math.PI);
                    
                    const rTop = 1.8 + edgeFactor * 1.5 + (Math.cos(x * 1.5 + seed) * 0.5);
                    const yOff = Math.sin(x * 1.1 + seed) * 0.5;
                    this.islands[layer].push({
                        type: 'circle',
                        cx: x,
                        cy: baseY + yOff,
                        rx: rTop,
                        ry: rTop,
                        rot: 0
                    });

                    if (Math.random() > 0.3) {
                        const rxSub = 2.0 + Math.random() * 1.5;
                        const rySub = 0.8 + Math.random() * 2.0; // 랜덤으로 얇게
                        this.islands[layer].push({
                            type: 'ellipse',
                            cx: x + (Math.random() - 0.5) * 1.5,
                            cy: baseY - 0.8 + (Math.random() - 0.5) * 1.0,
                            rx: rxSub,
                            ry: rySub,
                            rot: 0 // 물리가 rot 0을 기준으로 계산되므로 일치시켜야 함
                        });
                    }
                }
            };

            // 매 게임마다 조금씩 변화(랜덤성)를 주어 덜 단조롭게 구성
            const rnd = (min, max) => Math.random() * (max - min) + min;

            // Top Layer (3층) - 딱 1개 구름만 배치 (가장 우측) (모든 섬 4.5 Y단위 하향 조정)
            addIslandCluster(0, rnd(18, 20), rnd(30, 33), rnd(9.5, 11.5));

            // Middle Layer (2층) - 오른쪽으로 이동 (중앙 -5~5 부근에 섬이 위치하도록)
            addIslandCluster(1, rnd(-30, -28), rnd(-18, -16), rnd(-2.5, -0.5));
            addIslandCluster(1, rnd(-10, -8), rnd(2, 4), rnd(-5.0, -3.0));
            addIslandCluster(1, rnd(12, 14), rnd(23, 25), rnd(-2.5, -0.5));
            addIslandCluster(1, rnd(32, 34), rnd(40, 42), rnd(-5.0, -3.0));

            // Bottom Layer (1층) - 위치와 높낮이를 판마다 조금씩 흔듦 (왼쪽 3번째 섬은 왼쪽으로 5만큼 연장)
            addIslandCluster(2, rnd(-36, -34), rnd(-25, -23), rnd(-16.0, -14.0));
            addIslandCluster(2, rnd(-14, -12), rnd(-2, 0), rnd(-19.0, -17.0));
            addIslandCluster(2, rnd(5, 7), rnd(20, 22), rnd(-16.0, -14.0)); // 시작 X 10~12 -> 5~7 (왼쪽 5 확장)
            addIslandCluster(2, rnd(29, 31), rnd(35, 36), rnd(-19.0, -17.0));
        },
        layers: [
            (x) => {
                let maxY = -100;
                if (!TERRAINS.garden.islands || !TERRAINS.garden.islands[0]) return maxY;
                for (let s of TERRAINS.garden.islands[0]) {
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
                if (!TERRAINS.garden.islands || !TERRAINS.garden.islands[1]) return maxY;
                for (let s of TERRAINS.garden.islands[1]) {
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
                if (!TERRAINS.garden.islands || !TERRAINS.garden.islands[2]) return maxY;
                for (let s of TERRAINS.garden.islands[2]) {
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
