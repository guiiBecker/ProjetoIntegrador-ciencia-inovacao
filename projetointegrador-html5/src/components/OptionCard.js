import Badge from './Badge';
import Button from './Button';
import TimetableGrid from './TimetableGrid';
import './OptionCard.css';

const STRATEGY_LABELS = {
  greedy_best_preference: 'Melhor Preferencia (Guloso)',
  balanced_distribution: 'Distribuicao Equilibrada',
};

export default function OptionCard({ option, onSelect, isSelected, editable, selectedItem, onCellClick, isConfirmed }) {
  const turmaGroups = {};
  for (const item of option.items || []) {
    if (!turmaGroups[item.turma_nome]) {
      turmaGroups[item.turma_nome] = { items: [], turmaId: item.turma_id };
    }
    turmaGroups[item.turma_nome].items.push(item);
  }

  return (
    <div className={`option-card ${isSelected ? 'selected' : ''}`}>
      <div className="option-header">
        <div>
          <h3>{STRATEGY_LABELS[option.strategy] || option.strategy}</h3>
          <Badge variant="score">Score: {option.score}</Badge>
        </div>
        {!isConfirmed && (
          isSelected
            ? <Badge variant="selected">Selecionada</Badge>
            : <Button variant="select" onClick={() => onSelect(option.id)}>Selecionar</Button>
        )}
      </div>
      {isSelected && editable && (
        <div className="edit-hint">Clique em uma aula para move-la. Depois clique no destino vazio.</div>
      )}
      <div className="timetables-row">
        {Object.entries(turmaGroups).map(([turma, { items, turmaId }]) => (
          <TimetableGrid
            key={turma}
            items={items}
            turmaNome={turma}
            editable={editable && isSelected}
            selectedItem={selectedItem}
            onCellClick={onCellClick}
            turmaId={turmaId}
          />
        ))}
      </div>
    </div>
  );
}
