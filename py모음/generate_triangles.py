"""
수학 교육용 직각삼각형 이미지 자동 생성 스크립트
100개의 서로 다른 직각삼각형을 PNG(투명 배경)로 생성합니다.
"""

import sys
import os
import math

# Windows cp949 콘솔에서도 UTF-8 출력이 되도록 강제 설정
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch
import numpy as np

# 출력 디렉토리
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "triangles")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# 1. 삼각형 데이터 정의
#    각 항목: (a, b, c, label_a, label_b, label_c, orient)
#    - a, b: 직각을 끼는 두 변 (단위값)
#    - c: 빗변
#    - label_*: 이미지에 표시될 문자열
#    - orient: 삼각형 방향 ('normal'|'flip'|'rotate'|...) — 다양성을 위해
# ─────────────────────────────────────────────────────────────────────────────

# 피타고라스 수 모음
PYTHAGOREAN_TRIPLES = [
    (3, 4, 5),
    (5, 12, 13),
    (8, 15, 17),
    (7, 24, 25),
    (20, 21, 29),
    (9, 40, 41),
    (12, 35, 37),
    (11, 60, 61),
    (13, 84, 85),
    (6, 8, 10),       # 3-4-5 배수
    (9, 12, 15),
    (12, 16, 20),
    (15, 20, 25),
    (5, 12, 13),
    (10, 24, 26),
    (15, 36, 39),     # 5-12-13 배수
    (16, 30, 34),     # 8-15-17 배수
    (14, 48, 50),     # 7-24-25 배수
    (28, 45, 53),
    (33, 56, 65),
    (36, 77, 85),
    (13, 84, 85),
    (36, 77, 85),
    (20, 99, 101),
    (60, 91, 109),
    (15, 112, 113),
    (16, 63, 65),
    (33, 56, 65),
    (48, 55, 73),
    (36, 77, 85),
]

# 특수각 비율 삼각형 (30-60-90, 45-45-90)
SPECIAL_TRIANGLES = [
    # 30-60-90: 변의 비율 = 1 : √3 : 2
    (1, math.sqrt(3), 2,   "1",        "√3",       "2",         "30-60-90"),
    (2, 2*math.sqrt(3), 4, "2",        "2√3",      "4",         "30-60-90"),
    (3, 3*math.sqrt(3), 6, "3",        "3√3",      "6",         "30-60-90"),
    (4, 4*math.sqrt(3), 8, "4",        "4√3",      "8",         "30-60-90"),
    (5, 5*math.sqrt(3), 10,"5",        "5√3",      "10",        "30-60-90"),
    (1.5, 1.5*math.sqrt(3), 3, "3/2", "3√3/2",    "3",         "30-60-90"),
    # 45-45-90: 변의 비율 = 1 : 1 : √2
    (1, 1, math.sqrt(2),   "1",        "1",        "√2",        "45-45-90"),
    (2, 2, 2*math.sqrt(2), "2",        "2",        "2√2",       "45-45-90"),
    (3, 3, 3*math.sqrt(2), "3",        "3",        "3√2",       "45-45-90"),
    (4, 4, 4*math.sqrt(2), "4",        "4",        "4√2",       "45-45-90"),
    (5, 5, 5*math.sqrt(2), "5",        "5",        "5√2",       "45-45-90"),
    (6, 6, 6*math.sqrt(2), "6",        "6",        "6√2",       "45-45-90"),
    (7, 7, 7*math.sqrt(2), "7",        "7",        "7√2",       "45-45-90"),
]

