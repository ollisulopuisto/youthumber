# App Nap behavior

YouThumber runs the desktop window and its local Python server in the same process. macOS can apply App Nap when the window is hidden or inactive, which may throttle long-running work such as video scans, background removal, and downloading the matting model.

On macOS, `youthumber.appnap.hold(reason)` brackets these user-requested operations with an `NSProcessInfo` activity using `NSActivityUserInitiatedAllowingIdleSystemSleep`. This tells macOS to keep the work from being App Napped or deferred while still allowing normal system and display sleep. The activity is ended when the operation exits, including when it raises an exception.

If PyObjC or `NSProcessInfo` is unavailable, or macOS cannot begin or end the activity, the helper logs the issue and lets the operation continue with the system's default scheduling behavior. On other platforms it is a no-op. App Nap handling therefore does not determine whether the underlying operation can run.

The integration points are:

- `youthumber/server.py`: video scanning and background removal.
- `youthumber/matting.py`: matting-model download.

`tests/test_appnap.py` uses a fake process-info object, so the activity options, lifetime, error cleanup, and no-op paths can be checked without a Mac. The test for the activity option also ensures that the idle-system-sleep and idle-display-sleep disabling bits are absent.
