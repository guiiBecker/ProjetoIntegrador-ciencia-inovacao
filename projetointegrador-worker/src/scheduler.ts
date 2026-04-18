import { Pool } from 'pg';

// ===================== Types =====================

interface TurmaDisciplina {
  id: number;
  turma_id: number;
  disciplina_id: number;
  professor_id: number;
  aulas_semana: number;
  tamanho_bloco: number;
  turno_id: number;
}

interface TimeSlotInfo {
  id: number;
  dia_id: number;
  periodo_numero: number;
  turno_id: number;
}

interface ProfDisp {
  professor_id: number;
  time_slot_id: number;
  disponivel: boolean;
  preferencia: number;
}

interface Assignment {
  turma_disciplina_id: number;
  time_slot_id: number;
}

interface ScheduleResult {
  strategy: string;
  assignments: Assignment[];
  score: number;
}

interface ScheduleState {
  professorUsed: Map<number, Set<number>>;
  turmaUsed: Map<number, Set<number>>;
}

interface BlockCandidate {
  slotIds: number[];
  avgPref: number;
  diaId: number;
}

// ===================== Helpers =====================

function newState(): ScheduleState {
  return { professorUsed: new Map(), turmaUsed: new Map() };
}

function markSlots(
  state: ScheduleState,
  profId: number,
  turmaId: number,
  slotIds: number[],
): void {
  if (!state.professorUsed.has(profId)) state.professorUsed.set(profId, new Set());
  if (!state.turmaUsed.has(turmaId)) state.turmaUsed.set(turmaId, new Set());
  for (const id of slotIds) {
    state.professorUsed.get(profId)!.add(id);
    state.turmaUsed.get(turmaId)!.add(id);
  }
}

function buildProfDispMap(
  profDisps: ProfDisp[],
): Map<number, Map<number, ProfDisp>> {
  const map = new Map<number, Map<number, ProfDisp>>();
  for (const pd of profDisps) {
    if (!map.has(pd.professor_id)) map.set(pd.professor_id, new Map());
    map.get(pd.professor_id)!.set(pd.time_slot_id, pd);
  }
  return map;
}

function getSlotsByTurnoAndDay(
  slots: TimeSlotInfo[],
  turnoId: number,
): Map<number, TimeSlotInfo[]> {
  const byDay = new Map<number, TimeSlotInfo[]>();
  for (const slot of slots) {
    if (slot.turno_id !== turnoId) continue;
    if (!byDay.has(slot.dia_id)) byDay.set(slot.dia_id, []);
    byDay.get(slot.dia_id)!.push(slot);
  }
  for (const daySlots of byDay.values()) {
    daySlots.sort((a, b) => a.periodo_numero - b.periodo_numero);
  }
  return byDay;
}

function findValidBlocks(
  td: TurmaDisciplina,
  slotsByDay: Map<number, TimeSlotInfo[]>,
  profDispMap: Map<number, Map<number, ProfDisp>>,
  state: ScheduleState,
): BlockCandidate[] {
  const results: BlockCandidate[] = [];

  for (const [diaId, daySlots] of slotsByDay) {
    for (let i = 0; i <= daySlots.length - td.tamanho_bloco; i++) {
      let consecutive = true;
      for (let j = 1; j < td.tamanho_bloco; j++) {
        if (daySlots[i + j].periodo_numero !== daySlots[i].periodo_numero + j) {
          consecutive = false;
          break;
        }
      }
      if (!consecutive) continue;

      const slotIds: number[] = [];
      let totalPref = 0;
      let valid = true;

      for (let j = 0; j < td.tamanho_bloco; j++) {
        const slot = daySlots[i + j];
        const disp = profDispMap.get(td.professor_id)?.get(slot.id);
        if (!disp || !disp.disponivel) { valid = false; break; }
        if (state.professorUsed.get(td.professor_id)?.has(slot.id)) { valid = false; break; }
        if (state.turmaUsed.get(td.turma_id)?.has(slot.id)) { valid = false; break; }
        slotIds.push(slot.id);
        totalPref += disp.preferencia;
      }

      if (valid) {
        results.push({ slotIds, avgPref: totalPref / td.tamanho_bloco, diaId });
      }
    }
  }

  return results;
}

