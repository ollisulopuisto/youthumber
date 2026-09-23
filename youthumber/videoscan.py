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

# Multi-speaker identity clustering (VNGenerateImageFeaturePrintRequest is a generic
# image-similarity feature print, not a dedicated face-recognition embedding — it's a
# well-known Apple-native stand-in for "are these two face crops the same person" that
# needs no bundled model. The threshold below is empirical; tune if people get merged
# or split incorrectly.
FACE_SIMILARITY_THRESHOLD = 0.3  # feature-print distance below this = same person
FACE_CROP_MARGIN = 0.4  # extra context (hair/shoulders) around each face bbox, as a fraction of its size
DEFAULT_MAX_PEOPLE = 6  # safety cap so a noisy video doesn't explode into dozens of "people"

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


def _crop_face(pil_image: Image.Image, bbox, margin: float = FACE_CROP_MARGIN) -> Image.Image:
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


def _cluster_faces_by_identity(
    faces: list[FaceInstance],
    distance_fn=_feature_print_distance,
    threshold: float = FACE_SIMILARITY_THRESHOLD,
    max_clusters: int = DEFAULT_MAX_PEOPLE,
) -> list[list[FaceInstance]]:
    """Greedily groups face instances by visual identity.

    Each face joins the closest existing cluster (compared against that cluster's
    first face) if under ``threshold``, else starts a new cluster, up to
    ``max_clusters``. Faces beyond the cap are dropped (most likely false-positive
    detections rather than a 7th speaker).
    """
    clusters: list[list[FaceInstance]] = []
    for face in faces:
        best_cluster = None
        best_distance = threshold
        for cluster in clusters:
            distance = distance_fn(face.feature_print, cluster[0].feature_print)
            if distance < best_distance:
                best_distance = distance
                best_cluster = cluster
        if best_cluster is not None:
            best_cluster.append(face)
        elif len(clusters) < max_clusters:
            clusters.append([face])
    return clusters


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
    max_people: int = DEFAULT_MAX_PEOPLE,
) -> list[dict]:
    """Samples a video, detects every face per frame, clusters faces by visual identity,
    and returns each detected person's best-scoring frame — for the caller to let the
    user assign each detected person to a speaker slot.

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
                crop = _crop_face(frame_pil, bbox)
                if crop.width < 8 or crop.height < 8:
                    continue
                faces.append(
                    FaceInstance(
                        timestamp_seconds=t,
                        capture_quality=capture_quality,
                        face_height_ratio=float(bbox.size.height),
                        sharpness=_sharpness_score(crop),
                        crop=crop,
                        feature_print=_feature_print(crop),
                    )
                )
        t += interval_seconds

    clusters = _cluster_faces_by_identity(faces, max_clusters=max_people)

    results = []
    for cluster in clusters:
        best = _rank_candidates(list(cluster))[0]
        thumb = best.crop.copy()
        thumb.thumbnail((THUMBNAIL_MAX_SIDE, THUMBNAIL_MAX_SIDE))
        results.append(
            {
                "timestampSeconds": round(best.timestamp_seconds, 1),
                "score": round(best.score, 4),
                "captureQuality": round(best.capture_quality, 4),
                "frameCount": len(cluster),
                "image": image_to_data_url(thumb, format="JPEG"),
            }
        )

    # Surface the most consistently-appearing people first — likely the main speakers,
    # ahead of background extras or one-off false detections.
    results.sort(key=lambda r: r["frameCount"], reverse=True)
    return results
