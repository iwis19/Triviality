import sys
from math import prod

def rep(N, kmax=8, nmax=200000):
    out = []
    for k in range(2, kmax + 1):
        for n in range(0, nmax):
            target = N * prod(range(n + 1, n + k + 1))
            # m+1 ~ target^(1/k)
            m = int(round(target ** (1.0 / k))) - 1
            for mm in range(max(m - 2, n + k), m + 3):
                if prod(range(mm + 1, mm + k + 1)) == target and mm >= n + k:
                    out.append((k, n, mm))
        if out:
            return out
    return out

for N in [int(a) for a in sys.argv[1:]] or [4, 9, 16, 25, 36, 49, 64, 81, 100]:
    print(N, rep(N)[:5])
