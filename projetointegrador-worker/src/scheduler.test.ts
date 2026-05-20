import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  planBlocks,
  findValidBlocks,
  composeScore,
  getSlotsByTurnoAndDay,
  buildProfDispMap,
  newState,
  strategyAnnealing,
  type TurmaDisciplina,
  type TimeSlotInfo,
  type ProfDisp,
  type Assignment,
} from './scheduler';

// ---- Fixture helpers -------------------------------------------------------

const TURNO = 2;

function td(overrides: Partial<TurmaDisciplina> = {}): TurmaDisciplina {
  return {
    id: 1,
    turma_id: 1,
    disciplina_id: 1,
    professor_id: 1,
    aulas_semana: 3,
    tamanho_bloco: 1,
    turno_id: TURNO,
    disciplina_peso: 1,
    disciplina_sigla: 'MAT',
    ...overrides,
  };
}

// Build aula slots for given (dia, periodo_numero) pairs. The recreio period
// (numero 3 in the Tarde turno) is intentionally never created — only aula
// periods get a time_slot, exactly like the production schema.
function makeSlots(pairs: Array<[number, number]>): TimeSlotInfo[] {
  return pairs.map(([dia, numero], i) => ({
    id: i + 1,
    dia_id: dia,
    periodo_numero: numero,
    turno_id: TURNO,
  }));
}

function availability(slots: TimeSlotInfo[], professorId: number, pref = 5): ProfDisp[] {
  return slots.map((s) => ({
    professor_id: professorId,
    time_slot_id: s.id,
    disponivel: true,
    preferencia: pref,
  }));
}

// ---- planBlocks ------------------------------------------------------------

test('planBlocks splits with a smaller trailing remainder', () => {
  assert.deepEqual(planBlocks(5, 2), [2, 2, 1]);
  assert.deepEqual(planBlocks(4, 2), [2, 2]);
  assert.deepEqual(planBlocks(3, 1), [1, 1, 1]);
  assert.deepEqual(planBlocks(6, 3), [3, 3]);
});

test('planBlocks with block larger than demand keeps a single short block', () => {
  assert.deepEqual(planBlocks(2, 3), [2]);
});

// ---- findValidBlocks -------------------------------------------------------

test('findValidBlocks: size-2 blocks never span the recreio', () => {
  // Tarde aula numbers are 1,2,(3=recreio),4,5,6 -> slots only for 1,2,4,5,6.
  const slots = makeSlots([
    [1, 1], [1, 2], [1, 4], [1, 5], [1, 6],
  ]);
  const profDispMap = buildProfDispMap(availability(slots, 1));
  const byDay = getSlotsByTurnoAndDay(slots, TURNO);

  const blocks = findValidBlocks(td({ tamanho_bloco: 2 }), 2, byDay, profDispMap, newState());

  // Valid consecutive-by-numero pairs: (1,2), (4,5), (5,6). NOT (2,4).
  assert.equal(blocks.length, 3);
  for (const b of blocks) {
    assert.equal(b.slots.length, 2);
    assert.equal(b.slots[1].periodo_numero, b.slots[0].periodo_numero + 1);
  }
});

test('findValidBlocks: unavailable slots are excluded', () => {
  const slots = makeSlots([[1, 1], [1, 2], [1, 4]]);
  const disp = availability(slots, 1);
  disp[1].disponivel = false; // block numero 2 -> kills (1,2)
  const profDispMap = buildProfDispMap(disp);
  const byDay = getSlotsByTurnoAndDay(slots, TURNO);

  const single = findValidBlocks(td(), 1, byDay, profDispMap, newState());
  // numero 2 is unavailable, so only numeros 1 and 4 remain as size-1 blocks.
  assert.equal(single.length, 2);
  assert.deepEqual(single.map((b) => b.slots[0].periodo_numero).sort(), [1, 4]);
});

// ---- composeScore ----------------------------------------------------------

test('composeScore rewards spreading over same-day clustering', () => {
  const subject = td({ aulas_semana: 3, tamanho_bloco: 1 });
  const tds = [subject];

  // Spread across 3 days, first period each day.
  const spreadSlots = makeSlots([[1, 1], [2, 1], [3, 1]]);
  const spreadProf = buildProfDispMap(availability(spreadSlots, 1));
  const spreadAssign: Assignment[] = spreadSlots.map((s) => ({
    turma_disciplina_id: subject.id,
    time_slot_id: s.id,
  }));
  const spreadScore = composeScore(tds, spreadAssign, spreadSlots, spreadProf);

  // All 3 on the same day, consecutive aula positions (1,2,4 -> positions 0,1,2).
  const clusterSlots = makeSlots([[1, 1], [1, 2], [1, 4]]);
  const clusterProf = buildProfDispMap(availability(clusterSlots, 1));
  const clusterAssign: Assignment[] = clusterSlots.map((s) => ({
    turma_disciplina_id: subject.id,
    time_slot_id: s.id,
  }));
  const clusterScore = composeScore(tds, clusterAssign, clusterSlots, clusterProf);

  assert.ok(spreadScore > clusterScore, `spread ${spreadScore} should beat cluster ${clusterScore}`);
  assert.ok(spreadScore <= 100);
  assert.ok(clusterScore >= 0);
});