// ===================== Data Loading =====================

async function loadData(pool: Pool) {
  const tdResult = await pool.query(`
    SELECT td.id, td.turma_id, td.disciplina_id, td.professor_id,
           td.aulas_semana, td.tamanho_bloco, t.turno_id
    FROM turma_disciplina td
    JOIN turma t ON td.turma_id = t.id
    WHERE t.ativa = TRUE
  `);

  const tsResult = await pool.query(`
    SELECT ts.id, ts.dia_id, p.numero AS periodo_numero, p.turno_id
    FROM time_slot ts
    JOIN periodo p ON ts.periodo_id = p.id
    ORDER BY ts.dia_id, p.turno_id, p.numero
  `);

  const pdResult = await pool.query(`
    SELECT professor_id, time_slot_id, disponivel, preferencia
    FROM professor_disponibilidade
  `);

  return {
    turmaDisciplinas: tdResult.rows as TurmaDisciplina[],
    timeSlots: tsResult.rows as TimeSlotInfo[],
    profDisp: pdResult.rows as ProfDisp[],
  };
}

// ===================== Strategies =====================

// Strategy 1: Greedy - Most constrained first, pick highest preference slots
function strategyGreedy(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
): ScheduleResult {
  const profDispMap = buildProfDispMap(profDisps);
  const state = newState();

  // Pre-compute constraint level: fewer valid blocks = more constrained
  const scored = tds.map((td) => {
    const slotsByDay = getSlotsByTurnoAndDay(slots, td.turno_id);
    const candidates = findValidBlocks(td, slotsByDay, profDispMap, state);
    const blocksNeeded = Math.ceil(td.aulas_semana / td.tamanho_bloco);
    const ratio = blocksNeeded > 0 ? candidates.length / blocksNeeded : Infinity;
    return { td, ratio };
  });
  scored.sort((a, b) => a.ratio - b.ratio);

  const allAssignments: Assignment[] = [];
  let totalNeeded = 0;

  for (const { td } of scored) {
    totalNeeded += td.aulas_semana;
    const slotsByDay = getSlotsByTurnoAndDay(slots, td.turno_id);
    const blocksNeeded = Math.ceil(td.aulas_semana / td.tamanho_bloco);

    for (let b = 0; b < blocksNeeded; b++) {
      const candidates = findValidBlocks(td, slotsByDay, profDispMap, state);
      if (candidates.length === 0) break;
      // Pick highest preference
      candidates.sort((a, b) => b.avgPref - a.avgPref);
      const chosen = candidates[0];
      markSlots(state, td.professor_id, td.turma_id, chosen.slotIds);
      for (const slotId of chosen.slotIds) {
        allAssignments.push({ turma_disciplina_id: td.id, time_slot_id: slotId });
      }
    }
  }

  return {
    strategy: 'greedy_best_preference',
    assignments: allAssignments,
    score: totalNeeded > 0 ? (allAssignments.length / totalNeeded) * 100 : 0,
  };
}

// Strategy 2: Random First-Fit - Shuffle order and pick random valid slots
function strategyRandom(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
): ScheduleResult {
  const profDispMap = buildProfDispMap(profDisps);
  const state = newState();

  const shuffled = [...tds].sort(() => Math.random() - 0.5);
  const allAssignments: Assignment[] = [];
  let totalNeeded = 0;

  for (const td of shuffled) {
    totalNeeded += td.aulas_semana;
    const slotsByDay = getSlotsByTurnoAndDay(slots, td.turno_id);
    const blocksNeeded = Math.ceil(td.aulas_semana / td.tamanho_bloco);

    for (let b = 0; b < blocksNeeded; b++) {
      const candidates = findValidBlocks(td, slotsByDay, profDispMap, state);
      if (candidates.length === 0) break;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      markSlots(state, td.professor_id, td.turma_id, chosen.slotIds);
      for (const slotId of chosen.slotIds) {
        allAssignments.push({ turma_disciplina_id: td.id, time_slot_id: slotId });
      }
    }
  }

  return {
    strategy: 'random_first_fit',
    assignments: allAssignments,
    score: totalNeeded > 0 ? (allAssignments.length / totalNeeded) * 100 : 0,
  };
}

