import { Pool } from 'pg';
import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// ===================== Types =====================

export interface TurmaDisciplina {
  id: number;
  turma_id: number;
  disciplina_id: number;
  professor_id: number;
  aulas_semana: number;
  tamanho_bloco: number;
  turno_id: number;
  /** Segmento ao qual a turma pertence: 'anos_finais' (só manhã) ou 'ensino_medio' (manhã + tarde de segunda). */
  segmento: string;
  /** IDs de turnos cujos time_slots esta turma pode usar. Para anos_finais = [turno_id]; para ensino_medio = [turno_id, ...turnos marcados como para_ensino_medio]. */
  allowed_turno_ids: number[];
  disciplina_peso: number;
  disciplina_sigla: string | null;
}

export interface TimeSlotInfo {
  id: number;
  dia_id: number;
  periodo_numero: number;
  turno_id: number;
}

export interface ProfDisp {
  professor_id: number;
  time_slot_id: number;
  disponivel: boolean;
  preferencia: number;
}

export interface Assignment {
  turma_disciplina_id: number;
  time_slot_id: number;
}

export interface ScheduleResult {
  strategy: string;
  assignments: Assignment[];
  score: number;
}

export interface ScheduleState {
  professorUsed: Map<number, Set<number>>;
  turmaUsed: Map<number, Set<number>>;
  // turma_id -> dia_id -> disciplina_id -> count of slots placed on that day
  disciplinaPerDay: Map<number, Map<number, Map<number, number>>>;
  // turma_id -> periodo_numero -> disciplina_id -> count of slots placed at that period
  disciplinaPerPeriod: Map<number, Map<number, Map<number, number>>>;
}

export interface BlockCandidate {
  slots: TimeSlotInfo[];
  avgPref: number;
  diaId: number;
  dayClusterCount: number; // slots of this discipline already on this day
  periodPenalty: number;   // sum of (existing count at each periodo)^2 for this discipline
}

// A discipline block placed on the grid: its slots are a contiguous run on one
// day. The annealing strategy moves these around while preserving contiguity.
export interface PlacedBlock {
  td: TurmaDisciplina;
  slots: TimeSlotInfo[];
}

// ===================== Tunable weights =====================
// All weights are named so they can be calibrated without touching logic.

// ---- Soft-constraint weights (moderator-tunable) ----
// Each weight scales one soft constraint. SC1/SC2 steer both candidate ranking
// and the final score; SC5/SC6/SC7 only subtract from the final score. A weight
// of 0 effectively disables that constraint. Defaults mirror the historical
// hard-coded values and are overridden per request from the soft_constraint
// table (see loadSoftWeights).
export interface SoftWeights {
  dayCluster: number;     // SC1 same-discipline same-day
  periodCluster: number;  // SC2 same-discipline consecutive periods
  window: number;         // SC5 professor internal idle window (per free aula slot)
  heavyLast: number;      // SC6 heavy discipline placed in the last period
  practicalFirst: number; // SC7 practical discipline placed in the first period
}

export const DEFAULT_WEIGHTS: SoftWeights = {
  dayCluster: 3,
  periodCluster: 3,
  window: 1,
  heavyLast: 1.5,
  practicalFirst: 1,
};

// Maps soft_constraint.codigo rows to the SoftWeights field they tune.
const CODE_TO_WEIGHT: Record<string, keyof SoftWeights> = {
  SC1: 'dayCluster',
  SC2: 'periodCluster',
  SC5: 'window',
  SC6: 'heavyLast',
  SC7: 'practicalFirst',
};

// ---- Final score: positive components (must sum to 1) ----
const W_PLACEMENT = 0.6;
const W_SPREAD = 0.25;
const W_PREFERENCE = 0.15;

const HEAVY_PESO_THRESHOLD = 3; // disciplina.peso >= this counts as cognitively heavy (SC6)
// SC7: practical disciplines identified by sigla prefix (EDF, Arte, Computacao, etc.).
const PRACTICAL_SIGLA_RE = /^(EDF|EF|ART|MUS|COMP|INFO|INF|TI)/i;

// ---- Perturbed greedy (Option A: used to seed the annealing strategy) ----
const RANDOM_TOP_K = 4;         // each step samples among the K best candidates
const RANDOM_TEMPERATURE = 0.5; // softmax temperature; higher => more exploration

// ---- Simulated annealing (Option B): refines the seeded solution ----
const SA_MAX_ITERATIONS = 4000;     // hard cap on proposed moves
const SA_INITIAL_TEMP = 8;          // ~score points; sets early acceptance of worse moves
const SA_COOLING = 0.999;           // geometric cooling applied each iteration
const SA_TIME_BUDGET_MS = 3000;     // wall-clock stop, whichever comes first
const SA_SWAP_PROBABILITY = 0.5;    // share of (non-insert) moves that are swaps vs. relocations
const SA_SWAP_ATTEMPTS = 8;         // random pairs tried before giving up on a swap move
const SA_INSERT_PROBABILITY = 0.6;  // chance of attempting an insertion while blocks remain unplaced

// ===================== Soft-constraint penalty scales =====================

// SC1: penalty units for n aulas of one discipline on the same day for a turma.
// <=2/day is ideal; the brief calls for 3 leve, 4 severo, 5+ critico.
function dayClusterUnits(n: number): number {
  if (n <= 2) return 0;
  if (n === 3) return 1;
  if (n === 4) return 5;
  return 20 + (n - 5) * 20; // 5+ critical, keeps growing
}

// SC2: penalty units for a run of `len` consecutive periods of one discipline.
// <=2 consecutive is fine; 3 leve, 4+ severo.
function consecutiveUnits(len: number): number {
  if (len <= 2) return 0;
  if (len === 3) return 1;
  return 5 + (len - 4) * 5; // 4+ severe
}

// ===================== Helpers =====================

export function newState(): ScheduleState {
  return {
    professorUsed: new Map(),
    turmaUsed: new Map(),
    disciplinaPerDay: new Map(),
    disciplinaPerPeriod: new Map(),
  };
}

// Deterministic, seedable PRNG (mulberry32). Lets the randomized strategy be
// reproducible per request and makes its behaviour testable.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Split aulas_semana into block sizes, preferring tamanho_bloco and putting the
// remainder in a smaller trailing block. E.g. (5, 2) -> [2, 2, 1].
export function planBlocks(aulasSemana: number, tamanhoBloco: number): number[] {
  const blocks: number[] = [];
  const full = Math.floor(aulasSemana / tamanhoBloco);
  const remainder = aulasSemana % tamanhoBloco;
  for (let i = 0; i < full; i++) blocks.push(tamanhoBloco);
  if (remainder > 0) blocks.push(remainder);
  return blocks;
}

function getDayClusterCount(
  state: ScheduleState,
  turmaId: number,
  diaId: number,
  disciplinaId: number,
): number {
  return state.disciplinaPerDay.get(turmaId)?.get(diaId)?.get(disciplinaId) ?? 0;
}

function getPeriodCount(
  state: ScheduleState,
  turmaId: number,
  periodoNumero: number,
  disciplinaId: number,
): number {
  return state.disciplinaPerPeriod.get(turmaId)?.get(periodoNumero)?.get(disciplinaId) ?? 0;
}

