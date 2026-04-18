import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ConfigModule } from './config/config.module';
import { FormModule } from './form/form.module';

@Module({
  imports: [DatabaseModule, QueueModule, ScheduleModule, ConfigModule, FormModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}