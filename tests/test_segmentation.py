"""Tests for cleaning up person-segmentation masks."""

from PIL import Image, ImageDraw

from youthumber.segmentation import keep_largest_region


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

    assert cleaned.getpixel((202, 200)) == 128


def test_keep_largest_region_drops_a_semi_opaque_blob_touching_the_body() -> None:
    # In the real mask the mic remnant touched the shoulder at alpha 40-145 while the
    # body was 255, so plain connectivity kept it.
    mask = Image.new("L", (400, 300), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle([50, 40, 200, 299], fill=255)
    draw.rectangle([201, 100, 300, 140], fill=120)

    cleaned = keep_largest_region(mask)

    assert cleaned.getpixel((280, 120)) == 0
    assert cleaned.getpixel((120, 200)) == 255


def test_keep_largest_region_keeps_size_and_mode() -> None:
    cleaned = keep_largest_region(_mask_with_person_and_mic())

    assert cleaned.size == (400, 300)
    assert cleaned.mode == "L"


def test_keep_largest_region_leaves_an_empty_mask_alone() -> None:
    empty = Image.new("L", (100, 100), 0)

    assert keep_largest_region(empty).getbbox() is None
