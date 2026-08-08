import importlib.util, re, sys
sys.path.insert(0, '.')

spec = importlib.util.spec_from_file_location(
    'm', 'v1.0.2_260808_1536_triangles4변경.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

tests = [
    ('$1$',             'case1'),
    ('$12$',            'case2'),
    ('$\\sqrt{5}$',     'case3'),
    ('$\\sqrt{10}$',    'case4'),
    ('$2\\sqrt{5}$',    'case5'),
    ('$2\\sqrt{10}$',   'case6'),
    ('$3\\sqrt{3}$',    'case5'),
    ('$3\\sqrt{23}$',   'case6'),
]
all_ok = True
for label, expected in tests:
    result = f"case{m.classify_label_case(label)}"
    ok = result == expected
    all_ok = all_ok and ok
    print(f"{'OK' if ok else 'FAIL'}  {label!r:20s} -> {result}  (expected {expected})")

print('\nAll OK!' if all_ok else '\nSome FAILED!')
