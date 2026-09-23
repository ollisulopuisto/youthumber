"""Unit tests for video frame scanning: pure ranking/clustering logic and endpoint error paths."""

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from youthumber.server import create_app
from youthumber.videoscan import (
    FaceInstance,
    FrameCandidate,
    _cluster_faces_by_identity,
    _rank_candidates,
)


def _candidate(quality: float, sharpness: float, t: float = 0.0) -> FrameCandidate:
    return FrameCandidate(
        timestamp_seconds=t,
        capture_quality=quality,
        face_height_ratio=0.3,
        sharpness=sharpness,
        image=Image.new("RGB", (4, 4)),
    )


def _face(identity_label: str, quality: float = 0.5, sharpness: float = 100.0, t: float = 0.0) -> FaceInstance:
    # feature_print is normally a VNFeaturePrintObservation; tests stand in a plain
    # label and a fake distance_fn below, so no real Vision call is needed.
    return FaceInstance(
        timestamp_seconds=t,
        capture_quality=quality,
        face_height_ratio=0.3,
        sharpness=sharpness,
        crop=Image.new("RGB", (4, 4)),
        feature_print=identity_label,
    )


def _label_distance(a: str, b: str) -> float:
    return 0.0 if a == b else 1.0


def test_rank_candidates_prefers_higher_capture_quality() -> None:
    low = _candidate(quality=0.2, sharpness=100.0, t=0.0)
    high = _candidate(quality=0.9, sharpness=100.0, t=60.0)

    ranked = _rank_candidates([low, high])

    assert ranked[0] is high
    assert ranked[0].score > ranked[1].score


def test_rank_candidates_normalizes_sharpness_across_the_set() -> None:
    blurry = _candidate(quality=0.5, sharpness=10.0, t=0.0)
    sharp = _candidate(quality=0.5, sharpness=500.0, t=60.0)

    ranked = _rank_candidates([blurry, sharp])

    # Equal capture quality, so the sharper frame should win on the tiebreaker.
    assert ranked[0] is sharp


def test_rank_candidates_handles_identical_sharpness_without_division_by_zero() -> None:
    a = _candidate(quality=0.3, sharpness=42.0, t=0.0)
    b = _candidate(quality=0.7, sharpness=42.0, t=60.0)

    ranked = _rank_candidates([a, b])

    assert ranked[0] is b
    assert all(0.0 <= c.score <= 1.0 for c in ranked)


def test_rank_candidates_empty_list_returns_empty() -> None:
    assert _rank_candidates([]) == []


def test_rank_candidates_also_works_on_face_instances() -> None:
    # _rank_candidates is shared between FrameCandidate and FaceInstance by duck typing.
    low = _face("a", quality=0.2, sharpness=100.0)
    high = _face("a", quality=0.9, sharpness=100.0)

    ranked = _rank_candidates([low, high])

    assert ranked[0] is high


def test_cluster_faces_groups_same_identity_together() -> None:
    alice1 = _face("alice", t=0.0)
    alice2 = _face("alice", t=60.0)
    bob1 = _face("bob", t=30.0)

    clusters = _cluster_faces_by_identity(
        [alice1, bob1, alice2], distance_fn=_label_distance, threshold=0.5
    )

    assert len(clusters) == 2
    identities = {frozenset(f.feature_print for f in cluster) for cluster in clusters}
    assert identities == {frozenset({"alice"}), frozenset({"bob"})}


def test_cluster_faces_respects_max_clusters_cap() -> None:
    faces = [_face(f"person-{i}", t=float(i)) for i in range(10)]

    clusters = _cluster_faces_by_identity(
        faces, distance_fn=_label_distance, threshold=0.5, max_clusters=3
    )

    assert len(clusters) == 3
    # Faces beyond the cap are dropped, not merged into an existing cluster.
    assert sum(len(c) for c in clusters) == 3


def test_cluster_faces_empty_list_returns_empty() -> None:
    assert _cluster_faces_by_identity([], distance_fn=_label_distance) == []


def test_cluster_faces_treats_missing_feature_print_as_always_distinct() -> None:
    # The real _feature_print_distance returns inf for None inputs, so a face whose
    # feature print extraction failed should never merge into another cluster.
    from youthumber.videoscan import _feature_print_distance

    a = FaceInstance(
        timestamp_seconds=0.0,
        capture_quality=0.5,
        face_height_ratio=0.3,
        sharpness=100.0,
        crop=Image.new("RGB", (4, 4)),
        feature_print=None,
    )
    b = FaceInstance(
        timestamp_seconds=1.0,
        capture_quality=0.5,
        face_height_ratio=0.3,
        sharpness=100.0,
        crop=Image.new("RGB", (4, 4)),
        feature_print=None,
    )

    clusters = _cluster_faces_by_identity([a, b], distance_fn=_feature_print_distance)

    assert len(clusters) == 2


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_health_reports_video_scan_capability(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert "hasVideoScan" in res.json()


def test_scan_video_rejects_missing_file(client: TestClient) -> None:
    res = client.post(
        "/scan-video",
        json={"path": "/nonexistent/path/video.mp4", "intervalSeconds": 60, "maxCandidates": 12},
    )
    assert res.status_code == 400


def test_grab_frame_rejects_missing_file(client: TestClient) -> None:
    res = client.post(
        "/grab-frame",
        json={"path": "/nonexistent/path/video.mp4", "timestampSeconds": 10},
    )
    assert res.status_code == 400


def test_scan_video_validates_request_body(client: TestClient) -> None:
    res = client.post("/scan-video", json={})
    assert res.status_code == 422


def test_scan_video_speakers_rejects_missing_file(client: TestClient) -> None:
    res = client.post(
        "/scan-video-speakers",
        json={"path": "/nonexistent/path/video.mp4", "intervalSeconds": 60, "maxPeople": 6},
    )
    assert res.status_code == 400


def test_scan_video_speakers_validates_request_body(client: TestClient) -> None:
    res = client.post("/scan-video-speakers", json={})
    assert res.status_code == 422
