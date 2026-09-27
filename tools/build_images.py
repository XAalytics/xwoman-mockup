"""Convert img/raw/*.jpg into web images: 4:5 crops at 768x960 and 400x500, WebP.
Usage: python tools/build_images.py"""
import pathlib
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / 'img' / 'raw', ROOT / 'img'

for src in sorted(RAW.glob('*.jpg')):
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    im = ImageOps.fit(im, (768, 960), Image.LANCZOS, centering=(0.5, 0.35))
    im.save(OUT / f'{src.stem}.webp', 'WEBP', quality=82, method=6)
    im.resize((400, 500), Image.LANCZOS).save(OUT / f'{src.stem}-400.webp', 'WEBP', quality=80, method=6)
    print(src.stem, 'done')

# The site reads this list so products without a photo yet show a colour placeholder instead of a broken image.
ready = sorted(p.stem for p in RAW.glob('*.jpg'))
(OUT / 'manifest.js').write_text(f"const IMAGES_READY = new Set({ready!r});\n".replace("'", '"'), encoding='utf-8')
print('manifest:', ready)
