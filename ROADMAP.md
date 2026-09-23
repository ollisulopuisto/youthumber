# Roadmap

Planned work, not yet scheduled to a specific day unless noted.

## Extract shared desktop-shell code into a standalone package

`youthumber/gui.py` and autoraffkat's `src/autoraffkat/gui.py` are near
line-for-line duplicates: `find_free_port`, the `DesktopServer` class
(pywebview window + embedded FastAPI/Uvicorn in a background thread), dock
icon/name setup, and the native file-dialog wrapper. That's ~150-190 lines
of real, current duplication in each app.

**Plan:** pull the shared pieces into a small standalone package (e.g.
`pywebview-fastapi-shell`) with its own tiny repo, and have both apps depend
on it as a normal versioned dependency — not a monorepo merge. Reasoning:
youthumber was just hardened specifically for standalone public release, and
autoraffkat is already its own public repo with its own README/CHANGELOG —
folding both into one workspace (like the `podcast` suite does for
`packages/speechmix`) would blur two products that are meant to stay
independently public. The tradeoff versus a monorepo package: a fix to the
shared shell needs a version bump + upgrade in each app rather than landing
in one commit — acceptable since this code changes rarely.

Not started. Revisit before building more GUI-shell logic in either app.

**Related wrinkle to sort out first:** autoraffkat currently exists as both
a standalone repo (`~/Documents/koodi/autoraffkat`) and a copy inside
`podcast/apps/autoraffkat`. Figure out which is canonical before extracting
shared code out of either one.

## Auto-extract all speakers from a single combined video — Done (2026-09-22)

Give the app the final edited episode video (with all speakers in it) and
it finds and extracts good frames for each speaker automatically — no
per-slot video needed.

Implemented in `youthumber/videoscan.py` (`scan_video_for_speakers`,
`_detect_all_faces`, `_crop_face`, `_feature_print`/`_feature_print_distance`,
`_cluster_faces_by_identity`), a new `/scan-video-speakers` endpoint in
`youthumber/server.py`, and `MultiSpeakerScanModal.jsx` +
`scanVideoForSpeakers()` in `src/services/videoScan.js` on the frontend:

1. Detects *all* faces per sampled frame (not just the largest) via
   `VNDetectFaceCaptureQualityRequest`.
2. Clusters same-person face crops across timestamps with
   `VNGenerateImageFeaturePrintRequest` + `computeDistanceToFeaturePrintObservation_error_`
   — Vision's own "are these two crops the same thing" primitive. No model
   bundling, no cloud. Threshold is `FACE_SIMILARITY_THRESHOLD` (empirical,
   tunable).
3. Surfaces each detected person's best frame in a grid; the user assigns
   each to Speaker 1 / Speaker 2 manually — doesn't assume left=host/right=guest.

Verified via: 19 Python unit/endpoint tests (pure clustering logic with an
injected fake distance function, real Vision feature-print sanity check,
real HTTP round-trip against a generated test video), and a full browser
run-through of the assign-to-slot UI flow with backend calls stubbed.

**Real-footage results (2026-09-23):** a fixed similarity threshold split a
two-person, ~1h render into 6 people; grouping into exactly the known number
of people instead found the two speakers correctly. Superseded since by the
1–4 speaker rebuild (v26.09.23.62), where the picker shows up to 12 frames
per person.
