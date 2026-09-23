"""Unit tests for video frame scanning: pure ranking/clustering logic and endpoint error paths."""

import pytest
from fastapi.testclient import TestClient

from youthumber.server import create_app
from youthumber.videoscan import (
    FaceInstance,
    _core_members,
    _frames_for_person,
    _group_faces,
    _rank_candidates,
    _select_frames,
)


def _candidate(quality: float, sharpness: float, t: float = 0.0) -> FaceInstance:
    return _face("a", quality=quality, sharpness=sharpness, t=t)


def _face(
    identity_label: str,
    quality: float = 0.5,
    sharpness: float = 100.0,
    t: float = 0.0,
    expression: float = 0.0,
    gesture: float = 0.0,
) -> FaceInstance:
    # feature_print is normally a VNFeaturePrintObservation; tests stand in a plain
    # label and a fake distance_fn below, so no real Vision call is needed.
    return FaceInstance(
        timestamp_seconds=t,
        capture_quality=quality,
        face_height_ratio=0.3,
        sharpness=sharpness,
        bbox=(0.4, 0.4, 0.2, 0.3),
        feature_print=identity_label,
        expression=expression,
        gesture=gesture,
    )


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
            bbox=(0.4, 0.4, 0.2, 0.3),
            feature_print=None,
        )
    )

    groups = _group_faces(faces, num_people=2, distance_fn=_noisy_distance)

    assert all(f.feature_print is not None for g in groups for f in g)


def test_frames_for_person_lists_core_frames_first_then_the_rest_up_to_max() -> None:
    core = [_face(f"host#{i}", quality=0.3 + i * 0.1, t=float(i)) for i in range(4)]
    stranger = _face("stranger#0", quality=0.99, t=99.0)

    frames = _frames_for_person(
        core + [stranger], max_frames=12, distance_fn=_noisy_distance
    )

    # The typical (core) frames lead; the high-quality stray face is still offered,
    # just never ahead of them.
    core_count = len(_core_members(core + [stranger], distance_fn=_noisy_distance))
    assert all(f.feature_print.startswith("host") for f in frames[:core_count])
    assert stranger in frames[core_count:]
    assert len(frames) == 5


def test_frames_for_person_caps_at_max_frames() -> None:
    group = [_face(f"host#{i}", t=float(i)) for i in range(20)]

    assert (
        len(_frames_for_person(group, max_frames=12, distance_fn=_noisy_distance)) == 12
    )


def test_group_faces_clusters_a_sample_then_assigns_everyone_when_there_are_many_faces() -> (
    None
):
    # At one frame every 5s a 90-min video yields ~2000 faces; clustering all of them
    # pairwise would take hours, so only a sample is clustered and the rest assigned.
    faces = [_face(f"host#{i}", t=float(i)) for i in range(60)] + [
        _face(f"guest#{i}", t=100.0 + i) for i in range(40)
    ]

    groups = _group_faces(
        faces, num_people=2, distance_fn=_noisy_distance, max_samples=20
    )

    assert sum(len(g) for g in groups) == 100
    people = {frozenset(f.feature_print.split("#")[0] for f in g) for g in groups}
    assert people == {frozenset({"host"}), frozenset({"guest"})}


def test_core_members_uses_a_sample_of_references_for_big_groups() -> None:
    group = [_face(f"host#{i}", quality=0.5) for i in range(50)] + [
        _face("stranger#0", quality=0.99)
    ]

    core = _core_members(group, distance_fn=_noisy_distance, max_references=10)

    assert all(f.feature_print.startswith("host") for f in core)


def test_select_frames_covers_quality_expression_and_gesture_without_duplicates() -> (
    None
):
    group = [_face(f"host#{i}", quality=0.9 - i * 0.01, t=float(i)) for i in range(30)]
    group[25].expression = 0.95  # low quality, but the best smile
    group[28].gesture = 0.9  # low quality, but pointing

    frames = _select_frames(group, per_mode=5, distance_fn=_noisy_distance)

    assert group[25] in frames and group[28] in frames
    assert len(frames) == len({id(f) for f in frames}) <= 15


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


def test_grab_frame_rejects_missing_file(client: TestClient) -> None:
    res = client.post(
        "/grab-frame",
        json={"path": "/nonexistent/path/video.mp4", "timestampSeconds": 10},
    )
    assert res.status_code == 400


def test_scan_video_speakers_rejects_missing_file(client: TestClient) -> None:
    res = client.post(
        "/scan-video-speakers",
        json={
            "path": "/nonexistent/path/video.mp4",
            "intervalSeconds": 60,
            "numPeople": 2,
        },
    )
    assert res.status_code == 400


def test_scan_video_speakers_validates_request_body(client: TestClient) -> None:
    res = client.post("/scan-video-speakers", json={})
    assert res.status_code == 422
