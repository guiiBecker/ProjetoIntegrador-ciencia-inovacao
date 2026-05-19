import './ScheduleViews.css';

function buildAxes(items) {
  const diaMap = new Map();
  const periodoMap = new Map();
  for (const it of items) {
    if (!diaMap.has(it.dia_id)) diaMap.set(it.dia_id, it.dia_nome);
    if (!periodoMap.has(it.periodo_numero)) periodoMap.set(it.periodo_numero, it.hora_inicio);
  }
  const dias = [...diaMap.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.id - b.id);
  const periodos = [...periodoMap.entries()].map(([numero, hora]) => ({ numero, hora })).sort((a, b) => a.numero - b.numero);
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
              <td className="periodo-cell">{p.hora?.slice(0, 5)}</td>
              {dias.map((d) => {
                const cell = grid[`${d.id}-${p.numero}`];
                const filled = multiPerCell ? !!(cell && cell.length) : !!cell;
                return (
                  <td key={d.id} className={filled ? 'filled-cell' : 'empty-cell'}>
                    {filled ? renderCell(cell) : '-'}
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

const renderTurmaCell = (cell) => (
  <>
    <span className="cell-primary">{cell.disciplina_sigla}</span>
    <span className="cell-secondary">{cell.professor_nome}</span>
  </>
);

const renderProfessorCell = (cell) => (
  <>
    <span className="cell-primary">{cell.disciplina_sigla}</span>
    <span className="cell-secondary">{cell.turma_nome}</span>
  </>
);

const renderGeralCell = (cells) => (
  <div className="geral-stack">
    {cells.map((c) => (
      <div key={c.item_id} className="geral-item">
        <span className="cell-primary">{c.turma_nome}</span>
        <span className="cell-secondary">{c.disciplina_sigla} - {c.professor_nome}</span>
      </div>
    ))}
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
