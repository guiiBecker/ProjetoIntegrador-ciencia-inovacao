#!/usr/bin/env python3
"""Google OR-Tools (CP-SAT) timetable solver.

Invoked as a sidecar by the TypeScript worker (see strategyOrTools in
scheduler.ts). Reads a JSON problem description from stdin and writes the chosen
assignments as JSON to stdout. The TS side re-scores the assignments with its own
composeScore, so this solver only has to return a feasible, good placement; its
internal objective just steers the search.

Problem -> CP-SAT model. Hard constraints (HC) — a solution must satisfy all of
them or the model is INFEASIBLE and the worker fails the request:
  * For every turma_disciplina (td) we split aulas_semana into blocks (matching
    planBlocks in scheduler.ts) and enumerate every contiguous candidate run a
    block could occupy on a single day, within the td's turno, where the
    professor is available. Block contiguity (HC5) and turno (HC6) are guaranteed
    by construction; professor availability (HC3) is pre-filtered into candidates.
  * One boolean var per (block, candidate run). HC4: every block is placed
    exactly once (== 1). A block with no candidate run makes the model infeasible.
  * Set-packing constraints forbid a turma or a professor from using a slot twice
    (HC1/HC2).
  * No-gap (HC, turma only): a turma's occupied aula positions on a day must be
    contiguous — no idle window between its classes. Enforced as hard here;
    professor idle windows stay a soft penalty (SC5) scored on the TS side.
  * Objective (placement is constant under HC4, so not included) mirrors the soft
    constraints scored by composeScore in scheduler.ts: minimize same-discipline
    daily spread (SC1), professor idle windows (SC5), heavy discipline in the last
    period (SC6) and practical discipline in the first period (SC7); professor
    preference is a weak tie-breaker.
"""

import re
import sys
import json
from collections import defaultdict

from ortools.sat.python import cp_model

# Mirrors scheduler.ts: peso >= this is "cognitively heavy" (SC6); practical
# disciplines (SC7) are matched by sigla prefix.
HEAVY_PESO_THRESHOLD = 3
PRACTICAL_SIGLA_RE = re.compile(r"^(EDF|EF|ART|MUS|COMP|INFO|INF|TI)", re.IGNORECASE)


def plan_blocks(aulas_semana: int, tamanho_bloco: int):
    """Mirror of planBlocks() in scheduler.ts."""
    if tamanho_bloco <= 0:
        return [aulas_semana] if aulas_semana > 0 else []
    blocks = []
    full = aulas_semana // tamanho_bloco
    remainder = aulas_semana % tamanho_bloco
    blocks.extend([tamanho_bloco] * full)
    if remainder > 0:
        blocks.append(remainder)
    return blocks


def slots_by_turno_day(slots):
    """turno_id -> dia_id -> list of slots sorted by periodo_numero."""
    grouped = defaultdict(lambda: defaultdict(list))
    for s in slots:
        grouped[s["turno_id"]][s["dia_id"]].append(s)
    for by_day in grouped.values():
        for day_slots in by_day.values():
            day_slots.sort(key=lambda s: s["periodo_numero"])
    return grouped


def turno_edges(grouped):
    """turno_id -> (first_numero, last_numero) over its aula periods. Used by
    SC6/SC7 to know the day's clock-time edges (first/last aula of the day)."""
    edges = {}
    for turno_id, by_day in grouped.items():
        nums = {s["periodo_numero"] for day_slots in by_day.values() for s in day_slots}
        if nums:
            edges[turno_id] = (min(nums), max(nums))
    return edges


def candidate_runs(td, size, grouped, disp_map):
    """Every contiguous run of `size` aula slots on a single day for this td's
    turno where the professor is available on all of them. Returns a list of
    (slot_ids, total_preference, dia_id, numeros) where numeros is the tuple of
    periodo numbers covered (used to detect the day's first/last edges)."""
    runs = []
    prof = td["professor_id"]
    for day_slots in grouped.get(td["turno_id"], {}).values():
        for i in range(len(day_slots) - size + 1):
            run = day_slots[i:i + size]
            # Contiguous in clock terms: consecutive periodo numbers.
            if any(run[j]["periodo_numero"] != run[0]["periodo_numero"] + j
                   for j in range(size)):
                continue
            total_pref = 0
            ok = True
            for s in run:
                d = disp_map.get((prof, s["id"]))
                if d is None or not d["disponivel"]:
                    ok = False
                    break
                total_pref += d["preferencia"]
            if ok:
                runs.append((
                    [s["id"] for s in run],
                    total_pref,
                    run[0]["dia_id"],
                    tuple(s["periodo_numero"] for s in run),
                ))
    return runs


