import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../database/database.module';

@Injectable()
export class ConfigService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  // ===================== PERIODOS =====================

  async listPeriodos(): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT p.id, p.numero, p.hora_inicio, p.hora_fim, p.tipo, p.turno_id, t.nome AS turno_nome
       FROM periodo p JOIN turno t ON p.turno_id = t.id
       ORDER BY t.id, p.numero`,
    );
    return result.rows;
  }

  async createPeriodo(data: {
    numero: number;
    hora_inicio: string;
    hora_fim: string;
    tipo: string;
    turno_id: number;
  }): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO periodo (numero, hora_inicio, hora_fim, tipo, turno_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.numero, data.hora_inicio, data.hora_fim, data.tipo || 'aula', data.turno_id],
    );
    return result.rows[0];
  }

  async deletePeriodo(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM periodo WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Gera todos os periodos de um turno a partir de regras de alto nivel
  // (hora de inicio, duracao da aula, quantidade e intervalo) e reconstroi os
  // time slots. Substitui os periodos pre-existentes do turno. Roda em
  // transacao para nao deixar o turno num estado parcial.
  async generateTurnoPeriodos(data: {
    turno_id: number;
    hora_inicio: string; // 'HH:MM'
    duracao_aula: number; // minutos
    quantidade_aulas: number;
    intervalo_apos_aula?: number | null; // 1-based; nulo = sem intervalo
    duracao_intervalo?: number | null; // minutos
    dia_ids?: number[] | null; // dias da semana a gerar slots; nulo/vazio = todos
  }): Promise<{ periodos: number; slots: number }> {
    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };
    const toHHMM = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const hasIntervalo =
      data.intervalo_apos_aula != null &&
      data.intervalo_apos_aula >= 1 &&
      data.intervalo_apos_aula < data.quantidade_aulas &&
      data.duracao_intervalo != null &&
      data.duracao_intervalo > 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Dias a usar: os informados ou, se vazio/nulo, todos os dias cadastrados.
      let diaIds = (data.dia_ids ?? []).filter((d) => Number.isInteger(d));
      if (diaIds.length === 0) {
        const allDias = await client.query('SELECT id FROM dia_semana ORDER BY id');
        diaIds = allDias.rows.map((r) => r.id as number);
      }

      // Substituir os periodos do turno tambem apaga (CASCADE) os time slots
      // antigos deste turno; os de outros turnos permanecem intactos.
      await client.query('DELETE FROM periodo WHERE turno_id = $1', [data.turno_id]);

      let cursor = toMinutes(data.hora_inicio);
      let numero = 1;
      let periodosCriados = 0;

      for (let aula = 1; aula <= data.quantidade_aulas; aula++) {
        const fim = cursor + data.duracao_aula;
        await client.query(
          `INSERT INTO periodo (numero, hora_inicio, hora_fim, tipo, turno_id)
           VALUES ($1, $2, $3, 'aula', $4)`,
          [numero++, toHHMM(cursor), toHHMM(fim), data.turno_id],
        );
        cursor = fim;
        periodosCriados++;

        if (hasIntervalo && aula === data.intervalo_apos_aula) {
          const fimIntervalo = cursor + (data.duracao_intervalo as number);
          await client.query(
            `INSERT INTO periodo (numero, hora_inicio, hora_fim, tipo, turno_id)
             VALUES ($1, $2, $3, 'intervalo', $4)`,
            [numero++, toHHMM(cursor), toHHMM(fimIntervalo), data.turno_id],
          );
          cursor = fimIntervalo;
          periodosCriados++;
        }
      }

      // Gera os slots apenas para este turno e apenas para os dias marcados.
      const slotRes = await client.query(
        `INSERT INTO time_slot (dia_id, periodo_id)
         SELECT d.id, p.id FROM dia_semana d CROSS JOIN periodo p
         WHERE p.turno_id = $1 AND p.tipo = 'aula' AND d.id = ANY($2::int[])
         ORDER BY d.id, p.id
         RETURNING id`,
        [data.turno_id, diaIds],
      );

      await client.query('COMMIT');
      return { periodos: periodosCriados, slots: slotRes.rowCount ?? 0 };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async regenerateTimeSlots(): Promise<number> {
    await this.pool.query('DELETE FROM time_slot');
    const result = await this.pool.query(
      `INSERT INTO time_slot (dia_id, periodo_id)
       SELECT d.id, p.id FROM dia_semana d CROSS JOIN periodo p
       WHERE p.tipo = 'aula'
       ORDER BY d.id, p.id
       RETURNING id`,
    );
    return result.rowCount ?? 0;
  }

  // ===================== TURNOS =====================

  async listTurnos(): Promise<unknown[]> {
    const result = await this.pool.query('SELECT * FROM turno ORDER BY id');
    return result.rows;
  }

  // ===================== PROFESSORES =====================

  async listProfessores(): Promise<unknown[]> {
    const result = await this.pool.query(
      'SELECT * FROM professor WHERE ativo = TRUE ORDER BY nome',
    );
    return result.rows;
  }

  async createProfessor(data: {
    nome: string;
    email?: string;
    carga_horaria_max?: number;
  }): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO professor (nome, email, carga_horaria_max)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.nome, data.email || null, data.carga_horaria_max || 40],
    );
    return result.rows[0];
  }

  async deleteProfessor(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE professor SET ativo = FALSE WHERE id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== DISCIPLINAS =====================

  async listDisciplinas(): Promise<unknown[]> {
    const result = await this.pool.query('SELECT * FROM disciplina ORDER BY nome');
    return result.rows;
  }

  async createDisciplina(data: {
    nome: string;
    sigla?: string;
    peso?: number;
  }): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO disciplina (nome, sigla, peso)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.nome, data.sigla || null, data.peso || 1],
    );
    return result.rows[0];
  }

  async deleteDisciplina(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM disciplina WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== TURMAS =====================

  async listTurmas(): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT t.*, tur.nome AS turno_nome FROM turma t
       JOIN turno tur ON t.turno_id = tur.id
       WHERE t.ativa = TRUE ORDER BY t.nome`,
    );
    return result.rows;
  }

  async createTurma(data: {
    nome: string;
    serie: string;
    ano_letivo: number;
    turno_id: number;
  }): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO turma (nome, serie, ano_letivo, turno_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.nome, data.serie, data.ano_letivo, data.turno_id],
    );
    return result.rows[0];
  }

  async deleteTurma(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE turma SET ativa = FALSE WHERE id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== TURMA_DISCIPLINA =====================

  async listTurmaDisciplinas(): Promise<unknown[]> {
    const result = await this.pool.query(
      `SELECT td.*, t.nome AS turma_nome, d.nome AS disciplina_nome,
              d.sigla AS disciplina_sigla, p.nome AS professor_nome
       FROM turma_disciplina td
       JOIN turma t ON td.turma_id = t.id
       JOIN disciplina d ON td.disciplina_id = d.id
       JOIN professor p ON td.professor_id = p.id
       WHERE t.ativa = TRUE
       ORDER BY t.nome, d.nome`,
    );
    return result.rows;
  }

  async createTurmaDisciplina(data: {
    turma_id: number;
    disciplina_id: number;
    professor_id: number;
    aulas_semana: number;
    tamanho_bloco?: number;
  }): Promise<unknown> {
    const result = await this.pool.query(
      `INSERT INTO turma_disciplina (turma_id, disciplina_id, professor_id, aulas_semana, tamanho_bloco)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.turma_id, data.disciplina_id, data.professor_id, data.aulas_semana, data.tamanho_bloco || 1],
    );
    return result.rows[0];
  }

  async deleteTurmaDisciplina(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM turma_disciplina WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== DIAS =====================

  async listDias(): Promise<unknown[]> {
    const result = await this.pool.query('SELECT * FROM dia_semana ORDER BY id');
    return result.rows;
  }
}
