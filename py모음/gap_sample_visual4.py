"""
gap_sample_visual4.py
5 cases + 1 unclassified type visualization.
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

SFONT = 24
FIG_S = 5.5
SPAN  = 5.0
PX    = (FIG_S / SPAN) * 100   # 110 px / data_unit @ 100DPI

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

# ── Case definitions (unit: px) ───────────────────────────────────────────────
CASE_CFG = {
    'case1': dict(L=8,  R=8,  T=13, B=4,
                  color='#1E90FF',
                  desc='Case1: 1-digit integer  (e.g. 1, 2)'),
    'case4': dict(L=11, R=11, T=13, B=4,
                  color='#00BFFF',
                  desc='Case4: 2-digit integer  (e.g. 12, 15)'),
    'case2': dict(L=22, R=29, T=26, B=15,
                  color='#2ECC71',
                  desc='Case2: root(1-digit)  (e.g. root5, root3)'),
    'case5': dict(L=22, R=33, T=26, B=15,
                  color='#27AE60',
                  desc='Case5: root(2-digit)  (e.g. root10, root13)'),
    'case3': dict(L=28, R=34, T=26, B=15,
                  color='#9B59B6',
                  desc='Case3: n*root(1-digit)  (e.g. 2root5, 3root2)'),
    'caseX': dict(L=28, R=34, T=26, B=15,
                  color='#E74C3C',
                  desc='UNCLASSIFIED: n*root(2-digit)  (e.g. 2root10) - needs Case6?'),
}

# ── Labels to display (one representative per case) ───────────────────────────
LABELS = [
    ('$1$',            '1',         'case1', '1-digit int'),
    ('$12$',           '12',        'case4', '2-digit int'),
    ('$\\sqrt{5}$',    'root5',     'case2', 'root(1d)'),
    ('$\\sqrt{10}$',   'root10',    'case5', 'root(2d)'),
    ('$2\\sqrt{5}$',   '2root5',    'case3', 'n*root(1d)'),
    ('$2\\sqrt{10}$',  '2root10',   'caseX', 'n*root(2d)\n[unclassified?]'),
]

# ── Build rows ────────────────────────────────────────────────────────────────
rows = []
for latex, name, case_key, note in LABELS:
    nc, hw, hh = hw_hh(latex)
    cfg = CASE_CFG[case_key]
    rows.append(dict(
        latex=latex, name=name, case=case_key, note=note, cfg=cfg,
        nc=nc, hw=hw, hh=hh,
        EL=hw + cfg['L'] / PX,
        ER=hw + cfg['R'] / PX,
        ET=hh + cfg['T'] / PX,
        EB=hh + cfg['B'] / PX,
    ))

# ── Print table ───────────────────────────────────────────────────────────────
print(f"\n{'Label':<10} {'Case':<7} {'nc':>4} {'hw':>7} {'hh':>7} "
      f"{'EL':>6} {'ER':>6} {'ET':>6} {'EB':>6}   (data_unit, span={SPAN})")
print("-"*68)
for r in rows:
    print(f"{r['name']:<10} {r['case']:<7} {r['nc']:>4.1f} "
          f"{r['hw']:>7.3f} {r['hh']:>7.3f} "
          f"{r['EL']:>6.3f} {r['ER']:>6.3f} {r['ET']:>6.3f} {r['EB']:>6.3f}")
print(f"\nScale: 1 data_unit = {PX:.0f} px  @100DPI")

# ── Visualization ─────────────────────────────────────────────────────────────
n       = len(rows)
PANEL_W = 3.4
VIEW_X  = 1.05
VIEW_Y  = 0.75

ratio       = (PANEL_W / (2 * VIEW_X)) / (FIG_S / SPAN)
render_font = max(7, int(SFONT * ratio))

fig, axes = plt.subplots(1, n, figsize=(PANEL_W * n, 6.5), facecolor='#E5E5E5')
fig.subplots_adjust(wspace=0.50, top=0.85, bottom=0.14)

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
    col = r['cfg']['color']
    cfg = r['cfg']

    # ① Asymmetric excl box
    ax.add_patch(patches.Rectangle(
        (-EL, -EB), EL + ER, EB + ET,
        facecolor=col, edgecolor=col,
        linewidth=2.4, alpha=0.22, zorder=1
    ))
    ax.add_patch(patches.Rectangle(
        (-EL, -EB), EL + ER, EB + ET,
        facecolor='none', edgecolor=col,
        linewidth=2.4, zorder=3
    ))

    # ② Orange hw x hh box
    ax.add_patch(patches.Rectangle(
        (-hw, -hh), 2 * hw, 2 * hh,
        facecolor='#FFE0A0', edgecolor='darkorange',
        linewidth=2.0, alpha=0.90, zorder=2
    ))

    # ③ Label text
    ax.text(0, 0, r['latex'], ha='center', va='center',
            fontsize=render_font, zorder=5, color='#111')

    ax.axhline(0, color='#ccc', lw=0.4, zorder=0)
    ax.axvline(0, color='#ccc', lw=0.4, zorder=0)

    title_str = f"{r['name']}\n[{r['case']}]  {r['note']}"
    ax.set_title(title_str, fontsize=8.0, fontweight='bold', pad=4, color=col)

    # ── Clearance arrows (top row: clr_L navy, clr_R crimson) ────────────────
    y_arr = ET + 0.048
    ax.annotate('', xy=(-hw, y_arr), xytext=(-EL, y_arr),
                arrowprops=dict(**ARROW, color='navy'))
    ax.text((-EL - hw) / 2, y_arr + 0.018,
            f'L={cfg["L"]}px', ha='center', va='bottom', color='navy', **TEXT)

    ax.annotate('', xy=(ER, y_arr), xytext=(hw, y_arr),
                arrowprops=dict(**ARROW, color='crimson'))
    ax.text((hw + ER) / 2, y_arr + 0.018,
            f'R={cfg["R"]}px', ha='center', va='bottom', color='crimson', **TEXT)

    # ── Clearance arrows (right col: clr_T crimson, clr_B navy) ──────────────
    xT = ER + 0.055
    xB = ER + 0.180
    ax.annotate('', xy=(xT, ET), xytext=(xT, hh),
                arrowprops=dict(**ARROW, color='crimson'))
    ax.text(xT + 0.018, (hh + ET) / 2,
            f'T={cfg["T"]}px', ha='left', va='center', color='crimson', **TEXT)

    ax.annotate('', xy=(xB, -hh), xytext=(xB, -EB),
                arrowprops=dict(**ARROW, color='navy'))
    ax.text(xB + 0.018, -(hh + EB) / 2,
            f'B={cfg["B"]}px', ha='left', va='center', color='navy', **TEXT)

    # ── hw / hh dimension lines (orange) ─────────────────────────────────────
    y_hw = -EB - 0.055
    ax.annotate('', xy=(hw, y_hw), xytext=(-hw, y_hw),
                arrowprops=dict(**ARROW, color='darkorange'))
    ax.text(0, y_hw - 0.022, f'hw={hw:.3f}',
            ha='center', va='top', color='darkorange', fontsize=5.5, fontweight='bold')

    x_hh = -EL - 0.060
    ax.annotate('', xy=(x_hh, hh), xytext=(x_hh, -hh),
                arrowprops=dict(**ARROW, color='darkorange'))
    ax.text(x_hh - 0.018, 0, f'hh\n{hh:.3f}',
            ha='right', va='center', color='darkorange', fontsize=5.5, fontweight='bold')

    ax.set_xticks([])
    ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_edgecolor('#bbb')

# ── Legend ────────────────────────────────────────────────────────────────────
fig.legend(handles=[
    Patch(facecolor='#1E90FF', edgecolor='#1E90FF', alpha=0.6,
          label='Case1: 1-digit int    (L8/R8/T13/B4)'),
    Patch(facecolor='#00BFFF', edgecolor='#00BFFF', alpha=0.6,
          label='Case4: 2-digit int    (L11/R11/T13/B4)'),
    Patch(facecolor='#2ECC71', edgecolor='#2ECC71', alpha=0.6,
          label='Case2: root(1-digit)  (L22/R29/T26/B15)'),
    Patch(facecolor='#27AE60', edgecolor='#27AE60', alpha=0.6,
          label='Case5: root(2-digit)  (L22/R33/T26/B15)'),
    Patch(facecolor='#9B59B6', edgecolor='#9B59B6', alpha=0.6,
          label='Case3: n*root(1-digit)(L28/R34/T26/B15)'),
    Patch(facecolor='#E74C3C', edgecolor='#E74C3C', alpha=0.6,
          label='UNCLASSIFIED: n*root(2-digit) -- needs Case6?'),
    Patch(facecolor='#FFE0A0', edgecolor='darkorange',
          label='hw x hh  (estimated label bounding box)'),
], loc='lower center', ncol=4, fontsize=7.5,
   framealpha=0.95, bbox_to_anchor=(0.5, 0.00))

fig.suptitle(
    'Gap Sample v4  -  5 cases + 1 unclassified  |  4-directional clearance\n'
    f'span={SPAN},  scale={PX:.0f}px/data_unit  @100DPI  |  '
    'navy=Left/Bottom   crimson=Right/Top',
    fontsize=10, fontweight='bold', y=0.97, color='#111'
)

OUT = r'C:\Users\user\Documents\삼각비 게임1\triangles4\gap_sample_visual4.png'
plt.savefig(OUT, dpi=130, bbox_inches='tight')
plt.close()
print(f"\nSaved -> {OUT}")
