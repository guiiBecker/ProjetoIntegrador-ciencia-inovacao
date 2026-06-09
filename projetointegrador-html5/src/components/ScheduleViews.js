import { disciplineColorForItem } from '../utils/disciplineColors';
import './ScheduleViews.css';

function buildAxes(items) {
  const diaMap = new Map();
  const periodoMap = new Map();
  for (const it of items) {
    if (!diaMap.has(it.dia_id)) diaMap.set(it.dia_id, it.dia_nome);
    if (!periodoMap.has(it.periodo_numero)) {
      periodoMap.set(it.periodo_numero, { inicio: it.hora_inicio, fim: it.hora_fim });
    }
  }
  const dias = [...diaMap.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.id - b.id);
  const periodos = [...periodoMap.entries()]
    .map(([numero, horas]) => ({ numero, ...horas }))
    .sort((a, b) => a.numero - b.numero);
  return { dias, periodos };
}

function ViewGrid({ title, items, renderCell, multiPerCell }) {
  const { dias, periodos } = buildAxes(items);
  const grid = {};
  for (const it of items) {
    const k = `${it.dia_id}-${it.periodo_numero}`;
    if (multiPerCell) {
      if (!grid[k]) grid[k] = [];
      grid[k].push(it);
    } else {
      grid[k] = it;
    }
  }
  return (
    <div className="view-block">
      <div className="view-title">{title}</div>
      <table className="view-table">
        <thead>
          <tr>
            <th>Horario</th>
            {dias.map((d) => <th key={d.id}>{d.nome}</th>)}
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={p.numero}>
              <td className="periodo-cell">
                <span className="periodo-num">{p.numero}º</span>
                <span className="periodo-inicio">{p.inicio?.slice(0, 5)}</span>
                {p.fim && <span className="periodo-fim">{p.fim.slice(0, 5)}</span>}
              </td>
              {dias.map((d) => {
                const cell = grid[`${d.id}-${p.numero}`];
                const filled = multiPerCell ? !!(cell && cell.length) : !!cell;
                // Single-cell views tint the whole cell by discipline; the geral
                // view colors each stacked item instead (see renderGeralCell).
                const color = filled && !multiPerCell ? disciplineColorForItem(cell) : null;
                const style = color ? { background: color.bg, borderLeft: `4px solid ${color.border}` } : undefined;
                return (
                  <td key={d.id} className={filled ? 'filled-cell' : 'empty-cell'} style={style}>
                    {filled ? renderCell(cell, color) : <span className="empty-mark">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const renderTurmaCell = (cell, color) => (
  <span title={`${cell.disciplina_nome || cell.disciplina_sigla} — ${cell.professor_nome}`}>
    <span className="cell-primary" style={color ? { color: color.text } : undefined}>{cell.disciplina_sigla}</span>
    {cell.disciplina_nome && <span className="cell-name">{cell.disciplina_nome}</span>}
    <span className="cell-secondary">{cell.professor_nome}</span>
  </span>
);

const renderProfessorCell = (cell, color) => (
  <span title={`${cell.disciplina_nome || cell.disciplina_sigla} — ${cell.turma_nome}`}>
    <span className="cell-primary" style={color ? { color: color.text } : undefined}>{cell.disciplina_sigla}</span>
    {cell.disciplina_nome && <span className="cell-name">{cell.disciplina_nome}</span>}
    <span className="cell-secondary">{cell.turma_nome}</span>
  </span>
);

const renderGeralCell = (cells) => (
  <div className="geral-stack">
    {cells.map((c) => {
      const color = disciplineColorForItem(c);
      return (
        <div key={c.item_id} className="geral-item"
          title={`${c.turma_nome}: ${c.disciplina_nome || c.disciplina_sigla} — ${c.professor_nome}`}
          style={{ borderLeftColor: color.border, background: color.bg }}>
          <span className="cell-primary" style={{ color: color.text }}>{c.turma_nome}</span>
          <span className="cell-secondary">{c.disciplina_sigla} - {c.professor_nome}</span>
        </div>
      );
    })}
  </div>
);

export function ViewByTurma({ items }) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.turma_id)) groups.set(it.turma_id, { nome: it.turma_nome, items: [] });
    groups.get(it.turma_id).items.push(it);
  }
  const sorted = [...groups.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  if (sorted.length === 0) return <div className="empty-state">Sem aulas para exibir.</div>;
  return (
    <div className="views-row">
      {sorted.map((g) => (
        <ViewGrid key={g.nome} title={g.nome} items={g.items} renderCell={renderTurmaCell} />
      ))}
    </div>
  );
}

export function ViewByProfessor({ items }) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.professor_id)) groups.set(it.professor_id, { nome: it.professor_nome, items: [] });
    groups.get(it.professor_id).items.push(it);
  }
  const sorted = [...groups.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  if (sorted.length === 0) return <div className="empty-state">Sem aulas para exibir.</div>;
  return (
    <div className="views-row">
      {sorted.map((g) => (
        <ViewGrid key={g.nome} title={g.nome} items={g.items} renderCell={renderProfessorCell} />
      ))}
    </div>
  );
}

export function ViewGeral({ items }) {
  if (items.length === 0) return <div className="empty-state">Sem aulas para exibir.</div>;
  return (
    <div className="views-row">
      <ViewGrid title="Todas as turmas" items={items} renderCell={renderGeralCell} multiPerCell />
    </div>
  );
}
