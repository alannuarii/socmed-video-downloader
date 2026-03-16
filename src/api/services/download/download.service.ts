import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { Subject } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';

export interface DownloadProgress {
  status: 'downloading' | 'processing' | 'completed' | 'error';
  percent?: string;
  speed?: string;
  eta?: string;
  filename?: string;
  error?: string;
}

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);
  private downloadStreams = new Map<string, Subject<DownloadProgress>>();
  private readonly downloadsDir = path.join(process.cwd(), 'downloads');

  constructor() {
    if (!fs.existsSync(this.downloadsDir)) {
      fs.mkdirSync(this.downloadsDir, { recursive: true });
    }
  }

  startDownload(url: string): string {
    const id = uuidv4();
    const subject = new Subject<DownloadProgress>();
    this.downloadStreams.set(id, subject);

    this.logger.log(`Starting download [${id}] for URL: ${url}`);

    // yt-dlp command
    // Use format that yields best quality video + audio and merges them
    const ytDlpArgs = [
      url,
      '-f', 'bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '-o', path.join(this.downloadsDir, '%(title)s_%(id)s.%(ext)s'),
      '--newline', // Force newline output for easier parsing
      '--no-warnings'
    ];

    const child = spawn('yt-dlp', ytDlpArgs);

    let finalFilename = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      // Parsing yt-dlp output
      // [download]  15.3% of  150.00MiB at    5.00MiB/s ETA 00:25
      const downloadRegex = /\[download\]\s+([\d\.]+)%\s+of\s+~?\s*([\d\.\w]+)\s+at\s+([\d\.\w\/]+)\s+ETA\s+([\d:]+)/;
      const match = output.match(downloadRegex);
      
      if (match) {
        subject.next({
          status: 'downloading',
          percent: match[1],
          speed: match[3],
          eta: match[4]
        });
      }

      // Check for merger or final destination
      const destRegex = /\[(?:download|Merger)\] Destination:\s+(.+)/;
      const destMatch = output.match(destRegex);
      if (destMatch) {
         finalFilename = destMatch[1];
      }

      // Sometimes the file is already downloaded
      const alreadyDownloadedRegex = /\[download\]\s+(.+)\s+has already been downloaded/;
      const alreadyMatch = output.match(alreadyDownloadedRegex);
      if (alreadyMatch) {
         finalFilename = alreadyMatch[1];
      }
    });

    child.stderr.on('data', (data) => {
      this.logger.debug(`yt-dlp stderr [${id}]: ${data.toString()}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        this.logger.log(`Download [${id}] completed. File: ${finalFilename}`);
        // Send a final completion message with the short filename
        subject.next({
          status: 'completed',
          filename: path.basename(finalFilename)
        });
      } else {
        this.logger.error(`Download [${id}] failed with code ${code}`);
        subject.next({
          status: 'error',
          error: 'Download failed. Please check the URL and try again.'
        });
      }
      subject.complete();
      setTimeout(() => this.downloadStreams.delete(id), 60000); // Clean up stream memory after 1 minute
    });

    child.on('error', (err) => {
      this.logger.error(`Failed to start yt-dlp for [${id}]: ${err.message}`);
      subject.next({ status: 'error', error: 'Internal Server Error: yt-dlp is not installed or accessible.' });
      subject.complete();
      this.downloadStreams.delete(id);
    });

    return id;
  }

  getProgressStream(id: string): Subject<DownloadProgress> | undefined {
    return this.downloadStreams.get(id);
  }
}
