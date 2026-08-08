"""
교과서 스타일 직각삼각형 이미지 생성 v5
────────────────────────────────────────
변경 핵심:
  - 고정 갭(n×20%) 완전 제거
  - 레이블의 실제 문자 폭/높이를 data 좌표로 환산 → 그 반경 안의 호만 제거
    (글자가 좁으면 갭 좁고, 2√5 처럼 넓으면 갭 넓어짐)
  - 호 끝점(꼭짓점 부근)은 갭에 영향 없음 → 빨간 박스 문제 해결
  - 점선 굵기 AW = 1.3 (이전과 동일)
"""
import sys, os, math, re
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

matplotlib.rcParams.update({
    'mathtext.fontset': 'stix',
    'mathtext.default': 'bf',
})

ROOT_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(ROOT_DIR, "triangles2")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
def bracket_arc(p1, p2, centroid, sagitta_frac=0.28, n=120):
    """
    p1~p2 변 바깥쪽으로 휘는 독립 호.
    sagitta = sagitta_frac × chord_length
    반환: (arc_points [n,2], arc_peak [2])
    """
    p1 = np.asarray(p1, dtype=float)
    p2 = np.asarray(p2, dtype=float)
    mid = (p1 + p2) / 2.0
    chord = p2 - p1
    L = np.linalg.norm(chord)

    perp = np.array([-chord[1], chord[0]])
    perp /= np.linalg.norm(perp)
    if np.dot(perp, mid - np.asarray(centroid)) < 0:
        perp = -perp

    h = sagitta_frac * L
    R = ((L / 2.0) ** 2 + h ** 2) / (2.0 * h)
    C = mid - (R - h) * perp

    th1 = math.atan2(p1[1] - C[1], p1[0] - C[0]) % (2 * math.pi)
    th2 = math.atan2(p2[1] - C[1], p2[0] - C[0]) % (2 * math.pi)

    peak = mid + h * perp
    th_pk = math.atan2(peak[1] - C[1], peak[0] - C[0]) % (2 * math.pi)

    def in_ccw(s, e, t):
        if s <= e: return s <= t <= e
        return t >= s or t <= e

    if in_ccw(th1, th2, th_pk):
        start, end = th1, th2
    else:
        start, end = th2, th1
    if start > end:
        end += 2 * math.pi

    thetas = np.linspace(start, end, n)
    arc_pts = np.column_stack([C[0] + R * np.cos(thetas),
                               C[1] + R * np.sin(thetas)])
    return arc_pts, peak


def label_char_count(latex_str):
    """
    LaTeX 수식 문자열의 실질적 '글자 폭' 추정용 문자 수 반환.
    '\\sqrt'는 실제 렌더링 폭을 반영해 +1 처리.
    (이전 +2는 갭이 과도하게 컸음 → 시각적 차이 ~1.5× 반영)
    """
    nsqrt = latex_str.count(r'\sqrt')
    s = re.sub(r'\\[a-zA-Z]+', '', latex_str)
    s = re.sub(r'[\$\{\}]', '', s).strip()
    return max(1, len(s) + nsqrt * 1)


