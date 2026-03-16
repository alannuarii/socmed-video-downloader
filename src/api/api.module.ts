import { Module } from '@nestjs/common';
import { DownloadService } from './services/download/download.service';
import { DownloadController } from './controllers/download/download.controller';
import { CleanupService } from './services/cleanup/cleanup.service';

@Module({
  providers: [DownloadService, CleanupService],
  controllers: [DownloadController]
})
export class ApiModule {}
