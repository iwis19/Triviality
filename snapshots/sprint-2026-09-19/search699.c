// Erdős #699: for every 1<=i<j<=n/2 is there a prime p>=i with p | gcd(C(n,i),C(n,j))?
// Kummer: p | C(n,i) iff there is a carry adding i and n-i in base p, i.e. some digit of i exceeds digit of n.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static int divides(int p, int n, int i) {
    while (i > 0) {
        if (i % p > n % p) return 1;
        i /= p; n /= p;
    }
    return 0;
}
int main(int argc, char **argv) {
    int N = argc > 1 ? atoi(argv[1]) : 1000;
    char *isp = calloc(N + 2, 1);
    for (int i = 2; i <= N; i++) isp[i] = 1;
    for (int i = 2; i * i <= N; i++) if (isp[i]) for (int j = i * i; j <= N; j += i) isp[j] = 0;
    int bad = 0;
    for (int n = 4; n <= N; n++) {
        int h = n / 2;
        // div[p][i] for primes p<=n, i<=h
        unsigned char *div = malloc((size_t)(n + 1) * (h + 1));
        for (int p = 2; p <= n; p++) if (isp[p]) for (int i = 1; i <= h; i++) div[(size_t)p * (h + 1) + i] = divides(p, n, i);
        for (int i = 1; i <= h; i++) for (int j = i + 1; j <= h; j++) {
            int ok = 0;
            for (int p = i; p <= n && !ok; p++) if (isp[p] && div[(size_t)p * (h + 1) + i] && div[(size_t)p * (h + 1) + j]) ok = 1;
            if (!ok) { printf("COUNTEREXAMPLE n=%d i=%d j=%d\n", n, i, j); bad++; }
        }
        free(div);
        if (bad > 20) return 0;
    }
    printf("done up to n=%d, counterexamples=%d\n", N, bad);
    return 0;
}
