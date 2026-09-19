import itertools, random, sys
from math import lcm

def check(A, M=None):
    a_max = max(A)
    L = 1
    for a in A:
        L = lcm(L, a)
    if M is None:
        M = min(4 * L, 20000) + a_max
    inB = bytearray(M + 1)
    for a in A:
        inB[a::a] = b"\x01" * len(range(a, M + 1, a))
    cnt = 0
    best = None  # minimal density seen so far at n >= a_max: (density, n)
    for x in range(1, M + 1):
        cnt += inB[x]
        if x < a_max:
            continue
        d = cnt / x
        if best is not None and d >= 2 * best[0]:
            return (best[1], x, best[0], d)
        if best is None or d < best[0]:
            best = (d, x)
    return None

random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
# exhaustive over small sets
for size in range(1, 5):
    for A in itertools.combinations(range(2, 26), size):
        r = check(A)
        if r:
            print("COUNTEREXAMPLE", A, r)
print("exhaustive done")
for _ in range(20000):
    k = random.randint(2, 8)
    A = sorted(random.sample(range(2, 80), k))
    r = check(A)
    if r:
        print("COUNTEREXAMPLE", A, r)
print("random done")
