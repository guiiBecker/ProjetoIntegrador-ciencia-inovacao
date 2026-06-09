#!/usr/bin/env python3
"""Google OR-Tools (CP-SAT) timetable solver.

Invoked as a sidecar by the TypeScript worker (see strategyOrTools in
scheduler.ts). Reads a JSON problem description from stdin and writes the chosen
assignments as JSON to stdout. The TS side re-scores the assignments with its own
composeScore, so this solver only has to return a feasible, good placement; its
internal objective just steers the search.

Problem -> CP-SAT model:
  * For every turma_disciplina (td) we split aulas_semana into blocks (matching
    planBlocks in scheduler.ts) and enumerate every contiguous candidate run a
    block could occupy on a single day, within the td's turno, where the
    professor is available. Contiguity and turno are guaranteed by construction.
  * One boolean var per (block, candidate run). Each block is placed at most once.
  * Set-packing constraints forbid a turma or a professor from using a slot twice
    (HC1/HC2). Professor availability (HC3) is pre-filtered into the candidates.
  * Objective maximizes placed aulas (primary) and professor preference, and
    softly discourages putting >1 block of the same discipline on one day (spread).
"""

import sys
import json
from collections import defaultdict

from ortools.sat.python import cp_model


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


def candidate_runs(td, size, grouped, disp_map):
    """Every contiguous run of `size` aula slots on a single day for this td's
    turno where the professor is available on all of them. Returns a list of
    (slot_ids, total_preference, dia_id)."""
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
                runs.append(([s["id"] for s in run], total_pref, run[0]["dia_id"]))
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

    model = cp_model.CpModel()

    # x[(td_id, block_idx, run_idx)] = 1 if that block uses that candidate run.
    x = {}
    # For packing: (turma_id, slot_id) -> [vars], (prof_id, slot_id) -> [vars].
    turma_slot_vars = defaultdict(list)
    prof_slot_vars = defaultdict(list)
    # For spread: (turma_id, disciplina_id, dia_id) -> [vars].
    disc_day_vars = defaultdict(list)

    placement_terms = []   # (var, aulas placed) -> maximize
    preference_terms = []   # (var, total preference) -> maximize

    for td in tds:
        sizes = plan_blocks(td["aulas_semana"], td["tamanho_bloco"])
        for b_idx, size in enumerate(sizes):
            runs = candidate_runs(td, size, grouped, disp_map)
            block_vars = []
            for r_idx, (slot_ids, total_pref, dia_id) in enumerate(runs):
                var = model.NewBoolVar(f"x_{td['id']}_{b_idx}_{r_idx}")
                x[(td["id"], b_idx, r_idx)] = var
                block_vars.append(var)
                placement_terms.append((var, size))
                preference_terms.append((var, total_pref))
                for sid in slot_ids:
                    turma_slot_vars[(td["turma_id"], sid)].append(var)
                    prof_slot_vars[(td["professor_id"], sid)].append(var)
                disc_day_vars[(td["turma_id"], td["disciplina_id"], dia_id)].append(var)
            # Each block placed at most once (allows partial solutions).
            if block_vars:
                model.Add(sum(block_vars) <= 1)

    # HC1/HC2: no slot used twice by the same professor or turma.
    for vars_ in turma_slot_vars.values():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)
    for vars_ in prof_slot_vars.values():
        if len(vars_) > 1:
            model.Add(sum(vars_) <= 1)

    # Soft spread: penalize each block of a discipline beyond the first on a day.
    spread_excess = []
    for key, vars_ in disc_day_vars.items():
        if len(vars_) > 1:
            excess = model.NewIntVar(0, len(vars_), f"excess_{key[0]}_{key[1]}_{key[2]}")
            model.Add(excess >= sum(vars_) - 1)
            spread_excess.append(excess)

    # Integer objective. Coefficients only steer CP-SAT; TS re-scores the result.
    W_PLACE = 1000
    W_PREF = 10
    W_SPREAD = int(round(float(weights.get("dayCluster", 3)) * 50))

    objective = []
    for var, size in placement_terms:
        objective.append(W_PLACE * size * var)
    for var, total_pref in preference_terms:
        objective.append(W_PREF * total_pref * var)
    for excess in spread_excess:
        objective.append(-W_SPREAD * excess)
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
                for r_idx, (slot_ids, _pref, _dia) in enumerate(runs):
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