export function markSlots(
  state: ScheduleState,
  td: TurmaDisciplina,
  diaId: number,
  slots: TimeSlotInfo[],
): void {
  if (!state.professorUsed.has(td.professor_id)) state.professorUsed.set(td.professor_id, new Set());
  if (!state.turmaUsed.has(td.turma_id)) state.turmaUsed.set(td.turma_id, new Set());
  for (const s of slots) {
    state.professorUsed.get(td.professor_id)!.add(s.id);
    state.turmaUsed.get(td.turma_id)!.add(s.id);
  }

  if (!state.disciplinaPerDay.has(td.turma_id)) {
    state.disciplinaPerDay.set(td.turma_id, new Map());
  }
  const dayMap = state.disciplinaPerDay.get(td.turma_id)!;
  if (!dayMap.has(diaId)) dayMap.set(diaId, new Map());
  const discDayMap = dayMap.get(diaId)!;
  discDayMap.set(td.disciplina_id, (discDayMap.get(td.disciplina_id) ?? 0) + slots.length);

  if (!state.disciplinaPerPeriod.has(td.turma_id)) {
    state.disciplinaPerPeriod.set(td.turma_id, new Map());
  }
  const periodMap = state.disciplinaPerPeriod.get(td.turma_id)!;
  for (const s of slots) {
    if (!periodMap.has(s.periodo_numero)) periodMap.set(s.periodo_numero, new Map());
    const discPeriodMap = periodMap.get(s.periodo_numero)!;
    discPeriodMap.set(td.disciplina_id, (discPeriodMap.get(td.disciplina_id) ?? 0) + 1);
  }
}

// Inverse of markSlots — removes a block's occupancy from the state maps.
function unmarkSlots(
  state: ScheduleState,
  td: TurmaDisciplina,
  diaId: number,
  slots: TimeSlotInfo[],
): void {
  const profSet = state.professorUsed.get(td.professor_id);
  if (profSet) for (const s of slots) profSet.delete(s.id);
  const turmaSet = state.turmaUsed.get(td.turma_id);
  if (turmaSet) for (const s of slots) turmaSet.delete(s.id);
  const dayMap = state.disciplinaPerDay.get(td.turma_id);
  if (dayMap) {
    const m = dayMap.get(diaId);
    if (m) {
      const n = (m.get(td.disciplina_id) ?? 0) - slots.length;
      if (n <= 0) m.delete(td.disciplina_id); else m.set(td.disciplina_id, n);
    }
  }
  const periodMap = state.disciplinaPerPeriod.get(td.turma_id);
  if (periodMap) {
    for (const s of slots) {
      const m = periodMap.get(s.periodo_numero);
      if (m) {
        const n = (m.get(td.disciplina_id) ?? 0) - 1;
        if (n <= 0) m.delete(td.disciplina_id); else m.set(td.disciplina_id, n);
      }
    }
  }
}

export function buildProfDispMap(
  profDisps: ProfDisp[],
): Map<number, Map<number, ProfDisp>> {
  const map = new Map<number, Map<number, ProfDisp>>();
  for (const pd of profDisps) {
    if (!map.has(pd.professor_id)) map.set(pd.professor_id, new Map());
    map.get(pd.professor_id)!.set(pd.time_slot_id, pd);
  }
  return map;
}

