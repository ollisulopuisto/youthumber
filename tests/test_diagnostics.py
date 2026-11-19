"""Tests for packaged-build bridge diagnostics (youthumber/diagnostics.py)."""

from __future__ import annotations

import logging
import threading
from types import SimpleNamespace

import pytest

from youthumber import diagnostics


@pytest.fixture(autouse=True)
def reset_diagnostics(monkeypatch, tmp_path):
    """Isolate each test: no frozen flag, no env var, fresh log dir, clean loggers."""
    monkeypatch.delenv("YOUTHUMBER_DIAGNOSTICS", raising=False)
    monkeypatch.setattr(diagnostics.sys, "frozen", False, raising=False)
    monkeypatch.delattr(diagnostics.sys, "_MEIPASS", raising=False)
    diagnostics._reset_for_tests()
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path / "state"))
    yield
    diagnostics._reset_for_tests()


class FakeEvent:
    def __init__(self):
        self.handlers = []

    def __iadd__(self, handler):
        self.handlers.append(handler)
        return self

    def fire(self):
        for handler in self.handlers:
            handler()


class FakeWindow:
    def __init__(self, results):
        self.events = SimpleNamespace(loaded=FakeEvent())
        self._results = list(results)
        self.calls = 0

    def evaluate_js(self, script):
        self.calls += 1
        result = self._results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def test_disabled_by_default():
    assert diagnostics.setup_diagnostics("1.2.3") is None


def test_enabled_via_env_creates_log(monkeypatch):
    monkeypatch.setenv("YOUTHUMBER_DIAGNOSTICS", "1")
    path = diagnostics.setup_diagnostics("1.2.3")
    assert path is not None
    assert path.name == "youthumber.log"
    text = path.read_text()
    assert "1.2.3" in text
    assert "frozen=False" in text


def test_setup_is_idempotent(monkeypatch):
    monkeypatch.setenv("YOUTHUMBER_DIAGNOSTICS", "1")
    first = diagnostics.setup_diagnostics("1.2.3")
    second = diagnostics.setup_diagnostics("1.2.3")
    assert first == second


def test_enabled_when_frozen(monkeypatch):
    # Frozen mode redirects OS-level stdout/stderr, which pytest's capture
    # wraps; keep this to behavior that survives that (no crash, log created).
    monkeypatch.setattr(diagnostics.sys, "frozen", True, raising=False)
    monkeypatch.setattr(diagnostics.sys, "_MEIPASS", "/app/Contents/Frameworks", raising=False)
    path = diagnostics.setup_diagnostics("9.9.9")
    assert path is not None
    assert path.exists()
    assert diagnostics.setup_diagnostics("9.9.9") == path


def test_mac_log_path(monkeypatch, tmp_path):
    monkeypatch.setattr(diagnostics.sys, "platform", "darwin")
    assert diagnostics.log_path() == tmp_path / "Library" / "Logs" / "YouThumber" / "youthumber.log"


def test_probe_reports_success_and_stops(caplog):
    window = FakeWindow(["function:pick_video_file,set_native_menu"])
    with caplog.at_level(logging.INFO, logger="youthumber.diagnostics"):
        diagnostics.install_bridge_probe(window, interval=0.01, max_attempts=5)
        _wait_for(window, lambda: window.calls >= 1)
    assert window.calls == 1
    assert any("bridge ok" in r.message for r in caplog.records)


def test_probe_retries_after_exception_then_succeeds(caplog):
    window = FakeWindow([RuntimeError("boom"), "function:pick_video_file"])
    with caplog.at_level(logging.INFO, logger="youthumber.diagnostics"):
        diagnostics.install_bridge_probe(window, interval=0.01, max_attempts=5)
        _wait_for(window, lambda: window.calls >= 2)
    assert any("bridge ok" in r.message for r in caplog.records)


def test_probe_logs_error_when_bridge_never_appears(caplog):
    window = FakeWindow(["pywebview-missing"] * 5)
    with caplog.at_level(logging.INFO, logger="youthumber.diagnostics"):
        diagnostics.install_bridge_probe(window, interval=0.01, max_attempts=3)
        _wait_for(window, lambda: window.calls >= 3)
    assert any("unavailable" in r.message for r in caplog.records if r.levelno >= logging.ERROR)


def test_probe_logs_loaded_event(caplog):
    window = FakeWindow(["function:pick_video_file"])
    with caplog.at_level(logging.INFO, logger="youthumber.diagnostics"):
        diagnostics.install_bridge_probe(window, interval=0.01, max_attempts=5)
        window.events.loaded.fire()
        _wait_for(window, lambda: window.calls >= 1)
    assert any("loaded event" in r.message for r in caplog.records)


def _wait_for(window, condition, timeout=5.0):
    deadline = threading.Event()

    def poll():
        while not condition():
            if deadline.wait(0.01):
                return

    thread = threading.Thread(target=poll, daemon=True)
    thread.start()
    deadline.wait(timeout)
    deadline.set()
    thread.join(timeout=1.0)
