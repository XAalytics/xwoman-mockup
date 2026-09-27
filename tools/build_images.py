"""Build the site's product images: 4:5 WebP at 768x960 and 400x500, plus img/manifest.js.
Source (env IMG_SOURCE): art (default) = Claude-drawn illustrations in img/art/*.png (tools/illustrate.mjs)
                         photos         = AI photos in img/raw/*.jpg (tools/gen_images.py)
Usage: python tools/build_images.py"""
import os
import pathlib
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'img'
SOURCE = os.environ.get('IMG_SOURCE', 'art')
SRC_DIR, PATTERN = (OUT / 'art', '*.png') if SOURCE == 'art' else (OUT / 'raw', '*.jpg')

sources = sorted(SRC_DIR.glob(PATTERN))
for src in sources:
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    im = ImageOps.fit(im, (768, 960), Image.LANCZOS, centering=(0.5, 0.35))
    im.save(OUT / f'{src.stem}.webp', 'WEBP', quality=86, method=6)
    im.resize((400, 500), Image.LANCZOS).save(OUT / f'{src.stem}-400.webp', 'WEBP', quality=84, method=6)
    print(src.stem, 'done')

# The site reads this list so products without an image yet show a colour placeholder instead of a broken image.
ready = sorted(p.stem for p in sources)
(OUT / 'manifest.js').write_text(f"const IMAGES_READY = new Set({ready!r});\n".replace("'", '"'), encoding='utf-8')
print('manifest:', ready)