export function getSlotsByTurnoAndDay(
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

/**
 * Returns candidate slots for a turma grouped by day, covering ALL allowed turnos.
 * Each turno's slots are kept separate (never merged in the same day entry) to
 * avoid periodo_numero collisions between manhã and tarde on the same day.
 * Returns an array of per-turno Maps; callers should flatMap over them.
 */
export function getSlotsByAllowedTurnos(
  slots: TimeSlotInfo[],
  allowedTurnoIds: number[],
): Map<number, TimeSlotInfo[]>[] {
  return allowedTurnoIds.map((tid) => getSlotsByTurnoAndDay(slots, tid));
}

// Returns true if adding a block of size `blockSize` starting at position
// `blockStart` in `daySlots` keeps the resource's occupied positions contiguous
// (no holes between previously used positions and the new block).
function isContiguous(
  used: Set<number> | undefined,
  daySlots: TimeSlotInfo[],
  blockStart: number,
  blockSize: number,
): boolean {
  if (!used || used.size === 0) return true;
  const positions: number[] = [];
  for (let p = 0; p < daySlots.length; p++) {
    if (used.has(daySlots[p].id)) positions.push(p);
  }
  if (positions.length === 0) return true;
  for (let j = 0; j < blockSize; j++) positions.push(blockStart + j);
  positions.sort((a, b) => a - b);
  for (let k = 1; k < positions.length; k++) {
    if (positions[k] !== positions[k - 1] + 1) return false;
  }
  return true;
}

export function findValidBlocks(
  td: TurmaDisciplina,
  blockSize: number,
  slotsByDay: Map<number, TimeSlotInfo[]>,
  profDispMap: Map<number, Map<number, ProfDisp>>,
  state: ScheduleState,
): BlockCandidate[] {
  const results: BlockCandidate[] = [];

  for (const [diaId, daySlots] of slotsByDay) {
    for (let i = 0; i <= daySlots.length - blockSize; i++) {
      let consecutive = true;
      for (let j = 1; j < blockSize; j++) {
        if (daySlots[i + j].periodo_numero !== daySlots[i].periodo_numero + j) {
          consecutive = false;
          break;
        }
      }
      if (!consecutive) continue;

      const blockSlots: TimeSlotInfo[] = [];
      let totalPref = 0;
      let periodPenalty = 0;
      let valid = true;

      for (let j = 0; j < blockSize; j++) {
        const slot = daySlots[i + j];
        const disp = profDispMap.get(td.professor_id)?.get(slot.id);
        if (!disp || !disp.disponivel) { valid = false; break; }
        if (state.professorUsed.get(td.professor_id)?.has(slot.id)) { valid = false; break; }
        if (state.turmaUsed.get(td.turma_id)?.has(slot.id)) { valid = false; break; }
        blockSlots.push(slot);
        totalPref += disp.preferencia;
        const prevCount = getPeriodCount(state, td.turma_id, slot.periodo_numero, td.disciplina_id);
        periodPenalty += prevCount * prevCount;
      }

      // No-gap constraints: positions in the day's aula sequence (existing + new)
      // must be contiguous. Position-based so recreios are not counted as gaps.
      // No-gap (turma/professor) is NOT enforced here for heuristic strategies.
      // Reason: with demand == capacity (25/25 EF, 30/30 EM) the no-gap invariant
      // is trivially satisfied once ALL slots are filled. Enforcing it during
      // intermediate construction states is over-constraining: it rejects valid
      // placements because earlier slots of the same day aren't yet occupied, even
      // though they will be by the time construction finishes.
      // HC-no-gap remains a hard constraint in the CP-SAT solver (cpsat_solver.py),
      // which can reason globally across all assignments at once.
      // SC5 (professor idle window) penalises gaps in the final score (softPenalty).
      if (valid) {
        results.push({
          slots: blockSlots,
          avgPref: totalPref / blockSize,
          diaId,
          dayClusterCount: getDayClusterCount(state, td.turma_id, diaId, td.disciplina_id),
          periodPenalty,
        });
      }
    }
  }

  return results;
}

// ===================== Spread metric =====================

// Spread quality per turma_disciplina: how many distinct days were used vs.
// how many were ideally needed. Returns a value in [0, 1].
function spreadForTd(
  td: TurmaDisciplina,
  plannedBlocks: number[],
  assignments: Assignment[],
  slotById: Map<number, TimeSlotInfo>,
): number {
  const myAssignments = assignments.filter((a) => a.turma_disciplina_id === td.id);
  if (myAssignments.length === 0) return 0;

  const daysUsed = new Set<number>();
  for (const a of myAssignments) {
    const slot = slotById.get(a.time_slot_id);
    if (slot) daysUsed.add(slot.dia_id);
  }
  const idealDays = Math.min(plannedBlocks.length, 5); // ~5 weekdays
  if (idealDays <= 1) return 1;
  return Math.min(1, daysUsed.size / idealDays);
}

function buildSlotIndex(slots: TimeSlotInfo[]): Map<number, TimeSlotInfo> {
  const map = new Map<number, TimeSlotInfo>();
  for (const s of slots) map.set(s.id, s);
  return map;
}

function avgPreference(
  assignments: Assignment[],
  tdsById: Map<number, TurmaDisciplina>,
  profDispMap: Map<number, Map<number, ProfDisp>>,
): number {
  if (assignments.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const a of assignments) {
    const td = tdsById.get(a.turma_disciplina_id);
    if (!td) continue;
    const disp = profDispMap.get(td.professor_id)?.get(a.time_slot_id);
    if (disp) {
      total += disp.preferencia;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

// ===================== Soft-constraint penalties (final score) =====================

// Per-turno layout of the aula sequence. position maps a periodo_numero to its
// 0-based index among that turno's aula periods, so contiguity ignores recreios
// (which carry a periodo.numero but have no time_slot). first/last are the
// clock-time edges of the day used by SC6/SC7.
interface TurnoLayout {
  positionOf: Map<number, number>;
  firstNumero: number;
  lastNumero: number;
}

function buildTurnoLayouts(slots: TimeSlotInfo[]): Map<number, TurnoLayout> {
  const numerosByTurno = new Map<number, Set<number>>();
  for (const s of slots) {
    if (!numerosByTurno.has(s.turno_id)) numerosByTurno.set(s.turno_id, new Set());
    numerosByTurno.get(s.turno_id)!.add(s.periodo_numero);
  }
  const layouts = new Map<number, TurnoLayout>();
  for (const [turnoId, set] of numerosByTurno) {
    const nums = [...set].sort((a, b) => a - b);
    const positionOf = new Map<number, number>();
    nums.forEach((n, i) => positionOf.set(n, i));
    layouts.set(turnoId, {
      positionOf,
      firstNumero: nums[0],
      lastNumero: nums[nums.length - 1],
    });
  }
  return layouts;
}

export function isPractical(td: TurmaDisciplina): boolean {
  return td.disciplina_sigla != null && PRACTICAL_SIGLA_RE.test(td.disciplina_sigla);
}

// Sum of soft-constraint penalty points (SC1, SC2, SC5, SC6, SC7) for a solution.
// Never blocks placement; only subtracts from the final score.
function softPenalty(
  tds: TurmaDisciplina[],
  assignments: Assignment[],
  slots: TimeSlotInfo[],
  weights: SoftWeights,
): number {
  const tdById = new Map<number, TurmaDisciplina>();
  for (const td of tds) tdById.set(td.id, td);
  const slotById = buildSlotIndex(slots);
  const layouts = buildTurnoLayouts(slots);

  const dayCount = new Map<string, number>();              // SC1: turma|dia|disc -> count
  const discDayPositions = new Map<string, number[]>();    // SC2: turma|disc|dia -> positions
  const profDayPositions = new Map<string, number[]>();    // SC5: prof|dia|turno -> positions
  let heavyLast = 0;                                       // SC6
  let practicalFirst = 0;                                  // SC7

  for (const a of assignments) {
    const td = tdById.get(a.turma_disciplina_id);
    const slot = slotById.get(a.time_slot_id);
    if (!td || !slot) continue;
    const layout = layouts.get(slot.turno_id);
    const pos = layout?.positionOf.get(slot.periodo_numero);

    const dayKey = `${td.turma_id}|${slot.dia_id}|${td.disciplina_id}`;
    dayCount.set(dayKey, (dayCount.get(dayKey) ?? 0) + 1);

    if (pos !== undefined) {
      const discKey = `${td.turma_id}|${td.disciplina_id}|${slot.dia_id}`;
      if (!discDayPositions.has(discKey)) discDayPositions.set(discKey, []);
      discDayPositions.get(discKey)!.push(pos);

      const profKey = `${td.professor_id}|${slot.dia_id}|${slot.turno_id}`;
      if (!profDayPositions.has(profKey)) profDayPositions.set(profKey, []);
      profDayPositions.get(profKey)!.push(pos);
    }

    if (layout) {
      if (td.disciplina_peso >= HEAVY_PESO_THRESHOLD && slot.periodo_numero === layout.lastNumero) {
        heavyLast++;
      }
      if (isPractical(td) && slot.periodo_numero === layout.firstNumero) {
        practicalFirst++;
      }
    }
  }

  let penalty = 0;

  // SC1: same-discipline daily clustering.
  for (const n of dayCount.values()) {
    penalty += weights.dayCluster * dayClusterUnits(n);
  }

  // SC2: consecutive same-discipline runs (by aula position, so recreios break runs).
  for (const positions of discDayPositions.values()) {
    positions.sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i <= positions.length; i++) {
      if (i < positions.length && positions[i] === positions[i - 1] + 1) {
        run++;
      } else {
        penalty += weights.periodCluster * consecutiveUnits(run);
        run = 1;
      }
    }
  }

  // SC5: professor internal idle windows (free aula slots between taught slots).
  for (const positions of profDayPositions.values()) {
    if (positions.length < 2) continue;
    positions.sort((a, b) => a - b);
    const span = positions[positions.length - 1] - positions[0] + 1;
    const windows = span - positions.length;
    penalty += weights.window * windows;
  }

  // SC6 / SC7.
  penalty += weights.heavyLast * heavyLast;
  penalty += weights.practicalFirst * practicalFirst;

  return penalty;
}

// Combine placement %, spread quality, and avg preference into a 0-100 base, then
// subtract soft-constraint penalties. Result is clamped to [0, 100].
// Assumes preferencia is in 1..5 (project mock data uses 1-5; we normalize).
export function composeScore(
  tds: TurmaDisciplina[],
  assignments: Assignment[],
  slots: TimeSlotInfo[],
  profDispMap: Map<number, Map<number, ProfDisp>>,
  weights: SoftWeights = DEFAULT_WEIGHTS,
): number {
  const totalNeeded = tds.reduce((s, t) => s + t.aulas_semana, 0);
  if (totalNeeded === 0) return 0;

  const placementRatio = assignments.length / totalNeeded;

  const tdsById = new Map<number, TurmaDisciplina>();
  for (const td of tds) tdsById.set(td.id, td);
  const slotById = buildSlotIndex(slots);

  let spreadSum = 0;
  let spreadCount = 0;
  for (const td of tds) {
    const planned = planBlocks(td.aulas_semana, td.tamanho_bloco);
    if (planned.length <= 1) continue; // single block has no spread to measure
    spreadSum += spreadForTd(td, planned, assignments, slotById);
    spreadCount++;
  }
  const spreadRatio = spreadCount > 0 ? spreadSum / spreadCount : 1;

  const prefAvg = avgPreference(assignments, tdsById, profDispMap);
  const prefRatio = Math.max(0, Math.min(1, (prefAvg - 1) / 4)); // 1..5 -> 0..1

  const base = (W_PLACEMENT * placementRatio + W_SPREAD * spreadRatio + W_PREFERENCE * prefRatio) * 100;
  const penalty = softPenalty(tds, assignments, slots, weights);
  return Math.max(0, Math.min(100, base - penalty));
}

// ===================== Data Loading =====================

async function loadData(pool: Pool) {
  const tdResult = await pool.query(`
    SELECT td.id, td.turma_id, td.disciplina_id, td.professor_id,
           td.aulas_semana, td.tamanho_bloco, t.turno_id, t.segmento,
           d.peso AS disciplina_peso, d.sigla AS disciplina_sigla
    FROM turma_disciplina td
    JOIN turma t ON td.turma_id = t.id
    JOIN disciplina d ON td.disciplina_id = d.id
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

  // Turnos marcados como extra para Ensino Médio (e.g. "Tarde" com para_ensino_medio = TRUE).
  const emTurnoResult = await pool.query(`
    SELECT id FROM turno WHERE para_ensino_medio = TRUE
  `);
  const emTurnoIds: number[] = emTurnoResult.rows.map((r: { id: number }) => r.id);

  // Enriquecer cada TurmaDisciplina com allowed_turno_ids.
  const turmaDisciplinas: TurmaDisciplina[] = tdResult.rows.map((row) => ({
    ...row,
    segmento: row.segmento ?? 'anos_finais',
    allowed_turno_ids:
      row.segmento === 'ensino_medio'
        ? [...new Set([row.turno_id, ...emTurnoIds])]
        : [row.turno_id],
  }));

  return {
    turmaDisciplinas,
    timeSlots: tsResult.rows as TimeSlotInfo[],
    profDisp: pdResult.rows as ProfDisp[],
  };
}

// Reads moderator-tuned soft-constraint weights from the soft_constraint table,
// merged over the defaults. Unknown codigos are ignored and missing ones keep
// their default. If the table is absent (older schema), defaults are used so the
// scheduler keeps working.
export async function loadSoftWeights(pool: Pool): Promise<SoftWeights> {
  const weights: SoftWeights = { ...DEFAULT_WEIGHTS };
  try {
    const res = await pool.query('SELECT codigo, peso FROM soft_constraint');
    for (const row of res.rows) {
      const key = CODE_TO_WEIGHT[row.codigo as string];
      const peso = Number(row.peso);
      if (key && Number.isFinite(peso) && peso >= 0) weights[key] = peso;
    }
  } catch (err) {
    console.warn('[Scheduler] soft_constraint weights unavailable, using defaults:', err);
  }
  return weights;
}

// ===================== Candidate scoring & selection =====================

interface ScoredCandidate {
  cand: BlockCandidate;
  score: number; // higher is better
}

// Greedy desirability of a candidate: high professor preference, low same-day /
// same-period clustering for this discipline. Soft only.
function greedyCandidateScore(c: BlockCandidate, weights: SoftWeights): number {
  return c.avgPref
    - weights.dayCluster * c.dayClusterCount * c.dayClusterCount
    - weights.periodCluster * c.periodPenalty;
}

type CandidatePicker = (scored: ScoredCandidate[], rng: () => number) => BlockCandidate;

// Deterministic: always take the best-ranked candidate.
const pickTop: CandidatePicker = (scored) => scored[0].cand;

// Perturbed: softmax-weighted sample among the top-K candidates (Option A). With
// a single candidate it degenerates to the deterministic choice.
const pickWeightedTopK: CandidatePicker = (scored, rng) => {
  const top = scored.slice(0, RANDOM_TOP_K);
  if (top.length === 1) return top[0].cand;
  const maxScore = Math.max(...top.map((s) => s.score));
  const weights = top.map((s) => Math.exp((s.score - maxScore) / RANDOM_TEMPERATURE));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i].cand;
  }
  return top[top.length - 1].cand;
};

export function blocksToAssignments(blocks: PlacedBlock[]): Assignment[] {
  const out: Assignment[] = [];
  for (const b of blocks) {
    for (const s of b.slots) {
      out.push({ turma_disciplina_id: b.td.id, time_slot_id: s.id });
    }
  }
  return out;
}

// Shared greedy construction. Orders disciplines most-constrained-first, then
// places each planned block by delegating the final choice to `pick`. Returns
// the placed blocks so callers can either flatten them to assignments or hand
// them to the annealing refiner.
function buildGreedy(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDispMap: Map<number, Map<number, ProfDisp>>,
  pick: CandidatePicker,
  rng: () => number,
  weights: SoftWeights,
): PlacedBlock[] {
  const state = newState();

  // Pre-compute total aulas per professor across all TDs so that TDs taught by
  // highly-loaded professors (where professor aulas ≈ total available slots) are
  // scheduled first. This prevents Luane-style infeasibility where a professor
  // with 30 aulas / 30 slots gets processed last and finds no free slots left.
  const profTotalAulas = new Map<number, number>();
  for (const td of tds) {
    profTotalAulas.set(td.professor_id, (profTotalAulas.get(td.professor_id) ?? 0) + td.aulas_semana);
  }

  const scored = tds.map((td) => {
    const candidates = td.allowed_turno_ids.flatMap((turnoId) =>
      findValidBlocks(td, td.tamanho_bloco, getSlotsByTurnoAndDay(slots, turnoId), profDispMap, state),
    );
    const blocksNeeded = planBlocks(td.aulas_semana, td.tamanho_bloco).length;
    const ratio = blocksNeeded > 0 ? candidates.length / blocksNeeded : Infinity;
    return { td, ratio, profLoad: profTotalAulas.get(td.professor_id) ?? 0 };
  });
  // Primary sort: most-constrained TD first (fewest candidates per block needed).
  // Secondary sort: higher professor total load goes first (critical for professors
  // with aulas == total slots, e.g. Luane at 30/30 who must claim every slot).
  scored.sort((a, b) => {
    if (a.ratio !== b.ratio) return a.ratio - b.ratio;
    return b.profLoad - a.profLoad;
  });

  const placed: PlacedBlock[] = [];

  for (const { td } of scored) {
    const plannedBlocks = planBlocks(td.aulas_semana, td.tamanho_bloco);

    for (const blockSize of plannedBlocks) {
      const candidates = td.allowed_turno_ids.flatMap((turnoId) =>
        findValidBlocks(td, blockSize, getSlotsByTurnoAndDay(slots, turnoId), profDispMap, state),
      );
      // continue (not break) so remaining blocks of this TD are retried later in
      // the repair pass, and to allow smaller trailing blocks to be placed even
      // when a larger block fails.
      if (candidates.length === 0) continue;
      const ranked: ScoredCandidate[] = candidates
        .map((cand) => ({ cand, score: greedyCandidateScore(cand, weights) }))
        .sort((a, b) => b.score - a.score);
      const chosen = pick(ranked, rng);
      markSlots(state, td, chosen.diaId, chosen.slots);
      placed.push({ td, slots: chosen.slots });
    }
  }

  // Repair pass: retry TDs that weren't fully placed.  After the primary greedy
  // sweep some blocks may have been skipped (no valid candidate at that moment
  // because another TD had claimed the slot first).  Now that the grid is more
  // populated a second pass often finds room because the professor-conflict picture
  // has stabilised and the contiguous-candidate windows are clearer.
  const placedCount = new Map<number, number>();
  for (const b of placed) placedCount.set(b.td.id, (placedCount.get(b.td.id) ?? 0) + 1);

  for (const { td } of scored) {
    const plannedBlocks = planBlocks(td.aulas_semana, td.tamanho_bloco);
    let alreadyPlaced = placedCount.get(td.id) ?? 0;
    if (alreadyPlaced >= plannedBlocks.length) continue;

    // Start from alreadyPlaced so we use the correct block size for each
    // remaining slot (not restart from block index 0 which could over-place).
    for (let k = alreadyPlaced; k < plannedBlocks.length; k++) {
      const blockSize = plannedBlocks[k];
      const candidates = td.allowed_turno_ids.flatMap((turnoId) =>
        findValidBlocks(td, blockSize, getSlotsByTurnoAndDay(slots, turnoId), profDispMap, state),
      );
      if (candidates.length === 0) continue;
      const ranked: ScoredCandidate[] = candidates
        .map((cand) => ({ cand, score: greedyCandidateScore(cand, weights) }))
        .sort((a, b) => b.score - a.score);
      const chosen = pick(ranked, rng);
      markSlots(state, td, chosen.diaId, chosen.slots);
      placed.push({ td, slots: chosen.slots });
      alreadyPlaced++;
    }
  }

  // Size-1 fallback: fill remaining aulas one slot at a time.
  // Handles tamanho_bloco > 1 when free slots are on different days.
  const slotCount = new Map<number, number>();
  for (const b of placed) slotCount.set(b.td.id, (slotCount.get(b.td.id) ?? 0) + b.slots.length);
  for (const { td } of scored) {
    let filled = slotCount.get(td.id) ?? 0;
    while (filled < td.aulas_semana) {
      const candidates = td.allowed_turno_ids.flatMap((turnoId) =>
        findValidBlocks(td, 1, getSlotsByTurnoAndDay(slots, turnoId), profDispMap, state),
      );
      if (candidates.length === 0) break;
      const ranked: ScoredCandidate[] = candidates
        .map((cand) => ({ cand, score: greedyCandidateScore(cand, weights) }))
        .sort((a, b) => b.score - a.score);
      const chosen = pick(ranked, rng);
      markSlots(state, td, chosen.diaId, chosen.slots);
      placed.push({ td, slots: chosen.slots });
      slotCount.set(td.id, filled + 1);
      filled++;
    }
  }

  return placed;
}

// ===================== Strategies =====================


// Strategy 2: balanced distribution.
// Primary: even daily load per turma. Secondary: avoid same-discipline same-day
// clusters. Tertiary: prefer higher professor preference slots.
export function strategyBalanced(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
  weights: SoftWeights = DEFAULT_WEIGHTS,
): ScheduleResult {
  const profDispMap = buildProfDispMap(profDisps);
  const state = newState();
  const dayLoad = new Map<number, Map<number, number>>();

  // PRIMARY: professor total load descending — highly-loaded professors (Alan 24+,
  // Rosana 14 across C61+C62) claim all their turma slots as a group before
  // less-loaded professors interfere. This prevents cross-turma slot deadlocks.
  // SECONDARY: individual aulas_semana descending (larger blocks first).
  // TERTIARY: turma_id ascending (stable ordering).
  const profTotalAulasB = new Map<number, number>();
  for (const td of tds) {
    profTotalAulasB.set(td.professor_id, (profTotalAulasB.get(td.professor_id) ?? 0) + td.aulas_semana);
  }
  const sorted = [...tds].sort((a, b) => {
    const loadA = profTotalAulasB.get(a.professor_id) ?? 0;
    const loadB = profTotalAulasB.get(b.professor_id) ?? 0;
    if (loadA !== loadB) return loadB - loadA;
    if (a.aulas_semana !== b.aulas_semana) return b.aulas_semana - a.aulas_semana;
    return a.turma_id - b.turma_id;
  });
  const allAssignments: Assignment[] = [];
  const balPlaced: PlacedBlock[] = [];
  const placeBlock = (td: TurmaDisciplina, blockSize: number): boolean => {
    if (!dayLoad.has(td.turma_id)) dayLoad.set(td.turma_id, new Map());
    const turmaLoad = dayLoad.get(td.turma_id)!;
    const candidates = td.allowed_turno_ids.flatMap((turnoId) =>
      findValidBlocks(td, blockSize, getSlotsByTurnoAndDay(slots, turnoId), profDispMap, state),
    );
    if (candidates.length === 0) return false;
    candidates.sort((a, b) => {
      const loadA = turmaLoad.get(a.diaId) || 0;
      const loadB = turmaLoad.get(b.diaId) || 0;
      if (loadA !== loadB) return loadA - loadB;
      const penA = weights.dayCluster * a.dayClusterCount * a.dayClusterCount
        + weights.periodCluster * a.periodPenalty;
      const penB = weights.dayCluster * b.dayClusterCount * b.dayClusterCount
        + weights.periodCluster * b.periodPenalty;
      if (penA !== penB) return penA - penB;
      return b.avgPref - a.avgPref;
    });
    const chosen = candidates[0];
    markSlots(state, td, chosen.diaId, chosen.slots);
    turmaLoad.set(chosen.diaId, (turmaLoad.get(chosen.diaId) || 0) + blockSize);
    for (const s of chosen.slots) {
      allAssignments.push({ turma_disciplina_id: td.id, time_slot_id: s.id });
    }
    balPlaced.push({ td, slots: chosen.slots }); // tracked for displacement repair
    return true;
  };


  const balPlacedCount = new Map<number, number>();
  for (const td of sorted) {
    const plannedBlocks = planBlocks(td.aulas_semana, td.tamanho_bloco);
    let placed = 0;
    for (const blockSize of plannedBlocks) {
      if (placeBlock(td, blockSize)) {
        placed++;
        balPlacedCount.set(td.id, placed);
      }
      // continue (not break) — try remaining blocks even if one fails
    }
  }

  // Repair pass 1: retry TDs not fully placed (original block sizes).
  for (const td of sorted) {
    const plannedBlocks = planBlocks(td.aulas_semana, td.tamanho_bloco);
    let placed = balPlacedCount.get(td.id) ?? 0;
    if (placed >= plannedBlocks.length) continue;
    for (let k = 0; k < plannedBlocks.length - placed; k++) {
      const blockSize = plannedBlocks[placed + k] ?? plannedBlocks[plannedBlocks.length - 1];
      if (placeBlock(td, blockSize)) placed++;
    }
  }

  // Repair pass 2: fill remaining aulas with block size 1 (handles tamanho_bloco > 1
  // when free slots are on different days / non-consecutive positions).
  const aCount = new Map<number, number>();
  for (const a of allAssignments) aCount.set(a.turma_disciplina_id, (aCount.get(a.turma_disciplina_id) ?? 0) + 1);
  for (const td of sorted) {
    let filled = aCount.get(td.id) ?? 0;
    while (filled < td.aulas_semana) {
      if (placeBlock(td, 1)) { filled++; aCount.set(td.id, filled); }
      else break;
    }
  }

  // Same-turma displacement repair: for any still-missing aula, relocate a
  // same-turma placed block so the missing professor gains a free slot.
  for (const missingTd of sorted) {
    let filled = aCount.get(missingTd.id) ?? 0;
    if (filled >= missingTd.aulas_semana) continue;
    outerSame: for (let pi = balPlaced.length - 1; pi >= 0 && filled < missingTd.aulas_semana; pi--) {
      const pb = balPlaced[pi];
      if (pb.td.turma_id !== missingTd.turma_id || pb.td.id === missingTd.id) continue;
      const pbDiaId = pb.slots[0].dia_id;
      const hasSlot = pb.slots.some((s) => {
        const d = profDispMap.get(missingTd.professor_id)?.get(s.id);
        return d?.disponivel && !(state.professorUsed.get(missingTd.professor_id)?.has(s.id));
      });
      if (!hasSlot) continue;
      unmarkSlots(state, pb.td, pbDiaId, pb.slots);
      const altsSame = pb.td.allowed_turno_ids
        .flatMap((tid2) =>
          findValidBlocks(pb.td, pb.slots.length, getSlotsByTurnoAndDay(slots, tid2), profDispMap, state),
        )
        .filter((alt) => !alt.slots.some((s) => pb.slots.some((ps) => ps.id === s.id)));
      if (altsSame.length === 0) { markSlots(state, pb.td, pbDiaId, pb.slots); continue; }
      const tlSame = dayLoad.get(pb.td.turma_id) ?? new Map<number, number>();
      altsSame.sort((a, b) => (tlSame.get(a.diaId) ?? 0) - (tlSame.get(b.diaId) ?? 0));
      const bestSame = altsSame[0];
      markSlots(state, pb.td, bestSame.diaId, bestSame.slots);
      for (const s of pb.slots) {
        const idx = allAssignments.findIndex(
          (a) => a.turma_disciplina_id === pb.td.id && a.time_slot_id === s.id,
        );
        if (idx >= 0) allAssignments.splice(idx, 1);
      }
      for (const s of bestSame.slots) {
        allAssignments.push({ turma_disciplina_id: pb.td.id, time_slot_id: s.id });
      }
      tlSame.set(pbDiaId, Math.max(0, (tlSame.get(pbDiaId) ?? 0) - pb.slots.length));
      tlSame.set(bestSame.diaId, (tlSame.get(bestSame.diaId) ?? 0) + bestSame.slots.length);
      balPlaced[pi] = { td: pb.td, slots: bestSame.slots };
      const befSame = filled;
      while (filled < missingTd.aulas_semana) {
        if (placeBlock(missingTd, 1)) { filled++; aCount.set(missingTd.id, filled); }
        else break;
      }
      if (filled > befSame) continue outerSame;
      // Undo.
      unmarkSlots(state, pb.td, bestSame.diaId, bestSame.slots);
      for (const s of bestSame.slots) {
        const idx = allAssignments.findIndex(
          (a) => a.turma_disciplina_id === pb.td.id && a.time_slot_id === s.id,
        );
        if (idx >= 0) allAssignments.splice(idx, 1);
      }
      markSlots(state, pb.td, pbDiaId, pb.slots);
      for (const s of pb.slots) {
        allAssignments.push({ turma_disciplina_id: pb.td.id, time_slot_id: s.id });
      }
      tlSame.set(bestSame.diaId, Math.max(0, (tlSame.get(bestSame.diaId) ?? 0) - bestSame.slots.length));
      tlSame.set(pbDiaId, (tlSame.get(pbDiaId) ?? 0) + pb.slots.length);
      balPlaced[pi] = pb;
    }
  }

  // Cross-turma displacement repair: for each free turma slot where the missing
  // professor is blocked by a DIFFERENT turma's block, try to relocate that block.
  // Handles deadlocks like: C61's only free slot has Rosana teaching C62 there.
  for (const missingTd of sorted) {
    let filled = aCount.get(missingTd.id) ?? 0;
    if (filled >= missingTd.aulas_semana) continue;
    const turmaUsed = state.turmaUsed.get(missingTd.turma_id) ?? new Set<number>();
    const freeSlots = slots.filter(
      (s) => missingTd.allowed_turno_ids.includes(s.turno_id) && !turmaUsed.has(s.id),
    );
    for (const freeSlot of freeSlots) {
      if (filled >= missingTd.aulas_semana) break;
      const disp = profDispMap.get(missingTd.professor_id)?.get(freeSlot.id);
      if (!disp?.disponivel) continue;
      if (!(state.professorUsed.get(missingTd.professor_id)?.has(freeSlot.id))) {
        // Professor already free here — place directly (safety net).
        if (placeBlock(missingTd, 1)) { filled++; aCount.set(missingTd.id, filled); }
        continue;
      }
      // Find the other-turma block that is blocking the professor at freeSlot.
      const blockingIdx = balPlaced.findIndex(
        (pb) =>
          pb.td.professor_id === missingTd.professor_id &&
          pb.td.turma_id !== missingTd.turma_id &&
          pb.slots.some((s) => s.id === freeSlot.id),
      );
      if (blockingIdx < 0) continue;
      const pb = balPlaced[blockingIdx];
      const pbDiaId = pb.slots[0].dia_id;
      unmarkSlots(state, pb.td, pbDiaId, pb.slots);
      const altsCross = pb.td.allowed_turno_ids
        .flatMap((tid2) =>
          findValidBlocks(pb.td, pb.slots.length, getSlotsByTurnoAndDay(slots, tid2), profDispMap, state),
        )
        .filter((alt) => !alt.slots.some((s) => pb.slots.some((ps) => ps.id === s.id)));
      if (altsCross.length === 0) { markSlots(state, pb.td, pbDiaId, pb.slots); continue; }
      const tlCross = dayLoad.get(pb.td.turma_id) ?? new Map<number, number>();
      altsCross.sort((a, b) => (tlCross.get(a.diaId) ?? 0) - (tlCross.get(b.diaId) ?? 0));
      const bestCross = altsCross[0];
      markSlots(state, pb.td, bestCross.diaId, bestCross.slots);
      for (const s of pb.slots) {
        const idx = allAssignments.findIndex(
          (a) => a.turma_disciplina_id === pb.td.id && a.time_slot_id === s.id,
        );
        if (idx >= 0) allAssignments.splice(idx, 1);
      }
      for (const s of bestCross.slots) {
        allAssignments.push({ turma_disciplina_id: pb.td.id, time_slot_id: s.id });
      }
      tlCross.set(pbDiaId, Math.max(0, (tlCross.get(pbDiaId) ?? 0) - pb.slots.length));
      tlCross.set(bestCross.diaId, (tlCross.get(bestCross.diaId) ?? 0) + bestCross.slots.length);
      balPlaced[blockingIdx] = { td: pb.td, slots: bestCross.slots };
      const befCross = filled;
      while (filled < missingTd.aulas_semana) {
        if (placeBlock(missingTd, 1)) { filled++; aCount.set(missingTd.id, filled); }
        else break;
      }
      if (filled > befCross) continue;
      // Undo relocation.
      unmarkSlots(state, pb.td, bestCross.diaId, bestCross.slots);
      for (const s of bestCross.slots) {
        const idx = allAssignments.findIndex(
          (a) => a.turma_disciplina_id === pb.td.id && a.time_slot_id === s.id,
        );
        if (idx >= 0) allAssignments.splice(idx, 1);
      }
      markSlots(state, pb.td, pbDiaId, pb.slots);
      for (const s of pb.slots) {
        allAssignments.push({ turma_disciplina_id: pb.td.id, time_slot_id: s.id });
      }
      tlCross.set(bestCross.diaId, Math.max(0, (tlCross.get(bestCross.diaId) ?? 0) - bestCross.slots.length));
      tlCross.set(pbDiaId, (tlCross.get(pbDiaId) ?? 0) + pb.slots.length);
      balPlaced[blockingIdx] = pb;
    }
  }

  return {
    strategy: 'balanced_distribution',
    assignments: allAssignments,
    score: composeScore(tds, allAssignments, slots, profDispMap, weights),
  };
}


// ===================== Simulated annealing (Option B) =====================

// A planned block that the greedy seed could not fit; the insert move tries to
// place it, which is how annealing improves placement toward HC4.
interface PendingBlock {
  td: TurmaDisciplina;
  size: number;
}

// Moves that change placed blocks without ever breaking a hard constraint:
//  - 'swap'     : two same-size blocks of the same turma exchange their slots.
//  - 'relocate' : one block moves to a free contiguous run in the same turma/turno.
//  - 'insert'   : a pending (unplaced) block is placed on a free contiguous run.
// All keep each block contiguous (HC5), keep the turma's occupied set conflict
// free (HC2), and stay within the turma's turno (HC6). The validators below also
// enforce professor availability (HC3) and no professor double-booking (HC1).
type SaMove =
  | { kind: 'swap'; i: number; j: number; slotsI: TimeSlotInfo[]; slotsJ: TimeSlotInfo[] }
  | { kind: 'relocate'; i: number; from: TimeSlotInfo[]; to: TimeSlotInfo[] }
  | { kind: 'insert'; pending: PendingBlock; to: TimeSlotInfo[]; inserted?: PlacedBlock };

// Strategy 3: simulated annealing.
// Seeds from a perturbed greedy build (Option A) so it differs from strategy 1,
// then refines it with Metropolis-accepted local moves. The best solution ever
// seen is returned, so its score is always >= the seeded starting score.
export function strategyAnnealing(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
  seed = Date.now(),
  weights: SoftWeights = DEFAULT_WEIGHTS,
): ScheduleResult {
  const profDispMap = buildProfDispMap(profDisps);
  const rng = mulberry32(seed);

  const blocks = buildGreedy(tds, slots, profDispMap, pickWeightedTopK, rng, weights);

  // Occupancy maps kept in sync with `blocks` as moves are applied/undone.
  const turmaSlots = new Map<number, Set<number>>();
  const profSlots = new Map<number, Set<number>>();
  const addSlots = (m: Map<number, Set<number>>, key: number, s: TimeSlotInfo[]) => {
    if (!m.has(key)) m.set(key, new Set());
    for (const slot of s) m.get(key)!.add(slot.id);
  };
  const removeSlots = (m: Map<number, Set<number>>, key: number, s: TimeSlotInfo[]) => {
    const set = m.get(key);
    if (set) for (const slot of s) set.delete(slot.id);
  };
  for (const b of blocks) {
    addSlots(turmaSlots, b.td.turma_id, b.slots);
    addSlots(profSlots, b.td.professor_id, b.slots);
  }

  // Planned blocks the greedy seed could not place. The greedy fills plannedBlocks
  // in order and stops at the first failure, so the unplaced ones are the suffix.
  const pending: PendingBlock[] = [];
  const placedCount = new Map<number, number>();
  for (const b of blocks) placedCount.set(b.td.id, (placedCount.get(b.td.id) ?? 0) + 1);
  for (const td of tds) {
    const planned = planBlocks(td.aulas_semana, td.tamanho_bloco);
    for (let k = placedCount.get(td.id) ?? 0; k < planned.length; k++) {
      pending.push({ td, size: planned[k] });
    }
  }
  const EMPTY_IGNORE: Set<number> = new Set();

  // Per-turno day layouts (sorted aula slots) used to find relocation targets.
  // Built for ALL distinct turno_ids present in the loaded slots so that
  // ensino_medio turmas (which span manhã + tarde) get layouts for both turnos.
  const turnoLayouts = new Map<number, Map<number, TimeSlotInfo[]>>();
  for (const turnoId of new Set(slots.map((s) => s.turno_id))) {
    turnoLayouts.set(turnoId, getSlotsByTurnoAndDay(slots, turnoId));
  }

  const profAvailable = (prof: number, slotId: number): boolean =>
    profDispMap.get(prof)?.get(slotId)?.disponivel === true;
  const profBusy = (prof: number, slotId: number, ignore: Set<number>): boolean =>
    !ignore.has(slotId) && (profSlots.get(prof)?.has(slotId) ?? false);
  const turmaBusy = (turma: number, slotId: number, ignore: Set<number>): boolean =>
    !ignore.has(slotId) && (turmaSlots.get(turma)?.has(slotId) ?? false);

  const validSwap = (b1: PlacedBlock, b2: PlacedBlock): boolean => {
    const ignore = new Set([...b1.slots, ...b2.slots].map((s) => s.id));
    for (const s of b2.slots) {
      if (!profAvailable(b1.td.professor_id, s.id) || profBusy(b1.td.professor_id, s.id, ignore)) return false;
    }
    for (const s of b1.slots) {
      if (!profAvailable(b2.td.professor_id, s.id) || profBusy(b2.td.professor_id, s.id, ignore)) return false;
    }
    return true;
  };

  // Free contiguous runs of `len` aula slots for a turma+professor across all its
  // allowed turnos, ignoring slots in `ignore` (e.g. the slots a block currently
  // occupies). Each turno is searched separately so manhã and tarde periods are
  // never merged — this prevents contiguity false-positives across the lunch gap.
  const findFreeRuns = (
    turnoIds: number[], turmaId: number, profId: number, len: number, ignore: Set<number>,
  ): TimeSlotInfo[][] => {
    const runs: TimeSlotInfo[][] = [];
    for (const turnoId of turnoIds) {
      const layout = turnoLayouts.get(turnoId);
      if (!layout) continue;
      for (const daySlots of layout.values()) {
        for (let i = 0; i + len <= daySlots.length; i++) {
          let contiguous = true;
          for (let j = 1; j < len; j++) {
            if (daySlots[i + j].periodo_numero !== daySlots[i].periodo_numero + j) { contiguous = false; break; }
          }
          if (!contiguous) continue;
          const run = daySlots.slice(i, i + len);
          let ok = true;
          for (const s of run) {
            if (turmaBusy(turmaId, s.id, ignore)
              || !profAvailable(profId, s.id)
              || profBusy(profId, s.id, ignore)) { ok = false; break; }
          }
          if (ok) runs.push(run);
        }
      }
    }
    return runs;
  };

  // Relocation targets for an already-placed block (excludes its current spot).
  const relocationTargets = (block: PlacedBlock): TimeSlotInfo[][] => {
    const ignore = new Set(block.slots.map((s) => s.id));
    return findFreeRuns(block.td.allowed_turno_ids, block.td.turma_id, block.td.professor_id, block.slots.length, ignore)
      .filter((run) => !run.every((s, k) => s.id === block.slots[k]?.id));
  };

  const applyMove = (move: SaMove): void => {
    if (move.kind === 'swap') {
      const px = blocks[move.i].td.professor_id;
      const py = blocks[move.j].td.professor_id;
      removeSlots(profSlots, px, move.slotsI);
      removeSlots(profSlots, py, move.slotsJ);
      addSlots(profSlots, px, move.slotsJ);
      addSlots(profSlots, py, move.slotsI);
      blocks[move.i].slots = move.slotsJ;
      blocks[move.j].slots = move.slotsI;
    } else if (move.kind === 'relocate') {
      const { td } = blocks[move.i];
      removeSlots(profSlots, td.professor_id, move.from);
      removeSlots(turmaSlots, td.turma_id, move.from);
      addSlots(profSlots, td.professor_id, move.to);
      addSlots(turmaSlots, td.turma_id, move.to);
      blocks[move.i].slots = move.to;
    } else {
      const { td } = move.pending;
      addSlots(profSlots, td.professor_id, move.to);
      addSlots(turmaSlots, td.turma_id, move.to);
      const block: PlacedBlock = { td, slots: move.to };
      move.inserted = block;
      blocks.push(block);
      const pIdx = pending.indexOf(move.pending);
      if (pIdx !== -1) pending.splice(pIdx, 1);
    }
  };

  const undoMove = (move: SaMove): void => {
    if (move.kind === 'swap') {
      applyMove({ kind: 'swap', i: move.i, j: move.j, slotsI: move.slotsJ, slotsJ: move.slotsI });
    } else if (move.kind === 'relocate') {
      applyMove({ kind: 'relocate', i: move.i, from: move.to, to: move.from });
    } else {
      const { td } = move.pending;
      removeSlots(profSlots, td.professor_id, move.to);
      removeSlots(turmaSlots, td.turma_id, move.to);
      const bIdx = blocks.indexOf(move.inserted!);
      if (bIdx !== -1) blocks.splice(bIdx, 1);
      pending.push(move.pending);
    }
  };

  const score = (): number => composeScore(tds, blocksToAssignments(blocks), slots, profDispMap, weights);

  let currentScore = score();
  let best = blocks.map((b) => ({ td: b.td, slots: [...b.slots] }));
  let bestScore = currentScore;

  const deadline = Date.now() + SA_TIME_BUDGET_MS;
  let temperature = SA_INITIAL_TEMP;

  for (let iter = 0; iter < SA_MAX_ITERATIONS; iter++) {
    if (Date.now() > deadline) break;
    if (blocks.length === 0 && pending.length === 0) break;

    let move: SaMove | null = null;

    // Prefer placing a pending block while any remain (drives placement up).
    if (pending.length > 0 && rng() < SA_INSERT_PROBABILITY) {
      const p = pending[Math.floor(rng() * pending.length)];
      const targets = findFreeRuns(p.td.allowed_turno_ids, p.td.turma_id, p.td.professor_id, p.size, EMPTY_IGNORE);
      if (targets.length > 0) {
        move = { kind: 'insert', pending: p, to: targets[Math.floor(rng() * targets.length)] };
      }
    }

    if (move === null && blocks.length > 0) {
      if (rng() < SA_SWAP_PROBABILITY) {
        for (let attempt = 0; attempt < SA_SWAP_ATTEMPTS && move === null; attempt++) {
          const i = Math.floor(rng() * blocks.length);
          const j = Math.floor(rng() * blocks.length);
          if (i === j) continue;
          const b1 = blocks[i];
          const b2 = blocks[j];
          if (b1.td.turma_id !== b2.td.turma_id) continue;
          if (b1.slots.length !== b2.slots.length) continue;
          if (validSwap(b1, b2)) {
            move = { kind: 'swap', i, j, slotsI: b1.slots, slotsJ: b2.slots };
          }
        }
      } else {
        const i = Math.floor(rng() * blocks.length);
        const targets = relocationTargets(blocks[i]);
        if (targets.length > 0) {
          move = { kind: 'relocate', i, from: blocks[i].slots, to: targets[Math.floor(rng() * targets.length)] };
        }
      }
    }

    if (move === null) {
      temperature *= SA_COOLING;
      continue;
    }

    applyMove(move);
    const newScore = score();
    const delta = newScore - currentScore;
    if (delta >= 0 || rng() < Math.exp(delta / temperature)) {
      currentScore = newScore;
      if (newScore > bestScore) {
        bestScore = newScore;
        best = blocks.map((b) => ({ td: b.td, slots: [...b.slots] }));
      }
    } else {
      undoMove(move);
    }
    temperature *= SA_COOLING;
  }

  return {
    strategy: 'simulated_annealing',
    assignments: blocksToAssignments(best),
    score: bestScore,
  };
}

// ===================== OR-Tools (CP-SAT) =====================

// Wall-clock budget handed to the Python solver, plus headroom for the spawn so
// execFile doesn't kill it mid-solve. The model carries several soft objectives
// (SC1/SC5/SC6/SC7 + weekly fill-order); CP-SAT rarely proves optimality but the
// solution quality (esp. the weekly load taper) keeps improving with time, so the
// async worker spends ~30s per request to get a clean front-loaded schedule.
const ORTOOLS_TIME_BUDGET_MS = 30000;
const ORTOOLS_SPAWN_TIMEOUT_MS = ORTOOLS_TIME_BUDGET_MS + 15000;

const SOLVER_SCRIPT = path.join(__dirname, '..', 'solver', 'cpsat_solver.py');

// Picks the Python that has ortools installed. Explicit PYTHON_BIN wins; else the
// project venv (created for local dev, see README) is preferred so the sidecar
// works without extra setup; else the system python3 (in the Docker image the
// venv is on PATH, so this resolves to it).
function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvPython = path.join(__dirname, '..', '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python3';
}
const PYTHON_BIN = resolvePythonBin();

interface SolverOutput {
  assignments: Assignment[];
  status: string;
}

// Runs the CP-SAT sidecar, piping the problem as JSON to stdin and parsing the
// assignments from stdout. Rejects if Python or ortools is unavailable, the
// process errors, or the output can't be parsed — callers treat that as "skip
// this strategy" rather than failing the whole request.
function runCpSatSolver(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
  weights: SoftWeights,
): Promise<SolverOutput> {
  const input = JSON.stringify({
    tds,
    slots,
    profDisp: profDisps,
    weights,
    timeBudgetMs: ORTOOLS_TIME_BUDGET_MS,
  });

  return new Promise((resolve, reject) => {
    const child = execFile(
      PYTHON_BIN,
      [SOLVER_SCRIPT],
      { timeout: ORTOOLS_SPAWN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`CP-SAT solver failed: ${err.message}${stderr ? ` | ${stderr}` : ''}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as SolverOutput);
        } catch (parseErr) {
          reject(new Error(`CP-SAT solver returned invalid JSON: ${(parseErr as Error).message}`));
        }
      },
    );
    child.stdin?.end(input);
  });
}

