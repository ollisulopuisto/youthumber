"""Bounded JSON transport for offline project actions, without starting a server."""

from __future__ import annotations

import errno
import json
import sys
from pathlib import Path
from typing import Any

from .actions import execute_batch

MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_BATCH_ACTIONS = 100


def _reject_constant(value: str) -> None:
    raise ValueError(f"Non-finite JSON number is not supported: {value}")


def _read_batch(source: str) -> Any:
    if source == "-":
        raw_bytes = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw_bytes) > MAX_INPUT_BYTES:
            raise ValueError(f"Input exceeds {MAX_INPUT_BYTES} UTF-8 bytes")
        raw = raw_bytes.decode("utf-8")
    else:
        target = Path(source)
        try:
            is_file = target.exists()
        except OSError as exc:
            if exc.errno != errno.ENAMETOOLONG:
                raise
            is_file = False
        if is_file:
            with target.open("rb") as stream:
                raw_bytes = stream.read(MAX_INPUT_BYTES + 1)
            if len(raw_bytes) > MAX_INPUT_BYTES:
                raise ValueError(f"Input exceeds {MAX_INPUT_BYTES} UTF-8 bytes")
            raw = raw_bytes.decode("utf-8")
        elif source.lstrip().startswith(("[", "{")):
            raw = source
        else:
            raise ValueError("Expected a JSON array/object or an existing batch file")
    if len(raw.encode("utf-8")) > MAX_INPUT_BYTES:
        raise ValueError(f"Input exceeds {MAX_INPUT_BYTES} UTF-8 bytes")
    return json.loads(raw, parse_constant=_reject_constant)


def _validate_batch(data: Any) -> tuple[list[dict[str, Any]], dict | None]:
    project = None
    if isinstance(data, dict):
        if "actions" not in data:
            raise ValueError("Batch object must contain an actions array")
        project = data.get("project")
        if project is not None and not isinstance(project, dict):
            raise ValueError("Initial project must be an object or null")
        actions = data["actions"]
    else:
        actions = data
    if not isinstance(actions, list):
        raise TypeError("Batch must be an actions array or an object containing one")
    if len(actions) > MAX_BATCH_ACTIONS:
        raise ValueError(f"Batch exceeds {MAX_BATCH_ACTIONS} actions")
    for index, step in enumerate(actions):
        if not isinstance(step, dict):
            raise TypeError(f"Action {index} must be an object")
        name = step.get("action") or step.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError(f"Action {index} must have a non-empty action or name")
        for key in ("parameters", "params"):
            if key in step and not isinstance(step[key], dict):
                raise ValueError(f"Action {index} {key} must be an object")
    return actions, project


def run_actions(source: str) -> int:
    """Emit one project on stdout, or a JSON error on stderr with exit code 2."""
    try:
        actions, project = _validate_batch(_read_batch(source))
        result = execute_batch(actions, initial_project=project)
        # Serialize before writing anything: failed actions never publish a
        # partial result, and non-finite values never leak into JSON output.
        output = json.dumps(result, ensure_ascii=True, indent=2, allow_nan=False)
    except (
        OSError,
        ValueError,
        TypeError,
        KeyError,
        OverflowError,
        IndexError,
        AttributeError,
        RecursionError,
    ) as exc:
        print(
            json.dumps(
                {"error": {"code": "invalid_action_batch", "message": str(exc)}}
            ),
            file=sys.stderr,
        )
        return 2
    try:
        print(output, flush=True)
    except BrokenPipeError:
        # A consumer such as head can finish before reading the whole project.
        # Close our stream so interpreter shutdown does not retry its buffer.
        try:
            sys.stdout.close()
        except BrokenPipeError:
            pass
    return 0
