from __future__ import annotations

import io
import warnings

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import Settings


SUPPORTED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


class InvalidImageError(ValueError):
    pass


class ImageLimitError(ValueError):
    pass


def decode_and_preprocess(data: bytes, settings: Settings) -> np.ndarray:
    """Decode an image and apply conservative RC-friendly preprocessing."""

    if not data:
        raise InvalidImageError("empty image")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in SUPPORTED_IMAGE_FORMATS:
                    raise InvalidImageError("unsupported encoded image format")

                width, height = image.size
                if width <= 0 or height <= 0:
                    raise InvalidImageError("image has invalid dimensions")
                if width * height > settings.max_image_pixels:
                    raise ImageLimitError(
                        f"image exceeds {settings.max_image_pixels} decoded pixels"
                    )

                image.load()
                image = ImageOps.exif_transpose(image).convert("RGB")
                image = _resize_down(image, settings.preprocessing_max_side)
                rgb = np.asarray(image)
    except ImageLimitError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageLimitError("image dimensions are unsafe") from exc
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        if isinstance(exc, InvalidImageError):
            raise
        raise InvalidImageError("invalid or corrupt image") from exc

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    return _enhance_conservatively(bgr)


def _resize_down(image: Image.Image, max_side: int) -> Image.Image:
    width, height = image.size
    largest = max(width, height)
    if largest <= max_side:
        return image

    scale = max_side / largest
    target = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(target, Image.Resampling.LANCZOS)


def _enhance_conservatively(bgr: np.ndarray) -> np.ndarray:
    """Enhance local contrast and lightly denoise without thresholding text."""

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
    enhanced_lightness = clahe.apply(lightness)
    enhanced = cv2.cvtColor(
        cv2.merge((enhanced_lightness, channel_a, channel_b)),
        cv2.COLOR_LAB2BGR,
    )
    return cv2.bilateralFilter(enhanced, d=3, sigmaColor=18, sigmaSpace=18)
