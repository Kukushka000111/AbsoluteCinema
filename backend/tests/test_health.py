import pytest
from httpx import ASGITransport, AsyncClient

from app.main_api import app as api_app
from app.main_ws import app as ws_app


@pytest.mark.asyncio
async def test_api_health() -> None:
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "api"


@pytest.mark.asyncio
async def test_ws_health(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeRedis:
        async def ping(self) -> bool:
            return True

    monkeypatch.setattr("app.main_ws.get_redis", lambda: _FakeRedis())

    transport = ASGITransport(app=ws_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "ws"
