"""Keep the app out of App Nap while a user-initiated job runs (macOS).

Video scans, background removal and the matting-model download all run
inside this one process (the pywebview window plus the embedded FastAPI
server). When the window is hidden, App Nap may throttle the process —
timers coalesce and scheduling priority drops — and a multi-minute video
scan crawls ([Apple App Nap
guide](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/AppNap.html)).

``hold(reason)`` brackets the work with an ``NSProcessInfo`` activity. These
operations are user-initiated, so the activity uses
``NSActivityUserInitiatedAllowingIdleSystemSleep``: macOS won't App Nap or defer
the work, while the display and system remain free to sleep on their normal
schedule.

Off macOS, without PyObjC, or if the assertion itself fails, ``hold`` is a
no-op: the job still runs, the OS simply keeps its default heuristics.
The Cocoa object is injectable so tests need no Mac.
"""

from __future__ import annotations

import contextlib
import logging
import sys
from collections.abc import Iterator

logger = logging.getLogger("youthumber.appnap")

# NSActivityUserInitiatedAllowingIdleSystemSleep from NSProcessInfo.h. It marks
# lengthy work as user-requested but omits IdleSystemSleepDisabled (1 << 20).
# IdleDisplaySleepDisabled (1 << 40) is also absent, so neither normal system
# sleep nor display sleep is prevented.
NS_ACTIVITY_USER_INITIATED_ALLOWING_IDLE_SYSTEM_SLEEP = 0x00EFFFFF


def _process_info():
    """NSProcessInfo.processInfo() on macOS, None anywhere it can't work."""
    if sys.platform != "darwin":
        return None
    try:
        from Foundation import NSProcessInfo
    except ImportError as exc:  # no PyObjC
        logger.debug("NSProcessInfo unavailable, App Nap hold off: %s", exc)
        return None
    try:
        return NSProcessInfo.processInfo()
    except Exception as exc:  # noqa: BLE001 - not a Cocoa process
        logger.debug("NSProcessInfo unavailable, App Nap hold off: %s", exc)
        return None


@contextlib.contextmanager
def hold(reason: str, process_info=None) -> Iterator[None]:
    """Keep user-requested work out of App Nap until the block exits."""
    info = _process_info() if process_info is None else process_info
    if info is None:
        yield
        return
    activity = None
    try:
        activity = info.beginActivityWithOptions_reason_(
            NS_ACTIVITY_USER_INITIATED_ALLOWING_IDLE_SYSTEM_SLEEP, reason
        )
    except Exception as exc:  # noqa: BLE001 - any Cocoa failure must not kill the job
        logger.warning("could not begin App Nap assertion: %s", exc)
    try:
        yield
    finally:
        if activity is not None:
            try:
                info.endActivity_(activity)
            except Exception as exc:  # noqa: BLE001 - releasing must never kill the job
                logger.warning("could not end App Nap assertion: %s", exc)
