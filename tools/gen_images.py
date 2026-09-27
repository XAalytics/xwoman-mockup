"""Generate AI product photos for the XWoman mockup with FLUX.1 [dev].

Provider (env IMG_PROVIDER):
  fal (default) - fal.ai directly, key in ~/.fal_key.txt
  hf            - fal.ai via the Hugging Face Inference Providers router, key in ~/.hf_key.txt
  space         - the free FLUX.1-dev Hugging Face Space (ZeroGPU daily quota), key in ~/.hf_key.txt

Usage: python tools/gen_images.py [id ...]   (no ids = every shot whose image is missing)
The key is never printed. Stops at the first billing/auth error.
"""
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

PROVIDER = os.environ.get('IMG_PROVIDER', 'fal')
ENDPOINT = {
    'fal': 'https://fal.run/fal-ai/flux/dev',
    'hf': 'https://router.huggingface.co/fal-ai/fal-ai/flux/dev',
    'space': 'black-forest-labs/FLUX.1-dev',
}[PROVIDER]
KEY = pathlib.Path.home().joinpath('.fal_key.txt' if PROVIDER == 'fal' else '.hf_key.txt').read_text().strip()
_space = None
AUTH = f'Key {KEY}' if PROVIDER == 'fal' else f'Bearer {KEY}'

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'img' / 'raw'
STYLE = ("Professional e-commerce fashion catalogue photograph, full-length studio shot of a Pakistani woman model, "
         "calm natural pose, plain very light off-white seamless studio backdrop, soft diffused daylight, "
         "true-to-life colours, sharp fabric and embroidery detail, 85mm lens, no text, no logos, no watermark.")
SHOTS = json.loads((ROOT / 'tools' / 'shots.json').read_text(encoding='utf-8'))


def gen_space(shot, prompt):
    global _space
    from gradio_client import Client  # pip install gradio_client
    from PIL import Image
    _space = _space or Client(ENDPOINT, token=KEY, verbose=False)
    res = _space.predict(prompt=prompt, seed=shot.get('seed', 7), randomize_seed=False, width=768, height=960,
                         guidance_scale=3.5, num_inference_steps=28, api_name='/infer')
    out = res[0] if isinstance(res, (list, tuple)) else res
    out = out.get('path') if isinstance(out, dict) else out
    Image.open(out).convert('RGB').save(RAW / f"{shot['id']}.jpg", quality=95)


def gen(shot):
    prompt = shot['prompt'] if shot.get('raw_prompt') else f"{STYLE} Outfit: {shot['prompt']}"
    if PROVIDER == 'space':
        return gen_space(shot, prompt)
    body = json.dumps({'prompt': prompt, 'image_size': {'width': 768, 'height': 960},
                       'num_inference_steps': 28, 'guidance_scale': 3.5, 'num_images': 1,
                       'enable_safety_checker': True}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method='POST',
                                 headers={'Authorization': AUTH, 'Content-Type': 'application/json'})
    res = json.load(urllib.request.urlopen(req, timeout=240))
    (RAW / f"{shot['id']}.jpg").write_bytes(urllib.request.urlopen(res['images'][0]['url'], timeout=120).read())


if __name__ == '__main__':
    ids = set(sys.argv[1:])
    for shot in SHOTS:
        if (ids and shot['id'] not in ids) or (not ids and (RAW / f"{shot['id']}.jpg").exists()):
            continue
        started = time.time()
        try:
            gen(shot)
            print(shot['id'], f'ok {time.time() - started:.0f}s', flush=True)
        except urllib.error.HTTPError as e:
            print(shot['id'], 'ERROR', e.code, e.read().decode()[:200], flush=True)
            if e.code in (401, 402, 403, 429):
                sys.exit(2)
        except Exception as e:  # Space errors (e.g. ZeroGPU quota exceeded) arrive as generic exceptions
            print(shot['id'], 'ERROR', type(e).__name__, str(e)[:200], flush=True)
            if 'quota' in str(e).lower():
                sys.exit(2)
