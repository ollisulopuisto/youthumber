"""Process-level checks for the offline action transport."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def run_cli(*args, stdin=None, encoding=None, cwd=ROOT):
    return subprocess.run(
        [sys.executable, "-m", "youthumber", *args],
        input=stdin,
        check=False,
        capture_output=True,
        text=True,
        cwd=cwd,
        env={
            **os.environ,
            "PYTHONPATH": str(ROOT),
            **({"PYTHONIOENCODING": encoding} if encoding else {}),
        },
        timeout=10,
    )


def test_stdin_round_trip_continues_saved_project(tmp_path):
    first = run_cli(
        "--run-actions",
        "-",
        stdin=json.dumps(
            [
                {
                    "action": "create_project",
                    "params": {"name": "Jakso ä", "speaker_count": 3},
                },
                {"action": "set_headline", "params": {"text": "First title"}},
            ]
        ),
    )
    assert first.returncode == 0, first.stderr
    project = json.loads(first.stdout)
    saved = tmp_path / "batch.json"
    saved.write_text(
        json.dumps(
            {
                "project": project,
                "actions": [
                    {"name": "set_headline", "parameters": {"text": "Changed"}}
                ],
            }
        ),
        encoding="utf-8",
    )
    second = run_cli("--run-actions", str(saved))
    assert second.returncode == 0, second.stderr
    result = json.loads(second.stdout)
    assert result["id"] == project["id"]
    assert result["name"] == "Jakso ä"
    assert len(result["speakers"]) == 3
    assert result["text"]["text"] == "Changed"
    assert first.stderr == second.stderr == ""


def test_long_inline_json_is_not_treated_as_filename():
    title = "A" * 5000
    result = run_cli(
        "--run-actions",
        json.dumps(
            [
                {"action": "set_headline", "parameters": {"text": title}},
            ]
        ),
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["text"]["text"] == title


@pytest.mark.parametrize(
    "payload",
    [
        '[{"action":"set_speaker_count","params":{"count":1e999}}]',
        "null",
        "42",
        "true",
        '"text"',
        "{}",
        '{"actions": null}',
        '{"actions": [], "project": []}',
        "[null]",
        '[{"action": []}]',
        '[{"action": "set_headline", "params": []}]',
        '[{"action": "missing"}]',
        '[{"params": {}}]',
        '[{"action": "set_speaker_count", "params": {"count": "bad"}}]',
        '{"actions": [{"action":"set_headline", "params":{"text":"changed"}}], "project":{"text":[]}}',
        '{"actions": [], "project": {"value": NaN}}',
        '{"actions": [',
    ],
)
def test_invalid_input_is_json_error_without_project_or_traceback(payload):
    result = run_cli("--run-actions", "-", stdin=payload)
    assert result.returncode == 2
    assert result.stdout == ""
    error = json.loads(result.stderr)
    assert error["error"]["code"] == "invalid_action_batch"
    assert error["error"]["message"]
    assert "Traceback" not in result.stderr


def test_missing_file_is_structured_error(tmp_path):
    result = run_cli("--run-actions", str(tmp_path / "missing.json"))
    assert result.returncode == 2
    assert result.stdout == ""
    assert json.loads(result.stderr)["error"]["code"] == "invalid_action_batch"


@pytest.mark.parametrize("source", ["stdin", "file"])
def test_input_size_is_bounded(tmp_path, source):
    payload = json.dumps(
        [{"action": "set_headline", "params": {"text": "ä" * 600_000}}],
        ensure_ascii=False,
    )
    if source == "stdin":
        result = run_cli("--run-actions", "-", stdin=payload)
    else:
        path = tmp_path / "large.json"
        path.write_text(payload, encoding="utf-8")
        result = run_cli("--run-actions", str(path))
    assert result.returncode == 2
    assert result.stdout == ""
    assert "1048576" in json.loads(result.stderr)["error"]["message"]


def test_batch_size_is_bounded():
    result = run_cli(
        "--run-actions",
        "-",
        stdin=json.dumps([{"action": "create_project"} for _ in range(101)]),
    )
    assert result.returncode == 2
    assert result.stdout == ""
    assert "100" in json.loads(result.stderr)["error"]["message"]


def test_capability_discovery_uses_same_actions_and_no_gui():
    result = run_cli("--list-actions")
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    names = {action["name"] for action in data["actions"]}
    assert "create_project" in names
    assert names == {tool["function"]["name"] for tool in data["tools"]["openai"]}
    assert names == {tool["name"] for tool in data["tools"]["anthropic"]}


def test_modes_cannot_silently_override_each_other():
    result = run_cli("--list-actions", "--run-actions", "[]")
    assert result.returncode == 2
    assert result.stdout == ""


def test_escaped_unicode_surrogate_remains_valid_json():
    result = run_cli(
        "--run-actions",
        "-",
        stdin=json.dumps(
            [
                {"action": "set_headline", "params": {"text": "\ud800"}},
            ]
        ),
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["text"]["text"] == "\ud800"


def test_utf8_stdin_and_ascii_stdout_round_trip():
    result = run_cli(
        "--run-actions",
        "-",
        encoding="ascii",
        stdin=json.dumps(
            [
                {"action": "create_project", "params": {"name": "ääkköset"}},
            ],
            ensure_ascii=False,
        ),
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["name"] == "ääkköset"


def test_later_action_failure_never_prints_partial_project():
    result = run_cli(
        "--run-actions",
        "-",
        stdin=json.dumps(
            [
                {"action": "create_project", "params": {"name": "Do not publish"}},
                {"action": "no_such_action"},
            ]
        ),
    )
    assert result.returncode == 2
    assert result.stdout == ""
    assert json.loads(result.stderr)["error"]["code"] == "invalid_action_batch"


def test_exact_input_and_action_limits_are_accepted():
    data = {
        "actions": [{"action": "create_project"} for _ in range(100)],
        "padding": "",
    }
    raw = json.dumps(data)
    data["padding"] = " " * (1048576 - len(raw.encode("utf-8")))
    raw = json.dumps(data)
    assert len(raw.encode("utf-8")) == 1048576
    result = run_cli("--run-actions", "-", stdin=raw)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["version"] == 2


@pytest.mark.parametrize("source", ["file", "inline"])
def test_invalid_json_transport(source, tmp_path):
    raw = '[{"action":'
    if source == "file":
        path = tmp_path / "bad.json"
        path.write_text(raw, encoding="utf-8")
        raw = str(path)
    result = run_cli("--run-actions", raw)
    assert result.returncode == 2
    assert result.stdout == ""
    assert json.loads(result.stderr)["error"]["code"] == "invalid_action_batch"


@pytest.mark.parametrize("name", ["[Draft] Episode 42.json", "{draft}.json"])
def test_bracket_prefixed_relative_file_is_read(tmp_path, name):
    (tmp_path / name).write_text(
        '[{"action":"create_project","params":{"name":"from file"}}]', encoding="utf-8"
    )
    result = run_cli("--run-actions", name, cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["name"] == "from file"
