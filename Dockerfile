# ---------- Stage 1: Build ----------
FROM node:20-bookworm AS builder
WORKDIR /app

# deps สำหรับ build โมดูล native: canvas 3.x, sharp 0.34.x, tfjs-node 4.x
RUN apt-get update && apt-get install -y \
    build-essential python3 pkg-config \
    libcairo2-dev libjpeg-dev libpango1.0-dev \
    libgif-dev librsvg2-dev \
    libvips-dev \
    cmake git \
    && rm -rf /var/lib/apt/lists/*

# ให้ pkg-config หา .pc ได้ครบ
ENV PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig

# ลด npm noise
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_loglevel=warn

# คัดลอกไฟล์แพ็กเกจก่อนเพื่อ cache layer install
COPY package*.json ./

# ใช้ lockfile ถ้ามี และตัด devDeps ออก (เล็ก/เร็วขึ้น)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# บังคับ rebuild เฉพาะโมดูลที่ต้อง build จากเครื่อง
RUN npm rebuild canvas --build-from-source || true
RUN npm rebuild sharp --build-from-source || true
# หมายเหตุ: ไม่บังคับ build-from-source สำหรับ @tensorflow/tfjs-node (ใช้ prebuilt)

# คัดลอกซอร์สโค้ด
COPY . .

# ---------- Stage 2: Runtime ----------
FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5001 \
    npm_config_loglevel=warn \
    # เผื่อ tesseract.js ต้องการอ่านภาษา
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

# ไลบรารี runtime สำหรับโมดูล native (+ libgomp1 สำหรับ onnxruntime-node)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libjpeg62-turbo libpango-1.0-0 \
    libgif7 librsvg2-2 \
    libvips \
    libstdc++6 libatomic1 libgomp1 \
    python3 ca-certificates \
    tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# นำ node_modules ที่คอมไพล์เสร็จจาก builder มาใช้
COPY --from=builder /app/node_modules ./node_modules
# และคัดลอกซอร์ส
COPY . .

# ทำความสะอาดให้ image เล็กลง (optional)
RUN rm -rf ./node_modules/.cache && \
    find ./node_modules -name "*.md" -type f -delete && \
    find ./node_modules -name "*.ts" -type f -delete && \
    find ./node_modules -type d \( -name "test" -o -name "tests" -o -name "examples" \) -prune -exec rm -rf {} +

# ใช้พอร์ตเดียวกับ ENV
EXPOSE 5001

# Healthcheck ให้ชี้ตามพอร์ตเดียวกัน
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
  CMD node -e "require('http').get(`http://127.0.0.1:${process.env.PORT||5001}/health`,r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "app.js"]
