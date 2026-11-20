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


# --- the desktop Save flow: every outcome is a result the page can show -------------

import sys
import types

import pytest

from youthumber import gui

PAYLOAD = b"\xff\xd8\xff\xe0fake-jpeg-bytes"
DATA_URL = "data:image/jpeg;base64," + base64.b64encode(PAYLOAD).decode()


@pytest.fixture
def chosen(monkeypatch):
    """A fake pywebview whose Save panel returns ``chosen.path`` (None = cancelled)."""
    box = types.SimpleNamespace(path=None)

    class Window:
        def create_file_dialog(self, *args, **kwargs):
            return box.path

    fake = types.SimpleNamespace(
        windows=[Window()], FileDialog=types.SimpleNamespace(SAVE=1)
    )
    monkeypatch.setitem(sys.modules, "webview", fake)
    return box


def test_a_new_file_is_saved(chosen, tmp_path):
    chosen.path = str(tmp_path / "a.jpg")
    result = gui.DesktopApi().save_image(DATA_URL, "a.jpg")
    assert result == {"status": "saved", "path": chosen.path}
    assert Path(chosen.path).read_bytes() == PAYLOAD


def test_cancelling_the_panel_is_reported_as_cancelled(chosen):
    assert gui.DesktopApi().save_image(DATA_URL, "a.jpg") == {"status": "cancelled"}


def test_an_existing_file_is_not_touched_until_the_page_chooses(chosen, tmp_path):
    target = tmp_path / "a.jpg"
    target.write_bytes(b"old")
    chosen.path = str(target)
    api = gui.DesktopApi()
    assert api.save_image(DATA_URL, "a.jpg") == {
        "status": "exists",
        "path": str(target),
    }
    assert target.read_bytes() == b"old"
    assert api.save_image_to(DATA_URL, str(target), "replace") == {
        "status": "saved",
        "path": str(target),
    }
    assert target.read_bytes() == PAYLOAD


def test_keep_both_writes_a_numbered_copy_and_leaves_the_original(chosen, tmp_path):
    target = tmp_path / "a.jpg"
    target.write_bytes(b"old")
    (tmp_path / "a (2).jpg").write_bytes(b"older copy")
    chosen.path = str(target)
    api = gui.DesktopApi()
    api.save_image(DATA_URL, "a.jpg")
    result = api.save_image_to(DATA_URL, str(target), "keep_both")
    assert result == {"status": "saved", "path": str(tmp_path / "a (3).jpg")}
    assert target.read_bytes() == b"old"
    assert (tmp_path / "a (2).jpg").read_bytes() == b"older copy"


def test_save_image_to_refuses_a_path_the_panel_never_returned(tmp_path):
    result = gui.DesktopApi().save_image_to(
        DATA_URL, str(tmp_path / "x.jpg"), "replace"
    )
    assert result["status"] == "error"
    assert not (tmp_path / "x.jpg").exists()


def test_a_failed_write_comes_back_as_an_error_not_an_exception(chosen, tmp_path):
    """The silent failure: a write error used to be raised into the bridge and vanish."""
    chosen.path = str(tmp_path / "missing-folder" / "a.jpg")
    result = gui.DesktopApi().save_image(DATA_URL, "a.jpg")
    assert result["status"] == "error"
    assert "a.jpg" in result["message"]


def test_a_failing_replace_comes_back_as_an_error(chosen, tmp_path, monkeypatch):
    target = tmp_path / "a.jpg"
    target.write_bytes(b"old")
    chosen.path = str(target)
    api = gui.DesktopApi()
    api.save_image(DATA_URL, "a.jpg")

    def deny(*_a, **_k):
        raise PermissionError("Operation not permitted")

    monkeypatch.setattr(gui, "write_data_url_to_path", deny)
    result = api.save_image_to(DATA_URL, str(target), "replace")
    assert (
        result["status"] == "error" and "Operation not permitted" in result["message"]
    )
    assert target.read_bytes() == b"old"


def test_keep_both_never_overwrites_a_name_taken_after_the_check(tmp_path, monkeypatch):
    """Another process takes "(2)" between choosing the name and creating the file.

    The competing file appears immediately before our ``open``, so a check-then-write
    implementation (look for a free name, then write it) would truncate it.
    """
    url = "data:image/png;base64," + base64.b64encode(b"new").decode()
    target = tmp_path / "t.png"
    target.write_bytes(b"orig")
    taken = tmp_path / "t (2).png"
    real_open = open
    raced = []

    def racing_open(file, mode="r", *args, **kwargs):
        if Path(file) == taken and not raced:
            raced.append(True)
            taken.write_bytes(b"other process")
        return real_open(file, mode, *args, **kwargs)

    monkeypatch.setattr(gui, "open", racing_open, raising=False)
    written = gui.write_data_url_unique(url, str(target))
    assert raced
    assert written == str(tmp_path / "t (3).png")
    assert taken.read_bytes() == b"other process"
    assert Path(written).read_bytes() == b"new"
    assert target.read_bytes() == b"orig"
