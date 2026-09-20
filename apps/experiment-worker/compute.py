"""Bounded exact computations. No eval, imports, or executable user input."""
import json
import math
import sys

VERSION = "polynomial-v1"
FIELDS = {"coefficients", "start", "end", "property"}


def validate(data):
    if not isinstance(data, dict) or set(data) != FIELDS:
        raise ValueError("Expected coefficients, start, end, property only")
    coefficients = data["coefficients"]
    if not isinstance(coefficients, list) or not 1 <= len(coefficients) <= 9:
        raise ValueError("Use 1–9 integer coefficients, constant term first")
    if any(type(c) is not int or abs(c) > 1000000 for c in coefficients):
        raise ValueError("Coefficients must be integers with magnitude <= 1000000")
    start, end = data["start"], data["end"]
    if type(start) is not int or type(end) is not int or not -10000 <= start <= end <= 10000 or end-start > 10000:
        raise ValueError("Inclusive bounds must be within +/-10000 and contain at most 10001 integers")
    if data["property"] not in ("prime", "nonnegative", "positive", "zero"):
        raise ValueError("Unsupported property")
    return data


def compute(data):
    validate(data)
    tested = 0
    for n in range(data["start"], data["end"] + 1):
        value = 0
        for coefficient in reversed(data["coefficients"]):
            value = value * n + coefficient
        factor = None
        if data["property"] == "prime":
            if abs(value) > 1000000000:
                return dict(outcome="execution_error", tested=tested, diagnostic="Primality value exceeds magnitude limit 10^9")
            if value >= 2:
                factor = next((d for d in range(2, math.isqrt(value)+1) if value % d == 0), None)
            holds = value >= 2 and factor is None
        else:
            holds = {"nonnegative": value >= 0, "positive": value > 0, "zero": value == 0}[data["property"]]
        tested += 1
        if not holds:
            return dict(outcome="counterexample_found", tested=tested, witness=dict(n=n, value=value, factor=factor))
    return dict(outcome="no_counterexample_in_bounds", tested=tested, witness=None)


if __name__ == "__main__":
    if sys.platform == "linux":
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    print(json.dumps(compute(json.loads(sys.stdin.read(8193)))))
