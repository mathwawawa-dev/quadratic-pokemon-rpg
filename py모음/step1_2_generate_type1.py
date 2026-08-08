# -*- coding: utf-8 -*-
"""
STEP 1-2: 유형 ① 이미지 생성 (세 변 모두 표기)
=========================================================
triangle_data.json (25가지 삼각형 조합) ×
4가지 방향 템플릿 × 최대 2가지 변형(등변 제외)
= 최대 180개 PNG → triangles4/type1/

동시에 data/type1_metadata.json 생성 (STEP 1-4 questions.json 생성에 사용)

[4가지 방향 템플릿]
  tmpl 1: A 상좌 / B 하좌(직각) / C 하우
  tmpl 2: A 상우 / B 하좌       / C 하우(직각)
  tmpl 3: A 하좌 / B 상우       / C 상좌(직각)
  tmpl 4: A 하우 / B 상우(직각) / C 상좌

[변형]
  variant 'a': leg1 수평, leg2 수직
  variant 'b': leg2 수평, leg1 수직 (등변삼각형은 'a' 만 생성)
"""

import json, math, os, sys, importlib.util, time

# ── 경로 설정 ─────────────────────────────────────────────────────────────────
PY_DIR   = os.path.dirname(os.path.abspath(__file__))          # py모음/
ROOT     = os.path.dirname(PY_DIR)                              # 삼각비 게임1/
TYPE1_DIR = os.path.join(ROOT, 'triangles4', 'type1')
os.makedirs(TYPE1_DIR, exist_ok=True)

# ── draw() 함수 import (기존 v1.0.2 스크립트에서 재사용) ──────────────────────
_base_script = os.path.join(PY_DIR, 'v1.0.2_260808_1536_triangles4변경.py')
spec = importlib.util.spec_from_file_location('tri_draw', _base_script)
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)   # matplotlib rcParams 등 설정도 함께 로드됨
mod.OUTPUT_DIR = TYPE1_DIR     # 출력 폴더를 type1/ 으로 override
draw = mod.draw

# ── 삼각형 데이터 로드 ────────────────────────────────────────────────────────
with open(os.path.join(ROOT, 'data', 'triangle_data.json'), encoding='utf-8') as f:
    triangles = json.load(f)

# ── 방향 템플릿 팩토리 ────────────────────────────────────────────────────────
# p: 수평 leg, q: 수직 leg
# 반환: (verts, right_v, side_labels, vertex_label_rotations, extra_kwargs)
#
# [검증] 각 템플릿 CCW 확인 (p=3, q=4, hyp=5 기준):
#   tmpl1: A(0,4) B(0,0) C(3,0) → signed_area = +6 ✓
#   tmpl2: A(3,4) B(0,0) C(3,0) → signed_area = +6 ✓
#   tmpl3: A(0,0) B(3,4) C(0,4) → signed_area = +6 ✓
#   tmpl4: A(3,0) B(3,4) C(0,4) → signed_area = +6 ✓