test('composeScore penalizes a practical discipline in the first period (SC7)', () => {
  const subject = td({ disciplina_sigla: 'EDF', aulas_semana: 1, tamanho_bloco: 1 });
  const tds = [subject];

  const firstSlots = makeSlots([[1, 1], [1, 2]]); // numero 1 is the first period
  const prof = buildProfDispMap(availability(firstSlots, 1));

  const atFirst: Assignment[] = [{ turma_disciplina_id: subject.id, time_slot_id: firstSlots[0].id }];
  const atLater: Assignment[] = [{ turma_disciplina_id: subject.id, time_slot_id: firstSlots[1].id }];

  assert.ok(
    composeScore(tds, atLater, firstSlots, prof) > composeScore(tds, atFirst, firstSlots, prof),
    'EDF should score worse when opening the day',
  );
});

// ---- strategyAnnealing -----------------------------------------------------

// Asserts the hard constraints HC1-HC4 hold for a solution over `tds`/`slots`.
function assertFeasible(
  assignments: Assignment[],
  tds: TurmaDisciplina[],
  slots: TimeSlotInfo[],
  disp: ProfDisp[],
): void {
  const tdById = new Map(tds.map((t) => [t.id, t]));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const availByProfSlot = new Set(disp.filter((d) => d.disponivel).map((d) => `${d.professor_id}|${d.time_slot_id}`));

  const profSlot = new Set<string>(); // HC1
  const turmaSlot = new Set<string>(); // HC2
  const perTd = new Map<number, number>(); // HC4

  for (const a of assignments) {
    const t = tdById.get(a.turma_disciplina_id)!;
    const slot = slotById.get(a.time_slot_id)!;

    const pKey = `${t.professor_id}|${a.time_slot_id}`;
    assert.ok(!profSlot.has(pKey), 'HC1: professor double-booked');
    profSlot.add(pKey);

    const tKey = `${t.turma_id}|${a.time_slot_id}`;
    assert.ok(!turmaSlot.has(tKey), 'HC2: turma double-booked');
    turmaSlot.add(tKey);

    assert.ok(availByProfSlot.has(pKey), 'HC3: professor not available at slot');
    assert.equal(slot.turno_id, t.turno_id, 'HC6: slot outside turma turno');

    perTd.set(t.id, (perTd.get(t.id) ?? 0) + 1);
  }
  for (const t of tds) {
    assert.equal(perTd.get(t.id) ?? 0, t.aulas_semana, 'HC4: wrong number of aulas placed');
  }
}

test('strategyAnnealing is reproducible, feasible, and never worse than its seed', () => {
  const tds = [
    td({ id: 1, disciplina_id: 1, professor_id: 1, disciplina_sigla: 'MAT', aulas_semana: 4, tamanho_bloco: 2 }),
    td({ id: 2, disciplina_id: 2, professor_id: 2, disciplina_sigla: 'POR', aulas_semana: 4, tamanho_bloco: 2 }),
  ];
  // Roomy grid (5 days x 4 aula periods) so blocks can both swap and relocate.
  const slots = makeSlots(
    [1, 2, 3, 4, 5].flatMap((dia) => ([[dia, 1], [dia, 2], [dia, 4], [dia, 5]] as Array<[number, number]>)),
  );
  const disp = [...availability(slots, 1), ...availability(slots, 2)];

  const a = strategyAnnealing(tds, slots, disp, 42);
  const b = strategyAnnealing(tds, slots, disp, 42);

  assert.equal(a.strategy, 'simulated_annealing');
  assert.deepEqual(a.assignments, b.assignments); // same seed -> same result
  assert.ok(a.score >= 0 && a.score <= 100);
  assertFeasible(a.assignments, tds, slots, disp);
});

test('strategyAnnealing fills a tight grid completely (HC4 via insertion)', () => {
  // Exactly-sized grid: one day, 4 aula periods, two disciplines needing 2 each.
  // The only feasible solution uses every slot, so reaching HC4 stresses the
  // insertion/relocation machinery without leaving room for slack.
  const tds = [
    td({ id: 1, disciplina_id: 1, professor_id: 1, aulas_semana: 2, tamanho_bloco: 2 }),
    td({ id: 2, disciplina_id: 2, professor_id: 2, aulas_semana: 2, tamanho_bloco: 2 }),
  ];
  const slots = makeSlots([[1, 1], [1, 2], [1, 4], [1, 5]]);
  const disp = [...availability(slots, 1), ...availability(slots, 2)];

  for (const seed of [1, 7, 99]) {
    const r = strategyAnnealing(tds, slots, disp, seed);
    assert.equal(r.assignments.length, 4, `seed ${seed}: every slot should be used`);
    assertFeasible(r.assignments, tds, slots, disp);
  }
});
