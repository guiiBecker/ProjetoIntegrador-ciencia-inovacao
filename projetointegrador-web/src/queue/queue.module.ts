import { Module, Global } from '@nestjs/common';
import { Queue } from 'bullmq';

const SCHEDULE_QUEUE = 'SCHEDULE_QUEUE';

const queueFactory = {
  provide: SCHEDULE_QUEUE,
  useFactory: (): Queue => {
    return new Queue('schedule', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    });
  },
};

@Global()
@Module({
  providers: [queueFactory],
  exports: [SCHEDULE_QUEUE],
})
export class QueueModule {}

export { SCHEDULE_QUEUE };
