import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { Queue } from 'bullmq';
import { DB_POOL } from '../database/database.module';
import { SCHEDULE_QUEUE } from '../queue/queue.module';

@Injectable()
export class ScheduleService {
  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(SCHEDULE_QUEUE) private readonly queue: Queue,
  ) {}

  async createRequest(): Promise<{ id: number; status: string }> {
    const result = await this.pool.query(
      "INSERT INTO schedule_request (status) VALUES ('pending') RETURNING id, status",
    );
    const request = result.rows[0];
    await this.queue.add('generate', { requestId: request.id });
    return request;
  }

  async listRequests(): Promise<unknown[]> {
    const result = await this.pool.query(
      'SELECT id, status, criado_em FROM schedule_request ORDER BY criado_em DESC',
    );
    return result.rows;
  }

  async listConfirmedRequests(): Promise<unknown[]> {
    const result = await this.pool.query(
      "SELECT id, status, criado_em FROM schedule_request WHERE status = 'confirmed' ORDER BY criado_em DESC",
    );
    return result.rows;
  }

  async getRequest(id: number): Promise<unknown | null> {
    const reqResult = await this.pool.query(
      'SELECT id, status, criado_em FROM schedule_request WHERE id = $1',
      [id],
    );
    if (reqResult.rows.length === 0) return null;

    const request = reqResult.rows[0];
    const optResult = await this.pool.query(
      'SELECT id, strategy, score, selected, criado_em FROM schedule_option WHERE request_id = $1 ORDER BY id',
      [id],
    );

    const options = [];
    for (const opt of optResult.rows) {
      const itemsResult = await this.pool.query(
        `SELECT
          soi.id AS item_id,
          soi.turma_disciplina_id,
          soi.time_slot_id,
          t.nome AS turma_nome,
          t.id AS turma_id,
          t.serie AS turma_serie,
          d.nome AS disciplina_nome,
          d.sigla AS disciplina_sigla,
          pr.id AS professor_id,
          pr.nome AS professor_nome,
          ds.nome AS dia_nome,
          ds.id AS dia_id,
          per.numero AS periodo_numero,
          per.hora_inicio,
          per.hora_fim,
          tur.nome AS turno_nome
        FROM schedule_option_item soi
        JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
        JOIN turma t ON td.turma_id = t.id
        JOIN disciplina d ON td.disciplina_id = d.id
        JOIN professor pr ON td.professor_id = pr.id
        JOIN time_slot ts ON soi.time_slot_id = ts.id
        JOIN dia_semana ds ON ts.dia_id = ds.id
        JOIN periodo per ON ts.periodo_id = per.id
        JOIN turno tur ON per.turno_id = tur.id
        WHERE soi.option_id = $1
        ORDER BY ds.id, per.numero`,
        [opt.id],
      );
      options.push({ ...opt, items: itemsResult.rows });
    }

    const unavailRes = await this.pool.query(
      `WITH prof_turnos AS (
         SELECT DISTINCT td.professor_id, t.turno_id
         FROM schedule_option_item soi
         JOIN schedule_option so ON soi.option_id = so.id
         JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
         JOIN turma t ON td.turma_id = t.id
         WHERE so.request_id = $1
       )
       SELECT pt.professor_id, ts.dia_id, p.numero AS periodo_numero
       FROM prof_turnos pt
       JOIN periodo p ON p.turno_id = pt.turno_id
       JOIN time_slot ts ON ts.periodo_id = p.id
       LEFT JOIN professor_disponibilidade pd
         ON pd.professor_id = pt.professor_id AND pd.time_slot_id = ts.id
       WHERE pd.id IS NULL OR pd.disponivel = FALSE`,
      [id],
    );
    const professorAvailability: Record<string, Array<{ dia_id: number; periodo_numero: number }>> = {};
    for (const row of unavailRes.rows) {
      const key = String(row.professor_id);
      if (!professorAvailability[key]) professorAvailability[key] = [];
      professorAvailability[key].push({ dia_id: row.dia_id, periodo_numero: row.periodo_numero });
    }

    return { ...request, options, professorAvailability };
  }

  async getPublicRequest(id: number): Promise<unknown | null> {
    const request = await this.getRequest(id);
    if (!request || (request as { status?: string }).status !== 'confirmed') {
      return null;
    }
    return request;
  }

  async selectOption(
    requestId: number,
    optionId: number,
  ): Promise<boolean> {
    const check = await this.pool.query(
      'SELECT id FROM schedule_option WHERE id = $1 AND request_id = $2',
      [optionId, requestId],
    );
    if (check.rows.length === 0) return false;

    await this.pool.query(
      'UPDATE schedule_option SET selected = FALSE WHERE request_id = $1',
      [requestId],
    );
    await this.pool.query(
      'UPDATE schedule_option SET selected = TRUE WHERE id = $1',
      [optionId],
    );
    return true;
  }

  async updateItem(
    requestId: number,
    itemId: number,
    newTimeSlotId?: number,
    diaId?: number,
    periodoNumero?: number,
  ): Promise<{ success: boolean; error?: string }> {
    // Verify item belongs to a selected option of this request
    const itemRes = await this.pool.query(
      `SELECT soi.id, soi.option_id, soi.turma_disciplina_id, soi.time_slot_id,
              td.professor_id, td.turma_id, t.turno_id
       FROM schedule_option_item soi
       JOIN schedule_option so ON soi.option_id = so.id
       JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
       JOIN turma t ON td.turma_id = t.id
       WHERE soi.id = $1 AND so.request_id = $2 AND so.selected = TRUE`,
      [itemId, requestId],
    );
    if (itemRes.rows.length === 0) {
      return { success: false, error: 'Item nao encontrado na opcao selecionada' };
    }
    const item = itemRes.rows[0];

    // Resolve time_slot_id from (diaId, periodoNumero) using turma's turno when not provided
    if (!newTimeSlotId) {
      const resolved = await this.pool.query(
        `SELECT ts.id FROM time_slot ts
         JOIN periodo p ON ts.periodo_id = p.id
         WHERE ts.dia_id = $1 AND p.numero = $2 AND p.turno_id = $3`,
        [diaId, periodoNumero, item.turno_id],
      );
      if (resolved.rows.length === 0) {
        return { success: false, error: 'Horario de destino nao existe para esta turma' };
      }
      newTimeSlotId = resolved.rows[0].id;
    }

    // Verify new slot is in the correct turno
    const slotRes = await this.pool.query(
      `SELECT ts.id, p.turno_id FROM time_slot ts
       JOIN periodo p ON ts.periodo_id = p.id
       WHERE ts.id = $1`,
      [newTimeSlotId],
    );
    if (slotRes.rows.length === 0) {
      return { success: false, error: 'Time slot nao existe' };
    }
    if (slotRes.rows[0].turno_id !== item.turno_id) {
      return { success: false, error: 'Time slot pertence a outro turno' };
    }

    // Professor must be available at the destination slot
    const profAvail = await this.pool.query(
      `SELECT 1 FROM professor_disponibilidade
       WHERE professor_id = $1 AND time_slot_id = $2 AND disponivel = TRUE`,
      [item.professor_id, newTimeSlotId],
    );
    if (profAvail.rows.length === 0) {
      return { success: false, error: 'Professor nao disponivel neste horario' };
    }

    // Check turma conflict: turma already has class at this slot (in same option)
    const turmaConflict = await this.pool.query(
      `SELECT soi.id FROM schedule_option_item soi
       JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
       WHERE soi.option_id = $1 AND soi.time_slot_id = $2 AND td.turma_id = $3 AND soi.id != $4`,
      [item.option_id, newTimeSlotId, item.turma_id, itemId],
    );
    if (turmaConflict.rows.length > 0) {
      return { success: false, error: 'Turma ja tem aula neste horario' };
    }

    // Check professor conflict: professor already teaching at this slot (in same option)
    const profConflict = await this.pool.query(
      `SELECT soi.id FROM schedule_option_item soi
       JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
       WHERE soi.option_id = $1 AND soi.time_slot_id = $2 AND td.professor_id = $3 AND soi.id != $4`,
      [item.option_id, newTimeSlotId, item.professor_id, itemId],
    );
    if (profConflict.rows.length > 0) {
      return { success: false, error: 'Professor ja tem aula neste horario' };
    }

    await this.pool.query(
      'UPDATE schedule_option_item SET time_slot_id = $1 WHERE id = $2',
      [newTimeSlotId, itemId],
    );
    return { success: true };
  }

  async swapItems(
    requestId: number,
    itemAId: number,
    itemBId: number,
  ): Promise<{ success: boolean; error?: string }> {
    if (itemAId === itemBId) {
      return { success: false, error: 'Itens iguais' };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const itemsRes = await client.query(
        `SELECT soi.id, soi.option_id, soi.time_slot_id,
                td.professor_id, td.turma_id, t.turno_id
         FROM schedule_option_item soi
         JOIN schedule_option so ON soi.option_id = so.id
         JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
         JOIN turma t ON td.turma_id = t.id
         WHERE soi.id = ANY($1::int[]) AND so.request_id = $2 AND so.selected = TRUE`,
        [[itemAId, itemBId], requestId],
      );
      if (itemsRes.rows.length !== 2) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Itens nao encontrados na opcao selecionada' };
      }
      const a = itemsRes.rows.find((r) => r.id === itemAId);
      const b = itemsRes.rows.find((r) => r.id === itemBId);
      if (!a || !b) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Itens invalidos' };
      }
      if (a.option_id !== b.option_id) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Itens de opcoes diferentes' };
      }
      if (a.turma_id !== b.turma_id) {
        await client.query('ROLLBACK');
        return { success: false, error: 'So e possivel trocar aulas dentro da mesma turma' };
      }
      if (a.turno_id !== b.turno_id) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Horarios de turnos diferentes' };
      }
      if (a.time_slot_id === b.time_slot_id) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Itens ja estao no mesmo horario' };
      }

      // Both professors must be available at their destination slot
      const availA = await client.query(
        `SELECT 1 FROM professor_disponibilidade
         WHERE professor_id = $1 AND time_slot_id = $2 AND disponivel = TRUE`,
        [a.professor_id, b.time_slot_id],
      );
      if (availA.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Professor da aula movida nao disponivel no horario destino' };
      }
      const availB = await client.query(
        `SELECT 1 FROM professor_disponibilidade
         WHERE professor_id = $1 AND time_slot_id = $2 AND disponivel = TRUE`,
        [b.professor_id, a.time_slot_id],
      );
      if (availB.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Professor da aula trocada nao disponivel no horario destino' };
      }

      // Professor conflicts after swap (excluding the two items themselves)
      const profConflictA = await client.query(
        `SELECT soi.id FROM schedule_option_item soi
         JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
         WHERE soi.option_id = $1 AND soi.time_slot_id = $2
           AND td.professor_id = $3 AND soi.id NOT IN ($4, $5)`,
        [a.option_id, b.time_slot_id, a.professor_id, itemAId, itemBId],
      );
      if (profConflictA.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Professor da aula movida ja tem aula no horario destino' };
      }
      const profConflictB = await client.query(
        `SELECT soi.id FROM schedule_option_item soi
         JOIN turma_disciplina td ON soi.turma_disciplina_id = td.id
         WHERE soi.option_id = $1 AND soi.time_slot_id = $2
           AND td.professor_id = $3 AND soi.id NOT IN ($4, $5)`,
        [a.option_id, a.time_slot_id, b.professor_id, itemAId, itemBId],
      );
      if (profConflictB.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Professor da aula trocada ja tem aula no horario destino' };
      }

      await client.query(
        'UPDATE schedule_option_item SET time_slot_id = $1 WHERE id = $2',
        [b.time_slot_id, itemAId],
      );
      await client.query(
        'UPDATE schedule_option_item SET time_slot_id = $1 WHERE id = $2',
        [a.time_slot_id, itemBId],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Erro ao trocar itens' };
    } finally {
      client.release();
    }
  }

  async confirmSchedule(requestId: number): Promise<{ success: boolean; error?: string }> {
    const reqRes = await this.pool.query(
      'SELECT id, status FROM schedule_request WHERE id = $1',
      [requestId],
    );
    if (reqRes.rows.length === 0) {
      return { success: false, error: 'Requisicao nao encontrada' };
    }
    if (reqRes.rows[0].status === 'confirmed') {
      return { success: false, error: 'Requisicao ja confirmada' };
    }

    const optRes = await this.pool.query(
      'SELECT id FROM schedule_option WHERE request_id = $1 AND selected = TRUE',
      [requestId],
    );
    if (optRes.rows.length === 0) {
      return { success: false, error: 'Nenhuma opcao selecionada' };
    }
    const optionId = optRes.rows[0].id;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Replace existing horario rows for the turma_disciplina_ids being confirmed,
      // so re-confirming or confirming a revised schedule overwrites the prior one
      // without violating UNIQUE(turma_disciplina_id, time_slot_id) and without
      // touching unrelated turmas.
      await client.query(
        `DELETE FROM horario
         WHERE turma_disciplina_id IN (
           SELECT DISTINCT turma_disciplina_id FROM schedule_option_item WHERE option_id = $1
         )`,
        [optionId],
      );

      await client.query(
        `INSERT INTO horario (turma_disciplina_id, time_slot_id)
         SELECT turma_disciplina_id, time_slot_id
         FROM schedule_option_item
         WHERE option_id = $1`,
        [optionId],
      );

      await client.query(
        "UPDATE schedule_request SET status = 'confirmed' WHERE id = $1",
        [requestId],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Erro ao salvar grade confirmada' };
    } finally {
      client.release();
    }
  }
}
