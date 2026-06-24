import { useEffect } from 'react';
import Badge from './Badge';
import Button from './Button';
import TimetableGrid from './TimetableGrid';
import './OptionCard.css';

const STRATEGY_LABELS = {
  greedy_best_preference: 'Melhor Preferencia',
  balanced_distribution: 'Distribuicao Equilibrada',
  or_tools_cpsat: 'OR-Tools (CP-SAT)',
};

export default function OptionCard({ option, onSelect, isSelected, editable, selectedItem, onCellClick, onCellDragStart, onCellDrop, onCellDragEnd, professorAvailability, isConfirmed, activeTurma, onTurmaChange }) {
  const turmaGroups = {};
  for (const item of option.items || []) {
    if (!turmaGroups[item.turma_nome]) {
      turmaGroups[item.turma_nome] = { items: [], turmaId: item.turma_id };
    }
    turmaGroups[item.turma_nome].items.push(item);
  }
  // Stable, human-friendly tab order. Without this the tabs follow item order
  // (day/period), so a manual move/swap reorders the tabs and the active one
  // appears to jump to another turma.
  const turmaNames = Object.keys(turmaGroups).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const currentTurma = turmaNames.includes(activeTurma) ? activeTurma : turmaNames[0];

  useEffect(() => {
    if (!turmaNames.length) return;
    if (!turmaNames.includes(activeTurma) && onTurmaChange) {
      onTurmaChange(turmaNames[0]);
    }
  }, [turmaNames, activeTurma, onTurmaChange]);

  const turmaData = currentTurma ? turmaGroups[currentTurma] : null;

  return (
    <div className={`option-card ${isSelected ? 'selected' : ''}`}>
      <div className="option-header">
        <div className="option-header-info">
          <h3>{STRATEGY_LABELS[option.strategy] || option.strategy}</h3>
          <Badge variant="score">Score: {option.score}</Badge>
        </div>
        {!isConfirmed && (
          isSelected
            ? <Badge variant="selected">Selecionada</Badge>
            : <Button variant="select" onClick={() => onSelect(option.id)}>Selecionar esta opcao</Button>
        )}
      </div>

      {isSelected && editable && (
        <div className="edit-hint">Arraste uma aula para um horario vazio para mover, ou solte-a sobre outra aula da mesma turma para trocar. (Tambem funciona com clique-clique.)</div>
      )}

      {turmaNames.length > 0 && (
        <div className="turma-tabs" role="tablist">
          {turmaNames.map(name => (
            <button key={name}
              role="tab"
              aria-selected={currentTurma === name}
              className={`turma-tab ${currentTurma === name ? 'active' : ''}`}
              onClick={() => onTurmaChange && onTurmaChange(name)}>
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="timetable-panel">
        {turmaData && (
          <TimetableGrid
            key={currentTurma}
            items={turmaData.items}
            turmaNome={currentTurma}
            editable={editable && isSelected}
            selectedItem={selectedItem}
            onCellClick={onCellClick}
            onCellDragStart={onCellDragStart}
            onCellDrop={onCellDrop}
            onCellDragEnd={onCellDragEnd}
            professorAvailability={professorAvailability}
            turmaId={turmaData.turmaId}
          />
        )}
      </div>
    </div>
  );
}