def build_triangle_list():
    triangles = []

    # 피타고라스 수 기반 (정수 레이블)
    used = set()
    for (a, b, c) in PYTHAGOREAN_TRIPLES:
        key = (a, b)
        if key in used:
            continue
        used.add(key)
        triangles.append({
            "a": a, "b": b, "c": c,
            "label_a": str(a), "label_b": str(b), "label_c": str(c),
            "kind": "pythagorean"
        })

    # 특수각 삼각형
    for item in SPECIAL_TRIANGLES:
        a, b, c, la, lb, lc, kind = item
        triangles.append({
            "a": a, "b": b, "c": c,
            "label_a": la, "label_b": lb, "label_c": lc,
            "kind": kind
        })

    # 부족분을 임의 정수 비율로 채우기
    extra_pairs = [
        (1, 2), (2, 3), (3, 5), (4, 7), (5, 9), (2, 7), (3, 8), (4, 9),
        (1, 3), (2, 5), (3, 7), (4, 11), (5, 13), (6, 7), (7, 9),
        (1, 4), (2, 9), (5, 7), (6, 11), (8, 9), (10, 11), (9, 11),
        (3, 11), (4, 13), (5, 11), (6, 13), (7, 11), (8, 13), (9, 13),
        (10, 13), (11, 13), (12, 13), (4, 15), (5, 14), (6, 17), (7, 15),
        (8, 17), (9, 14), (10, 17), (11, 15), (12, 17), (13, 15), (14, 17),
        (3, 14), (4, 17), (5, 16), (6, 19), (7, 18), (8, 19), (2, 11),
        (3, 13), (4, 19), (5, 17), (6, 23), (7, 22), (8, 23), (9, 22),
        (10, 21), (11, 23), (12, 23), (13, 19), (14, 23), (15, 23), (16, 23),
    ]
    for (a_n, b_n) in extra_pairs:
        c_n = math.sqrt(a_n**2 + b_n**2)
        triangles.append({
            "a": a_n, "b": b_n, "c": c_n,
            "label_a": str(a_n), "label_b": str(b_n),
            "label_c": f"{c_n:.2f}",
            "kind": "general"
        })

    return triangles[:100]

# ─────────────────────────────────────────────────────────────────────────────
# 2. 단일 삼각형 그리기 함수
# ─────────────────────────────────────────────────────────────────────────────

COLORS = [
    ("#4A90D9", "#2C3E50"),   # 파랑 계열
    ("#E74C3C", "#2C3E50"),   # 빨강 계열
    ("#27AE60", "#1A252F"),   # 초록 계열
    ("#F39C12", "#1A252F"),   # 주황 계열
    ("#8E44AD", "#2C3E50"),   # 보라 계열
    ("#16A085", "#1A252F"),   # 청록 계열
    ("#D35400", "#2C3E50"),   # 주황-갈색 계열
    ("#2980B9", "#1A252F"),   # 진파랑 계열
    ("#C0392B", "#1A252F"),   # 진빨강 계열
    ("#1ABC9C", "#2C3E50"),   # 민트 계열
]

def latex_label(s):
    """레이블 문자열을 matplotlib LaTeX 표현으로 변환"""
    if "√" in s:
        s = s.replace("√3", r"$\sqrt{3}$")
        s = s.replace("√2", r"$\sqrt{2}$")
        # 계수 처리: e.g. "2√3" → "2$\sqrt{3}$"
    return s


