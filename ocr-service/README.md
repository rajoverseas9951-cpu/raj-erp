# Vimawallah OCR service (Phase 1)

Self-hosted, CPU-only FastAPI service for extracting candidate fields from Indian
vehicle registration certificate (RC) images. It is intentionally isolated from
the Laravel and Next.js processes; Laravel reaches it over an internal-only HTTP
endpoint.

OCR output is probabilistic. **A user must review and confirm every extracted
field before any value is saved to the ERP.** Missing or low-confidence values
remain `null`; the service does not invent them.

## Architecture

1. FastAPI validates multipart inputs, file types, the 15 MiB aggregate limit,
   and request timeouts.
2. Pillow safely reads JPEG/PNG/WebP data, applies EXIF rotation, and enforces a
   decoded-pixel limit before loading image pixels.
3. OpenCV downsizes large images, gently improves local contrast, and applies a
   light bilateral denoise. It deliberately avoids destructive thresholding.
4. A single PaddleOCR pipeline is created during application startup. It uses
   CPU inference, PP-OCRv5 mobile detection/recognition models, document orientation,
   and no unwarping, VLM, LLM, or document-structure features.
5. Front, back, and combined inputs are OCR'd separately. Their text lines and
   confidence values are merged without losing the source image.
6. A deterministic parser applies normalized labels and regular expressions.
   It returns only sufficiently confident candidate values plus raw OCR evidence
   and warnings.

The Paddle import is lazy. Tests inject a fake engine, so running `pytest` does
not install or download OCR models.

## Local setup

Python 3.11 is the deployment target.

```bash
cd ocr-service
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
# PaddleX also declares the GUI contrib distribution. Ensure the actual cv2
# binary loaded at runtime is the API-compatible headless build.
python -m pip install --force-reinstall --no-deps opencv-contrib-python-headless==4.10.0.84
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 1
```

On Windows PowerShell, activate with:

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

The first real startup downloads the official PaddleOCR mobile detection,
recognition, and orientation models. Startup can therefore take several minutes
and requires outbound HTTPS. Later starts reuse `OCR_MODEL_CACHE_DIR` as long as
that directory persists and is writable by the service user.

## API

Health check:

```bash
curl http://localhost:8001/health
```

Front and back:

```bash
curl -X POST http://localhost:8001/v1/ocr/rc \
  -F "front=@/path/to/rc-front.jpg" \
  -F "back=@/path/to/rc-back.jpg"
```

One combined image:

```bash
curl -X POST http://localhost:8001/v1/ocr/rc \
  -F "combined=@/path/to/rc-combined.webp"
```

Accepted filename extensions are `.jpg`, `.jpeg`, `.png`, and `.webp`. At least
one image is required. The maximum is 15 MiB total across all multipart images.

## Configuration

All settings use the `OCR_` prefix.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OCR_SERVICE_NAME` | `vimawallah-ocr` | Health response service name |
| `OCR_HOST` / `OCR_PORT` | `0.0.0.0` / `8001` | Documented bind address and port |
| `OCR_LOG_LEVEL` | `INFO` | Structured log threshold |
| `OCR_MAX_UPLOAD_BYTES` | `15728640` | Aggregate multipart payload bytes |
| `OCR_MAX_IMAGE_PIXELS` | `40000000` | Decoded decompression-bomb guard |
| `OCR_PREPROCESSING_MAX_SIDE` | `2600` | Maximum preprocessed width or height |
| `OCR_REQUEST_TIMEOUT_SECONDS` | `90` | OCR processing timeout |
| `OCR_MIN_FIELD_CONFIDENCE` | `0.55` | Parser acceptance threshold |
| `OCR_CPU_THREADS` | `2` | Paddle CPU inference threads |
| `OCR_MODEL_CACHE_DIR` | `/models` | Persistent Paddle/PaddleX model cache |
| `OCR_ENABLE_DOCUMENT_ORIENTATION` | `true` | Enable 0/90/180/270 orientation model |
| `OCR_TEXT_DETECTION_MODEL_NAME` | `PP-OCRv5_mobile_det` | Lightweight detection model |
| `OCR_TEXT_RECOGNITION_MODEL_NAME` | `PP-OCRv5_mobile_rec` | Lightweight recognition model |
| `OCR_CORS_ALLOWED_ORIGINS` | empty | Comma-separated exact browser origins |
| `OCR_CORS_ALLOW_CREDENTIALS` | `false` | Allow CORS credentials |

Wildcard CORS is rejected when credentials are enabled. CORS middleware is not
installed when the origin list is empty.

## Docker

Build and run from `ocr-service/`:

```bash
docker build -t vimawallah-ocr:phase1 .
docker volume create vimawallah-ocr-models
docker run --rm \
  --name vimawallah-ocr \
  -p 8001:8001 \
  --env-file .env \
  -v vimawallah-ocr-models:/models \
  vimawallah-ocr:phase1
