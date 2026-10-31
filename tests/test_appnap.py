"""appnap.hold: NSProcessInfo assertion for the job's lifetime, no Mac needed."""

from youthumber.appnap import NS_ACTIVITY_BACKGROUND, hold


class FakeProcessInfo:
    def __init__(self, fail=False):
        self.fail = fail
        self.begun = []
        self.ended = []

    def beginActivityWithOptions_reason_(self, options, reason):
        if self.fail:
            raise RuntimeError("no assertions for you")
        self.begun.append((options, reason))
        return object()

    def endActivity_(self, activity):
        self.ended.append(activity)


def test_background_option_is_nap_only():
    # 1 << 40 is IdleDisplaySleepDisabled; Background must not include it.
    assert NS_ACTIVITY_BACKGROUND & (1 << 40) == 0
    assert NS_ACTIVITY_BACKGROUND == 0xFF


def test_hold_brackets_the_work():
    pi = FakeProcessInfo()
    with hold("Scanning video for speakers", process_info=pi):
        assert len(pi.begun) == 1
        assert pi.begun[0] == (NS_ACTIVITY_BACKGROUND, "Scanning video for speakers")
        assert not pi.ended
    assert len(pi.ended) == 1


def test_hold_releases_on_error():
    pi = FakeProcessInfo()
    try:
        with hold("job", process_info=pi):
            raise ValueError("boom")
    except ValueError:
        pass
    assert len(pi.ended) == 1


def test_begin_failure_still_runs_the_job():
    pi = FakeProcessInfo(fail=True)
    ran = False
    with hold("job", process_info=pi):
        ran = True
    assert ran and pi.begun == [] and pi.ended == []


def test_no_process_info_is_a_noop():
    with hold("job", process_info=None):
        pass  # off-macOS path: nothing begins, nothing breaks