def make_orient(tmpl, p, q, p_lbl, q_lbl, h_lbl):
    if tmpl == 1:
        # AB=q(수직leg), BC=p(수평leg), CA=hyp
        return (
            {'A': (0, q), 'B': (0, 0), 'C': (p, 0)},
            'B',
            {'AB': q_lbl, 'BC': p_lbl, 'CA': h_lbl},
            {'A': -10},
            {'side_gap_factors': {'CA': 1.6}}   # 빗변 라벨 gap 확대
        )
    elif tmpl == 2:
        # AB=hyp, BC=p(수평leg), CA=q(수직leg)
        return (
            {'A': (p, q), 'B': (0, 0), 'C': (p, 0)},
            'C',
            {'AB': h_lbl, 'BC': p_lbl, 'CA': q_lbl},
            {'A': 10},
            {'side_gap_factors': {'AB': 1.6}}   # 빗변 라벨 gap 확대
        )
    elif tmpl == 3:
        # AB=hyp, BC=p(수평leg,상단), CA=q(수직leg)
        # BC 라벨: arc_peak ≈ 0.28*(Lmin/p)^0.3*p = 0.28*Lmin^0.3*p^0.7
        # 오프셋 = -0.15 * arc_peak ≈ -0.042 * min(p,q)^0.3 * p^0.7  (약 85% 위치)
        _off3 = -0.042 * min(p, q) ** 0.3 * p ** 0.7
        return (
            {'A': (0, 0), 'B': (p, q), 'C': (0, q)},
            'C',
            {'AB': h_lbl, 'BC': p_lbl, 'CA': q_lbl},
            {'A': 12},
            {'side_label_offsets': {'BC': (0, _off3)}, 'side_gap_factors': {'AB': 1.6}}
        )
    elif tmpl == 4:
        # AB=q(수직leg), BC=p(수평leg,상단), CA=hyp
        # 동일 공식 적용
        _off4 = -0.042 * min(p, q) ** 0.3 * p ** 0.7
        return (
            {'A': (p, 0), 'B': (p, q), 'C': (0, q)},
            'B',
            {'AB': q_lbl, 'BC': p_lbl, 'CA': h_lbl},
            {'A': -12},
            {'side_label_offsets': {'BC': (0, _off4)}, 'side_gap_factors': {'CA': 1.6}}
        )

# ── 이미지 생성 루프 ──────────────────────────────────────────────────────────
metadata = []
count    = 0
t_start  = time.time()

for t in triangles:
    tid   = t['id']
    l1v   = t['leg1_val']
    l2v   = t['leg2_val']
    hv    = t['hyp_val']
    l1lb  = t['leg1_label']
    l2lb  = t['leg2_label']
    hlb   = t['hyp_label']
    cat   = t['category']
    is_iso = math.isclose(l1v, l2v, rel_tol=1e-9)

    # 변형 목록: 등변삼각형은 'a' 하나만
    variants = [('a', l1v, l2v, l1lb, l2lb)]
    if not is_iso:
        variants.append(('b', l2v, l1v, l2lb, l1lb))

    for var, p, q, p_lbl, q_lbl in variants:
        for tmpl in [1, 2, 3, 4]:
            verts, rv, slabels, rot, extra = make_orient(tmpl, p, q, p_lbl, q_lbl, hlb)
            fname = f"tri_{tid}_{tmpl}{var}.png"

            draw(
                verts,
                right_v=rv,
                side_labels=slabels,
                filename=fname,
                vertex_label_rotations=rot,
                gap_factor=0.9,
                **extra
            )

            # 각 변의 실수 길이 기록 (STEP 1-4용)
            # tmpl 1,4: AB=q, BC=p, CA=hyp
            # tmpl 2,3: AB=hyp, BC=p, CA=q
            if tmpl in [1, 4]:
                side_len = {'AB': q, 'BC': p, 'CA': hv}
            else:
                side_len = {'AB': hv, 'BC': p, 'CA': q}

            metadata.append({
                'filename':     fname,
                'triangle_id':  tid,
                'category':     cat,
                'template':     tmpl,
                'variant':      var,
                'right_vertex': rv,
                'image_type':   1,
                'side_lengths': side_len,
                'side_labels':  slabels,
            })

            count += 1
            elapsed = time.time() - t_start
            print(f"  [{count:3d}] {fname}  ({elapsed:.1f}s)")

# ── 메타데이터 저장 ───────────────────────────────────────────────────────────
meta_path = os.path.join(ROOT, 'data', 'type1_metadata.json')
with open(meta_path, 'w', encoding='utf-8') as f:
    json.dump(metadata, f, ensure_ascii=False, indent=2)

print(f"\n{'='*55}")
print(f"✅ 완료: {count}개 이미지 → triangles4/type1/")
print(f"   메타데이터  → data/type1_metadata.json")
print(f"   총 소요시간 : {time.time() - t_start:.1f}초")
