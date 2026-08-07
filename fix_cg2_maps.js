const fs = require('fs');

let maps = fs.readFileSync('js/maps.js', 'utf8');

const newCloudGarden2 = `    cloud_garden2: {
        name: "솜사탕(2)",
        bg: ["#0284c7", "#38bdf8", "#bae6fd"],
        color: "rgba(255, 228, 235, 0.95)",
        outColor: "rgba(244, 114, 182, 0.95)",
        deathZoneY: -25,
        islands3: null,
        init: function(seed) {
            const rnd = (min, max) => Math.random() * (max - min) + min;
            this.islands3 = {
                left:  { x0: -24, x1: -10, baseY: rnd(-1.0, 1.0)  },
                mid:   { x0:  -6, x1:   6, baseY: rnd( 2.0, 3.5)  },
                right: { x0:  10, x1:  24, baseY: rnd( 0.0, 1.5)  }
            };
        },
        func: function(x) {
            const isl = TERRAINS.cloud_garden2.islands3;
            if (!isl) return -100;
            let island = null;
            if (x >= isl.left.x0 - 0.1 && x <= isl.left.x1 + 0.1) island = isl.left;
            else if (x >= isl.mid.x0 - 0.1 && x <= isl.mid.x1 + 0.1) island = isl.mid;
            else if (x >= isl.right.x0 - 0.1 && x <= isl.right.x1 + 0.1) island = isl.right;
            if (!island) return -100;

            const { x0, x1, baseY } = island;
            const t = (x - (x0 + x1) / 2) / ((x1 - x0) / 2);
            const edgeFade = Math.cos(Math.max(-1, Math.min(1, t)) * Math.PI / 2.2);

            const bumps = Math.sin(x * 0.55) * 0.6 + Math.cos(x * 0.9 + 1.0) * 0.4;
            return (baseY + bumps) * edgeFade + (1 - edgeFade) * (baseY - 1.5);
        }
    },`;

const cg2Start = maps.indexOf('    cloud_garden2: {');
const cg2End = maps.indexOf('    },', cg2Start) + 6;
if (cg2Start !== -1 && cg2End !== -1) {
    maps = maps.slice(0, cg2Start) + newCloudGarden2 + maps.slice(cg2End);
    fs.writeFileSync('js/maps.js', maps, 'utf8');
    console.log('Fixed maps.js cloud_garden2 logic');
} else {
    console.log('Could not find cloud_garden2 in maps.js');
}
