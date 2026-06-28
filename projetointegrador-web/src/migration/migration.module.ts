import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MigrationService } from './migration.service';

@Module({
  imports: [DatabaseModule],
  providers: [MigrationService],
})
export class MigrationModule {}
