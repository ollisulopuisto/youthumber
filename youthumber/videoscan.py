"""Finds good frames of each person in a local video, using AVFoundation + Vision.

Samples a frame every ``interval_seconds`` (skipping the very start), finds every face
in it, groups the faces into people, and scores each face three ways for the picker:

- quality: Apple's own "best frame" score (VNDetectFaceCaptureQualityRequest, what
  Photos uses for Top Shot) plus a sharpness proxy — sharp, well-lit, eyes open. It
  favours calm faces, so on its own it never surfaced smiles or gestures.
- expression: smile / open mouth / raised eyebrows, from face landmarks.
- gesture: a raised hand, most of all a pointing one, from hand pose — linked to the
  right person through body pose, since an arm can reach across the frame.

The pure scoring rules live in ``framescoring``.
"""

from __future__ import annotations

import io
import logging
import sys
from dataclasses import dataclass

from PIL import Image, ImageFilter

from .framescoring import (
    assign_hands_to_faces,
    expression_score,
    gesture_score,
    head_shoulders_box,
)
from .segmentation import image_to_data_url

logger = logging.getLogger(__name__)

# Tunable defaults. Adjust these to change how frames are sampled and ranked.
MIN_FACE_HEIGHT_RATIO = 0.08  # ignore faces smaller than this share of the frame height
CAPTURE_QUALITY_WEIGHT = 0.7  # Vision's own face capture-quality score
SHARPNESS_WEIGHT = 0.3  # blur/sharpness proxy, normalized across the candidate set
THUMBNAIL_MAX_SIDE = 640

# Multi-speaker grouping. VNGenerateImageFeaturePrintRequest is a generic image-similarity
# feature print, not a face-recognition embedding, so there is no reliable absolute
# "same person" distance: a fixed threshold of 0.3 split a real two-person, 1h render
# into 6 people (2026-09-23). Instead faces are grouped into exactly the number of
# people in the video, by average-linkage agglomerative clustering, which only needs
# same-person pairs to be *closer* than different-person pairs.
DEFAULT_NUM_PEOPLE = 2
DEFAULT_FRAMES_PER_PERSON = 12  # per sort mode, so up to 3x this many per person
# Smiles and gestures last a second or two; at 30s the scan (2026-09-23) found none.
# Every 5s is ~6x the work of 30s. Not yet timed on a full-length real video.
DEFAULT_SPEAKER_SCAN_INTERVAL_SECONDS = 5.0
IDENTITY_CROP_MARGIN = 0.1  # tight crop for the feature print, so background/camera angle weigh less
CORE_MEMBER_FRACTION = 0.5  # quality picks come from the half of a group closest to its centre
# Pairwise clustering is O(n^2) distances and O(n^3) merging: fine for a few hundred
# faces, hours for the ~2000 a 90-min video gives at 5s. Cluster a sample, assign the rest.
MAX_FACES_TO_CLUSTER = 300
MAX_REFERENCE_FACES = 40  # faces compared against when judging how typical a face is

HAS_AVFOUNDATION = False
if sys.platform == "darwin":
    try:
        import AVFoundation  # noqa: F401
        import CoreMedia  # noqa: F401
        import Quartz  # noqa: F401
        import Vision  # noqa: F401
        from Foundation import NSURL  # noqa: F401

        HAS_AVFOUNDATION = True
    except ImportError as e:
        logger.warning("AVFoundation/Vision not available for video scanning: %s", e)


@dataclass
class FaceInstance:
    """One detected face, at one timestamp. Keeps only its box, not pixels — the
    picker thumbnail is re-cut from the video for the few frames actually shown."""

    timestamp_seconds: float
    capture_quality: float
    face_height_ratio: float
    sharpness: float
    bbox: tuple[float, float, float, float]  # Vision normalized x, y (bottom), w, h
    feature_print: object | None = None
    expression: float = 0.0
    gesture: float = 0.0
    score: float = 0.0


def _cgimage_to_pil(cg_image) -> Image.Image:
    """Converts a CGImage to a PIL Image via a lossless PNG round-trip."""
    import Quartz

    data = Quartz.CFDataCreateMutable(None, 0)
    dest = Quartz.CGImageDestinationCreateWithData(data, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, cg_image, None)
    Quartz.CGImageDestinationFinalize(dest)
    return Image.open(io.BytesIO(bytes(data))).convert("RGB")


