import json

import httpx

from app.config import Settings
from app.services.devin_client import DevinApiClient, SessionInfo


def test_terminal_and_blocked_states() -> None:
    working = SessionInfo("s", "u", "running", "working")
    assert not working.is_terminal and not working.is_blocked

    asking = SessionInfo("s", "u", "running", "waiting_for_user")
    assert asking.is_blocked and not asking.is_terminal

    delivered = SessionInfo(
        "s", "u", "running", "waiting_for_user", structured_output={"ideas": []}
    )
    assert delivered.is_terminal

    assert SessionInfo("s", "u", "running", "finished").is_terminal
    assert SessionInfo("s", "u", "exit", "usage_limit_exceeded").is_terminal
    assert SessionInfo("s", "u", "error", "error").is_terminal
    idle = SessionInfo("s", "u", "suspended", "inactivity")
    assert idle.is_blocked and not idle.is_terminal
    assert SessionInfo(
        "s", "u", "suspended", "inactivity", structured_output={"ideas": []}
    ).is_terminal
    assert not SessionInfo("s", "u", "claimed", "").is_terminal


def test_api_client_request_shape() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = request.read()
        return httpx.Response(
            200,
            json={
                "session_id": "abc",
                "url": "https://app.devin.ai/sessions/abc",
                "status": "new",
                "devin_mode": "fusion",
                "user_id": "user-1",
            },
        )

    settings = Settings(
        devin_provider="api",
        devin_api_key="k",
        devin_org_id="org-1",
        devin_create_as_user_id="user-1",
    )
    transport = httpx.MockTransport(handler)
    client = DevinApiClient(
        settings, client=httpx.Client(base_url="https://api.devin.ai", transport=transport)
    )
    info = client.create_session(
        prompt="p",
        devin_mode="fusion",
        tags=["mathlab"],
        title="t",
        session_secrets={"LAB_WORKER_TOKEN": "tok"},
        max_acu_limit=5,
    )
    assert seen["url"] == "https://api.devin.ai/v3/organizations/org-1/sessions"
    body = json.loads(seen["body"])
    assert body["devin_mode"] == "fusion"
    assert body["structured_output_required"] is True
    assert body["max_acu_limit"] == 5
    assert body["create_as_user_id"] == "user-1"
    assert body["session_secrets"] == [
        {"key": "LAB_WORKER_TOKEN", "value": "tok", "sensitive": True}
    ]
    assert info.session_id == "abc" and info.devin_mode == "fusion" and info.user_id == "user-1"
