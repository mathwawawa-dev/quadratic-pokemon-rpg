"""
STEP 1-1 검증 스크립트
triangle_data.json의 피타고라스 정리 a² + b² = c² 자동 검증
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "data", "triangle_data.json")

with open(DATA_PATH, encoding="utf-8") as f:
    triangles = json.load(f)

print(f"{'ID':<6} {'category':<16} {'leg1':>8} {'leg2':>8} {'hyp':>8}  {'검증':>6}")
print("-" * 60)

all_ok = True
for t in triangles:
    a, b, c = t["leg1_val"], t["leg2_val"], t["hyp_val"]
    lhs = round(a**2 + b**2, 8)
    rhs = round(c**2, 8)
    ok = math.isclose(lhs, rhs, rel_tol=1e-6)
    status = "✅ OK" if ok else "❌ FAIL"
    if not ok:
        all_ok = False
    print(f"{t['id']:<6} {t['category']:<16} {a:>8.4f} {b:>8.4f} {c:>8.4f}  {status}")

print("-" * 60)
print(f"총 {len(triangles)}개  결과: {'✅ 모두 정상' if all_ok else '❌ 오류 있음'}")
