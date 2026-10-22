# Where the catalog is captured, on every machine: Argos compares pixels, so the fonts a fallback
# reaches (Arabic, emoji), fontconfig's rendering and the libraries Electron draws with are pinned
# here rather than taken from whichever host runs it.
FROM node:22.23-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    xvfb xauth \
    libgtk-3-0 libnss3 libxss1 libasound2 libgbm1 libxshmfence1 libdrm2 libxkbcommon0 \
    libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 libcups2 libpango-1.0-0 \
    fonts-noto-core fonts-noto-color-emoji fontconfig \
  && rm -rf /var/lib/apt/lists/*

COPY fonts.conf /etc/fonts/local.conf

RUN corepack enable && fc-cache -f
