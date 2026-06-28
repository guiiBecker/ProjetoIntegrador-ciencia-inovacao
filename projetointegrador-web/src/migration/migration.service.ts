import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../database/database.module';

/**
 * Roda automaticamente no startup do backend (antes do SeedService).
 *
 * Fase 1 – Schema (sempre): aplica ALTER TABLE / CREATE INDEX idempotentes.
 *   Seguro de rodar contra bancos novos (as colunas já existem em init.sql)
 *   e contra bancos antigos (IF NOT EXISTS evita erro de duplicidade).
 *
 * Fase 2 – Dados (só quando SEED_ON_STARTUP != 'true'): aplica UPDATEs de
 *   configuração em produção (quando nenhum seed reset os dados).
 *   Em dev/teste com SEED_ON_STARTUP=true, o mock_data.sql já inclui os
 *   valores corretos nas cláusulas INSERT — nenhum UPDATE extra é necessário.
 */
@Injectable()
export class MigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationService.name);

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.runSchemaChanges();

    if (process.env.SEED_ON_STARTUP !== 'true') {
      await this.runDataFixes();
    }
  }

  // ── Fase 1: alterações de schema idempotentes ──────────────────────────────

  private async runSchemaChanges(): Promise<void> {
    this.logger.log('Aplicando migrações de schema...');

    // Cada bloco roda separado para que uma falha não cancele os demais.

    // ── soft_constraint (adicionada após o schema inicial) ──────────────────
    await this.runStep('criar tabela soft_constraint', `
      CREATE TABLE IF NOT EXISTS soft_constraint (
        id           SERIAL PRIMARY KEY,
        codigo       VARCHAR(10)    NOT NULL UNIQUE,
        nome         VARCHAR(100)   NOT NULL,
        descricao    TEXT,
        peso         NUMERIC(5,2)   NOT NULL DEFAULT 1 CHECK (peso >= 0),
        atualizado_em TIMESTAMP     NOT NULL DEFAULT NOW()
      );
    `);

    // Insere os pesos default apenas se a tabela estiver vazia.
    await this.runStep('seed soft_constraint', `
      INSERT INTO soft_constraint (codigo, nome, descricao, peso)
      SELECT * FROM (VALUES
        ('SC1', 'Concentracao diaria da disciplina',
         'Penaliza muitas aulas da mesma disciplina no mesmo dia para uma turma.', 3),
        ('SC2', 'Aulas consecutivas da disciplina',
         'Penaliza sequencias longas de periodos seguidos da mesma disciplina.', 3),
        ('SC5', 'Janela ociosa do professor',
         'Penaliza horarios vagos entre aulas do professor no mesmo dia.', 1),
        ('SC6', 'Disciplina pesada no ultimo periodo',
         'Penaliza disciplinas cognitivamente pesadas alocadas no ultimo periodo do dia.', 1.5),
        ('SC7', 'Disciplina pratica no primeiro periodo',
         'Penaliza disciplinas praticas alocadas no primeiro periodo do dia.', 1)
      ) AS v(codigo, nome, descricao, peso)
      WHERE NOT EXISTS (SELECT 1 FROM soft_constraint LIMIT 1);
    `);

    // ── turno: para_ensino_medio ─────────────────────────────────────────────
    await this.runStep('coluna turno.para_ensino_medio', `
      ALTER TABLE turno
        ADD COLUMN IF NOT EXISTS para_ensino_medio BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // ── turma: segmento ──────────────────────────────────────────────────────
    await this.runStep('coluna turma.segmento', `
      ALTER TABLE turma
        ADD COLUMN IF NOT EXISTS segmento VARCHAR(20) NOT NULL DEFAULT 'anos_finais';
    `);

    await this.runStep('constraint turma.segmento', `
      DO $$
      BEGIN
        ALTER TABLE turma ADD CONSTRAINT turma_segmento_check
          CHECK (segmento IN ('anos_finais', 'ensino_medio'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      $$;
    `);

    await this.runStep('index idx_turma_segmento', `
      CREATE INDEX IF NOT EXISTS idx_turma_segmento ON turma(segmento);
    `);

    this.logger.log('Migrações de schema concluídas.');
  }

  /** Executa um passo de migração e loga a falha sem derrubar a aplicação. */
  private async runStep(name: string, sql: string): Promise<void> {
    try {
      await this.pool.query(sql);
    } catch (err) {
      this.logger.error(`Migration step "${name}" falhou: ${(err as Error).message}`);
    }
  }

  // ── Fase 2: dados de configuração (só em produção, sem seed) ───────────────

  private async runDataFixes(): Promise<void> {
    this.logger.log('Aplicando correções de dados para produção...');
    try {
      // Marca o turno "Tarde" como extra para o Ensino Médio.
      // Em produção a escola usa turno Manhã para todos + Tarde só na segunda.
      await this.pool.query(`
        UPDATE turno
          SET para_ensino_medio = TRUE
          WHERE nome = 'Tarde' AND para_ensino_medio = FALSE;
      `);

      // Classifica turmas como ensino_medio com base na série cadastrada.
      // Padrão adotado pela escola: séries terminadas em 'EM' (ex.: 1EM, 2EM, 3EM).
      await this.pool.query(`
        UPDATE turma
          SET segmento = 'ensino_medio'
          WHERE segmento = 'anos_finais'
            AND (serie ILIKE '%EM%' OR serie ILIKE '%medio%');
      `);

      const updated = await this.pool.query(
        `SELECT COUNT(*) FROM turma WHERE segmento = 'ensino_medio'`,
      );
      const count = updated.rows[0]?.count ?? 0;
      this.logger.log(
        `Dados de produção aplicados. Turmas Ensino Médio: ${count}`,
      );
    } catch (err) {
      this.logger.error(
        `Falha nas correções de dados: ${(err as Error).message}`,
      );
    }
  }
}
