"""Scans a local video file for well-framed, in-focus faces using AVFoundation + Vision.

Samples a frame every ``interval_seconds`` (skipping the very start), scores each
sampled frame with Apple's own "best frame" API (VNDetectFaceCaptureQualityRequest,
the same signal Photos uses for Top Shot) plus a cheap sharpness proxy, and returns
the top-scoring candidates for the user to pick from manually.
"""

from __future__ import annotations

import io
import logging
import sys
from dataclasses import dataclass

from PIL import Image, ImageFilter

from .segmentation import image_to_data_url

logger = logging.getLogger(__name__)

# Tunable defaults. Adjust these to change how frames are sampled and ranked.
DEFAULT_INTERVAL_SECONDS = 60.0
DEFAULT_MAX_CANDIDATES = 12
MIN_FACE_HEIGHT_RATIO = 0.08  # reject frames where the largest face is smaller than this (of frame height)
CAPTURE_QUALITY_WEIGHT = 0.7  # Vision's own face capture-quality score
SHARPNESS_WEIGHT = 0.3  # blur/sharpness proxy, normalized across the candidate set
THUMBNAIL_MAX_SIDE = 640

# Multi-speaker grouping. VNGenerateImageFeaturePrintRequest is a generic image-similarity
# feature print, not a face-recognition embedding, so there is no reliable absolute
# "same person" distance: a fixed threshold of 0.3 split a real two-person, 1h render
# into 6 people (2026-09-23). Instead faces are grouped into exactly the number of
# speakers the project has, by average-linkage agglomerative clustering, which only
# needs same-person pairs to be *closer* than different-person pairs.
DEFAULT_NUM_PEOPLE = 2
IDENTITY_CROP_MARGIN = 0.1  # tight crop for the feature print, so background/camera angle weigh less
THUMBNAIL_CROP_MARGIN = 0.4  # looser crop (hair/shoulders) for the picker thumbnail
CORE_MEMBER_FRACTION = 0.5  # best frame is picked from the half of a group closest to its centre

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
class FrameCandidate:
    timestamp_seconds: float
    capture_quality: float
    face_height_ratio: float
    sharpness: float
    image: Image.Image
    score: float = 0.0


@dataclass
class FaceInstance:
    """One detected face crop, at one timestamp, awaiting identity clustering."""

    timestamp_seconds: float
    capture_quality: float
    face_height_ratio: float
    sharpness: float
    crop: Image.Image
    feature_print: object | None = None
    score: float = 0.0


def _cgimage_to_pil(cg_image) -> Image.Image:
    """Converts a CGImage to a PIL Image via a lossless PNG round-trip."""
    import Quartz

    data = Quartz.CFDataCreateMutable(None, 0)
    dest = Quartz.CGImageDestinationCreateWithData(data, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, cg_image, None)
    Quartz.CGImageDestinationFinalize(dest)
    return Image.open(io.BytesIO(bytes(data))).convert("RGB")


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


def _face_quality(cg_image) -> tuple[bool, float, float]:
    """Returns (has_face, capture_quality, largest_face_height_ratio) for a frame."""
    import Vision

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    quality_request = Vision.VNDetectFaceCaptureQualityRequest.alloc().initWithCompletionHandler_(
        None
    )
    rect_request = Vision.VNDetectFaceRectanglesRequest.alloc().initWithCompletionHandler_(None)

    success, _err = handler.performRequests_error_([quality_request, rect_request], None)
    if not success:
        return False, 0.0, 0.0

    rects = rect_request.results() or []
    qualities = quality_request.results() or []
    if not rects:
        return False, 0.0, 0.0

    largest = max(rects, key=lambda r: r.boundingBox().size.height)
    face_height_ratio = float(largest.boundingBox().size.height)
    capture_quality = max((float(q.faceCaptureQuality()) for q in qualities), default=0.0)

    return True, capture_quality, face_height_ratio


