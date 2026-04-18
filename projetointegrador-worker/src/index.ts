import { Worker } from 'bullmq';
import { Pool } from 'pg';
import { generateSchedules } from './scheduler';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'projetointegrador',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
  max: 5,
});

const worker = new Worker(
  'schedule',
  async (job) => {
    console.log(`[Worker] Processing job ${job.id}, request_id: ${job.data.requestId}`);
    await generateSchedules(pool, job.data.requestId);
    console.log(`[Worker] Job ${job.id} completed`);
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    },
  },
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job?.id} finished successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

console.log('[Worker] Schedule worker started, waiting for jobs...');
