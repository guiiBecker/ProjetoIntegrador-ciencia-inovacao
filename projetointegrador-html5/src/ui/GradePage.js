import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';
import OptionCard from '../components/OptionCard';
import './GradePage.css';

const STRATEGY_LABELS = {
  greedy_best_preference: 'Melhor Preferência',
  balanced_distribution: 'Distribuição Equilibrada',
  or_tools_cpsat: 'OR-Tools (CP-SAT)',
};

function formatRequestDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

export default function GradePage() {
  const [requests, setRequests] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editError, setEditError] = useState('');
  const [activeOptionId, setActiveOptionId] = useState(null);
  const [activeTurmaByOption, setActiveTurmaByOption] = useState({});

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiJson('/api/schedule');
      setRequests(data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    try {
      const data = await apiJson(`/api/schedule/${id}`);
      setActiveRequest(data);
      return data;
    } catch (err) { console.error(err); return null; }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const options = activeRequest?.options || [];
    if (options.length === 0) { setActiveOptionId(null); return; }
    const stillThere = options.some(o => o.id === activeOptionId);
    if (!stillThere) {
      const selected = options.find(o => o.selected);
      setActiveOptionId((selected || options[0]).id);
    }
  }, [activeRequest, activeOptionId]);

  useEffect(() => {
    if (!polling || !activeRequest) return;
    if (activeRequest.status === 'completed' || activeRequest.status === 'failed') {
      setPolling(false); fetchRequests(); return;
    }
    const timer = setInterval(async () => {
      const data = await fetchDetail(activeRequest.id);
      if (data && (data.status === 'completed' || data.status === 'failed')) {
        setPolling(false); fetchRequests();
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [polling, activeRequest, fetchDetail, fetchRequests]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/schedule', { method: 'POST' });
      const data = await res.json();
      await fetchDetail(data.id);
      setPolling(true);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSelect = async (optionId) => {
    try {
      await apiFetch(`/api/schedule/${activeRequest.id}/select`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      setSelectedItem(null); setEditError('');
      await fetchDetail(activeRequest.id);
    } catch (err) { console.error(err); }
  };

  const isProfessorUnavailable = useCallback((professorId, diaId, periodoNum) => {
    const list = activeRequest?.professorAvailability?.[String(professorId)] || [];
    return list.some((s) => s.dia_id === diaId && s.periodo_numero === periodoNum);
  }, [activeRequest]);

  const handleCellClick = async (cell, diaId, periodoNum, turmaId) => {
    setEditError('');
    if (cell) {
      if (!selectedItem) { setSelectedItem(cell); return; }
      if (selectedItem.item_id === cell.item_id) { setSelectedItem(null); return; }
      if (selectedItem.turma_id !== turmaId) {
        setEditError('Só é possível trocar aulas dentro da mesma turma');
        setSelectedItem(null);
        return;
      }
      if (isProfessorUnavailable(selectedItem.professor_id, cell.dia_id, cell.periodo_numero)
        || isProfessorUnavailable(cell.professor_id, selectedItem.dia_id, selectedItem.periodo_numero)) {
        setEditError('Professor não disponível no horário de destino');
        setSelectedItem(null);
        return;
      }
      try {
        const res = await apiFetch(`/api/schedule/${activeRequest.id}/items/${selectedItem.item_id}/swap/${cell.item_id}`, {
          method: 'POST',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setEditError(data.message || 'Erro ao trocar aulas'); }
        else { await fetchDetail(activeRequest.id); }
      } catch (err) { setEditError('Erro de conexão ao trocar aulas'); }
      setSelectedItem(null);
      return;
    }
    if (!selectedItem) return;
    if (selectedItem.turma_id !== turmaId) {
      setEditError('Só é possível mover aulas dentro da mesma turma');
      setSelectedItem(null);
      return;
    }
    if (!diaId || !periodoNum) {
      setEditError('Não foi possível identificar o horário de destino');
      setSelectedItem(null);
      return;
    }
    if (selectedItem.dia_id === diaId && selectedItem.periodo_numero === periodoNum) {
      setSelectedItem(null);
      return;
    }
    if (isProfessorUnavailable(selectedItem.professor_id, diaId, periodoNum)) {
      setEditError('Professor não disponível neste horário');
      setSelectedItem(null);
      return;
    }
    try {
      const res = await apiFetch(`/api/schedule/${activeRequest.id}/items/${selectedItem.item_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diaId, periodoNumero: periodoNum }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setEditError(data.message || 'Erro ao mover aula'); }
      else { await fetchDetail(activeRequest.id); }
    } catch (err) { setEditError('Erro de conexão ao mover aula'); }
    setSelectedItem(null);
  };

  const handleConfirm = async () => {
    try {
      const res = await apiFetch(`/api/schedule/${activeRequest.id}/confirm`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setEditError(data.message || 'Erro ao confirmar'); return; }
      setSelectedItem(null); setEditError('');
      await fetchDetail(activeRequest.id);
      await fetchRequests();
    } catch (err) { setEditError('Erro de conexão ao confirmar'); }
  };

  const statusLabel = { pending: 'Pendente', processing: 'Processando', completed: 'Concluído', failed: 'Falhou', confirmed: 'Confirmado' };
  const isConfirmed = activeRequest?.status === 'confirmed';
  const hasSelectedOption = activeRequest?.options?.some((o) => o.selected);

  return (
    <div className="grade-page">
      <div className="grade-toolbar">
        <Button variant="generate" onClick={handleGenerate} disabled={loading || polling}>
          {loading ? 'Criando...' : polling ? 'Processando...' : 'Gerar Nova Grade'}
        </Button>
        <div className="request-picker">
          <label htmlFor="request-select">Versão</label>
          <select
            id="request-select"
            className="request-select"
            value={activeRequest?.id ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (!id) return;
              setSelectedItem(null); setEditError(''); setPolling(false); fetchDetail(id);
            }}
          >
            <option value="" disabled>
              {requests.length ? 'Selecione uma versão' : 'Nenhuma requisição ainda'}
            </option>
            {requests.map(r => (
              <option key={r.id} value={r.id}>
                #{r.id} — {statusLabel[r.status] || r.status}{r.criado_em ? ` — ${formatRequestDate(r.criado_em)}` : ''}
              </option>
            ))}
          </select>
        </div>
        {activeRequest && (
          <Badge variant={activeRequest.status}>{statusLabel[activeRequest.status] || activeRequest.status}</Badge>
        )}
      </div>

      <section className="content">
          {!activeRequest && <div className="placeholder">Clique em "Gerar Nova Grade" para começar ou selecione uma requisição existente.</div>}
          {activeRequest?.status === 'processing' && <div className="placeholder"><Spinner /><p>Gerando opções de grade horária...</p></div>}
          {activeRequest?.status === 'pending' && <div className="placeholder"><p>Aguardando processamento...</p></div>}
          {activeRequest?.status === 'failed' && <div className="placeholder error"><p>Falha ao gerar grade. Verifique os dados de entrada.</p></div>}

          {activeRequest && (activeRequest.status === 'completed' || activeRequest.status === 'confirmed') && activeRequest.options && (
            <div className="options-container">
              <div className="options-header-bar">
                <h2>{isConfirmed ? `Grade Confirmada - Requisição #${activeRequest.id}` : `Opções de Grade - Requisição #${activeRequest.id}`}</h2>
                {!isConfirmed && hasSelectedOption && <Button variant="confirm" onClick={handleConfirm}>Confirmar Grade Final</Button>}
              </div>
              {isConfirmed && <div className="confirmed-banner">Grade salva com sucesso na base de dados.</div>}
              {editError && <div className="edit-error">{editError}</div>}

              {!isConfirmed && (
                <div className="option-tabs" role="tablist">
                  {activeRequest.options.map(opt => (
                    <button key={opt.id}
                      role="tab"
                      aria-selected={activeOptionId === opt.id}
                      className={`option-tab ${activeOptionId === opt.id ? 'active' : ''} ${opt.selected ? 'is-selected' : ''}`}
                      onClick={() => { setActiveOptionId(opt.id); setSelectedItem(null); setEditError(''); }}>
                      <span className="option-tab-label">{STRATEGY_LABELS[opt.strategy] || opt.strategy}</span>
                      <span className="option-tab-meta">Score {opt.score}{opt.selected ? ' • Selecionada' : ''}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeRequest.options.filter(opt => isConfirmed ? opt.selected : opt.id === activeOptionId).map(opt => (
                <OptionCard key={opt.id} option={opt} onSelect={handleSelect}
                  isSelected={opt.selected} editable={!isConfirmed && opt.selected}
                  selectedItem={selectedItem} onCellClick={handleCellClick}
                  onCellDragStart={(cell) => { setEditError(''); setSelectedItem(cell); }}
                  onCellDrop={handleCellClick}
                  onCellDragEnd={() => { setSelectedItem(null); }}
                  professorAvailability={activeRequest.professorAvailability}
                  isConfirmed={isConfirmed}
                  activeTurma={activeTurmaByOption[opt.id]}
                  onTurmaChange={(turma) => {
                    setSelectedItem(null); setEditError('');
                    setActiveTurmaByOption(prev => ({ ...prev, [opt.id]: turma }));
                  }} />
              ))}
            </div>
          )}
        </section>
    </div>
  );
}
