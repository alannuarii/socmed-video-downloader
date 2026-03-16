import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly downloadsDir = path.join(process.cwd(), 'downloads');

  @Cron(CronExpression.EVERY_HOUR)
  handleCron() {
    this.logger.debug('Running automated cleanup job for downloads folder');
    this.cleanupOldFiles();
  }

  private cleanupOldFiles() {
    if (!fs.existsSync(this.downloadsDir)) return;

    const files = fs.readdirSync(this.downloadsDir);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const file of files) {
      if (file === '.gitkeep') continue;
      
      const filePath = path.join(this.downloadsDir, file);
      const stat = fs.statSync(filePath);

      // Check if file is older than 1 hour
      if (now - stat.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Cleaned up old file: ${file}`);
      }
    }
  }
}
