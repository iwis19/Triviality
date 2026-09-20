"""Optional authenticated transport for the bounded experiment worker."""
import json
import os
import urllib.error
import urllib.request

REQUEST_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["coefficients", "start", "end", "property"],
    "properties": {
        "coefficients": {"type": "array", "minItems": 1, "maxItems": 9,
                         "items": {"type": "integer", "minimum": -1000000, "maximum": 1000000}},
        "start": {"type": "integer", "minimum": -10000, "maximum": 10000},
        "end": {"type": "integer", "minimum": -10000, "maximum": 10000},
        "property": {"type": "string", "enum": ["prime", "nonnegative", "positive", "zero"]},
    },
}
PLAN_SCHEMA = {"type": "object", "additionalProperties": False,
               "required": ["rationale", "experiment"], "properties": {
                   "rationale": {"type": "string", "minLength": 1, "maxLength": 2000},
                   "experiment": {"anyOf": [REQUEST_SCHEMA, {"type": "null"}]}}}


def enabled():
    return bool(os.environ.get("EXPERIMENT_API_URL"))


def execute(experiment):
    url = os.environ.get("EXPERIMENT_API_URL", "").rstrip("/")
    key = os.environ.get("EXPERIMENT_API_KEY", "")
    failure = dict(outcome="execution_error", verified=False, request=experiment)
    if not url or not key:
        return dict(failure, diagnostic="Experiment endpoint or credential missing")
    # Host controls this URL; model output cannot choose a network destination.
    request = urllib.request.Request(url + "/experiments", data=json.dumps(experiment).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    opener = urllib.request.build_opener(NoRedirect())
    for attempt in range(2):
        try:
            with opener.open(request, timeout=15) as response:
                body = response.read(16385)
            if len(body) > 16384:
                raise ValueError("Oversized response")
            result = json.loads(body)
            if (not isinstance(result, dict) or result.get("request") != experiment
                    or result.get("verified") is not False or not isinstance(result.get("job_id"), str)
                    or result.get("outcome") not in ("counterexample_found", "no_counterexample_in_bounds", "execution_error")):
                raise ValueError("Invalid experiment response")
            return result
        except urllib.error.HTTPError as error:
            return dict(failure, diagnostic=f"Experiment service returned HTTP {error.code}")
        except (OSError, ValueError):
            if attempt:
                return dict(failure, diagnostic="Experiment service unavailable or returned invalid evidence")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
