"""gap_sample_visual.py - 레이블별 여백 박스 시각화"""
import re
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Patch

plt.rcParams.update({'mathtext.fontset': 'cm', 'font.family': 'serif', 'text.usetex': False})

SFONT      = 24
FIG_S      = 5.5
gap_factor = 1.15
SPAN       = 5.0

def label_char_count(s):
    nsqrt = s.count(r'\sqrt')
    t = re.sub(r'\\[a-zA-Z]+', '', s)
    t = re.sub(r'[\$\{\}]', '', t).strip()
    return max(1, len(t) + nsqrt * 1.5)

def compute_gaps(latex, span=SPAN, side_gf=1.0):
    nc   = label_char_count(latex)
    hw   = (SFONT * 0.60 * nc / 72.0) * span / FIG_S / 2.0
    hh   = (SFONT * 1.10        / 72.0) * span / FIG_S / 2.0
    dash = ((4.5 + 3.0) / 72.0) * span / FIG_S
    erx  = hw * gap_factor * side_gf + dash * 0.55
    ery  = hh * gap_factor * side_gf + dash * 0.55
    return dict(nc=nc, hw=hw, hh=hh, erx=erx, ery=ery)

LABELS = [
    ('$1$',            '1',     1.0),
    ('$2$',            '2',     1.0),
    ('$12$',           '12',    1.0),
    ('$\\sqrt{5}$',    'root5', 1.0),
    ('$2\\sqrt{5}$',   '2root5',1.0),
    ('$\\sqrt{10}$',   'root10',1.0),
    ('$2\\sqrt{10}$',  '2root10',1.0),
]

scale_px = (FIG_S / SPAN) * 100   # px per data_unit @ 100DPI

rows = [(latex, name, sgf, compute_gaps(latex, side_gf=sgf))
        for latex, name, sgf in LABELS]

# ── 수치 출력 ────────────────────────────────────────────────────────────────
print(f"\n{'Label':<10} {'nc':>5} {'hw':>7} {'hh':>7} "
      f"{'excl_rx':>9} {'excl_ry':>9} {'clr_x(px)':>11} {'clr_y(px)':>11}")
print("-"*75)
for latex, name, sgf, g in rows:
    clx = (g['erx'] - g['hw']) * scale_px
    cly = (g['ery'] - g['hh']) * scale_px
    print(f"{name:<10} {g['nc']:>5.1f} {g['hw']:>7.3f} {g['hh']:>7.3f} "
          f"{g['erx']:>9.3f} {g['ery']:>9.3f} {clx:>11.1f} {cly:>11.1f}")

# ── 시각화 ───────────────────────────────────────────────────────────────────
n       = len(rows)
PANEL_W = 3.2
VIEW_X  = 0.80
VIEW_Y  = 0.52

ratio       = (PANEL_W / (2*VIEW_X)) / (FIG_S / SPAN)
render_font = max(7, int(SFONT * ratio))

fig, axes = plt.subplots(1, n, figsize=(PANEL_W * n, 5.2), facecolor='#eeeeee')
fig.subplots_adjust(wspace=0.45, top=0.88, bottom=0.14)

