"""Tests for writing exported thumbnails to disk from the desktop app."""

import base64
from pathlib import Path

from youthumber.gui import write_data_url_to_path


def test_write_data_url_to_path_writes_decoded_bytes(tmp_path: Path) -> None:
    payload = b"\xff\xd8\xff\xe0fake-jpeg-bytes"
    data_url = "data:image/jpeg;base64," + base64.b64encode(payload).decode()
    target = tmp_path / "thumb.jpg"

    write_data_url_to_path(data_url, str(target))

    assert target.read_bytes() == payload
