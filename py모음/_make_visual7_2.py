src = open('gap_sample_visual7.py', encoding='utf-8').read()

# Remove orange hw×hh box block
src = src.replace(
    "    # ② hw×hh orange box\n    ax.add_patch(patches.Rectangle((-hw,-hh), 2*hw, 2*hh,\n        facecolor='#FFE0A0', edgecolor='darkorange', linewidth=2.0, alpha=0.90, zorder=2))\n\n",
    ""
)

# Remove hw/hh dimension lines block
src = src.replace(
    "    # ── hw/hh dimension lines (orange) ───────────────────────────────────────\n    yh = -EB - 0.058\n    ax.annotate('', xy=(hw,yh), xytext=(-hw,yh), arrowprops=dict(**AR, color='darkorange'))\n    ax.text(0, yh-0.022, f'hw={hw:.3f}du',\n            ha='center', va='top', color='darkorange', fontsize=5.5, fontweight='bold')\n\n    xhh = -EL - 0.060\n    ax.annotate('', xy=(xhh,hh), xytext=(xhh,-hh), arrowprops=dict(**AR, color='darkorange'))\n    ax.text(xhh-0.018, 0, f'hh\\n{hh:.3f}du',\n            ha='right', va='center', color='darkorange', fontsize=5.5, fontweight='bold')\n\n",
    ""
)

# Remove legend entry for hw x hh
src = src.replace(
    "    Patch(facecolor='#FFE0A0', edgecolor='darkorange',\n          label='hw x hh  (estimated label bbox)'),\n",
    ""
)

# Update output path and title
src = src.replace('gap_sample_visual7.png', 'gap_sample_visual7_2.png')
src = src.replace('Gap Sample v7', 'Gap Sample v7-2')

open('gap_sample_visual7_2.py', 'w', encoding='utf-8').write(src)
print('Done')
