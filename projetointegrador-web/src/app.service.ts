import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from './database/database.module';

@Injectable()
export class AppService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  getRootMessage(): { message: string } {
    return { message: 'Backend rodando com sucesso!' };
  }

  getHealth(): { status: string; timestamp: Date } {
    return {
      status: 'OK',
      timestamp: new Date(),
    };
  }

  async getDbHealth(): Promise<{ status: string; timestamp: string }> {
    const result = await this.pool.query('SELECT NOW() AS now');
    return {
      status: 'OK',
      timestamp: result.rows[0].now,
    };
  }
}