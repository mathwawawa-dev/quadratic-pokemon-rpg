"""
gap_sample_visual6.py - 6 cases (REDEFINED), all text English
Case definitions (new):
  case1: 1-digit integer  (1, 2, 3)
  case2: 2-digit integer  (12, 22)
  case3: root(1-digit)    (root5, root3)
  case4: root(2-digit)    (root11, root23)
  case5: n*root(1-digit)  (2root5, 3root3)
  case6: n*root(2-digit)  (2root11, 3root23)
"""
import re
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Patch

plt.rcParams.update({'mathtext.fontset': 'cm', 'font.family': 'serif', 'text.usetex': False})

SFONT = 24
FIG_S = 5.5
SPAN  = 5.0
PX    = (FIG_S / SPAN) * 100   # 110 px/data_unit @100DPI

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

# ── Case definitions (NEW numbering, unit: px) ────────────────────────────────
CASE_CFG = {
    'case1': dict(L=8,  R=8,  T=13, B=4,
                  color='#1E90FF',
                  desc='Case1: 1-digit int  (1,2,3)'),
    'case2': dict(L=13, R=13, T=13, B=4,
                  color='#00BFFF',
                  desc='Case2: 2-digit int  (12,22)'),
    'case3': dict(L=24, R=30, T=27, B=15,
                  color='#2ECC71',
                  desc='Case3: root(1d)  (root5,root3)'),
    'case4': dict(L=29, R=34, T=27, B=15,
                  color='#27AE60',
                  desc='Case4: root(2d)  (root11,root23)'),
    'case5': dict(L=34, R=35, T=26, B=15,
                  color='#9B59B6',
                  desc='Case5: n*root(1d)  (2root5,3root3)'),
    'case6': dict(L=36, R=39, T=27, B=15,
                  color='#E67E22',
                  desc='Case6: n*root(2d)  (2root11,3root23)'),
}

# ── Representative labels ─────────────────────────────────────────────────────
LABELS = [
    ('$1$',            '1',        'case1'),
    ('$12$',           '12',       'case2'),
    ('$\\sqrt{5}$',    'root5',    'case3'),
    ('$\\sqrt{10}$',   'root10',   'case4'),
    ('$2\\sqrt{5}$',   '2root5',   'case5'),
    ('$2\\sqrt{10}$',  '2root10',  'case6'),
]

rows = []
for latex, name, ck in LABELS:
    nc, hw, hh = hw_hh(latex)
    cfg = CASE_CFG[ck]
    rows.append(dict(
        latex=latex, name=name, case=ck, cfg=cfg, nc=nc, hw=hw, hh=hh,
        EL=hw + cfg['L'] / PX, ER=hw + cfg['R'] / PX,
        ET=hh + cfg['T'] / PX, EB=hh + cfg['B'] / PX,
    ))

# ── Print table ───────────────────────────────────────────────────────────────
print(f"\n{'Label':<10} {'Case':<7} {'nc':>4} {'hw(du)':>7} {'hh(du)':>7} "
      f"{'EL':>6} {'ER':>6} {'ET':>6} {'EB':>6}")
print("-"*65)
for r in rows:
    print(f"{r['name']:<10} {r['case']:<7} {r['nc']:>4.1f} "
          f"{r['hw']:>7.3f} {r['hh']:>7.3f} "
          f"{r['EL']:>6.3f} {r['ER']:>6.3f} {r['ET']:>6.3f} {r['EB']:>6.3f}")
print(f"\nScale: {PX:.0f} px/data_unit  @100DPI, span={SPAN}")

# ── Visualization ─────────────────────────────────────────────────────────────
n = len(rows)
PANEL_W = 3.4
VIEW_X  = 1.10
VIEW_Y  = 0.78

ratio       = (PANEL_W / (2 * VIEW_X)) / (FIG_S / SPAN)
render_font = max(7, int(SFONT * ratio))

fig, axes = plt.subplots(1, n, figsize=(PANEL_W * n, 6.6), facecolor='#E5E5E5')
fig.subplots_adjust(wspace=0.50, top=0.84, bottom=0.13)