def _crop_cgimage(cg_image, box: tuple[int, int, int, int]):
    """Crops a CGImage to a (left, top, right, bottom) pixel box, top-left origin."""
    import Quartz

    left, top, right, bottom = box
    return Quartz.CGImageCreateWithImageInRect(
        cg_image, Quartz.CGRectMake(left, top, right - left, bottom - top)
    )


def _make_generator(video_path: str):
    import AVFoundation
    from Foundation import NSURL

    url = NSURL.fileURLWithPath_(video_path)
    asset = AVFoundation.AVURLAsset.alloc().initWithURL_options_(url, None)
    generator = AVFoundation.AVAssetImageGenerator.alloc().initWithAsset_(asset)
    generator.setAppliesPreferredTrackTransform_(True)
    return asset, generator


def _duration_seconds(asset) -> float:
    import CoreMedia

    return CoreMedia.CMTimeGetSeconds(asset.duration())


def grab_cgimage_at_time(generator, seconds: float):
    """Grabs a single frame's CGImage at the given time, or None if it couldn't be decoded."""
    import CoreMedia

    time_value = CoreMedia.CMTimeMakeWithSeconds(seconds, 600)
    cg_image, error = generator.copyCGImageAtTime_actualTime_error_(time_value, None, None)
    if cg_image is None:
        logger.debug("Could not decode frame at %.1fs: %s", seconds, error)
        return None
    return cg_image


def _landmark_points(region) -> list[tuple[float, float]]:
    # normalizedPoints() is an unsized C array in PyObjC; iterating it directly runs off
    # the end and crashes the process, so read exactly pointCount() entries.
    if region is None:
        return []
    raw = region.normalizedPoints()
    return [(float(raw[i].x), float(raw[i].y)) for i in range(region.pointCount())]


def _landmarks(observation) -> dict[str, list[tuple[float, float]]]:
    # Plain capture-quality observations have no landmarks(); only landmark results do.
    landmarks = observation.landmarks() if hasattr(observation, "landmarks") else None
    if landmarks is None:
        return {}
    return {
        "outerLips": _landmark_points(landmarks.outerLips()),
        "innerLips": _landmark_points(landmarks.innerLips()),
        "leftEyebrow": _landmark_points(landmarks.leftEyebrow()),
        "leftEye": _landmark_points(landmarks.leftEye()),
    }


def _joint(observation, name) -> tuple[float, float, float] | None:
    point, _err = observation.recognizedPointForJointName_error_(name, None)
    if point is None:
        return None
    location = point.location()
    return (float(location.x), float(location.y), float(point.confidence()))


def _hand_joints(observation) -> dict[str, tuple[float, float, float]]:
    import Vision

    names = {
        "wrist": Vision.VNHumanHandPoseObservationJointNameWrist,
        "indexMCP": Vision.VNHumanHandPoseObservationJointNameIndexMCP,
        "indexTip": Vision.VNHumanHandPoseObservationJointNameIndexTip,
        "middleMCP": Vision.VNHumanHandPoseObservationJointNameMiddleMCP,
        "middleTip": Vision.VNHumanHandPoseObservationJointNameMiddleTip,
        "ringMCP": Vision.VNHumanHandPoseObservationJointNameRingMCP,
        "ringTip": Vision.VNHumanHandPoseObservationJointNameRingTip,
        "littleMCP": Vision.VNHumanHandPoseObservationJointNameLittleMCP,
        "littleTip": Vision.VNHumanHandPoseObservationJointNameLittleTip,
    }
    joints = {key: _joint(observation, name) for key, name in names.items()}
    return {key: value for key, value in joints.items() if value is not None}


def _body_joints(observation) -> dict:
    import Vision

    wrists = [
        _joint(observation, Vision.VNHumanBodyPoseObservationJointNameLeftWrist),
        _joint(observation, Vision.VNHumanBodyPoseObservationJointNameRightWrist),
    ]
    return {
        "nose": _joint(observation, Vision.VNHumanBodyPoseObservationJointNameNose),
        "wrists": [w for w in wrists if w is not None],
    }


