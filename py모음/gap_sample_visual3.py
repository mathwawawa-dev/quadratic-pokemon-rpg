"""
gap_sample_visual2.py
Visualizes proposed 4-directional asymmetric clearance boxes per label case.
All text in English to avoid font issues.
"""
import re
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Patch

plt.rcParams.update({
    'mathtext.fontset': 'cm',
    'font.family': 'serif',
    'text.usetex': False,
})

# ── Base parameters ───────────────────────────────────────────────────────────
SFONT   = 24
FIG_S   = 5.5
SPAN    = 5.0
PX      = (FIG_S / SPAN) * 100   # data_unit → pixel conversion factor (=110 @ 100DPI)
# 1 px = 1/PX data_units

def label_char_count(s):
    nsqrt = s.count(r'\sqrt')
    t = re.sub(r'\\[a-zA-Z]+', '', s)
    t = re.sub(r'[\$\{\}]', '', t).strip()
    return max(1, len(t) + nsqrt * 1.5)

def hw_hh(latex):
    nc = label_char_count(latex)
    hw = (SFONT * 0.60 * nc / 72.0) * SPAN / FIG_S / 2.0
    hh = (SFONT * 1.10        / 72.0) * SPAN / FIG_S / 2.0
    return nc, hw, hh

# ── Proposed clearance per case (unit: px) ────────────────────────────────────
CASE_CFG = {
    'case1': dict(L=8,  R=8,  T=14, B=4,
                  color='#1E90FF', name='Case1: Integer only'),
    'case2': dict(L=17, R=28, T=22, B=11,
                  color='#2ECC71', name='Case2: Root only'),
    'case3': dict(L=25, R=34, T=22, B=11,
                  color='#9B59B6', name='Case3: n x Root'),
}

LABELS = [
    ('$1$',            '1',       'case1'),
    ('$2$',            '2',       'case1'),
    ('$12$',           '12',      'case1'),
    ('$\\sqrt{5}$',    'root5',   'case2'),
    ('$2\\sqrt{5}$',   '2root5',  'case3'),
    ('$\\sqrt{10}$',   'root10',  'case2'),
    ('$2\\sqrt{10}$',  '2root10', 'case3'),
]

# ── Build rows ────────────────────────────────────────────────────────────────
rows = []
for latex, name, case_key in LABELS:
    nc, hw, hh = hw_hh(latex)
    cfg = CASE_CFG[case_key]
    row = dict(
        latex=latex, name=name, case=case_key, cfg=cfg,
        nc=nc, hw=hw, hh=hh,
        EL = hw + cfg['L'] / PX,   # excl boundary: left   of center
        ER = hw + cfg['R'] / PX,   # excl boundary: right  of center
        ET = hh + cfg['T'] / PX,   # excl boundary: top    of center
        EB = hh + cfg['B'] / PX,   # excl boundary: bottom of center
    )
    rows.append(row)

# ── Print numeric table ───────────────────────────────────────────────────────
print(f"\n{'Label':<10} {'Case':<7} {'nc':>4} {'hw(du)':>7} {'hh(du)':>7} "
      f"{'EL':>6} {'ER':>6} {'ET':>6} {'EB':>6}   (du=data unit, span={SPAN})")
print("-"*72)
for r in rows:
    print(f"{r['name']:<10} {r['case']:<7} {r['nc']:>4.1f} "
          f"{r['hw']:>7.3f} {r['hh']:>7.3f} "
          f"{r['EL']:>6.3f} {r['ER']:>6.3f} {r['ET']:>6.3f} {r['EB']:>6.3f}")
print(f"\nScale: 1 data_unit = {PX:.0f} px  @100DPI, span={SPAN}")

# ── Visualization ─────────────────────────────────────────────────────────────
n       = len(rows)
PANEL_W = 3.4   # inches per panel
VIEW_X  = 0.95
VIEW_Y  = 0.70

ratio       = (PANEL_W / (2 * VIEW_X)) / (FIG_S / SPAN)
render_font = max(7, int(SFONT * ratio))

fig, axes = plt.subplots(1, n, figsize=(PANEL_W * n, 6.0), facecolor='#E8E8E8')
fig.subplots_adjust(wspace=0.50, top=0.86, bottom=0.12)

ARROW = dict(arrowstyle='<->', lw=1.3)
TEXT  = dict(fontsize=5.8, fontweight='bold')