def _detect_all_faces(cg_image) -> list[tuple]:
    """Returns (boundingBox, capture_quality) for every face Vision finds in the frame.

    ``VNDetectFaceCaptureQualityRequest`` observations carry both fields directly, so
    a separate rectangles request isn't needed.
    """
    import Vision

    handler = Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(cg_image, None)
    quality_request = Vision.VNDetectFaceCaptureQualityRequest.alloc().initWithCompletionHandler_(
        None
    )
    success, _err = handler.performRequests_error_([quality_request], None)
    if not success:
        return []
    return [
        (obs.boundingBox(), float(obs.faceCaptureQuality()))
        for obs in (quality_request.results() or [])
    ]


def _crop_face(pil_image: Image.Image, bbox, margin: float = THUMBNAIL_CROP_MARGIN) -> Image.Image:
    """Crops a face region from a full frame given Vision's normalized bbox.

    Vision's bounding box origin is bottom-left; PIL's is top-left. ``margin`` expands
    the crop outward (as a fraction of the face's own size) to include some context.
    """
    width, height = pil_image.size
    x, y = bbox.origin.x, bbox.origin.y
    w, h = bbox.size.width, bbox.size.height

    x0 = max(0.0, x - w * margin)
    y0 = max(0.0, y - h * margin)
    x1 = min(1.0, x + w * (1 + margin))
    y1 = min(1.0, y + h * (1 + margin))

    left = x0 * width
    right = x1 * width
    top = (1 - y1) * height
    bottom = (1 - y0) * height

    return pil_image.crop((int(left), int(top), int(right), int(bottom)))


def _pil_to_cgimage(pil_image: Image.Image):
    """Converts a PIL Image to a CGImage via a lossless PNG round-trip."""
    import Quartz
    from Foundation import NSData

    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    ns_data = NSData.dataWithBytes_length_(buf.getvalue(), len(buf.getvalue()))
    source = Quartz.CGImageSourceCreateWithData(ns_data, None)
    return Quartz.CGImageSourceCreateImageAtIndex(source, 0, None)


def _feature_print(pil_image: Image.Image):
    """Computes a Vision feature print for an image crop, or None if it fails."""
    import Vision

    cg_image = _pil_to_cgimage(pil_image)
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


def _group_faces(
    faces: list[FaceInstance],
    num_people: int = DEFAULT_NUM_PEOPLE,
    distance_fn=_feature_print_distance,
) -> list[list[FaceInstance]]:
    """Groups faces into ``num_people`` people by average-linkage agglomerative clustering.

    Starts with every face in its own group and repeatedly merges the two groups with
    the smallest mean pairwise distance until ``num_people`` remain. Faces whose
    feature print couldn't be computed are dropped.
    """
    import numpy as np

    faces = [f for f in faces if f.feature_print is not None]
    n = len(faces)
    if n == 0:
        return []

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


def _core_members(
    group: list[FaceInstance],
    distance_fn=_feature_print_distance,
    keep_fraction: float = CORE_MEMBER_FRACTION,
) -> list[FaceInstance]:
    """Returns the part of a group closest to its centre (lowest mean distance to the rest).

    Forcing faces into a fixed number of groups means a stray third person or false
    detection lands in someone's group; picking the best frame only from the core keeps
    it from becoming that person's thumbnail.
    """
    if len(group) <= 2:
        return list(group)

    def mean_distance(face: FaceInstance) -> float:
        others = [distance_fn(face.feature_print, o.feature_print) for o in group if o is not face]
        return sum(others) / len(others)

    ranked = sorted(group, key=mean_distance)
    keep = max(1, round(len(group) * keep_fraction))
    return ranked[:keep]


def _sharpness_score(pil_image: Image.Image) -> float:
    """Cheap blur/sharpness proxy: variance of an edge-detected, downscaled grayscale frame."""
    import numpy as np

    gray = pil_image.convert("L")
    scale = 320 / gray.width
    gray = gray.resize((320, max(1, round(gray.height * scale))))
    edges = gray.filter(ImageFilter.FIND_EDGES)
    return float(np.asarray(edges, dtype="float32").var())