def draw_triangle(tri, idx, orientation=0):
    """
    tri: dict with keys a, b, c, label_a, label_b, label_c, kind
    idx: 0-based index
    orientation: 0~3 (삼각형 방향 변형)
    """
    a = tri["a"]  # BC 변 (수평)
    b = tri["b"]  # AB 변 (수직)
    c = tri["c"]  # 빗변 AC

    # 꼭짓점 좌표 (B가 직각)
    # B = (0, 0), C = (a, 0), A = (0, b)
    B = np.array([0.0, 0.0])
    C = np.array([float(a), 0.0])
    A = np.array([0.0, float(b)])

    # orientation에 따라 회전 또는 반전
    if orientation == 1:
        # A, B, C 위치 교환: C가 직각
        B, C, A = np.array([0.0, 0.0]), np.array([float(a), 0.0]), np.array([float(a), float(b)])
    elif orientation == 2:
        # 좌우 반전
        B = np.array([float(a), 0.0])
        C = np.array([0.0, 0.0])
        A = np.array([float(a), float(b)])
    elif orientation == 3:
        # 상하 반전
        B = np.array([0.0, float(b)])
        C = np.array([float(a), float(b)])
        A = np.array([0.0, 0.0])

    # 패딩 계산
    max_dim = max(a, b)
    pad = max_dim * 0.35

    all_x = [A[0], B[0], C[0]]
    all_y = [A[1], B[1], C[1]]
    x_min, x_max = min(all_x) - pad, max(all_x) + pad
    y_min, y_max = min(all_y) - pad, max(all_y) + pad

    # Figure 크기 (비율 고려)
    fig_w = 6.0
    aspect = (y_max - y_min) / (x_max - x_min) if (x_max - x_min) > 0 else 1
    aspect = max(0.5, min(2.0, aspect))
    fig_h = fig_w * aspect

    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    fig.patch.set_alpha(0.0)
    ax.set_facecolor((0, 0, 0, 0))

    # 색상 선택
    fill_color, text_color = COLORS[idx % len(COLORS)]

    # ── 삼각형 그리기 ──
    triangle = plt.Polygon(
        [A, B, C],
        closed=True,
        facecolor=fill_color + "55",  # 반투명
        edgecolor=fill_color,
        linewidth=2.5,
        zorder=2,
    )
    ax.add_patch(triangle)

    # ── 직각 기호 (B 꼭짓점) ──
    # B에서 나오는 두 변의 방향 단위 벡터
    def unit_vec(p, q):
        v = q - p
        n = np.linalg.norm(v)
        return v / n if n > 1e-9 else v

    sq_size = max_dim * 0.055

    if orientation == 0:
        # B=(0,0), 변 BC(→x), 변 BA(→y)
        sq_pts = [
            B + np.array([sq_size, 0]),
            B + np.array([sq_size, sq_size]),
            B + np.array([0, sq_size]),
        ]
    elif orientation == 1:
        # B=(0,0), 변 BC(→x), 변 BA(→y)  [동일]
        sq_pts = [
            B + np.array([sq_size, 0]),
            B + np.array([sq_size, sq_size]),
            B + np.array([0, sq_size]),
        ]
    elif orientation == 2:
        # B=(a,0), 변 BC(→-x), 변 BA(→y)
        sq_pts = [
            B + np.array([-sq_size, 0]),
            B + np.array([-sq_size, sq_size]),
            B + np.array([0, sq_size]),
        ]
    elif orientation == 3:
        # B=(0,b), 변 BC(→x), 변 BA(→-y)
        sq_pts = [
            B + np.array([sq_size, 0]),
            B + np.array([sq_size, -sq_size]),
            B + np.array([0, -sq_size]),
        ]

    sq_patch = plt.Polygon(
        sq_pts,
        closed=True,
        facecolor="none",
        edgecolor=fill_color,
        linewidth=2.0,
        zorder=3,
    )
    ax.add_patch(sq_patch)

    # ── 꼭짓점 레이블 (A, B, C) ──
    vert_offset = max_dim * 0.12
    font_size = max(9, min(15, int(120 / max_dim)))

    def vertex_label(ax, point, label, ref_center, size, color):
        """꼭짓점에서 삼각형 중심 반대 방향으로 레이블 배치"""
        center = (A + B + C) / 3
        direction = point - center
        norm = np.linalg.norm(direction)
        if norm > 1e-9:
            direction = direction / norm
        offset = direction * vert_offset * 1.3
        ax.text(
            point[0] + offset[0], point[1] + offset[1],
            label,
            fontsize=size + 2,
            fontweight="bold",
            ha="center", va="center",
            color=color,
            zorder=5,
        )

    vertex_label(ax, A, "A", (A+B+C)/3, font_size, text_color)
    vertex_label(ax, B, "B", (A+B+C)/3, font_size, text_color)
    vertex_label(ax, C, "C", (A+B+C)/3, font_size, text_color)

    # ── 변의 길이 레이블 ──
    # BC = a (tri["label_a"]), AB = b (tri["label_b"]), AC = c (tri["label_c"])
    side_font = max(8, min(12, int(100 / max_dim)))

    def side_label(ax, p1, p2, label_str, center_tri, offset_mul=0.15):
        mid = (p1 + p2) / 2
        center = center_tri
        # 변의 법선 방향 (삼각형 바깥쪽)
        direction = mid - center
        norm = np.linalg.norm(direction)
        if norm > 1e-9:
            direction = direction / norm
        offset = direction * max_dim * offset_mul
        # LaTeX 변환
        disp = label_str
        has_sqrt = "√" in disp
        if has_sqrt:
            disp = disp.replace("√3", r"$\sqrt{3}$").replace("√2", r"$\sqrt{2}$")

        ax.text(
            mid[0] + offset[0], mid[1] + offset[1],
            disp,
            fontsize=side_font + 1,
            ha="center", va="center",
            color="#1A1A2E",
            fontweight="bold",
            bbox=dict(
                boxstyle="round,pad=0.25",
                facecolor="white",
                edgecolor=fill_color,
                alpha=0.88,
                linewidth=1.2,
            ),
            zorder=6,
        )

    center = (A + B + C) / 3
    # BC: label_a
    side_label(ax, B, C, tri["label_a"], center)
    # AB: label_b
    side_label(ax, A, B, tri["label_b"], center)
    # AC (빗변): label_c
    side_label(ax, A, C, tri["label_c"], center)

    # ── 축 설정 ──
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)
    ax.set_aspect("equal")
    ax.axis("off")

    # ── 저장 ──
    filename = f"triangle_{idx+1:03d}.png"
    filepath = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(
        filepath,
        dpi=150,
        transparent=True,
        bbox_inches="tight",
        pad_inches=0.1,
    )
    plt.close(fig)
    return filepath


