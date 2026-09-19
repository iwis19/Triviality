import sys
from math import prod
N=int(sys.argv[1]); nmax=int(sys.argv[2]); kmax=int(sys.argv[3])
for k in range(2,kmax+1):
    for n in range(0,nmax):
        target=N*prod(range(n+1,n+k+1))
        m=int(round(target**(1.0/k)))-1
        for mm in range(max(m-2,n+k),m+3):
            if prod(range(mm+1,mm+k+1))==target: print("FOUND",N,k,n,mm,flush=True)
    print("k",k,"done",flush=True)