// Strategy 3: Balanced Distribution - Spread classes evenly across the week
function strategyBalanced(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
): ScheduleResult {
  const profDispMap = buildProfDispMap(profDisps);
  const state = newState();
  const dayLoad = new Map<number, Map<number, number>>();

  // Sort by most aulas first to place hardest first
  const sorted = [...tds].sort((a, b) => b.aulas_semana - a.aulas_semana);
  const allAssignments: Assignment[] = [];
  let totalNeeded = 0;

  for (const td of sorted) {
    totalNeeded += td.aulas_semana;
    if (!dayLoad.has(td.turma_id)) dayLoad.set(td.turma_id, new Map());
    const turmaLoad = dayLoad.get(td.turma_id)!;
    const slotsByDay = getSlotsByTurnoAndDay(slots, td.turno_id);
    const blocksNeeded = Math.ceil(td.aulas_semana / td.tamanho_bloco);

    for (let b = 0; b < blocksNeeded; b++) {
      const candidates = findValidBlocks(td, slotsByDay, profDispMap, state);
      if (candidates.length === 0) break;
      // Pick the day with least load, then highest preference
      candidates.sort((a, cb) => {
        const loadA = turmaLoad.get(a.diaId) || 0;
        const loadB = turmaLoad.get(cb.diaId) || 0;
        if (loadA !== loadB) return loadA - loadB;
        return cb.avgPref - a.avgPref;
      });
      const chosen = candidates[0];
      markSlots(state, td.professor_id, td.turma_id, chosen.slotIds);
      turmaLoad.set(chosen.diaId, (turmaLoad.get(chosen.diaId) || 0) + td.tamanho_bloco);
      for (const slotId of chosen.slotIds) {
        allAssignments.push({ turma_disciplina_id: td.id, time_slot_id: slotId });
      }
    }
  }

  return {
    strategy: 'balanced_distribution',
    assignments: allAssignments,
    score: totalNeeded > 0 ? (allAssignments.length / totalNeeded) * 100 : 0,
  };
}

// ===================== Main Entry =====================

export async function generateSchedules(
  pool: Pool,
  requestId: number,
): Promise<void> {
  await pool.query(
    "UPDATE schedule_request SET status = 'processing' WHERE id = $1",
    [requestId],
  );

  try {
    const { turmaDisciplinas, timeSlots, profDisp } = await loadData(pool);

    if (turmaDisciplinas.length === 0) {
      await pool.query(
        "UPDATE schedule_request SET status = 'failed' WHERE id = $1",
        [requestId],
      );
      return;
    }

    const results: ScheduleResult[] = [
      strategyGreedy(turmaDisciplinas, timeSlots, profDisp),
      strategyRandom(turmaDisciplinas, timeSlots, profDisp),
      strategyBalanced(turmaDisciplinas, timeSlots, profDisp),
    ];

    for (const result of results) {
      const optRes = await pool.query(
        'INSERT INTO schedule_option (request_id, strategy, score) VALUES ($1, $2, $3) RETURNING id',
        [requestId, result.strategy, result.score],
      );
      const optionId = optRes.rows[0].id;

      if (result.assignments.length > 0) {
        const values: (number)[] = [];
        const placeholders: string[] = [];
        let idx = 1;
        for (const a of result.assignments) {
          placeholders.push(`($${idx++}, $${idx++}, $${idx++})`);
          values.push(optionId, a.turma_disciplina_id, a.time_slot_id);
        }
        await pool.query(
          `INSERT INTO schedule_option_item (option_id, turma_disciplina_id, time_slot_id) VALUES ${placeholders.join(', ')}`,
          values,
        );
      }
    }

    await pool.query(
      "UPDATE schedule_request SET status = 'completed' WHERE id = $1",
      [requestId],
    );
    console.log(`[Scheduler] Request ${requestId}: generated 3 options`);
  } catch (error) {
    console.error(`[Scheduler] Request ${requestId} failed:`, error);
    await pool.query(
      "UPDATE schedule_request SET status = 'failed' WHERE id = $1",
      [requestId],
    );
  }
}