// Strategy 4: constraint programming via Google OR-Tools CP-SAT.
// Delegates placement to the Python sidecar, then scores the returned
// assignments with the same composeScore as the heuristic strategies so all
// options are directly comparable.
export async function strategyOrTools(
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  profDisps: ProfDisp[],
  weights: SoftWeights = DEFAULT_WEIGHTS,
): Promise<ScheduleResult> {
  const profDispMap = buildProfDispMap(profDisps);
  const { assignments, status } = await runCpSatSolver(tds, slots, profDisps, weights);
  // With HC4 relaxed (at-most-once), the solver may return a partial schedule.
  // A completely empty result (solver couldn't place a single block) is still an
  // unrecoverable failure and should surface as such.
  if (assignments.length === 0) {
    throw new Error(`CP-SAT found no feasible schedule (status: ${status})`);
  }
  const totalAulas = tds.reduce((s, td) => s + td.aulas_semana, 0);
  const placedAulas = assignments.length;
  if (placedAulas < totalAulas) {
    console.log(
      `[Scheduler] OR-Tools placed ${placedAulas}/${totalAulas} aulas (status: ${status})`,
    );
  }
  return {
    strategy: 'or_tools_cpsat',
    assignments,
    score: composeScore(tds, assignments, slots, profDispMap, weights),
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

    const weights = await loadSoftWeights(pool);

    // Gera três opções em paralelo: CP-SAT (exato) + duas heurísticas rápidas.
    // Cada estratégia produz uma schedule_option independente que o usuário pode
    // comparar e escolher. Se uma falhar (e.g. CP-SAT sem sidecar Python), as
    // outras ainda são salvas. O request só vai para 'failed' se TODAS falharem.
    const settled = await Promise.allSettled([
      strategyOrTools(turmaDisciplinas, timeSlots, profDisp, weights),
      Promise.resolve(strategyBalanced(turmaDisciplinas, timeSlots, profDisp, weights)),
    ]);

    const results: ScheduleResult[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        console.error(`[Scheduler] Estratégia falhou (request ${requestId}):`, (s.reason as Error).message);
      }
    }

    if (results.length === 0) {
      throw new Error('Todas as estratégias falharam — nenhuma grade gerada.');
    }

    for (const result of results) {
      const optRes = await pool.query(
        'INSERT INTO schedule_option (request_id, strategy, score) VALUES ($1, $2, $3) RETURNING id',
        [requestId, result.strategy, result.score],
      );
      const optionId = optRes.rows[0].id;

      const assignments = result.assignments;
      if (assignments.length > 0) {
        const placeholders = assignments.map(
          (_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`,
        );
        const values: (number | string)[] = [optionId];
        for (const a of assignments) {
          values.push(a.turma_disciplina_id, a.time_slot_id);
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
    console.log(`[Scheduler] Request ${requestId}: generated ${results.length} options`);
  } catch (err) {
    console.error(`[Scheduler] Request ${requestId} failed:`, err);
    await pool.query(
      "UPDATE schedule_request SET status = 'failed' WHERE id = $1",
      [requestId],
    );
  }
}
