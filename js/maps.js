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
        init: function(seed) {
            this.islands = [[], [], []];
            
            const addIsland = (layer, startX, endX, baseY) => {
                for (let x = startX; x <= endX; x += 1.5) {
                    let yOff = Math.sin(x * 1.3 + seed) * 0.8;
                    let r = 2.5 + Math.abs(Math.cos(x * 0.8 + seed)) * 1.5;
                    // 가장자리를 약간 둥글고 작게 처리
                    if (x - startX < 2 || endX - x < 2) r *= 0.8;
                    this.islands[layer].push({ x: x, y: baseY + yOff, r: r });
                    
                    // 구름의 풍성함을 위해 서브 원 추가
                    if (Math.random() > 0.5) {
                        this.islands[layer].push({
                            x: x + (Math.random() - 0.5) * 2,
                            y: baseY + yOff + (Math.random() - 0.5) * 2,
                            r: r * 0.7
                        });
                    }
                }
            };

            // Top Layer (y ≈ 15)
            addIsland(0, 4, 14, 15);
            addIsland(0, 20, 32, 15);

            // Middle Layer (y ≈ 5)
            addIsland(1, -32, -22, 5);
            addIsland(1, -14, -4, 5);
            addIsland(1, 0, 8, 5);       // Overlaps Top 1 left
            addIsland(1, 12, 22, 5);     // Overlaps Top 1 right & Top 2 left
            addIsland(1, 28, 35, 5);     // Overlaps Top 2 right

            // Bottom Layer (y ≈ -5)
            addIsland(2, -35, -28, -5);
            addIsland(2, -24, -12, -5);
            addIsland(2, -6, 2, -5);     // Overlaps Mid 3 left
            addIsland(2, 6, 14, -5);     // Overlaps Mid 3 right & Mid 4 left
            addIsland(2, 20, 28, -5);    // Overlaps Mid 4 right
        },
        layers: [
            (x) => {
                let maxY = -100;
                if (!TERRAINS.garden.islands) return maxY;
                for (let c of TERRAINS.garden.islands[0]) {
                    const dx = Math.abs(x - c.x);
                    if (dx <= c.r) maxY = Math.max(maxY, c.y + Math.sqrt(c.r*c.r - dx*dx));
                }
                return maxY;
            },
            (x) => {
                let maxY = -100;
                if (!TERRAINS.garden.islands) return maxY;
                for (let c of TERRAINS.garden.islands[1]) {
                    const dx = Math.abs(x - c.x);
                    if (dx <= c.r) maxY = Math.max(maxY, c.y + Math.sqrt(c.r*c.r - dx*dx));
                }
                return maxY;
            },
            (x) => {
                let maxY = -100;
                if (!TERRAINS.garden.islands) return maxY;
                for (let c of TERRAINS.garden.islands[2]) {
                    const dx = Math.abs(x - c.x);
                    if (dx <= c.r) maxY = Math.max(maxY, c.y + Math.sqrt(c.r*c.r - dx*dx));
                }
                return maxY;
            }
        ],
        func: (x) => -100
    }
};