# ─────────────────────────────────────────────────────────────────────────────
# 3. 메인 실행
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("직각삼각형 이미지 100개 생성 시작")
    print(f"출력 경로: {OUTPUT_DIR}")
    print("=" * 60)

    triangles = build_triangle_list()
    assert len(triangles) >= 100, f"삼각형 데이터 부족: {len(triangles)}개"

    # 방향 다양성 패턴 (0~3 순환)
    orientations = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1]

    generated = []
    errors = []

    for i, tri in enumerate(triangles[:100]):
        orient = orientations[i % len(orientations)]
        try:
            fp = draw_triangle(tri, i, orientation=orient)
            generated.append(fp)
            if (i + 1) % 10 == 0:
                print(f"  [{i+1:3d}/100] 완료 — {os.path.basename(fp)}")
        except Exception as e:
            errors.append((i + 1, str(e)))
            print(f"  [{i+1:3d}/100] 오류: {e}")

    # ── 검증 ──
    print("\n" + "=" * 60)
    print("검증 결과")
    print("=" * 60)
    existing = sorted([f for f in os.listdir(OUTPUT_DIR) if f.endswith(".png")])
    print(f"생성된 PNG 파일 수: {len(existing)}")
    if errors:
        print(f"오류 발생 항목: {len(errors)}개")
        for idx, msg in errors:
            print(f"  - triangle_{idx:03d}: {msg}")
    else:
        print("오류 없음 ✓")

    # 파일 크기 체크
    total_size = 0
    for fname in existing:
        fpath = os.path.join(OUTPUT_DIR, fname)
        sz = os.path.getsize(fpath)
        total_size += sz
        if sz < 1000:
            print(f"  경고: {fname} 크기가 너무 작음 ({sz} bytes)")

    print(f"총 파일 크기: {total_size / 1024:.1f} KB")
    print(f"평균 파일 크기: {total_size / max(len(existing),1) / 1024:.1f} KB")
    print("\n[완료] 생성 성공!")
    print(f"폴더: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
