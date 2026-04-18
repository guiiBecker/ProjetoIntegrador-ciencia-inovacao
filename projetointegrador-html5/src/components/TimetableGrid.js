import './TimetableGrid.css';

export default function TimetableGrid({ items, turmaNome, editable, selectedItem, onCellClick, turmaId }) {
  const dias = [...new Set(items.map(i => i.dia_nome))];
  const periodos = [...new Set(items.map(i => i.periodo_numero))].sort((a, b) => a - b);

  const grid = {};
  for (const item of items) {
    grid[`${item.dia_nome}-${item.periodo_numero}`] = item;
  }

  return (
    <div className="timetable-wrapper">
      <div className="turma-title">{turmaNome}</div>
      <table className="timetable">
        <thead>
          <tr>
            <th>Horario</th>
            {dias.map(d => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {periodos.map(pNum => {
            const refItem = items.find(i => i.periodo_numero === pNum);
            return (
              <tr key={pNum}>
                <td className="periodo-cell">{refItem?.hora_inicio?.slice(0,5)}</td>
                {dias.map(dia => {
                  const cell = grid[`${dia}-${pNum}`];
                  const isPickedUp = editable && selectedItem && cell && selectedItem.item_id === cell.item_id;
                  const isDropTarget = editable && selectedItem && !cell?.disciplina_sigla;
                  const diaId = cell?.dia_id || items.find(i => i.dia_nome === dia)?.dia_id;
                  return (
                    <td key={dia}
                      className={`${cell?.disciplina_sigla ? 'filled-cell' : 'empty-cell'} ${isPickedUp ? 'picked-up' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                      onClick={editable ? () => onCellClick(cell?.disciplina_sigla ? cell : null, diaId, pNum, turmaId) : undefined}
                      style={editable ? { cursor: 'pointer' } : undefined}>
                      {cell?.disciplina_sigla ? (
                        <>
                          <span className="disc-sigla">{cell.disciplina_sigla}</span>
                          <span className="prof-nome">{cell.professor_nome}</span>
                        </>
                      ) : '-'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
