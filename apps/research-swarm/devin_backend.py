"""Devin v3 sessions as structured role workers, under SwarmFlow coordination."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from jsonschema import ValidationError, validate


def env_value(*names, default=""):
    """Read the native WorkSwarm name, then the imported MathLab alias."""
    return next((os.environ[name] for name in names if os.environ.get(name)), default)


def organization_id():
    return env_value("DEVIN_ORG_ID", "MATHLAB_DEVIN_ORG_ID")


def request(base, key, path, method="GET", payload=None):
    req = Request(base + path, method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace").strip()
        try:
            parsed = json.loads(body)
            detail = parsed.get("detail") or parsed.get("title") or body
        except (json.JSONDecodeError, AttributeError):
            detail = body
        suffix = f": {str(detail)[:500]}" if detail else ""
        raise RuntimeError(f"Devin API returned HTTP {error.code}{suffix}") from None
    except URLError:
        raise RuntimeError("Devin API could not be reached") from None


async def run_session(prompt, schema, route, directory, call_key, emit):
    key, base, _, _ = route
    org = organization_id()
    if not org:
        raise RuntimeError("Configure DEVIN_ORG_ID (or MATHLAB_DEVIN_ORG_ID) for Devin role assignments")
    path = f"/v3/organizations/{quote(org, safe='')}/sessions"
    identity = hashlib.sha256((str(call_key) + prompt + json.dumps(schema, sort_keys=True)).encode()).hexdigest()
    record = Path(directory) / ("devin-" + identity + ".json")
    if record.exists():
        session = json.loads(record.read_text(encoding="utf-8"))
        if session.get("completed") and isinstance(session.get("structured_output"), dict):
            emit("devin_session", session_id=session["session_id"], reused=True)
            return session["structured_output"]
    else:
        schema_text = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
        payload = {
            "title": "Triviality research role",
            "prompt": prompt + "\n\nUpdate the structured output as soon as you have an answer and before "
                "finishing. It must match this JSON Schema exactly:\n" + schema_text +
                "\nDo not modify repositories, publish changes, send messages, or spawn additional sessions.",
            "structured_output_required": True, "structured_output_schema": schema,
            "max_acu_limit": float(env_value("DEVIN_MAX_ACU", "MATHLAB_DEVIN_MAX_ACU_LIMIT", default="2")),
            "devin_mode": env_value("DEVIN_MODE", "MATHLAB_DEVIN_MODE", default="normal"),
            "resumable": False,
            "tags": ["triviality", "workswarm"],
        }
        create_as = env_value("DEVIN_CREATE_AS_USER_ID", "MATHLAB_DEVIN_CREATE_AS_USER_ID")
        if create_as:
            payload["create_as_user_id"] = create_as
        session = await asyncio.to_thread(request, base, key, path, "POST", payload)
        if not session.get("session_id"):
            raise RuntimeError("Devin returned no session ID")
        record.write_text(json.dumps({"session_id": session["session_id"]}), encoding="utf-8")
    session_id = session["session_id"]
    session_path = path + "/" + quote(session_id, safe="")
    emit("devin_session", session_id=session_id)
    terminal = False
    completed = False
    try:
        timeout = float(env_value("DEVIN_SESSION_TIMEOUT_SECONDS", default="840"))
        poll_interval = float(env_value("DEVIN_POLL_INTERVAL_SECONDS", default="10"))
        async with asyncio.timeout(timeout):
            while True:
                session = await asyncio.to_thread(request, base, key, session_path)
                terminal = session.get("status") in {"exit", "error", "suspended"}
                detail = session.get("status_detail")
                output = session.get("structured_output")
                output_valid = False
                if isinstance(output, dict):
                    try:
                        validate(instance=output, schema=schema)
                        output_valid = True
                    except ValidationError:
                        pass
                if detail == "finished" or session.get("status") == "exit" or (detail in {"waiting_for_user", "waiting_for_approval"} and output_valid):
                    if not output_valid:
                        raise RuntimeError("Devin finished without valid structured role output")
                    completed = True
                    record.write_text(json.dumps({"session_id": session_id, "completed": True,
                        "structured_output": output, "acus_consumed": session.get("acus_consumed")}), encoding="utf-8")
                    emit("usage", provider="devin", unit="ACU", amount=session.get("acus_consumed"), session_id=session_id)
                    return output
                if terminal or detail in {"waiting_for_user", "waiting_for_approval"}:
                    raise RuntimeError(f"Devin session ended without valid structured output ({detail or session.get('status')})")
                await asyncio.sleep(poll_interval)
    finally:
        if not completed:
            record.unlink(missing_ok=True)
        if not terminal:
            try:
                await asyncio.shield(asyncio.to_thread(request, base, key, session_path, "DELETE"))
            except Exception:
                emit("devin_cleanup_failed", session_id=session_id, message="Terminate this session in Devin")
