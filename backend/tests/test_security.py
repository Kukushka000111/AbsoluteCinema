import uuid

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("secret-pass")
    assert verify_password("secret-pass", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_encode_decode() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(user_id, "tester")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["username"] == "tester"


def test_jwt_invalid_token() -> None:
    assert decode_access_token("not-a-jwt") is None