def _rank_candidates(candidates: list) -> list:
    """Combines capture quality and normalized sharpness into a single score, sorted best-first.

    Works on any list of objects with ``.capture_quality``, ``.sharpness`` and a settable
    ``.score`` — both ``FrameCandidate`` and ``FaceInstance`` qualify.
    """
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


def scan_video_for_best_frames(
    video_path: str,
    interval_seconds: float = DEFAULT_INTERVAL_SECONDS,
    max_candidates: int = DEFAULT_MAX_CANDIDATES,
) -> list[dict]:
    """Samples a video at regular intervals and returns the top-scoring, face-containing frames."""
    if not HAS_AVFOUNDATION:
        raise RuntimeError("Video scanning requires macOS AVFoundation and Vision")

    asset, generator = _make_generator(video_path)
    duration = _duration_seconds(asset)
    if duration <= 0:
        raise RuntimeError("Could not read video duration")

    candidates: list[FrameCandidate] = []
    t = min(interval_seconds / 2, duration / 2)
    while t < duration:
        cg_image = grab_cgimage_at_time(generator, t)
        if cg_image is not None:
            has_face, capture_quality, face_height_ratio = _face_quality(cg_image)
            if has_face and face_height_ratio >= MIN_FACE_HEIGHT_RATIO:
                pil_image = _cgimage_to_pil(cg_image)
                candidates.append(
                    FrameCandidate(
                        timestamp_seconds=t,
                        capture_quality=capture_quality,
                        face_height_ratio=face_height_ratio,
                        sharpness=_sharpness_score(pil_image),
                        image=pil_image,
                    )
                )
        t += interval_seconds

    ranked = _rank_candidates(candidates)[:max_candidates]

    results = []
    for c in ranked:
        thumb = c.image.copy()
        thumb.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE))
        results.append(
            {
                "timestampSeconds": round(c.timestamp_seconds, 1),
                "score": round(c.score, 4),
                "captureQuality": round(c.capture_quality, 4),
                "image": image_to_data_url(thumb, format="JPEG"),
            }
        )
    return results


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
    interval_seconds: float = DEFAULT_INTERVAL_SECONDS,
    num_people: int = DEFAULT_NUM_PEOPLE,
) -> list[dict]:
    """Samples a video, detects every face per frame, groups the faces into
    ``num_people`` people, and returns each person's best-scoring frame — for the caller
    to let the user assign each person to a speaker slot.

    The returned frame is only a face-crop thumbnail for identification in a picker UI;
    the actual full frame (for background removal / auto-framing) is fetched separately
    via ``grab_frame_at_time`` once the user picks a person's timestamp.
    """
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
            detections = _detect_all_faces(cg_image)
            frame_pil = None
            for bbox, capture_quality in detections:
                if bbox.size.height < MIN_FACE_HEIGHT_RATIO:
                    continue
                if frame_pil is None:
                    frame_pil = _cgimage_to_pil(cg_image)
                crop = _crop_face(frame_pil, bbox, THUMBNAIL_CROP_MARGIN)
                identity_crop = _crop_face(frame_pil, bbox, IDENTITY_CROP_MARGIN)
                if identity_crop.width < 8 or identity_crop.height < 8:
                    continue
                faces.append(
                    FaceInstance(
                        timestamp_seconds=t,
                        capture_quality=capture_quality,
                        face_height_ratio=float(bbox.size.height),
                        sharpness=_sharpness_score(identity_crop),
                        crop=crop,
                        feature_print=_feature_print(identity_crop),
                    )
                )
        t += interval_seconds

    groups = _group_faces(faces, num_people=num_people)

    results = []
    for group in groups:
        best = _rank_candidates(_core_members(group))[0]
        thumb = best.crop.copy()
        thumb.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE))
        results.append(
            {
                "timestampSeconds": round(best.timestamp_seconds, 1),
                "score": round(best.score, 4),
                "captureQuality": round(best.capture_quality, 4),
                "frameCount": len(group),
                "image": image_to_data_url(thumb, format="JPEG"),
            }
        )

    # Surface the most consistently-appearing people first — likely the main speakers,
    # ahead of background extras or one-off false detections.
    results.sort(key=lambda r: r["frameCount"], reverse=True)
    return results
