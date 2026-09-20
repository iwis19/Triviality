import sys
from math import gcd
from collections import defaultdict

def lcm(a, b):
    return a * b // gcd(a, b)

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200000
for k in range(2, 13):
    seen = defaultdict(list)
    found = False
    for n in range(0, N):
        L = 1
        for i in range(1, k + 1):
            L = lcm(L, n + i)
        for n0 in seen.get(L, []):
            if n >= n0 + k:
                print(f"k={k}: M({n0},{k}) = M({n},{k}) = {L}")
                found = True
        seen[L].append(n)
    if not found:
        print(f"k={k}: none up to {N}")
