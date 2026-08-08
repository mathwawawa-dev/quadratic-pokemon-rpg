# 직각삼각형 이미지 생성 로직 문서
`generate_triangles2.py` — 교과서 스타일 직각삼각형 PNG 자동 생성기

---

## 1. 출력 규격

| 항목 | 값 |
|---|---|
| 포맷 | PNG, 투명 배경 (transparent=True) |
| DPI | 200 |
| 폰트 (수식) | STIX Bold (mathtext.fontset=stix, mathtext.default=bf) |
| 폰트 (A,B,C 레이블) | Times New Roman, 보통체(non-italic) |
| 출력 폴더 | triangles2/ |

---

## 2. 꼭짓점 명명 규칙

1. **A의 위치**: 삼각형의 **가장 윗부분** 꼭짓점.
   - y좌표가 같은 꼭짓점이 두 개이면 → **가장 아랫부분** 꼭짓점이 A.
2. **A→B→C 순서**: 반드시 **반시계 방향(CCW)**.
   - 외적 검증: `(B-A) × (C-A) > 0`이면 CCW.
3. **직각 꼭짓점**: right_v 파라미터로 지정 ('A', 'B', 'C' 중 하나).

---

## 3. 핵심 함수: bracket_arc(p1, p2, centroid, sagitta_frac, n=120)

변 p1~p2 바깥쪽(무게중심 반대 방향)으로 휘는 원호를 계산합니다.

```
sagitta = sagitta_frac × 변 길이   (호의 최대 높이)
```

### 3-1. 호 곡률 (적응형 sagitta_frac)

```python
sfrac = clip(0.28 × (L_min / L)^0.3, 0.12, 0.28)
```

| 변 종류 | 대략 sfrac |
|---|---|
| 가장 짧은 변 (L_min) | 0.28 (기준) |
| 중간 변 | ~0.23 |
| 가장 긴 변 | ~0.21 |

### 3-2. 호 점 생성 알고리즘

1. 현(chord) 중점(mid) 계산
2. 현에 수직인 방향 perp 계산 (무게중심 반대 방향)
3. sagitta h = sfrac × L
4. 외접원 반지름 R = ((L/2)^2 + h^2) / (2h)
5. 원 중심 C_arc = mid - (R-h) × perp
6. 각도 theta1(p1), theta2(p2), theta_peak 계산
7. peak 포함 CCW 방향으로 120등분
8. 반환: arc_pts [120×2], peak [2]

---

## 4. 변 길이 레이블 (점선 호 + 숫자)

### 4-1. 갭(Gap) 계산

```python
nchars = len(숫자부분) + sqrt기호수 × 1   # \sqrt는 +1 처리

half_w = (폰트크기 × 0.60 × nchars / 72) × span / FIG_S / 2
half_h = (폰트크기 × 1.10 / 72) × span / FIG_S / 2

dash_cycle_data = (7.5pt / 72) × span / FIG_S
excl_r = max(half_w, half_h) × 1.35 + dash_cycle_data × 0.55
```

excl_r 내부 호 점들은 그리지 않아 텍스트 자리를 만듭니다.

### 4-2. 점선 세그먼트 분할

| 구간 | 그리기 방향 | 이유 |
|---|---|---|
| 갭 앞 (v1쪽) | 순방향 (v1→갭) | v1 꼭짓점에서 대시 시작 → 풀 대시 보장 |
| 갭 뒤 (v2쪽) | 역방향 (v2→갭) | v2 꼭짓점 근처 짧은 대시 방지 |

### 4-3. 점선 파라미터

```python
dashes         = (4.5, 3.0)   # on=4.5pt, off=3.0pt
lw             = 1.3
solid_capstyle = 'butt'        # 원형 도트 아티팩트 방지
dash_capstyle  = 'round'
```

---

## 5. 직각 기호

```python
SQ_S = ref_len × 0.058
sp1 = right_v + d1 × SQ_S
sp2 = right_v + d2 × SQ_S
sc  = right_v + d1 × SQ_S + d2 × SQ_S
```

---

## 6. 꼭짓점 레이블 (A, B, C) 위치

```python
VOFF = ref_len × 0.08   # 빗변(AB) 길이의 8%

방향 d = normalize(꼭짓점 - 무게중심)
레이블 위치 = 꼭짓점 + d × VOFF
```

주의: ref_len = |AB|(빗변)가 매우 짧은 삼각형(≈2 이하)은
VOFF가 작아져 레이블이 선에 너무 가까워질 수 있습니다.

---

## 7. 그림 여백 및 레이아웃

```python
ref_len = |AB|
pad     = ref_len × 0.28
span    = max(W, H)
FIG_S   = 5.5 inch
figsize = (FIG_S × W/span, FIG_S × H/span)
```

---

## 8. draw() 함수 시그니처

```python
draw(
    vertices_dict,   # {'A': (x,y), 'B': (x,y), 'C': (x,y)}
    right_v,         # 직각 꼭짓점: 'A' | 'B' | 'C'
    side_labels,     # {'AB': r'$4$', 'BC': r'$2$', 'AC': r'$2\sqrt{5}$'}
    filename,        # 'triangle_001.png'
)
```

- side_labels에 없는 변 → 호/레이블 없음 (빗변 생략 가능)
- 키 순서 무관: 'AB'와 'BA' 둘 다 인식

---

## 9. 좌우대칭 방법

```python
# 원본
{'A': (0, 4), 'B': (0, 0), 'C': (2, 0)}

# 좌우대칭 (x → -x)
{'A': (0, 4), 'B': (0, 0), 'C': (-2, 0)}
```

주의: x 반전은 CCW <-> CW를 바꾸므로 대칭 후 반드시 B↔C 스왑 여부 확인.
검증: (B-A) × (C-A) > 0 이면 CCW

---

## 10. 알려진 제한 사항

- ref_len(빗변) ≈ 2처럼 짧고 삼각형이 매우 납작한 경우,
  VOFF = ref_len × 0.08 = 0.16 이 너무 작아 레이블이 삼각형 선과 가까워짐.
  → 해결책: 해당 삼각형만 span × 0.035 방식의 VOFF 사용 권장.

---

## 11. 의존성

```
matplotlib >= 3.5
numpy
Python 3.8+
Times New Roman 폰트 (시스템 설치)
```