for i, (latex, name, sgf, g) in enumerate(rows):
    ax = axes[i]
    ax.set_facecolor('white')
    ax.set_xlim(-VIEW_X, VIEW_X)
    ax.set_ylim(-VIEW_Y, VIEW_Y)
    ax.set_aspect('equal')

    erx, ery = g['erx'], g['ery']
    hw,  hh  = g['hw'],  g['hh']
    clx_px   = (erx - hw) * scale_px
    cly_px   = (ery - hh) * scale_px

    # ① 하늘색 excl 박스 (배경)
    ax.add_patch(patches.Rectangle(
        (-erx, -ery), 2*erx, 2*ery,
        facecolor='lightskyblue', edgecolor='deepskyblue',
        linewidth=2.0, alpha=0.55, zorder=1
    ))

    # ② 주황색 hw×hh 박스 (채움)
    ax.add_patch(patches.Rectangle(
        (-hw, -hh), 2*hw, 2*hh,
        facecolor='#FFE0A0', edgecolor='darkorange',
        linewidth=2.0, alpha=0.90, zorder=2
    ))

    # ③ 레이블 텍스트
    ax.text(0, 0, latex, ha='center', va='center',
            fontsize=render_font, zorder=5, color='#111')

    ax.axhline(0, color='#ccc', lw=0.4, zorder=0)
    ax.axvline(0, color='#ccc', lw=0.4, zorder=0)
    ax.set_title(name, fontsize=11, fontweight='bold', pad=5)

    # ── 치수선 아래쪽 ──────────────────────────────────────────────
    y1 = -ery - 0.04   # hw 라인
    y2 = -ery - 0.10   # excl_rx 라인

    # hw (주황)
    ax.annotate('', xy=(hw, y1), xytext=(-hw, y1),
                arrowprops=dict(arrowstyle='<->', color='darkorange', lw=1.4))
    ax.text(0, y1 - 0.022, f'hw={hw:.3f}',
            ha='center', va='top', fontsize=6.2, color='darkorange', fontweight='bold')

    # excl_rx (파랑)
    ax.annotate('', xy=(erx, y2), xytext=(-erx, y2),
                arrowprops=dict(arrowstyle='<->', color='steelblue', lw=1.4))
    ax.text(0, y2 - 0.022, f'excl_rx={erx:.3f}',
            ha='center', va='top', fontsize=6.2, color='steelblue', fontweight='bold')

    # ── 치수선 오른쪽 ──────────────────────────────────────────────
    x1 = erx + 0.05   # hh 라인
    x2 = erx + 0.18   # excl_ry 라인

    # hh (주황)
    ax.annotate('', xy=(x1, hh), xytext=(x1, -hh),
                arrowprops=dict(arrowstyle='<->', color='darkorange', lw=1.4))
    ax.text(x1 + 0.018, 0, f'hh\n{hh:.3f}',
            ha='left', va='center', fontsize=5.8, color='darkorange', fontweight='bold')

    # excl_ry (파랑)
    ax.annotate('', xy=(x2, ery), xytext=(x2, -ery),
                arrowprops=dict(arrowstyle='<->', color='steelblue', lw=1.4))
    ax.text(x2 + 0.018, 0, f'excl_ry\n{ery:.3f}',
            ha='left', va='center', fontsize=5.8, color='steelblue', fontweight='bold')

    # ── clr_x (빨강, 상단 오른쪽: hw → excl_rx) ──────────────────
    y_clrx = hh + 0.035
    ax.annotate('', xy=(erx, y_clrx), xytext=(hw, y_clrx),
                arrowprops=dict(arrowstyle='<->', color='crimson', lw=1.3))
    ax.text((erx + hw)/2, y_clrx + 0.016,
            f'clr_x={clx_px:.0f}px',
            ha='center', va='bottom', fontsize=5.8, color='crimson', fontweight='bold')

    # ── clr_y (빨강, 왼쪽: hh → excl_ry) ────────────────────────
    x_clry = -hw - 0.07
    ax.annotate('', xy=(x_clry, ery), xytext=(x_clry, hh),
                arrowprops=dict(arrowstyle='<->', color='crimson', lw=1.3))
    ax.text(x_clry - 0.018, (ery + hh)/2,
            f'clr_y\n={cly_px:.0f}px',
            ha='right', va='center', fontsize=5.8, color='crimson', fontweight='bold')

    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_edgecolor('#bbb')

# 범례
fig.legend(handles=[
    Patch(facecolor='lightskyblue', edgecolor='steelblue', label='excl_rx x excl_ry  (점선 제외 영역)'),
    Patch(facecolor='#FFE0A0',      edgecolor='darkorange', label='hw x hh  (계산상 레이블 크기)'),
    Patch(facecolor='crimson',      edgecolor='crimson',    label='clr_x / clr_y  (실제 공백)'),
], loc='lower center', ncol=3, fontsize=9,
   framealpha=0.95, bbox_to_anchor=(0.5, 0.00))

fig.suptitle(f'Gap Sample  (gap_factor={gap_factor},  span={SPAN},  @100DPI)',
             fontsize=12, fontweight='bold', y=0.96)

OUT = r'C:\Users\user\Documents\삼각비 게임1\triangles4\gap_sample_visual.png'
plt.savefig(OUT, dpi=130, bbox_inches='tight')
plt.close()
print(f"\n저장 완료 → {OUT}")
