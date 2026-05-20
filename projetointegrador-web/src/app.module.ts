import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ConfigModule } from './config/config.module';
import { FormModule } from './form/form.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [DatabaseModule, AuthModule, QueueModule, ScheduleModule, ConfigModule, FormModule, SeedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}