def _analyse_frame(cg_image, width: int, height: int) -> list[dict]:
    """Every usable face in a frame: its box, capture quality, expression and gesture."""
    import Vision

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    quality = Vision.VNDetectFaceCaptureQualityRequest.alloc().initWithCompletionHandler_(None)
    success, _err = handler.performRequests_error_([quality], None)
    if not success:
        return []
    faces = [
        f for f in (quality.results() or []) if f.boundingBox().size.height >= MIN_FACE_HEIGHT_RATIO
    ]
    if not faces:
        return []

    landmarks = Vision.VNDetectFaceLandmarksRequest.alloc().initWithCompletionHandler_(None)
    landmarks.setInputFaceObservations_(faces)
    hands = Vision.VNDetectHumanHandPoseRequest.alloc().initWithCompletionHandler_(None)
    hands.setMaximumHandCount_(6)
    bodies = Vision.VNDetectHumanBodyPoseRequest.alloc().initWithCompletionHandler_(None)
    handler.performRequests_error_([landmarks, hands, bodies], None)

    # Landmark results carry the same boxes and capture quality as the faces passed in.
    observed = list(landmarks.results() or []) or faces
    boxes = []
    for f in observed:
        b = f.boundingBox()
        boxes.append((float(b.origin.x), float(b.origin.y), float(b.size.width), float(b.size.height)))

    hand_list = [h for h in (_hand_joints(o) for o in (hands.results() or [])) if "wrist" in h]
    body_list = [_body_joints(o) for o in (bodies.results() or [])]
    owners = assign_hands_to_faces(boxes, body_list, [h["wrist"][:2] for h in hand_list])
    aspect = width / height if height else 16 / 9

    analysed = []
    for i, (observation, box) in enumerate(zip(observed, boxes)):
        own_hands = [hand for hand, owner in zip(hand_list, owners) if owner == i]
        analysed.append(
            {
                "bbox": box,
                "quality": float(observation.faceCaptureQuality() or 0.0),
                "expression": expression_score(_landmarks(observation)),
                "gesture": max((gesture_score(h, box, aspect) for h in own_hands), default=0.0),
            }
        )
    return analysed


def _feature_print(cg_image):
    """Computes a Vision feature print for an image, or None if it fails."""
    import Vision

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    request = Vision.VNGenerateImageFeaturePrintRequest.alloc().initWithCompletionHandler_(None)
    success, _err = handler.performRequests_error_([request], None)
    if not success:
        return None
    results = request.results() or []
    return results[0] if results else None


def _feature_print_distance(a, b) -> float:
    """Vision's own similarity distance between two feature prints (0 = identical)."""
    if a is None or b is None:
        return float("inf")
    return float(a.computeDistanceToFeaturePrintObservation_error_(b, None))


def _evenly_spaced(items: list, count: int) -> list:
    if len(items) <= count:
        return list(items)
    step = len(items) / count
    return [items[int(i * step)] for i in range(count)]


