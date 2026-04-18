import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';

const DB_POOL = 'DB_POOL';

const poolFactory = {
  provide: DB_POOL,
  useFactory: (): Pool => {
    return new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'projetointegrador',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      max: 10,
    });
  },
};

@Global()
@Module({
  providers: [poolFactory],
  exports: [DB_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor() {}

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Fechando pool de conexoes com o banco');
  }
}

export { DB_POOL };
