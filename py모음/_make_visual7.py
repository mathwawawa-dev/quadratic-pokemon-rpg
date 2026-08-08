import shutil, re

src = open('gap_sample_visual6.py', encoding='utf-8').read()

# Update values
replacements = [
    ("'case1': dict(L=7,  R=7,  T=13, B=4,",  "'case1': dict(L=8,  R=8,  T=13, B=4,"),
    ("'case2': dict(L=13, R=13, T=13, B=4,",  "'case2': dict(L=13, R=13, T=13, B=4,"),   # unchanged
    ("'case3': dict(L=22, R=29, T=27, B=15,", "'case3': dict(L=24, R=30, T=27, B=15,"),
    ("'case4': dict(L=26, R=34, T=27, B=15,", "'case4': dict(L=29, R=34, T=27, B=15,"),
    ("'case5': dict(L=31, R=34, T=26, B=15,", "'case5': dict(L=34, R=35, T=26, B=15,"),
    ("'case6': dict(L=32, R=39, T=27, B=15,", "'case6': dict(L=36, R=39, T=27, B=15,"),
    # legend
    ("label='Case1: 1-digit int      L7/R7/T13/B4'",   "label='Case1: 1-digit int      L8/R8/T13/B4'"),
    ("label='Case2: 2-digit int      L13/R13/T13/B4'", "label='Case2: 2-digit int      L13/R13/T13/B4'"),  # unchanged
    ("label='Case3: root(1-digit)    L22/R29/T27/B15'","label='Case3: root(1-digit)    L24/R30/T27/B15'"),
    ("label='Case4: root(2-digit)    L26/R34/T27/B15'","label='Case4: root(2-digit)    L29/R34/T27/B15'"),
    ("label='Case5: n*root(1-digit)  L31/R34/T26/B15'","label='Case5: n*root(1-digit)  L34/R35/T26/B15'"),
    ("label='Case6: n*root(2-digit)  L32/R39/T27/B15'","label='Case6: n*root(2-digit)  L36/R39/T27/B15'"),
    # output path and title
    ("gap_sample_visual6.png", "gap_sample_visual7.png"),
    ("Gap Sample v6", "Gap Sample v7"),
]

for old, new in replacements:
    src = src.replace(old, new)

open('gap_sample_visual7.py', 'w', encoding='utf-8').write(src)
print('Done')