def _agglomerate(faces: list[FaceInstance], num_people: int, distance_fn) -> list[list[FaceInstance]]:
    """Average-linkage agglomerative clustering into ``num_people`` groups."""
    import numpy as np

    n = len(faces)
    dist = np.zeros((n, n), dtype="float64")
    for i in range(n):
        for j in range(i + 1, n):
            dist[i, j] = dist[j, i] = distance_fn(faces[i].feature_print, faces[j].feature_print)

    members: list[list[int]] = [[i] for i in range(n)]
    active = list(range(n))
    np.fill_diagonal(dist, np.inf)

    while len(active) > max(1, num_people):
        sub = dist[np.ix_(active, active)]
        flat = int(np.argmin(sub))
        a, b = active[flat // len(active)], active[flat % len(active)]
        if a == b:  # every remaining distance is inf; nothing meaningful left to merge
            break

        # Lance-Williams update for average linkage: distance to the merged group is the
        # size-weighted mean of the distances to its two halves.
        size_a, size_b = len(members[a]), len(members[b])
        merged = (size_a * dist[a] + size_b * dist[b]) / (size_a + size_b)
        dist[a], dist[:, a] = merged, merged
        dist[a, a] = np.inf
        members[a].extend(members[b])
        active.remove(b)

    return [[faces[i] for i in members[g]] for g in active]


def _group_faces(
    faces: list[FaceInstance],
    num_people: int = DEFAULT_NUM_PEOPLE,
    distance_fn=_feature_print_distance,
    max_samples: int = MAX_FACES_TO_CLUSTER,
) -> list[list[FaceInstance]]:
    """Groups faces into ``num_people`` people.

    Clusters an evenly spaced sample of at most ``max_samples`` faces, then gives every
    other face to the group it is closest to on average. Faces whose feature print
    couldn't be computed are dropped.
    """
    faces = [f for f in faces if f.feature_print is not None]
    if not faces:
        return []

    sample = _evenly_spaced(faces, max_samples)
    groups = _agglomerate(sample, num_people, distance_fn)
    if len(sample) == len(faces):
        return groups

    sampled = {id(f) for f in sample}
    references = [_evenly_spaced(g, 15) for g in groups]
    for face in faces:
        if id(face) in sampled:
            continue
        mean_distances = [
            sum(distance_fn(face.feature_print, r.feature_print) for r in refs) / len(refs)
            for refs in references
        ]
        groups[mean_distances.index(min(mean_distances))].append(face)
    return groups


def _core_members(
    group: list[FaceInstance],
    distance_fn=_feature_print_distance,
    keep_fraction: float = CORE_MEMBER_FRACTION,
    max_references: int = MAX_REFERENCE_FACES,
) -> list[FaceInstance]:
    """Returns the part of a group closest to its centre (lowest mean distance to the rest).

    Forcing faces into a fixed number of groups means a stray third person or false
    detection lands in someone's group; picking quality frames only from the core keeps
    it from becoming that person's thumbnail. Big groups are compared against an evenly
    spaced sample of ``max_references`` members rather than everyone.
    """
    if len(group) <= 2:
        return list(group)

    references = _evenly_spaced(group, max_references)

    def mean_distance(face: FaceInstance) -> float:
        others = [distance_fn(face.feature_print, r.feature_print) for r in references if r is not face]
        return sum(others) / len(others)

    ranked = sorted(group, key=mean_distance)
    keep = max(1, round(len(group) * keep_fraction))
    return ranked[:keep]


def _frames_for_person(
    group: list[FaceInstance],
    max_frames: int = DEFAULT_FRAMES_PER_PERSON,
    distance_fn=_feature_print_distance,
) -> list[FaceInstance]:
    """A person's frames by quality, best first.

    The core of the group (most typical shots) comes first, ranked by quality, then the
    rest — so a stray face grouped with this person can't top the list.
    """
    core = _core_members(group, distance_fn=distance_fn)
    core_ids = {id(f) for f in core}
    rest = [f for f in group if id(f) not in core_ids]
    return (_rank_candidates(core) + _rank_candidates(rest))[:max_frames]


def _select_frames(
    group: list[FaceInstance],
    per_mode: int = DEFAULT_FRAMES_PER_PERSON,
    distance_fn=_feature_print_distance,
) -> list[FaceInstance]:
    """The frames to send to the picker: the top ``per_mode`` by quality, by expression and
    by gesture, without duplicates — the picker re-sorts them by whichever mode is chosen."""
    by_quality = _frames_for_person(group, max_frames=per_mode, distance_fn=distance_fn)
    by_expression = sorted(group, key=lambda f: f.expression, reverse=True)[:per_mode]
    by_gesture = sorted(group, key=lambda f: f.gesture, reverse=True)[:per_mode]

    selected, seen = [], set()
    for face in by_quality + by_expression + by_gesture:
        if id(face) not in seen:
            seen.add(id(face))
            selected.append(face)
    return selected


def _sharpness_score(pil_image: Image.Image) -> float:
    """Cheap blur/sharpness proxy: variance of an edge-detected, downscaled grayscale image."""
    import numpy as np

    gray = pil_image.convert("L")
    scale = 320 / gray.width
    gray = gray.resize((320, max(1, round(gray.height * scale))))
    edges = gray.filter(ImageFilter.FIND_EDGES)
    return float(np.asarray(edges, dtype="float32").var())


def _rank_candidates(candidates: list[FaceInstance]) -> list[FaceInstance]:
    """Combines capture quality and normalized sharpness into a single score, sorted best-first."""
    if not candidates:
        return []

    sharpness_values = [c.sharpness for c in candidates]
    lo, hi = min(sharpness_values), max(sharpness_values)
    spread = (hi - lo) or 1.0

    for c in candidates:
        normalized_sharpness = (c.sharpness - lo) / spread
        c.score = (
            CAPTURE_QUALITY_WEIGHT * c.capture_quality + SHARPNESS_WEIGHT * normalized_sharpness
        )

    return sorted(candidates, key=lambda c: c.score, reverse=True)


def grab_frame_at_time(video_path: str, timestamp_seconds: float) -> str:
    """Grabs a single full-resolution frame from a video at the given timestamp as a data URL."""
    if not HAS_AVFOUNDATION:
        raise RuntimeError("Frame grabbing requires macOS AVFoundation")

    _asset, generator = _make_generator(video_path)
    cg_image = grab_cgimage_at_time(generator, timestamp_seconds)
    if cg_image is None:
        raise RuntimeError(f"Could not decode frame at {timestamp_seconds}s")

    pil_image = _cgimage_to_pil(cg_image)
    return image_to_data_url(pil_image, format="PNG")


def scan_video_for_speakers(
    video_path: str,
    interval_seconds: float = DEFAULT_SPEAKER_SCAN_INTERVAL_SECONDS,
    num_people: int = DEFAULT_NUM_PEOPLE,
    frames_per_person: int = DEFAULT_FRAMES_PER_PERSON,
) -> list[dict]:
    """Samples a video, scores every face, groups the faces into ``num_people`` people,
    and returns each person's candidate frames with all three scores.

    Returns ``[{frameCount, frames: [{timestampSeconds, image, scores}]}]``, most-seen
    person first. ``image`` is a head-and-shoulders thumbnail for the picker; the full
    frame is fetched with ``grab_frame_at_time`` once the user picks one.
    """
    import Quartz

    if not HAS_AVFOUNDATION:
        raise RuntimeError("Video scanning requires macOS AVFoundation and Vision")

    asset, generator = _make_generator(video_path)
    duration = _duration_seconds(asset)
    if duration <= 0:
        raise RuntimeError("Could not read video duration")

    faces: list[FaceInstance] = []
    t = min(interval_seconds / 2, duration / 2)
    while t < duration:
        cg_image = grab_cgimage_at_time(generator, t)
        if cg_image is not None:
            width, height = Quartz.CGImageGetWidth(cg_image), Quartz.CGImageGetHeight(cg_image)
            for face in _analyse_frame(cg_image, width, height):
                box = head_shoulders_box(
                    face["bbox"],
                    width,
                    height,
                    side=IDENTITY_CROP_MARGIN,
                    above=IDENTITY_CROP_MARGIN,
                    below=IDENTITY_CROP_MARGIN,
                )
                if box[2] - box[0] < 8 or box[3] - box[1] < 8:
                    continue
                identity_crop = _crop_cgimage(cg_image, box)
                faces.append(
                    FaceInstance(
                        timestamp_seconds=t,
                        capture_quality=face["quality"],
                        face_height_ratio=face["bbox"][3],
                        sharpness=_sharpness_score(_cgimage_to_pil(identity_crop)),
                        bbox=face["bbox"],
                        feature_print=_feature_print(identity_crop),
                        expression=face["expression"],
                        gesture=face["gesture"],
                    )
                )
        t += interval_seconds

    groups = _group_faces(faces, num_people=num_people)
    selections = [_select_frames(group, per_mode=frames_per_person) for group in groups]

    # Decode each chosen timestamp once and cut every thumbnail it holds, one frame in
    # memory at a time (holding all of them was up to ~70 full-HD frames).
    thumbnails: dict[int, str] = {}
    by_time: dict[float, list[FaceInstance]] = {}
    for face in (f for chosen in selections for f in chosen):
        by_time.setdefault(face.timestamp_seconds, []).append(face)
    for seconds in sorted(by_time):
        cg = grab_cgimage_at_time(generator, seconds)
        if cg is None:
            continue
        frame = _cgimage_to_pil(cg)
        for face in by_time[seconds]:
            thumb = frame.crop(head_shoulders_box(face.bbox, frame.width, frame.height))
            thumb.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE))
            thumbnails[id(face)] = image_to_data_url(thumb, format="JPEG")

    results = []
    for group, chosen in zip(groups, selections):
        frames = [
            {
                "timestampSeconds": round(face.timestamp_seconds, 1),
                "image": thumbnails[id(face)],
                "scores": {
                    "quality": round(face.score, 4),
                    "expression": round(face.expression, 4),
                    "gesture": round(face.gesture, 4),
                },
            }
            for face in chosen
            if id(face) in thumbnails
        ]
        results.append({"frameCount": len(group), "frames": frames})

    # Surface the most consistently-appearing people first — likely the main speakers,
    # ahead of background extras or one-off false detections.
    results.sort(key=lambda r: r["frameCount"], reverse=True)
    return results
