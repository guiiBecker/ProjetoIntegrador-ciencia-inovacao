import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../database/database.module';
import { PaginationParams, paginateQuery } from '../common/pagination';

@Injectable()
export class ConfigService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  // ===================== PERIODOS =====================

  async listPeriodos(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(
      this.pool,
      `SELECT p.id, p.numero, p.hora_inicio, p.hora_fim, p.tipo, p.turno_id, t.nome AS turno_nome
       FROM periodo p JOIN turno t ON p.turno_id = t.id
       ORDER BY t.id, p.numero`,
      [],
      pagination,
    );
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

  async updatePeriodo(
    id: number,
    data: {
      numero: number;
      hora_inicio: string;
      hora_fim: string;
      tipo: string;
      turno_id: number;
    },
  ): Promise<unknown | null> {
    const result = await this.pool.query(
      `UPDATE periodo
       SET numero = $1, hora_inicio = $2, hora_fim = $3, tipo = $4, turno_id = $5
       WHERE id = $6
       RETURNING *`,
      [data.numero, data.hora_inicio, data.hora_fim, data.tipo || 'aula', data.turno_id, id],
    );
    return result.rows[0] ?? null;
  }

  async deletePeriodo(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM periodo WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
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

  async listTurnos(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(this.pool, 'SELECT * FROM turno ORDER BY id', [], pagination);
  }

  // ===================== PROFESSORES =====================

  async listProfessores(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(
      this.pool,
      'SELECT * FROM professor WHERE ativo = TRUE ORDER BY nome',
      [],
      pagination,
    );
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

  async updateProfessor(
    id: number,
    data: {
      nome: string;
      email?: string;
      carga_horaria_max?: number;
    },
  ): Promise<unknown | null> {
    const result = await this.pool.query(
      `UPDATE professor
       SET nome = $1, email = $2, carga_horaria_max = $3
       WHERE id = $4 AND ativo = TRUE
       RETURNING *`,
      [data.nome, data.email || null, data.carga_horaria_max ?? 40, id],
    );
    return result.rows[0] ?? null;
  }

  async deleteProfessor(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE professor SET ativo = FALSE WHERE id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== DISCIPLINAS =====================

  async listDisciplinas(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(this.pool, 'SELECT * FROM disciplina ORDER BY nome', [], pagination);
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

  async updateDisciplina(
    id: number,
    data: {
      nome: string;
      sigla?: string;
      peso?: number;
    },
  ): Promise<unknown | null> {
    const result = await this.pool.query(
      `UPDATE disciplina
       SET nome = $1, sigla = $2, peso = $3
       WHERE id = $4
       RETURNING *`,
      [data.nome, data.sigla || null, data.peso ?? 1, id],
    );
    return result.rows[0] ?? null;
  }

  async deleteDisciplina(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM disciplina WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== TURMAS =====================

  async listTurmas(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(
      this.pool,
      `SELECT t.*, tur.nome AS turno_nome FROM turma t
       JOIN turno tur ON t.turno_id = tur.id
       WHERE t.ativa = TRUE ORDER BY t.nome`,
      [],
      pagination,
    );
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

  async updateTurma(
    id: number,
    data: {
      nome: string;
      serie: string;
      ano_letivo: number;
      turno_id: number;
    },
  ): Promise<unknown | null> {
    const result = await this.pool.query(
      `UPDATE turma
       SET nome = $1, serie = $2, ano_letivo = $3, turno_id = $4
       WHERE id = $5 AND ativa = TRUE
       RETURNING *`,
      [data.nome, data.serie, data.ano_letivo, data.turno_id, id],
    );
    return result.rows[0] ?? null;
  }

  async deleteTurma(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE turma SET ativa = FALSE WHERE id = $1',
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== TURMA_DISCIPLINA =====================

  async listTurmaDisciplinas(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(
      this.pool,
      `SELECT td.*, t.nome AS turma_nome, d.nome AS disciplina_nome,
              d.sigla AS disciplina_sigla, p.nome AS professor_nome
       FROM turma_disciplina td
       JOIN turma t ON td.turma_id = t.id
       JOIN disciplina d ON td.disciplina_id = d.id
       JOIN professor p ON td.professor_id = p.id
       WHERE t.ativa = TRUE
       ORDER BY t.nome, d.nome`,
      [],
      pagination,
    );
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

  async updateTurmaDisciplina(
    id: number,
    data: {
      turma_id: number;
      disciplina_id: number;
      professor_id: number;
      aulas_semana: number;
      tamanho_bloco?: number;
    },
  ): Promise<unknown | null> {
    const result = await this.pool.query(
      `UPDATE turma_disciplina
       SET turma_id = $1, disciplina_id = $2, professor_id = $3, aulas_semana = $4, tamanho_bloco = $5
       WHERE id = $6
       RETURNING *`,
      [data.turma_id, data.disciplina_id, data.professor_id, data.aulas_semana, data.tamanho_bloco || 1, id],
    );
    return result.rows[0] ?? null;
  }

  async deleteTurmaDisciplina(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM turma_disciplina WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ===================== DIAS =====================

  async listDias(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(this.pool, 'SELECT * FROM dia_semana ORDER BY id', [], pagination);
  }
}
