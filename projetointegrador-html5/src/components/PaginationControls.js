import './PaginationControls.css';

export default function PaginationControls({
  page,
  totalPages,
  total,
  limit,
  onPrevious,
  onNext,
  onLimitChange,
  limitOptions = [20, 50],
  label = 'Itens',
}) {
  return (
    <div className="pagination-controls">
      <div className="pagination-info">
        <strong>{label}</strong>
        <span>
          {total === 0
            ? 'Nenhum registro'
            : `Página ${page} de ${Math.max(totalPages, 1)} · ${total} registro${total === 1 ? '' : 's'} · ${limit} por página`}
        </span>
      </div>
      <div className="pagination-actions">
        {onLimitChange && (
          <select className="pagination-limit" value={limit} onChange={(event) => onLimitChange(Number(event.target.value))}>
            {limitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="pagination-btn" onClick={onPrevious} disabled={page <= 1}>
          Anterior
        </button>
        <button type="button" className="pagination-btn" onClick={onNext} disabled={page >= totalPages || totalPages === 0}>
          Próxima
        </button>
      </div>
    </div>
  );
}