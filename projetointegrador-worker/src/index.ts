import { Worker } from 'bullmq';
import { Pool } from 'pg';
import { generateSchedules } from './scheduler';

// Required secrets/connection settings have no safe default — fail fast if absent.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer, got "${raw}"`);
  }
  return parsed;
}

const pool = new Pool({
  host: requireEnv('DB_HOST'),
  port: optionalPort('DB_PORT', 5432),
  database: requireEnv('DB_NAME'),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
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
      host: requireEnv('REDIS_HOST'),
      port: optionalPort('REDIS_PORT', 6379),
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
