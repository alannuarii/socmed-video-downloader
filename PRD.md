Berikut adalah Dokumen Persyaratan Perangkat Lunak (PRD) yang mendalam, lengkap dengan spesifikasi teknis Docker dan Jenkins untuk kebutuhan CI/CD Anda.

---

## 1. Ringkasan Proyek

Aplikasi **"NestDL"** adalah platform monolitik berbasis web yang memungkinkan pengguna mengunduh video berkualitas tinggi dari YouTube, Instagram, dan TikTok hanya dengan memasukkan URL. Aplikasi ini dirancang untuk penggunaan personal dengan fokus pada kesederhanaan dan efisiensi.

## 2. Alur Pengguna (User Flow)

Alur ini dirancang untuk integrasi yang mulus pada lingkungan **Antigravity**:

1. **Input**: Pengguna membuka antarmuka web dan menempelkan tautan (URL) video.
2. **Validasi**: Backend NestJS memvalidasi format URL menggunakan regex sesuai platform tujuan.
3. **Pemrosesan**:
* Sistem memanggil `yt-dlp` untuk mengekstrak metadata.
* `yt-dlp` mengunduh video dan audio secara terpisah (untuk kualitas terbaik).
* `FFmpeg` menggabungkan (merge) kedua file tersebut menjadi MP4 tunggal.


4. **Output**: Browser secara otomatis memicu unduhan file hasil gabungan ke perangkat lokal pengguna.
5. **Cleanup**: Server menghapus file sementara segera setelah proses pengiriman selesai atau jika terjadi error.

## 3. Persyaratan Fungsional

| ID | Fitur | Deskripsi |
| --- | --- | --- |
| **F-01** | **Multi-Platform Support** | Mendukung pengunduhan dari YouTube, Instagram, dan TikTok. |
| **F-02** | **Best Quality Selection** | Mengunduh resolusi tertinggi yang tersedia (hingga 4K) secara otomatis. |
| **F-03** | **Real-time Progress** | Menampilkan status pengunduhan pada antarmuka web. |
| **F-04** | **Automatic Cleanup** | Penghapusan otomatis file sementara di folder `downloads/` setiap 1 jam atau pasca-unduh. |

---

## 4. Spesifikasi Teknis (CI/CD & Docker)

### A. Dockerfile

Dockerfile ini menggunakan *multi-stage build* untuk menjaga ukuran image tetap kecil, namun tetap menyertakan dependensi Python dan FFmpeg yang krusial.

```dockerfile
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

```

---

### B. Jenkinsfile (CI/CD Pipeline)

Pipeline ini akan mengotomatiskan proses pengujian, pembuatan image, dan deployment ke server.

```groovy
pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "nest-downloader:latest"
        CONTAINER_NAME = "nest-downloader-app"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Docker Build & Tag') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE} ."
            }
        }

        stage('Deploy to Server') {
            steps {
                sh """
                    docker stop ${CONTAINER_NAME} || true
                    docker rm ${CONTAINER_NAME} || true
                    docker run -d \
                        --name ${CONTAINER_NAME} \
                        -p 3011:3000 \
                        -v /path/to/host/downloads:/app/downloads \
                        ${DOCKER_IMAGE}
                """
            }
        }
    }

    post {
        success {
            echo 'Aplikasi berhasil diperbarui di server!'
        }
        failure {
            echo 'Terjadi kesalahan pada pipeline CI/CD.'
        }
    }
}

```

---

## 5. Rencana Pengujian

1. **Unit Testing**: Menguji service `DownloadService` dengan URL dummy.
2. **Integration Testing**: Memastikan `yt-dlp` dapat terpanggil di dalam container Docker.
3. **Volume Testing**: Memastikan file tersimpan di volume Docker agar tidak hilang jika container *restart*.