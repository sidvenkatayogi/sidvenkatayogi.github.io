"""Embed RGB samples; the SSH app renders colored ASCII at each visitor's size."""
import base64
import json
import sys
import zlib
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[2]
results = []
for source in json.load(sys.stdin):
    filename = (root / source.lstrip('/')).resolve()
    if not filename.is_relative_to(root / 'images'):
        raise ValueError(f'Artwork must be a local image: {source}')
    with Image.open(filename) as original:
        image = ImageOps.exif_transpose(original).convert('RGBA')
        background = Image.new('RGBA', image.size, 'white')
        background.alpha_composite(image)
        image = background.convert('RGB')
        image.thumbnail((480, 480), Image.Resampling.LANCZOS)
        results.append({
            'width': image.width,
            'height': image.height,
            'channels': 3,
            'pixels': base64.b64encode(zlib.compress(image.tobytes(), 9)).decode('ascii'),
            'source': f'https://s9v10.dev{source}',
        })
json.dump(results, sys.stdout)
