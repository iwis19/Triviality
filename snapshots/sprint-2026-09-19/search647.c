// Erdős #647: find n > 24 with max_{m<n} (m + tau(m)) <= n + 2.
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
int main(int argc, char **argv) {
    uint64_t N = argc > 1 ? strtoull(argv[1], 0, 10) : 100000000ULL;
    uint16_t *tau = calloc(N + 1, sizeof(uint16_t));
    for (uint64_t d = 1; d <= N; d++)
        for (uint64_t m = d; m <= N; m += d) tau[m]++;
    uint64_t running = 0; // max_{m<n} (m + tau(m))
    for (uint64_t n = 2; n <= N; n++) {
        // running currently covers m < n
        if (n > 24 && running <= n + 2) printf("FOUND n=%llu (max=%llu)\n", (unsigned long long)n, (unsigned long long)running);
        uint64_t v = n + tau[n];
        if (v > running) running = v;
    }
    printf("done up to %llu\n", (unsigned long long)N);
    return 0;
}
