const LEVELS = [
    { title: "Stage 1", terrain: 'grass', count: 3, flyingCount: 1 },
    { title: "Stage 2", terrain: 'ice',   count: 3, flyingCount: 1 },
    { title: "Stage 3", terrain: 'sky',   count: 3, flyingCount: 3 },
    { title: "Stage 4", terrain: 'lava',  count: 3, flyingCount: 1 },
    { title: "Stage 5", terrain: 'cave',  count: 3, flyingCount: 2 },
    { title: "Stage 6", terrain: 'electric', count: 4, flyingCount: 1 },
    { title: "Stage 7", terrain: 'psychic',  count: 4, flyingCount: 2 },
    { title: "Stage 8", terrain: 'garden',   count: 4, flyingCount: 2 },
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
        bg: ["#001f3f", "#005c99", "#cce6ff"],
        color: "#b3d9ff", outColor: "#001f3f",
        func: (x) => -4 + Math.abs(Math.sin((x + terrainSeed) / 3)) * 4 + Math.cos(x - terrainSeed) * 0.5
    },
    cave: {
        name: "어두운 동굴",
        bg: ["#0d0d0d", "#262626", "#404040"],
        color: "#595959", outColor: "#0d0d0d",
        func: (x) => Math.sin((x + terrainSeed) / 4) * Math.cos((x - terrainSeed) / 2) * 3 - 2
    },
    electric: {
        name: "발전소",
        bg: ["#1e1b4b", "#312e81", "#fbbf24"],
        color: "#1e1b4b", outColor: "#100e2b", // 언덕 아래를 배경 가장 어두운 남색 톤으로 통일
        func: (x) => Math.sin((x + terrainSeed) / 1.5) * 1.8 + Math.cos((x - terrainSeed) * 1.2) * 0.8 - 1
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
        layers: [
            // Top Layer (y ≈ 16) - x > 0 구간에만 주로 생성 (3단 레이어)
            (x) => {
                if (x < 0.01) return -100;
                const seed = terrainSeed;
                const pattern = Math.sin(x * 0.15 + seed) + Math.cos(x * 0.25 + seed * 1.3);
                // 넓은 섬 생성 (임계값을 0.0으로 낮춰 섬 면적 약 50% 확보)
                if (pattern > 0.0) {
                    return 16 + Math.sin(x * 0.5) * 1.5;
                }
                return -100;
            },
            // Middle Layer (y ≈ 6)
            (x) => {
                const seed = terrainSeed + 100;
                const pattern = Math.cos(x * 0.2 + seed * 0.8) + Math.sin(x * 0.3 - seed * 1.1);
                const centerBoost = Math.max(0, 1.5 - Math.abs(x) * 0.15); 
                // 위 아래 층과 약 40~50% 겹치도록 임계값 완화
                if (pattern + centerBoost > 0.0) {
                    return 6 + Math.cos(x * 0.7) * 1.2;
                }
                return -100;
            },
            // Bottom Layer (y ≈ -4)
            (x) => {
                const seed = terrainSeed + 200;
                const pattern = Math.sin(x * 0.18 + seed * 1.5) + Math.cos(x * 0.22 - seed * 0.9);
                // 넓게 깔리는 바닥 섬 생성 (임계값 -0.1)
                if (pattern > -0.1) {
                    return -4 + Math.sin(x * 0.6) * 1.0;
                }
                return -100;
            }
        ],
        func: (x) => -100
    }
};
