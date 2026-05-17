import re

from app.utils.slug import (
    GUEST_NAME_PREFIX,
    generate_guest_display_name,
    generate_guest_id,
    generate_room_id,
)


def test_generate_room_id_format() -> None:
    room_id = generate_room_id()
    assert len(room_id) == 8
    assert re.fullmatch(r"[a-z0-9]+", room_id)


def test_generate_guest_display_name_prefix() -> None:
    name = generate_guest_display_name()
    assert name.startswith(GUEST_NAME_PREFIX)


def test_generate_guest_id_unique() -> None:
    a = generate_guest_id()
    b = generate_guest_id()
    assert a != b
