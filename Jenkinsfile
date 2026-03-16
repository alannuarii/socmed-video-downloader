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
                        --restart always \
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
