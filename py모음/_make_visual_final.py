src = open('gap_sample_visual7_2.py', encoding='utf-8').read()

src = src.replace("'case6': dict(L=36, R=39, T=27, B=15,",
                   "'case6': dict(L=38, R=40, T=27, B=15,")
src = src.replace("label='Case6: n*root(2-digit)  L36/R39/T27/B15'",
                   "label='Case6: n*root(2-digit)  L38/R40/T27/B15'")
src = src.replace('gap_sample_visual7_2.png', 'gap_sample_visual_final.png')
src = src.replace('Gap Sample v7-2', 'Gap Sample FINAL (confirmed)')

open('gap_sample_visual_final.py', 'w', encoding='utf-8').write(src)
print('Done')
