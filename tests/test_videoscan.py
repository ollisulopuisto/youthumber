"""Unit tests for video frame scanning: pure ranking/clustering logic and endpoint error paths."""

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from youthumber.server import create_app
from youthumber.videoscan import (
    FaceInstance,
    FrameCandidate,
    _core_members,
    _group_faces,
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


def _noisy_distance(a: str, b: str) -> float:
    # Mirrors real footage: the same person across camera angles is NOT near-zero
    # distance (0.45 here), just consistently closer than two different people (0.9).
    # A fixed "same person below 0.3" threshold split 2 real people into 6 cards.
    if a == b:
        return 0.0
    same_person = a.split("#")[0] == b.split("#")[0]
    return 0.45 if same_person else 0.9


def test_group_faces_finds_two_people_despite_high_same_person_distance() -> None:
    faces = [_face(f"host#{i}", t=float(i)) for i in range(5)] + [
        _face(f"guest#{i}", t=100.0 + i) for i in range(4)
    ]

    groups = _group_faces(faces, num_people=2, distance_fn=_noisy_distance)

    assert len(groups) == 2
    people = {frozenset(f.feature_print.split("#")[0] for f in g) for g in groups}
    assert people == {frozenset({"host"}), frozenset({"guest"})}


def test_group_faces_returns_fewer_groups_when_fewer_faces_than_people() -> None:
    groups = _group_faces([_face("host#0")], num_people=2, distance_fn=_noisy_distance)

    assert len(groups) == 1


def test_group_faces_empty_list_returns_empty() -> None:
    assert _group_faces([], num_people=2, distance_fn=_noisy_distance) == []


def test_group_faces_drops_faces_without_feature_print() -> None:
    faces = [_face("host#0"), _face("host#1")]
    faces.append(
        FaceInstance(
            timestamp_seconds=9.0,
            capture_quality=0.9,
            face_height_ratio=0.3,
            sharpness=100.0,
            crop=Image.new("RGB", (4, 4)),
            feature_print=None,
        )
    )

    groups = _group_faces(faces, num_people=2, distance_fn=_noisy_distance)

    assert all(f.feature_print is not None for g in groups for f in g)


def test_core_members_excludes_outlier_from_best_frame_pool() -> None:
    # A one-off face forced into a person's group (a third person, a false detection)
    # must not be picked as that person's best frame, even with the top quality score.
    group = [_face(f"host#{i}", quality=0.5) for i in range(4)] + [
        _face("stranger#0", quality=0.99)
    ]

    core = _core_members(group, distance_fn=_noisy_distance)

    assert all(f.feature_print.startswith("host") for f in core)
    assert core


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
        json={"path": "/nonexistent/path/video.mp4", "intervalSeconds": 60, "numPeople": 2},
    )
    assert res.status_code == 400


def test_scan_video_speakers_validates_request_body(client: TestClient) -> None:
    res = client.post("/scan-video-speakers", json={})
    assert res.status_code == 422
