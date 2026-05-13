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

    return { ...request, options };
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
    newTimeSlotId: number,
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

    // Copy selected option items to horario table (official schedule)
    await this.pool.query(
      `INSERT INTO horario (turma_disciplina_id, time_slot_id)
       SELECT turma_disciplina_id, time_slot_id
       FROM schedule_option_item
       WHERE option_id = $1`,
      [optionId],
    );

    await this.pool.query(
      "UPDATE schedule_request SET status = 'confirmed' WHERE id = $1",
      [requestId],
    );

    return { success: true };
  }
}