# ─────────────────────────────────────────────────────────────────────────────
def draw(vertices_dict, right_v, side_labels, filename):
    pts = {k: np.array(v, dtype=float) for k, v in vertices_dict.items()}
    centroid = (pts['A'] + pts['B'] + pts['C']) / 3.0

    # 레이블 있는 변들의 길이를 먼저 계산 → L_min 기준 적응형 sagitta_frac
    labeled_lens = [
        np.linalg.norm(pts[v1] - pts[v2])
        for v1, v2 in [('A','B'), ('B','C'), ('C','A')]
        if side_labels.get(v1+v2) or side_labels.get(v2+v1)
    ]
    L_min = min(labeled_lens) if labeled_lens else 1.0

    def adaptive_sfrac(L):
        """
        짧은 변: sagitta_frac=0.28 유지,
        길어질수록 0.3제곱 비례로 완만하게 감소 (0.6의 절반 → 두 이전 상태의 중간).
        clamp: [0.12, 0.28]
        """
        return float(np.clip(0.28 * (L_min / L) ** 0.3, 0.12, 0.28))

    arcs = []
    all_arc_pts = []
    for v1, v2 in [('A','B'), ('B','C'), ('C','A')]:
        lbl = side_labels.get(v1+v2) or side_labels.get(v2+v1)
        if not lbl: continue
        L   = np.linalg.norm(pts[v1] - pts[v2])
        ap, peak = bracket_arc(pts[v1], pts[v2], centroid, adaptive_sfrac(L))
        arcs.append((v1, v2, lbl, ap, peak))
        all_arc_pts.extend(ap.tolist())

    # ref_len = 빗변(가장 긴 변) 길이 → SQ_S·VOFF의 기준값
    # (이전: |AB|. 꼭짓점 명명 규칙 변경 후 AB가 짧은 직각변이 되는 경우 대응)
    sides = [np.linalg.norm(pts['A'] - pts['B']),
             np.linalg.norm(pts['B'] - pts['C']),
             np.linalg.norm(pts['C'] - pts['A'])]
    ref_len = float(max(sides))

    all_np  = np.array([pts['A'], pts['B'], pts['C']] + all_arc_pts)
    pad     = ref_len * 0.28
    xmin, xmax = all_np[:,0].min() - pad, all_np[:,0].max() + pad
    ymin, ymax = all_np[:,1].min() - pad, all_np[:,1].max() + pad
    W, H   = xmax - xmin, ymax - ymin
    span   = max(W, H)
    FIG_S  = 5.5

    fig, ax = plt.subplots(figsize=(FIG_S * W / span, FIG_S * H / span))
    fig.patch.set_alpha(0.0)
    ax.set_facecolor((0, 0, 0, 0))
    ax.set_xlim(xmin, xmax); ax.set_ylim(ymin, ymax)
    ax.set_aspect('equal'); ax.axis('off')

    LW    = 2.8
    SQ_W  = 2.3
    AW    = 1.3          # 점선 굵기
    SQ_S  = ref_len * 0.058
    VOFF  = ref_len * 0.08   # 0.13 → 0.08 (38% 감소, 꼭짓점에 가깝게)
    VFONT = 20
    SFONT = 24

    # ── 삼각형 변
    xs = [pts[v][0] for v in ('A','B','C','A')]
    ys = [pts[v][1] for v in ('A','B','C','A')]
    ax.plot(xs, ys, 'k-', lw=LW,
            solid_capstyle='round', solid_joinstyle='round', zorder=3)

    # ── 직각 기호
    rv_pt = pts[right_v]
    oth   = [x for x in 'ABC' if x != right_v]
    d1 = pts[oth[0]] - rv_pt;  d1 /= np.linalg.norm(d1)
    d2 = pts[oth[1]] - rv_pt;  d2 /= np.linalg.norm(d2)
    sp1 = rv_pt + d1 * SQ_S
    sc  = rv_pt + d1 * SQ_S + d2 * SQ_S
    sp2 = rv_pt + d2 * SQ_S
    ax.plot([sp1[0], sc[0], sp2[0]], [sp1[1], sc[1], sp2[1]],
            'k-', lw=SQ_W, solid_capstyle='round', zorder=4)

    # ── 꼭짓점 레이블
    # VOFF: 꼭짓점에서 레이블까지 거리 = 빗변 길이(ref_len)의 8%
    tnr  = FontProperties(family='Times New Roman',
                          style='normal', weight='normal', size=VFONT)
    VOFF = ref_len * 0.08

    for vname, vp in pts.items():
        d  = vp - centroid
        dn = np.linalg.norm(d)
        if dn > 1e-9: d /= dn
        lpos = vp + d * VOFF
        ax.text(lpos[0], lpos[1], vname, fontproperties=tnr,
                ha='center', va='center', color='black', zorder=5)


    # ── 점선 호 + 레이블 (텍스트 폭 기반 정밀 갭)
    dash_kw = dict(color='black', lw=AW, linestyle='--',
                   dashes=(4.5, 3.0),
                   solid_capstyle='butt',
                   dash_capstyle='round',
                   zorder=2)

    for (v1, v2, label, ap, peak) in arcs:
        n = len(ap)

        # ① 레이블의 실질 문자 수 → 텍스트 폭을 data 좌표로 환산
        nchars = label_char_count(label)
        # 폰트 크기(pt) × 문자당 평균 폭비(0.60) → 인치 → data 단위
        # data 단위 = inch × (span / FIG_S)  [aspect='equal' 보장]
        half_w = (SFONT * 0.60 * nchars / 72.0) * span / FIG_S / 2.0
        half_h = (SFONT * 1.10          / 72.0) * span / FIG_S / 2.0
        # 레이블 주변 제외 반경 (여백 계수 1.35 적용)
        # + 대시 1주기(on+off=7.5pt)의 절반을 data 단위로 추가:
        #   갭 경계가 대시 중간에 걸리면 단편 점이 생기므로 이를 흡수
        dash_cycle_data = ((4.5 + 3.0) / 72.0) * span / FIG_S
        excl_r = max(half_w, half_h) * 1.35 + dash_cycle_data * 0.55

        # ② 호 위 각 점 → peak까지 거리 계산
        dists  = np.linalg.norm(ap - peak, axis=1)
        in_gap = dists < excl_r          # True = 갭 내부 (그리지 않음)

        # ③ 갭 바깥의 연속 구간만 점선으로 그리기
        #    갭 앞 구간(v1쪽): 순방향 → v1 꼭짓점에서 대시 시작 ✓
        #    갭 뒤 구간(v2쪽): 역방향으로 그려 v2 꼭짓점에서 대시 시작 ✓
        #    (끝에서 끝으로 가는 방향이 아닌, 항상 꼭짓점 → 갭 방향)
        segments = []   # (seg_array, is_post_gap)
        seg_start = None
        passed_gap = False
        for i in range(n):
            if not in_gap[i]:
                if seg_start is None:
                    seg_start = i
            else:
                if seg_start is not None and i - seg_start > 1:
                    segments.append((ap[seg_start:i], passed_gap))
                passed_gap = True
                seg_start = None
        if seg_start is not None and n - seg_start > 1:
            segments.append((ap[seg_start:], passed_gap))

        for seg, is_post_gap in segments:
            pts_draw = seg[::-1] if is_post_gap else seg   # 갭 뒤는 역방향
            ax.plot(pts_draw[:, 0], pts_draw[:, 1], **dash_kw)

        # ④ 레이블: 호의 정점(peak) 정중앙
        ax.text(peak[0], peak[1], label,
                fontsize=SFONT, ha='center', va='center',
                color='black', zorder=5)

    out = os.path.join(OUTPUT_DIR, filename)
    plt.savefig(out, dpi=200, transparent=True,
                bbox_inches='tight', pad_inches=0.20)
    plt.close(fig)
    print(f"  Saved: {filename}")