AR = dict(arrowstyle='<->', lw=1.3)
TX = dict(fontsize=5.8, fontweight='bold')

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

    # ① Excl box (filled + border)
    ax.add_patch(patches.Rectangle((-EL,-EB), EL+ER, EB+ET,
        facecolor=col, edgecolor=col, linewidth=2.4, alpha=0.22, zorder=1))
    ax.add_patch(patches.Rectangle((-EL,-EB), EL+ER, EB+ET,
        facecolor='none', edgecolor=col, linewidth=2.4, zorder=3))

    # ③ Label text
    ax.text(0, 0, r['latex'], ha='center', va='center',
            fontsize=render_font, zorder=5, color='#111')
    ax.axhline(0, color='#ccc', lw=0.4, zorder=0)
    ax.axvline(0, color='#ccc', lw=0.4, zorder=0)
    ax.set_title(f"{r['name']}\n[{r['case']}] {cfg['desc']}",
                 fontsize=8.0, fontweight='bold', pad=4, color=col)

    # ── Top arrows: clr_L (navy) | clr_R (crimson) ───────────────────────────
    ya = ET + 0.050
    ax.annotate('', xy=(-hw,ya), xytext=(-EL,ya), arrowprops=dict(**AR, color='navy'))
    ax.text((-EL-hw)/2, ya+0.020, f'L={cfg["L"]}px',
            ha='center', va='bottom', color='navy', **TX)
    ax.annotate('', xy=(ER,ya), xytext=(hw,ya), arrowprops=dict(**AR, color='crimson'))
    ax.text((hw+ER)/2, ya+0.020, f'R={cfg["R"]}px',
            ha='center', va='bottom', color='crimson', **TX)

    # ── Right arrows: clr_T (crimson) | clr_B (navy) ─────────────────────────
    xT = ER + 0.055
    xB = ER + 0.190
    ax.annotate('', xy=(xT,ET), xytext=(xT,hh), arrowprops=dict(**AR, color='crimson'))
    ax.text(xT+0.018, (hh+ET)/2, f'T={cfg["T"]}px',
            ha='left', va='center', color='crimson', **TX)
    ax.annotate('', xy=(xB,-hh), xytext=(xB,-EB), arrowprops=dict(**AR, color='navy'))
    ax.text(xB+0.018, -(hh+EB)/2, f'B={cfg["B"]}px',
            ha='left', va='center', color='navy', **TX)

    ax.set_xticks([]); ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_edgecolor('#bbb')

# ── Legend ────────────────────────────────────────────────────────────────────
fig.legend(handles=[
    Patch(facecolor='#1E90FF', edgecolor='#1E90FF', alpha=0.7,
          label='Case1: 1-digit int      L8/R8/T13/B4'),
    Patch(facecolor='#00BFFF', edgecolor='#00BFFF', alpha=0.7,
          label='Case2: 2-digit int      L13/R13/T13/B4'),
    Patch(facecolor='#2ECC71', edgecolor='#2ECC71', alpha=0.7,
          label='Case3: root(1-digit)    L24/R30/T27/B15'),
    Patch(facecolor='#27AE60', edgecolor='#27AE60', alpha=0.7,
          label='Case4: root(2-digit)    L29/R34/T27/B15'),
    Patch(facecolor='#9B59B6', edgecolor='#9B59B6', alpha=0.7,
          label='Case5: n*root(1-digit)  L34/R35/T26/B15'),
    Patch(facecolor='#E67E22', edgecolor='#E67E22', alpha=0.7,
          label='Case6: n*root(2-digit)  L36/R39/T27/B15'),
], loc='lower center', ncol=4, fontsize=7.8,
   framealpha=0.95, bbox_to_anchor=(0.5, 0.00))

fig.suptitle(
    'Gap Sample v7-2  -  6 cases (redefined)  |  4-directional asymmetric clearance\n'
    f'span={SPAN},  {PX:.0f}px/data_unit  @100DPI  |  '
    'navy = Left/Bottom     crimson = Right/Top',
    fontsize=10, fontweight='bold', y=0.97, color='#111'
)

OUT = r'C:\Users\user\Documents\삼각비 게임1\triangles4\gap_sample_visual7_2.png'
plt.savefig(OUT, dpi=130, bbox_inches='tight')
plt.close()
print(f"\nSaved -> {OUT}")
