import { useEffect } from 'react';
import Badge from './Badge';
import Button from './Button';
import TimetableGrid from './TimetableGrid';
import './OptionCard.css';

const STRATEGY_LABELS = {
  balanced_distribution: 'Distribuição Equilibrada',
  or_tools_cpsat: 'OR-Tools (CP-SAT)',
};

export default function OptionCard({ option, onEditToggle, onCancelEdit, onSaveEdit, isEditing, editable, selectedItem, onCellClick, onCellDragStart, onCellDrop, onCellDragEnd, professorAvailability, isConfirmed, activeTurma, onTurmaChange }) {
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
    <div className={`option-card ${isEditing ? 'selected editing' : ''}`}>
      <div className="option-header">
        <div className="option-header-info">
          <h3>{STRATEGY_LABELS[option.strategy] || option.strategy}</h3>
        </div>
        {isEditing
          ? <div className="editing-controls">
              <Button variant="cancel-edit" onClick={onCancelEdit}>Cancelar</Button>
              <Button variant="save-edit" onClick={onSaveEdit}>Salvar Edição</Button>
            </div>
          : <Button variant="select" onClick={onEditToggle}>Editar Horários</Button>
        }
      </div>

      {isEditing && (
        <div className="edit-hint">
          ✏️ <strong>Modo edição ativo.</strong> Arraste uma aula para outro horário vazio para mover, ou arraste sobre outra aula da mesma turma para trocar. Movimentos inválidos serão bloqueados automaticamente.
        </div>
      )}

      {turmaNames.length > 0 && (
        <div className="turma-tabs" role="tablist">
          {turmaNames.map(name => (
            <button
              key={name}
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
            editable={editable && isEditing}
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
