"""Tests for user-supplied path handling in youthumber.server.

resolve_video_path and resolve_dist_file must fail closed for path traversal
attempts: a user-supplied string must never let the backend read a file outside
the location it is meant to serve.
"""

from pathlib import Path

import pytest
from fastapi import HTTPException

from youthumber.server import resolve_dist_file, resolve_video_path


def test_resolve_video_path_rejects_traversal_to_an_existing_file(tmp_path):
    """A traversal string that resolves to an existing video must still be rejected."""
    subdir = tmp_path / "subdir"
    subdir.mkdir()
    secret = subdir / "secret.mp4"
    secret.write_bytes(b"x")
    # A traversal string that resolves to the existing video above; every
    # component exists, so only traversal rejection can make this fail.
    evil = str(subdir / ".." / "subdir" / "secret.mp4")
    assert ".." in evil.split("/")
    assert Path(evil).resolve() == secret.resolve()
    with pytest.raises(HTTPException) as exc_info:
        resolve_video_path(evil)
    assert exc_info.value.status_code == 400


def test_resolve_video_path_accepts_a_legitimate_video(tmp_path):
    video = tmp_path / "episode.mp4"
    video.write_bytes(b"x")
    assert resolve_video_path(str(video)) == video.resolve()


def test_resolve_video_path_rejects_missing_and_non_video_files(tmp_path):
    with pytest.raises(HTTPException):
        resolve_video_path(str(tmp_path / "nope.mp4"))
    text = tmp_path / "notes.txt"
    text.write_bytes(b"x")
    with pytest.raises(HTTPException):
        resolve_video_path(str(text))


def test_resolve_dist_file_rejects_traversal_and_absolute_paths(tmp_path):
    root = tmp_path / "build"
    root.mkdir()
    (root / "inner.json").write_text("{}")
    outside = tmp_path / "outside.json"
    outside.write_text("{}")

    assert resolve_dist_file(root, "../outside.json") is None
    assert resolve_dist_file(root, "/etc/passwd") is None
    assert resolve_dist_file(root, "") is None

    assert resolve_dist_file(root, "inner.json") == (root / "inner.json").resolve()


def test_resolve_dist_file_rejects_missing_files(tmp_path):
    assert resolve_dist_file(tmp_path / "build", "missing.json") is None


def test_resolve_video_path_rejects_null_byte(tmp_path):
    """A null byte in the user-supplied video path must fail closed with 400.

    pathlib raises ValueError for embedded null bytes; it must be treated as a
    bad request, never surface as an unhandled 500.
    """
    video = tmp_path / "episode.mp4"
    video.write_bytes(b"x")
    evil = str(video) + "\x00"
    with pytest.raises(HTTPException) as exc_info:
        resolve_video_path(evil)
    assert exc_info.value.status_code == 400


def test_resolve_dist_file_rejects_null_byte(tmp_path):
    root = tmp_path / "build"
    root.mkdir()
    (root / "inner.json").write_text("{}")
    assert resolve_dist_file(root, "inner.json\x00") is None


def test_resolve_dist_file_rejects_symlink_escape(tmp_path):
    """A symlink inside the root that points outside must not be served.

    resolve() follows the symlink, so the containment check (relative_to) must
    reject the resolved target.
    """
    root = tmp_path / "build"
    root.mkdir()
    (root / "inner.json").write_text("{}")
    outside = tmp_path / "outside.json"
    outside.write_text("{}")
    (root / "link.json").symlink_to(outside)
    assert resolve_dist_file(root, "link.json") is None
