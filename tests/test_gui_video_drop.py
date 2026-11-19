"""Dropped videos open the scan on the original path: no copy, no upload.

pywebview's native layer captures the real path of a dropped file (its Cocoa
webview reads the pasteboard's file URLs) and hands it to a DOM drop handler as
``pywebviewFullPath``; the desktop app forwards that path to the page, which
opens the scan modal on the file in place.
"""

from youthumber.gui import dropped_video_paths, forward_dropped_videos


def _drop(*files):
    return {"dataTransfer": {"files": list(files)}}


def test_a_dropped_video_yields_its_real_path():
    event = _drop({"name": "clip.mp4", "pywebviewFullPath": "/Users/x/Movies/clip.mp4"})
    assert dropped_video_paths(event) == ["/Users/x/Movies/clip.mp4"]


def test_suffix_matching_is_case_insensitive_and_skips_non_videos():
    event = _drop(
        {"name": "notes.txt", "pywebviewFullPath": "/x/notes.txt"},
        {"name": "B.MOV", "pywebviewFullPath": "/x/B.MOV"},
        {"name": "c.m4v", "pywebviewFullPath": "/x/c.m4v"},
    )
    assert dropped_video_paths(event) == ["/x/B.MOV", "/x/c.m4v"]


def test_a_file_without_a_native_path_is_not_invented():
    # A drop the native layer did not resolve (or a browser File) has no path;
    # forwarding the name would scan the wrong file, so it is skipped.
    event = _drop({"name": "clip.mp4"})
    assert dropped_video_paths(event) == []


def test_forward_calls_the_page_with_each_video_path():
    calls = []
    forward_dropped_videos(
        _drop(
            {"name": "a.mp4", "pywebviewFullPath": "/x/a.mp4"},
            {"name": "b.txt", "pywebviewFullPath": "/x/b.txt"},
        ),
        evaluate_js=calls.append,
    )
    assert len(calls) == 1
    assert "/x/a.mp4" in calls[0]
    assert "__youthumberVideoDropped" in calls[0]


def test_forward_ignores_a_drop_with_no_videos():
    calls = []
    forward_dropped_videos(
        _drop({"name": "b.txt", "pywebviewFullPath": "/x/b.txt"}),
        evaluate_js=calls.append,
    )
    assert calls == []
