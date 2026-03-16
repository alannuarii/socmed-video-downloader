import { Controller, Post, Body, Get, Param, Res, Sse, MessageEvent, HttpException, HttpStatus } from '@nestjs/common';
import { DownloadService } from '../../services/download/download.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('api')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Post('download')
  startDownload(@Body('url') url: string) {
    if (!url) {
      throw new HttpException('URL is required', HttpStatus.BAD_REQUEST);
    }

    // Basic URL validation
    const validUrlPatterns = [
      /youtube\.com/, /youtu\.be/,
      /instagram\.com/,
      /tiktok\.com/
    ];

    const isValid = validUrlPatterns.some(pattern => pattern.test(url));
    if (!isValid) {
      throw new HttpException('Unsupported URL provided. Only YouTube, Instagram, and TikTok are supported.', HttpStatus.BAD_REQUEST);
    }

    const id = this.downloadService.startDownload(url);
    return { id };
  }

  @Sse('progress/:id')
  progress(@Param('id') id: string): Observable<MessageEvent> {
    const stream = this.downloadService.getProgressStream(id);
    if (!stream) {
      throw new HttpException('Download ID not found', HttpStatus.NOT_FOUND);
    }

    return stream.pipe(
      map((progress) => ({
        data: progress,
      }) as MessageEvent)
    );
  }

  @Get('file/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    if (filename.includes('..') || filename.includes('/')) {
      throw new HttpException('Invalid filename', HttpStatus.BAD_REQUEST);
    }

    const filePath = path.join(process.cwd(), 'downloads', filename);
    if (!fs.existsSync(filePath)) {
      throw new HttpException('File not found or has been cleaned up', HttpStatus.NOT_FOUND);
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).send('Error downloading file');
        }
      }
    });
  }
}
