import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ConfigModule } from './config/config.module';
import { FormModule } from './form/form.module';
import { AuthModule } from './auth/auth.module';
import { MigrationModule } from './migration/migration.module';
import { SeedModule } from './seed/seed.module';

@Module({
  // MigrationModule deve vir antes de SeedModule: aplica ALTER TABLE antes
  // do seed rodar e tentar inserir linhas com as novas colunas.
  imports: [DatabaseModule, AuthModule, QueueModule, ScheduleModule, ConfigModule, FormModule, MigrationModule, SeedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}