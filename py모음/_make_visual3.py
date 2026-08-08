import re

content = open('gap_sample_visual2.py', encoding='utf-8').read()

# Update case values
content = content.replace("'case1': dict(L=8,  R=8,  T=14, B=6,",
                           "'case1': dict(L=8,  R=8,  T=14, B=4,")
content = content.replace("'case2': dict(L=11, R=25, T=20, B=9,",
                           "'case2': dict(L=17, R=28, T=22, B=11,")
content = content.replace("'case3': dict(L=18, R=25, T=20, B=9,",
                           "'case3': dict(L=25, R=34, T=22, B=11,")

# Update output file and title
content = content.replace('gap_sample_visual2.png', 'gap_sample_visual3.png')
content = content.replace('Gap Sample v2', 'Gap Sample v3')

# Update legend strings
content = content.replace('Case1 excl box  (L=8 / R=8 / T=14 / B=6 px)',
                           'Case1 excl box  (L=8 / R=8 / T=14 / B=4 px)')
content = content.replace('Case2 excl box  (L=11 / R=25 / T=20 / B=9 px)',
                           'Case2 excl box  (L=17 / R=28 / T=22 / B=11 px)')
content = content.replace('Case3 excl box  (L=18 / R=25 / T=20 / B=9 px)',
                           'Case3 excl box  (L=25 / R=34 / T=22 / B=11 px)')

open('gap_sample_visual3.py', 'w', encoding='utf-8').write(content)
print('Done')