def solve(problem):
    tds = problem["tds"]
    slots = problem["slots"]
    prof_disp = problem["profDisp"]
    weights = problem.get("weights", {})
    time_budget_ms = problem.get("timeBudgetMs", 5000)

    disp_map = {
        (d["professor_id"], d["time_slot_id"]): {
            "disponivel": bool(d["disponivel"]),
            "preferencia": d["preferencia"],
        }
        for d in prof_disp
    }
    grouped = slots_by_turno_day(slots)
    edges = turno_edges(grouped)

    # Fill-order maps: day_rank ranks weekdays 0..N-1 (earliest = 0) and pos_of is
    # each slot's index within its turno's day (0 = first period). Used by the
    # fill-order objective to front-load the week and anchor days to the morning.
    day_rank = {d: r for r, d in enumerate(sorted({s["dia_id"] for s in slots}))}
    pos_of = {}
    for turno_id, by_day in grouped.items():
        for day_slots in by_day.values():
            for idx, s in enumerate(day_slots):
                pos_of[(turno_id, s["id"])] = idx

    model = cp_model.CpModel()

    # x[(td_id, block_idx, run_idx)] = 1 if that block uses that candidate run.
    x = {}
    # For packing: (turma_id, slot_id) -> [vars], (prof_id, slot_id) -> [vars].
    turma_slot_vars = defaultdict(list)
    prof_slot_vars = defaultdict(list)
    # For spread: (turma_id, disciplina_id, dia_id) -> [vars].
    disc_day_vars = defaultdict(list)
    # turma_id -> turno_id (a turma's tds all share its turno); used for no-gap.
    turma_turno = {}

    preference_terms = []     # (var, total preference) -> maximize
    heavy_last_terms = []     # SC6: vars placing a heavy discipline in the last period
    practical_first_terms = []  # SC7: vars placing a practical discipline in the first period
    fill_terms = []           # (var, day_rank_sum, pos_sum) -> minimize (fill order)

    for td in tds:
        turma_turno[td["turma_id"]] = td["turno_id"]
        is_heavy = td.get("disciplina_peso", 1) >= HEAVY_PESO_THRESHOLD
        sigla = td.get("disciplina_sigla") or ""
        is_practical = bool(PRACTICAL_SIGLA_RE.match(sigla))
        first_n, last_n = edges.get(td["turno_id"], (None, None))
        sizes = plan_blocks(td["aulas_semana"], td["tamanho_bloco"])
        for b_idx, size in enumerate(sizes):
            runs = candidate_runs(td, size, grouped, disp_map)
            block_vars = []
            for r_idx, (slot_ids, total_pref, dia_id, numeros) in enumerate(runs):
                var = model.NewBoolVar(f"x_{td['id']}_{b_idx}_{r_idx}")
                x[(td["id"], b_idx, r_idx)] = var
                block_vars.append(var)
                preference_terms.append((var, total_pref))
                for sid in slot_ids:
                    turma_slot_vars[(td["turma_id"], sid)].append(var)
                    prof_slot_vars[(td["professor_id"], sid)].append(var)
                disc_day_vars[(td["turma_id"], td["disciplina_id"], dia_id)].append(var)
                if is_heavy and last_n in numeros:
                    heavy_last_terms.append(var)
                if is_practical and first_n in numeros:
                    practical_first_terms.append(var)
                pos_sum = sum(pos_of[(td["turno_id"], sid)] for sid in slot_ids)
                fill_terms.append((var, size * day_rank[dia_id], pos_sum))
            # HC4: every block must be placed exactly once. A block with no
            # candidate run cannot be placed at all -> the problem is infeasible.
            if not block_vars:
                return {"assignments": [], "status": "INFEASIBLE"}
            model.Add(sum(block_vars) == 1)

    # HC1/HC2: no slot used twice by the same professor or turma.
    for vars_ in turma_slot_vars.values():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)
    for vars_ in prof_slot_vars.values():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # HC no-gap (turma): a turma's occupied aula positions on a day must be
    # contiguous. Position-based over the turno's sorted slots, so recreios (no
    # time_slot) don't count as gaps. For any positions a < b < c on a day, if a
    # and c are both occupied then the middle b must be too. occ[p] is the (0/1)
    # occupancy of position p, i.e. the sum of vars covering that slot for the
    # turma (HC2 keeps it <= 1).
    for turma_id, turno_id in turma_turno.items():
        for day_slots in grouped.get(turno_id, {}).values():
            occ = [turma_slot_vars.get((turma_id, s["id"]), []) for s in day_slots]
            n = len(occ)
            for a in range(n):
                if not occ[a]:
                    continue
                for c in range(a + 2, n):
                    if not occ[c]:
                        continue
                    for b in range(a + 1, c):
                        model.Add(sum(occ[b]) >= sum(occ[a]) + sum(occ[c]) - 1)

    # Soft spread (SC1): penalize each block of a discipline beyond the first on a day.
    spread_excess = []
    for key, vars_ in disc_day_vars.items():
        if len(vars_) > 1:
            excess = model.NewIntVar(0, len(vars_), f"excess_{key[0]}_{key[1]}_{key[2]}")
            model.Add(excess >= sum(vars_) - 1)
            spread_excess.append(excess)

    # Soft SC5: professor idle windows (free aula slots between the prof's first
    # and last class of a (day, turno)). For each interior free position p, gap=1
    # iff the professor has a class before AND after p but not at p; minimizing
    # sum(gap) compacts each professor's day. occ[p] is the prof's 0/1 occupancy
    # (HC1 keeps it <= 1). Built per (professor, turno, day), position-based so
    # recreios don't count -- matching softPenalty's SC5 in scheduler.ts.
    window_gaps = []
    prof_ids = sorted({td["professor_id"] for td in tds})
    for prof in prof_ids:
        for turno_id, by_day in grouped.items():
            for dia_id, day_slots in by_day.items():
                occ = [prof_slot_vars.get((prof, s["id"]), []) for s in day_slots]
                n = len(occ)
                for p in range(1, n - 1):
                    before = [q for q in range(p) if occ[q]]
                    after = [q for q in range(p + 1, n) if occ[q]]
                    if not before or not after:
                        continue
                    hb = model.NewBoolVar(f"hb_{prof}_{turno_id}_{dia_id}_{p}")
                    for q in before:
                        model.Add(hb >= sum(occ[q]))
                    ha = model.NewBoolVar(f"ha_{prof}_{turno_id}_{dia_id}_{p}")
                    for q in after:
                        model.Add(ha >= sum(occ[q]))
                    gap = model.NewBoolVar(f"gap_{prof}_{turno_id}_{dia_id}_{p}")
                    model.Add(gap >= hb + ha - sum(occ[p]) - 1)
                    window_gaps.append(gap)

    # Integer objective. Coefficients only steer CP-SAT; TS re-scores the result.
    # Placement is fixed by HC4, so it's not in the objective. The soft-constraint
    # weights (scaled to integers) mirror scheduler.ts so the solver optimizes the
    # same trade-offs that composeScore measures; preference is a weak tie-breaker.
    SCALE = 100
    W_PREF = 1
    W_SPREAD = int(round(float(weights.get("dayCluster", 3)) * SCALE))
    W_WINDOW = int(round(float(weights.get("window", 1)) * SCALE))
    W_HEAVY = int(round(float(weights.get("heavyLast", 1.5)) * SCALE))
    W_PRAC = int(round(float(weights.get("practicalFirst", 1)) * SCALE))
    # Fill-order: front-load the week (earlier days cheaper) and start each day in
    # the morning (earlier periods cheaper). W_DAY dominates W_EARLY so the weekly
    # taper wins over within-day anchoring when they compete.
    W_DAY = int(round(float(weights.get("frontLoadDay", 60))))
    W_EARLY = int(round(float(weights.get("earlyPeriod", 12))))

    objective = []
    for var, total_pref in preference_terms:
        objective.append(W_PREF * total_pref * var)
    for excess in spread_excess:
        objective.append(-W_SPREAD * excess)
    for gap in window_gaps:
        objective.append(-W_WINDOW * gap)
    for var in heavy_last_terms:
        objective.append(-W_HEAVY * var)
    for var in practical_first_terms:
        objective.append(-W_PRAC * var)
    for var, day_cost, pos_cost in fill_terms:
        objective.append(-(W_DAY * day_cost + W_EARLY * pos_cost) * var)
    model.Maximize(sum(objective))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(0.5, time_budget_ms / 1000.0)
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    assignments = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for td in tds:
            sizes = plan_blocks(td["aulas_semana"], td["tamanho_bloco"])
            for b_idx, size in enumerate(sizes):
                runs = candidate_runs(td, size, grouped, disp_map)
                for r_idx, (slot_ids, _pref, _dia, _nums) in enumerate(runs):
                    var = x.get((td["id"], b_idx, r_idx))
                    if var is not None and solver.Value(var) == 1:
                        for sid in slot_ids:
                            assignments.append({
                                "turma_disciplina_id": td["id"],
                                "time_slot_id": sid,
                            })

    return {
        "assignments": assignments,
        "status": solver.StatusName(status),
    }


def main():
    problem = json.load(sys.stdin)
    result = solve(problem)
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
