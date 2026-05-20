import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';
import { ViewByTurma, ViewByProfessor, ViewGeral } from '../components/ScheduleViews';
import PaginationControls from '../components/PaginationControls';
import { normalizePaginatedResponse } from '../utils/pagination';

const DEFAULT_PAGE_LIMIT = 20;

const VIEWS = [
  { key: 'turma', label: 'Por Turma' },
  { key: 'professor', label: 'Por Professor' },
  { key: 'geral', label: 'Grade Geral' },
];

export default function ScheduleViewerPage() {
  const [requests, setRequests] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('turma');
  const [pageLimit, setPageLimit] = useState(() => DEFAULT_PAGE_LIMIT);
  const [requestPage, setRequestPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });

  const loadRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await apiJson(`/api/schedule/public?page=${page}&limit=${pageLimit}`);
      const normalized = normalizePaginatedResponse(data, pageLimit);
      setRequestPage(normalized);
      setRequests(normalized.items);
      if (normalized.items.length > 0) {
        const detail = await apiJson(`/api/schedule/public/${normalized.items[0].id}`);
        setActiveRequest(detail);
      } else {
        setActiveRequest(null);
      }
    } catch {
      setRequests([]);
      setActiveRequest(null);
    } finally {
      setLoading(false);
    }
  }, [pageLimit]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleChangeLimit = (newLimit) => {
    setPageLimit(newLimit);
    setRequestPage((current) => ({ ...current, page: 1, limit: newLimit }));
  };

  const openRequest = async (requestId) => {
    try {
      const detail = await apiJson(`/api/schedule/public/${requestId}`);
      setActiveRequest(detail);
    } catch {
      setActiveRequest(null);
    }
  };

  const items = useMemo(() => {
    const selected = activeRequest?.options?.find((o) => o.selected) || activeRequest?.options?.[0];
    return selected?.items || [];
  }, [activeRequest]);

  const statusLabel = {
    confirmed: 'Confirmado',
    completed: 'Concluido',
    processing: 'Processando',
  };

  const handlePrevious = () => {
    if (requestPage.page > 1) {
      loadRequests(requestPage.page - 1);
    }
  };

  const handleNext = () => {
    if (requestPage.page < requestPage.totalPages) {
      loadRequests(requestPage.page + 1);
    }
  };

  return (
    <div className="page-card">
      <div className="section-header">
        <div>
          <h3>Horários confirmados</h3>
          <p className="config-hint">Área somente leitura para consulta das grades já aprovadas.</p>
        </div>
        <Button variant="info" onClick={() => loadRequests(requestPage.page)}>Atualizar</Button>
      </div>

      <div className="viewer-grid">
        <aside className="viewer-sidebar">
          <h4 style={{ marginBottom: '0.75rem' }}>Requisições confirmadas</h4>
          {loading ? (
            <Spinner />
          ) : (
            <>
              <ul className="viewer-list">
                {requests.map((request) => (
                  <li key={request.id}>
                    <button
                      type="button"
                      className={`viewer-item ${activeRequest?.id === request.id ? 'active' : ''}`}
                      onClick={() => openRequest(request.id)}
                    >
                      <div className="viewer-item-title">Requisição #{request.id}</div>
                      <div className="viewer-item-meta">
                        <span>{new Date(request.criado_em).toLocaleString('pt-BR')}</span>
                        <Badge variant={request.status}>{statusLabel[request.status] || request.status}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
                {requests.length === 0 && <li className="empty-state">Nenhuma grade confirmada encontrada.</li>}
              </ul>
              <PaginationControls
                label="Requisições"
                page={requestPage.page}
                totalPages={requestPage.totalPages}
                total={requestPage.total}
                limit={requestPage.limit}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onLimitChange={handleChangeLimit}
              />
            </>
          )}
        </aside>

        <section>
          {!activeRequest && !loading && <div className="empty-state">Selecione uma requisição para ver os detalhes.</div>}
          {activeRequest && (
            <div className="options-container">
              <div className="options-header-bar">
                <h2>Grade confirmada - Requisição #{activeRequest.id}</h2>
                <Badge variant="selected">Somente leitura</Badge>
              </div>

              <div className="view-tabs" role="tablist">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    role="tab"
                    aria-selected={view === v.key}
                    className={`view-tab ${view === v.key ? 'active' : ''}`}
                    onClick={() => setView(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {view === 'turma' && <ViewByTurma items={items} />}
              {view === 'professor' && <ViewByProfessor items={items} />}
              {view === 'geral' && <ViewGeral items={items} />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
