FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/ocr \
    PADDLE_HOME=/models/paddle \
    PADDLE_PDX_CACHE_HOME=/models/paddlex

RUN apt-get update \
    && apt-get install --no-install-recommends -y libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 ocr \
    && useradd --uid 10001 --gid ocr --create-home --shell /usr/sbin/nologin ocr \
    && mkdir -p /models/paddle /models/paddlex /srv/ocr \
    && chown -R ocr:ocr /models /srv/ocr

WORKDIR /srv/ocr

COPY requirements.txt ./requirements.txt
# PaddleX declares the GUI contrib distribution. Install the API-compatible
# headless binary last so cv2 does not require GUI system libraries.
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.txt \
    && python -m pip install --force-reinstall --no-deps opencv-contrib-python-headless==4.10.0.84 \
    && python -m pip check

COPY --chown=ocr:ocr app ./app

USER ocr

VOLUME ["/models"]
EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3).read()"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
