"""Devin v3 sessions as structured role workers, under SwarmFlow coordination."""
import asyncio
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def request(base, key, path, method="GET", payload=None):
    req = Request(base + path, method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except HTTPError as error:
        raise RuntimeError(f"Devin API returned HTTP {error.code}") from None
    except URLError:
        raise RuntimeError("Devin API could not be reached") from None


async def run_session(prompt, schema, route, directory, call_key, emit):
    key, base, _, _ = route
    org = os.environ.get("DEVIN_ORG_ID", "")
    if not org:
        raise RuntimeError("Configure DEVIN_ORG_ID for Devin role assignments")
    path = f"/v3/organizations/{quote(org, safe='')}/sessions"
    identity = hashlib.sha256((str(call_key) + prompt).encode()).hexdigest()
    record = Path(directory) / ("devin-" + identity + ".json")
    if record.exists():
        session = json.loads(record.read_text(encoding="utf-8"))
    else:
        session = await asyncio.to_thread(request, base, key, path, "POST", {
            "title": "Triviality research role",
            "prompt": prompt + "\nReturn the required structured output. Do not modify repositories, "
                "publish changes, send messages, or spawn additional sessions.",
            "structured_output_required": True, "structured_output_schema": schema,
            "max_acu_limit": float(os.environ.get("DEVIN_MAX_ACU", "2")),
            "tags": ["triviality", "workswarm"],
        })
        if not session.get("session_id"):
            raise RuntimeError("Devin returned no session ID")
        record.write_text(json.dumps({"session_id": session["session_id"]}), encoding="utf-8")
    session_id = session["session_id"]
    session_path = path + "/" + quote(session_id, safe="")
    emit("devin_session", session_id=session_id)
    terminal = False
    try:
        async with asyncio.timeout(540):
            while True:
                session = await asyncio.to_thread(request, base, key, session_path)
                terminal = session.get("status") in {"exit", "error", "suspended"}
                if session.get("status_detail") == "finished" or session.get("status") == "exit":
                    output = session.get("structured_output")
                    if not isinstance(output, dict):
                        raise RuntimeError("Devin finished without structured role output")
                    emit("usage", provider="devin", unit="ACU", amount=session.get("acus_consumed"), session_id=session_id)
                    return output
                if terminal or session.get("status_detail") in {"waiting_for_user", "waiting_for_approval"}:
                    raise RuntimeError("Devin session needs attention or ended without completing the role")
                await asyncio.sleep(5)
    finally:
        if not terminal:
            try:
                await asyncio.shield(asyncio.to_thread(request, base, key, session_path, "DELETE"))
            except Exception:
                emit("devin_cleanup_failed", session_id=session_id, message="Terminate this session in Devin")