for i, r in enumerate(rows):
    ax = axes[i]
    ax.set_facecolor('white')
    ax.set_xlim(-VIEW_X, VIEW_X)
    ax.set_ylim(-VIEW_Y, VIEW_Y)
    ax.set_aspect('equal')

    hw, hh = r['hw'], r['hh']
    EL, ER, ET, EB = r['EL'], r['ER'], r['ET'], r['EB']
    cfg = r['cfg']
    col = cfg['color']

    # ─ (1) Asymmetric excl box (case color, filled + border) ─────────────────
    ax.add_patch(patches.Rectangle(
        (-EL, -EB), EL + ER, EB + ET,
        facecolor=col, edgecolor=col,
        linewidth=2.2, alpha=0.22, zorder=1
    ))
    ax.add_patch(patches.Rectangle(
        (-EL, -EB), EL + ER, EB + ET,
        facecolor='none', edgecolor=col,
        linewidth=2.2, zorder=3
    ))

    # ─ (2) Orange hw x hh box (symmetric label size) ─────────────────────────
    ax.add_patch(patches.Rectangle(
        (-hw, -hh), 2 * hw, 2 * hh,
        facecolor='#FFE0A0', edgecolor='darkorange',
        linewidth=2.0, alpha=0.90, zorder=2
    ))

    # ─ (3) Label text ─────────────────────────────────────────────────────────
    ax.text(0, 0, r['latex'], ha='center', va='center',
            fontsize=render_font, zorder=5, color='#111')

    ax.axhline(0, color='#ccc', lw=0.4, zorder=0)
    ax.axvline(0, color='#ccc', lw=0.4, zorder=0)
    ax.set_title(f"{r['name']}  [{r['case']}]", fontsize=9, fontweight='bold',
                 pad=4, color=col)

    # ─ Clearance arrows ───────────────────────────────────────────────────────
    # TOP ROW: clr_L (navy) and clr_R (crimson) arrows above the box
    y_top_arrow = ET + 0.042
    # clr_L: from -EL to -hw
    ax.annotate('', xy=(-hw, y_top_arrow), xytext=(-EL, y_top_arrow),
                arrowprops=dict(**ARROW, color='navy'))
    ax.text((-EL - hw) / 2, y_top_arrow + 0.018,
            f'clr_L={cfg["L"]}px', ha='center', va='bottom', color='navy', **TEXT)
    # clr_R: from hw to ER
    ax.annotate('', xy=(ER, y_top_arrow), xytext=(hw, y_top_arrow),
                arrowprops=dict(**ARROW, color='crimson'))
    ax.text((hw + ER) / 2, y_top_arrow + 0.018,
            f'clr_R={cfg["R"]}px', ha='center', va='bottom', color='crimson', **TEXT)

    # RIGHT COLUMN: clr_T (crimson) and clr_B (navy) arrows right of the box
    x_right_T = ER + 0.055
    x_right_B = ER + 0.175
    # clr_T: from hh to ET
    ax.annotate('', xy=(x_right_T, ET), xytext=(x_right_T, hh),
                arrowprops=dict(**ARROW, color='crimson'))
    ax.text(x_right_T + 0.018, (hh + ET) / 2,
            f'clr_T\n={cfg["T"]}px', ha='left', va='center', color='crimson', **TEXT)
    # clr_B: from -EB to -hh
    ax.annotate('', xy=(x_right_B, -hh), xytext=(x_right_B, -EB),
                arrowprops=dict(**ARROW, color='navy'))
    ax.text(x_right_B + 0.018, -(hh + EB) / 2,
            f'clr_B\n={cfg["B"]}px', ha='left', va='center', color='navy', **TEXT)

    # ─ hw / hh dimension lines (orange) ──────────────────────────────────────
    # hw: below the box
    y_hw_line = -EB - 0.048
    ax.annotate('', xy=(hw, y_hw_line), xytext=(-hw, y_hw_line),
                arrowprops=dict(**ARROW, color='darkorange'))
    ax.text(0, y_hw_line - 0.022, f'hw={hw:.3f}du',
            ha='center', va='top', color='darkorange', fontsize=5.5, fontweight='bold')

    # hh: left of the box
    x_hh_line = -EL - 0.055
    ax.annotate('', xy=(x_hh_line, hh), xytext=(x_hh_line, -hh),
                arrowprops=dict(**ARROW, color='darkorange'))
    ax.text(x_hh_line - 0.018, 0, f'hh\n{hh:.3f}du',
            ha='right', va='center', color='darkorange', fontsize=5.5, fontweight='bold')

    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_edgecolor('#bbb')

# ── Legend ────────────────────────────────────────────────────────────────────
fig.legend(handles=[
    Patch(facecolor='#1E90FF', edgecolor='#1E90FF', alpha=0.6,
          label='Case1 excl box  (L=8 / R=8 / T=14 / B=4 px)'),
    Patch(facecolor='#2ECC71', edgecolor='#2ECC71', alpha=0.6,
          label='Case2 excl box  (L=17 / R=28 / T=22 / B=11 px)'),
    Patch(facecolor='#9B59B6', edgecolor='#9B59B6', alpha=0.6,
          label='Case3 excl box  (L=25 / R=34 / T=22 / B=11 px)'),
    Patch(facecolor='#FFE0A0', edgecolor='darkorange',
          label='hw x hh  (estimated label bounding box)'),
    Patch(facecolor='navy',    edgecolor='navy',
          label='navy arrow = clr_Left / clr_Bottom'),
    Patch(facecolor='crimson', edgecolor='crimson',
          label='crimson arrow = clr_Right / clr_Top'),
], loc='lower center', ncol=3, fontsize=7.5,
   framealpha=0.95, bbox_to_anchor=(0.5, 0.00))

fig.suptitle(
    'Gap Sample v3  -  Proposed 4-directional asymmetric clearance\n'
    f'span={SPAN},  scale={PX:.0f}px/data_unit  @100DPI',
    fontsize=11, fontweight='bold', y=0.97, color='#111'
)

OUT = r'C:\Users\user\Documents\삼각비 게임1\triangles4\gap_sample_visual3.png'
plt.savefig(OUT, dpi=130, bbox_inches='tight')
plt.close()
print(f"\nSaved -> {OUT}")
