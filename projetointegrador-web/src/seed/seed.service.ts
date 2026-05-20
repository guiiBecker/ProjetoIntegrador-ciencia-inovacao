import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { DB_POOL } from '../database/database.module';

// Reaplica o mock de dados (sql/mock_data.sql) no startup do backend para que
// haja sempre um dataset consistente e testavel — incluindo a disponibilidade
// dos professores, que e pre-requisito para a geracao de grade.
//
// Controlado por SEED_ON_STARTUP=true (ligado no docker-compose do ambiente de
// testes). O proprio mock_data.sql faz TRUNCATE ... CASCADE antes de inserir,
// entao cada subida reseta o banco para o estado de mock. Falhas sao apenas
// logadas: nunca derrubam a aplicacao.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SEED_ON_STARTUP !== 'true') {
      return;
    }

    const sqlPath = process.env.SEED_SQL_PATH || '/app/sql/mock_data.sql';
    this.logger.log(`SEED_ON_STARTUP ativo — aplicando mock de ${sqlPath}`);

    try {
      const sql = readFileSync(sqlPath, 'utf8');
      await this.pool.query(sql);
      this.logger.log('Mock de dados aplicado com sucesso');
    } catch (err) {
      this.logger.error(
        `Falha ao aplicar mock de dados: ${(err as Error).message}`,
      );
    }
  }
}
