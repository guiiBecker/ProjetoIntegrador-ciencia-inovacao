import { disciplineColorForItem } from '../utils/disciplineColors';
import './TimetableGrid.css';

export default function TimetableGrid({ items, turmaNome, editable, selectedItem, onCellClick, onCellDragStart, onCellDrop, onCellDragEnd, professorAvailability, turmaId }) {
  const dias = [...new Set(items.map(i => i.dia_nome))];
  const periodos = [...new Set(items.map(i => i.periodo_numero))].sort((a, b) => a - b);

  const grid = {};
  for (const item of items) {
    grid[`${item.dia_nome}-${item.periodo_numero}`] = item;
  }

  const unavailableSet = (() => {
    if (!selectedItem || !professorAvailability) return null;
    const list = professorAvailability[String(selectedItem.professor_id)] || [];
    return new Set(list.map(s => `${s.dia_id}-${s.periodo_numero}`));
  })();

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
                <td className="periodo-cell">
                  <span className="periodo-num">{pNum}º</span>
                  <span className="periodo-inicio">{refItem?.hora_inicio?.slice(0,5)}</span>
                  {refItem?.hora_fim && <span className="periodo-fim">{refItem.hora_fim.slice(0,5)}</span>}
                </td>
                {dias.map(dia => {
                  const cell = grid[`${dia}-${pNum}`];
                  const isFilled = !!cell?.disciplina_sigla;
                  const isPickedUp = editable && selectedItem && cell && selectedItem.item_id === cell.item_id;
                  const isDropTarget = editable && selectedItem && !isFilled;
                  const isSwapTarget = editable && selectedItem && isFilled
                    && selectedItem.item_id !== cell.item_id
                    && selectedItem.turma_id === turmaId;
                  const diaId = cell?.dia_id || items.find(i => i.dia_nome === dia)?.dia_id;
                  const draggable = editable && isFilled;
                  const isUnavailable = !!(unavailableSet && diaId
                    && unavailableSet.has(`${diaId}-${pNum}`)
                    && !isPickedUp);
                  const cursor = !editable ? undefined : isUnavailable && selectedItem ? 'not-allowed' : draggable ? 'grab' : 'pointer';
                  const color = isFilled ? disciplineColorForItem(cell) : null;
                  const cellStyle = {};
                  if (cursor) cellStyle.cursor = cursor;
                  if (color) {
                    cellStyle.background = color.bg;
                    cellStyle.borderLeft = `4px solid ${color.border}`;
                  }
                  return (
                    <td key={dia}
                      title={isFilled ? `${cell.disciplina_nome || cell.disciplina_sigla} — ${cell.professor_nome}` : undefined}
                      className={`${isFilled ? 'filled-cell' : 'empty-cell'} ${isPickedUp ? 'picked-up' : ''} ${isDropTarget ? 'drop-target' : ''} ${isSwapTarget ? 'swap-target' : ''} ${isUnavailable ? 'prof-unavailable' : ''}`}
                      draggable={draggable}
                      onDragStart={draggable ? (e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(cell.item_id));
                        onCellDragStart && onCellDragStart(cell);
                      } : undefined}
                      onDragOver={editable ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
                      onDrop={editable ? (e) => {
                        e.preventDefault();
                        onCellDrop && onCellDrop(isFilled ? cell : null, diaId, pNum, turmaId);
                      } : undefined}
                      onDragEnd={draggable ? () => { onCellDragEnd && onCellDragEnd(); } : undefined}
                      onClick={editable ? () => onCellClick(isFilled ? cell : null, diaId, pNum, turmaId) : undefined}
                      style={Object.keys(cellStyle).length ? cellStyle : undefined}>
                      {cell?.disciplina_sigla ? (
                        <>
                          <span className="disc-sigla" style={color ? { color: color.text } : undefined}>{cell.disciplina_sigla}</span>
                          {cell.disciplina_nome && <span className="disc-nome">{cell.disciplina_nome}</span>}
                          <span className="prof-nome">{cell.professor_nome}</span>
                        </>
                      ) : <span className="empty-mark">·</span>}
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