# ─────────────────────────────────────────────────────────────────────────────
def main():
    s5 = math.sqrt(5)
    print("샘플 6개 생성 중 (꼭짓점 규칙 적용)...")

    # ── 001 ──────────────────────────────────────────────────────────────────
    # 최상단: (0,4) → A  /  나머지 (0,0),(2,0): CCW 위해 B=(0,0), C=(2,0)
    # 직각 at B=(0,0) → right_v='B'
    draw(
        {'A': (0, 4), 'B': (0, 0), 'C': (2, 0)},
        right_v='B',
        side_labels={'AB': r'$4$', 'BC': r'$2$', 'AC': r'$2\sqrt{5}$'},
        filename='sample_001.png',
    )

    cx2, cy2 = 1.6 * s5, 0.8 * s5   # ≈ (3.578, 1.789)

    # ── 002 ──────────────────────────────────────────────────────────────────
    # 최상단: (cx2,cy2) → A  /  (0,0),(2√5,0): CCW 위해 B=(0,0), C=(2√5,0)
    # 직각 at A=(cx2,cy2) → right_v='A'
    draw(
        {'A': (cx2, cy2), 'B': (0, 0), 'C': (2 * s5, 0)},
        right_v='A',
        side_labels={'AB': r'$4$', 'AC': r'$2$'},
        filename='sample_002.png',
    )

    # ── 003 ──────────────────────────────────────────────────────────────────
    # 상단 꼭짓점 두 개(y=6) → 최하단 (0,0)이 A
    # A=(0,0): B=(3,6), C=(0,6) → CCW 확인: (3,6)×(0,6)=18>0 ✓
    # 직각 at C=(0,6) → right_v='C'
    draw(
        {'A': (0, 0), 'B': (3, 6), 'C': (0, 6)},
        right_v='C',
        side_labels={'CA': r'$6$', 'CB': r'$3$'},
        filename='sample_003.png',
    )

    # ── 004: 001 좌우대칭 ────────────────────────────────────────────────────
    # 최상단: (0,4) → A  /  (-2,0),(0,0): CCW 확인: (-2,-4)×(0,-4)=8>0 ✓
    # 직각 at C=(0,0) → right_v='C'
    draw(
        {'A': (0, 4), 'B': (-2, 0), 'C': (0, 0)},
        right_v='C',
        side_labels={'AC': r'$4$', 'CB': r'$2$', 'AB': r'$2\sqrt{5}$'},
        filename='sample_004.png',
    )

    # ── 005: 002 좌우대칭 ────────────────────────────────────────────────────
    # 최상단: (-cx2,cy2) → A  /  (-2√5,0),(0,0): CCW 위해 B=(-2√5,0), C=(0,0)
    # 직각 at A=(-cx2,cy2) → right_v='A'
    draw(
        {'A': (-cx2, cy2), 'B': (-2 * s5, 0), 'C': (0, 0)},
        right_v='A',
        side_labels={'AB': r'$2$', 'AC': r'$4$'},
        filename='sample_005.png',
    )

    # ── 006: 003 좌우대칭 ────────────────────────────────────────────────────
    # 상단 꼭짓점 두 개(y=6) → 최하단 (0,0)이 A
    # A=(0,0): (0,6),(−3,6) → CCW 위해 B=(0,6), C=(−3,6)
    # 직각 at B=(0,6) → right_v='B'
    draw(
        {'A': (0, 0), 'B': (0, 6), 'C': (-3, 6)},
        right_v='B',
        side_labels={'AB': r'$6$', 'BC': r'$3$'},
        filename='sample_006.png',
    )

    print("[완료] triangles2/ 폴더에 저장됨")


if __name__ == '__main__':
    main()
