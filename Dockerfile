# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# Install Python, FFmpeg, dan yt-dlp
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    ln -sf python3 /usr/bin/python && \
    pip install --break-system-packages yt-dlp

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Buat direktori temporary untuk unduhan
RUN mkdir downloads && chmod 777 downloads

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
