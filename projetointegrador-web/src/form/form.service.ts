import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { DB_POOL } from '../database/database.module';
import { PaginationParams, paginateQuery } from '../common/pagination';

@Injectable()
export class FormService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async generateLink(professorId: number): Promise<{ token: string } | null> {
    const profCheck = await this.pool.query(
      'SELECT id FROM professor WHERE id = $1 AND ativo = TRUE',
      [professorId],
    );
    if (profCheck.rows.length === 0) return null;

    const token = randomBytes(32).toString('hex');
    await this.pool.query(
      `INSERT INTO professor_form_link (professor_id, token)
       VALUES ($1, $2)`,
      [professorId, token],
    );
    return { token };
  }

  async listLinks(
    pagination?: PaginationParams,
  ): Promise<unknown[] | { items: unknown[]; page: number; limit: number; total: number; totalPages: number }> {
    return paginateQuery(
      this.pool,
      `SELECT fl.id, fl.token, fl.respondido, fl.criado_em, fl.respondido_em,
              p.id AS professor_id, p.nome AS professor_nome, p.email AS professor_email
       FROM professor_form_link fl
       JOIN professor p ON fl.professor_id = p.id
       ORDER BY fl.criado_em DESC`,
      [],
      pagination,
    );
  }

  async getFormData(token: string): Promise<unknown | null> {
    const linkResult = await this.pool.query(
      `SELECT fl.id, fl.professor_id, fl.respondido, p.nome AS professor_nome
       FROM professor_form_link fl
       JOIN professor p ON fl.professor_id = p.id
       WHERE fl.token = $1`,
      [token],
    );
    if (linkResult.rows.length === 0) return null;

    const link = linkResult.rows[0];
    if (link.respondido) {
      return { ...link, already_answered: true, slots: [] };
    }

    const slotsResult = await this.pool.query(
      `SELECT ts.id AS time_slot_id, ds.id AS dia_id, ds.nome AS dia_nome,
              p.id AS periodo_id, p.numero AS periodo_numero,
              p.hora_inicio, p.hora_fim, t.id AS turno_id, t.nome AS turno_nome
       FROM time_slot ts
       JOIN dia_semana ds ON ts.dia_id = ds.id
       JOIN periodo p ON ts.periodo_id = p.id
       JOIN turno t ON p.turno_id = t.id
       WHERE p.tipo = 'aula'
       ORDER BY t.id, ds.id, p.numero`,
    );

    return { ...link, already_answered: false, slots: slotsResult.rows };
  }

  async submitAvailability(
    token: string,
    disponibilidade: Array<{ time_slot_id: number; disponivel: boolean; preferencia: number }>,
  ): Promise<{ success: boolean; error?: string }> {
    const linkResult = await this.pool.query(
      'SELECT id, professor_id, respondido FROM professor_form_link WHERE token = $1',
      [token],
    );
    if (linkResult.rows.length === 0) {
      return { success: false, error: 'Link invalido' };
    }
    const link = linkResult.rows[0];
    if (link.respondido) {
      return { success: false, error: 'Formulario ja foi respondido' };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'DELETE FROM professor_disponibilidade WHERE professor_id = $1',
        [link.professor_id],
      );

      if (disponibilidade.length > 0) {
        const values: (number | boolean)[] = [];
        const placeholders: string[] = [];
        let idx = 1;
        for (const d of disponibilidade) {
          placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
          values.push(link.professor_id, d.time_slot_id, d.disponivel, d.preferencia);
        }
        await client.query(
          `INSERT INTO professor_disponibilidade (professor_id, time_slot_id, disponivel, preferencia)
           VALUES ${placeholders.join(', ')}`,
          values,
        );
      }

      await client.query(
        `UPDATE professor_form_link SET respondido = TRUE, respondido_em = NOW() WHERE id = $1`,
        [link.id],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
