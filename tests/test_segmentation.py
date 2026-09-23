"""Tests for cleaning up person-segmentation masks."""

from PIL import Image, ImageDraw

from youthumber.segmentation import choke_edge, keep_largest_region


def _mask_with_person_and_mic() -> Image.Image:
    # Mirrors a real cutout (2026-09-23): Vision's person mask also kept a floating
    # piece of the microphone in front of the host, separate from the body.
    mask = Image.new("L", (400, 300), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle([50, 40, 200, 299], fill=255)  # the person
    draw.rectangle([260, 120, 300, 150], fill=255)  # the stray mic blob
    return mask


def test_keep_largest_region_drops_a_separate_blob() -> None:
    cleaned = keep_largest_region(_mask_with_person_and_mic())

    assert cleaned.getpixel((280, 135)) == 0
    assert cleaned.getpixel((120, 200)) == 255


def test_keep_largest_region_keeps_soft_edges_of_the_person() -> None:
    mask = _mask_with_person_and_mic()
    ImageDraw.Draw(mask).rectangle([201, 40, 203, 299], fill=128)  # anti-aliased edge

    cleaned = keep_largest_region(mask)

    # Right next to the body the edge is kept (within rounding of the fade's tail).
    assert cleaned.getpixel((202, 200)) >= 124


def test_keep_largest_region_keeps_a_semi_opaque_object_touching_the_body() -> None:
    # A mic touching the host's shoulder (alpha 40-145 vs 255 for the body) was cut off
    # in .62/.63, but it had been hiding the shirt behind it, so removing it left a hole
    # in the person (2026-09-23). Things touching the body stay.
    mask = Image.new("L", (400, 300), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle([50, 40, 200, 299], fill=255)
    draw.rectangle([201, 100, 300, 140], fill=120)

    cleaned = keep_largest_region(mask)

    assert cleaned.getpixel((280, 120)) == 120
    assert cleaned.getpixel((120, 200)) == 255


def test_keep_largest_region_fades_edges_instead_of_cutting_blocky_steps() -> None:
    # The region search runs on a 4x-downscaled copy of a 1080p mask; cutting with it
    # directly left 4px square stair steps along soft edges ("gritty", 2026-09-23).
    import numpy as np

    width = 1920
    row = np.zeros(width, dtype=np.float64)
    row[:100] = 255
    row[100:140] = np.linspace(
        255, 0, 40
    )  # a wide soft edge, like hair or a dark chair
    mask = Image.fromarray(np.tile(row, (64, 1)).astype(np.uint8), mode="L")

    out = np.asarray(keep_largest_region(mask), dtype=np.int32)[32]

    largest_drop = int(np.max(out[:-1] - out[1:]))
    assert largest_drop <= 40, (
        f"edge drops by {largest_drop} between neighbouring pixels"
    )


def test_keep_largest_region_keeps_size_and_mode() -> None:
    cleaned = keep_largest_region(_mask_with_person_and_mic())

    assert cleaned.size == (400, 300)
    assert cleaned.mode == "L"


def test_keep_largest_region_leaves_an_empty_mask_alone() -> None:
    empty = Image.new("L", (100, 100), 0)

    assert keep_largest_region(empty).getbbox() is None


def test_keep_largest_region_keeps_a_separate_piece_holding_a_detected_hand() -> None:
    # A raised hand whose arm leaves the frame is not connected to the body inside the
    # picture, and was deleted like a stray mic (2026-09-23). Vision's mask is just as
    # sure of both (255), so the tell is Vision's hand detector: pieces holding a hand stay.
    mask = _mask_with_person_and_mic()
    ImageDraw.Draw(mask).rectangle([330, 20, 380, 90], fill=255)  # the raised hand

    cleaned = keep_largest_region(mask, keep_points=[(355, 50)])

    assert cleaned.getpixel((355, 50)) == 255
    assert cleaned.getpixel((280, 135)) == 0  # the mic still goes
    assert cleaned.getpixel((120, 200)) == 255


def test_choke_edge_pulls_the_edge_in_about_3px_at_full_hd() -> None:
    # Vision's mask runs 1-2 px past the person at full strength, so a dark studio wall
    # showed as a rim around the fingers (2026-09-23). A 1 px choke on a 685 px preview
    # removed it; 2 px ate the fingertips. Scaled with width, ~3 px at 1920.
    mask = Image.new("L", (1920, 1080), 0)
    ImageDraw.Draw(mask).rectangle([500, 300, 1400, 1079], fill=255)

    out = choke_edge(mask)

    assert out.size == mask.size and out.mode == "L"
    assert out.getpixel((500, 700)) < 64  # the old outer edge pixel is now background
    assert out.getpixel((506, 700)) == 255  # a few pixels in is untouched
    assert out.getpixel((950, 700)) == 255


def test_choke_edge_never_erodes_more_than_1px_on_small_images() -> None:
    mask = Image.new("L", (685, 400), 0)
    ImageDraw.Draw(mask).rectangle([100, 100, 400, 399], fill=255)

    out = choke_edge(mask)

    assert out.getpixel((103, 200)) == 255