```

Production uses the checked-in Compose definition and binds PaddleOCR only to
the VPS loopback interface:

```bash
cp .env.example .env
docker compose -f compose.production.yml build --no-cache ocr
docker compose -f compose.production.yml up -d --force-recreate ocr
docker compose -f compose.production.yml ps
curl --fail http://127.0.0.1:8001/health
docker compose -f compose.production.yml exec -T ocr \
  python -c "import paddle, paddleocr, paddlex; print('paddle', paddle.__version__); print('paddleocr', paddleocr.__version__); print('paddlex', paddlex.__version__)"
docker compose -f compose.production.yml exec -T ocr \
  python scripts/inference_smoke_test.py
```

The CPU runtime is pinned to PaddlePaddle 3.2.2, PaddleOCR 3.4.1, and PaddleX
3.4.3. `FLAGS_use_mkldnn=0` is set in the image and Compose environment, and the
constructor passes `enable_mkldnn=False`, avoiding the affected oneDNN execution
path. `FLAGS_enable_pir_api` is intentionally not changed because disabling
MKLDNN is sufficient for this compatible runtime. Startup emits an `ocr_runtime`
JSON log with all three versions, CPU mode, and the MKLDNN state.

The Nginx template in `deploy/nginx-ocr-internal.conf` adds a second loopback-only
listener on port 8081. Configure Laravel with
`PADDLEOCR_URL=http://127.0.0.1:8081`; no PaddleOCR route is exposed by the public
ERP virtual host.

The image runs as non-root UID/GID `10001`, exposes port 8001, uses one Uvicorn
worker, force-installs the headless OpenCV binary after PaddleX dependency
resolution, and includes an HTTP healthcheck. A host bind mount used instead of a
named volume must be writable by UID 10001. Keep one worker per container because
each worker would otherwise load its own model set and consume additional RAM.

## Validation

```bash
python -m compileall -q app tests
pytest -q
```

API tests mock the OCR engine. A separate smoke test with a real RC image is
recommended on the deployment server after the model cache is populated. The
checked-in synthetic smoke test always performs real model inference and fails
the deployment on a non-JSON response, an HTTP error, or an unsuccessful OCR
response even when `/health` is healthy.

## Server requirements

- Linux x86-64 host capable of running Docker (or Python 3.11 directly).
- At least 2 CPU cores and 4 GiB RAM; 4 CPU cores and 6-8 GiB RAM are preferred
  for more predictable latency during startup and concurrent ERP use.
- Persistent writable storage mounted at `/models` (allow at least 2 GiB).
- Outbound HTTPS during the first model download; it may be restricted after the
  cache is populated and verified.
- Inbound TCP 8001 only from the reverse proxy/application network. Terminate TLS
  at the reverse proxy and do not expose this unauthenticated Phase 1 endpoint to
  the public internet.
- A process/container supervisor with restart policy, log collection, and health
  checks. Logs contain request metadata only, never OCR text or document data.
- Exact production browser origins configured through
  `OCR_CORS_ALLOWED_ORIGINS`; do not use wildcard origins with credentials.
- A 90-second-or-higher upstream proxy timeout and request-body limit of at least
  15 MiB (slightly higher is needed for multipart overhead).

## Known limitations

- Image quality, glare, card laminates, regional RC layouts, handwriting, and OCR
  character confusion can lower accuracy.
- Deterministic rules cover common English Indian RC labels, not every historic
  or state-specific format and not handwritten or regional-language labels.
- Request timeout returns HTTP 504, but Python cannot forcibly stop an inference
  thread already executing inside Paddle; the single engine lock remains the
  concurrency guard until that inference returns.
- The API has no authentication or rate limiting in Phase 1. Keep it on a trusted
  private network until the Laravel integration adds those controls.
- Laravel returns OCR candidates to the existing editable vehicle form. OCR does
  not save a vehicle; the user must still review the fields and submit Save.
