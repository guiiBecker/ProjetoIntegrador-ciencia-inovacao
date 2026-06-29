import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import { normalizePaginatedResponse } from '../utils/pagination';
import './ProfessoresPage.css';

const DEFAULT_PAGE_LIMIT = 20;

export default function ProfessoresPage() {
  const [pageLimit] = useState(DEFAULT_PAGE_LIMIT);
  const [professoresPage, setProfessoresPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [allLinks, setAllLinks] = useState([]);
  const [msg, setMsg] = useState('');
  const [filtroNome, setFiltroNome] = useState('');

  const loadData = useCallback(async (profPage = 1) => {
    try {
      const [profs, lks] = await Promise.all([
        apiJson(`/api/config/professores?page=${profPage}&limit=${pageLimit}`),
        apiJson('/api/form/links'),
      ]);
      setProfessoresPage(normalizePaginatedResponse(profs, pageLimit));
      setAllLinks(Array.isArray(lks) ? lks : []);
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  useEffect(() => { loadData(1); }, [loadData]);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 5000); };

  const handleGenerate = async (profId) => {
    try {
      const res = await apiFetch(`/api/form/generate/${profId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showMsg(data.message || 'Erro'); return; }
      showMsg('Link gerado com sucesso!');
      loadData(professoresPage.page);
    } catch (err) { showMsg('Erro de conexão'); }
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/#form/${token}`;
    navigator.clipboard.writeText(url).then(() => showMsg('Link copiado!')).catch(() => showMsg(url));
  };

  const professorFiltrado = professoresPage.items.filter(p =>
    p.nome.toLowerCase().includes(filtroNome.toLowerCase())
  );

  return (
    <div className="prof-page">
      <Toast message={msg} />

      <div className="prof-page-header">
        <div>
          <h3>Gerenciamento de Links</h3>
          <p className="config-hint">Gere links para os professores preencherem sua disponibilidade de horários e acompanhe o status de cada resposta.</p>
        </div>
      </div>

      <div className="config-section">
        <div className="filter-wrapper">
          <label>Filtrar Professor</label>
          <input
            type="text"
            placeholder="Digite o nome..."
            value={filtroNome}
            onChange={e => setFiltroNome(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="data-table-wrapper">
          <DataTable
            headers={['Professor', 'Email', 'Link Gerado em', 'Status', 'Ação']}
            rows={professorFiltrado}
            emptyText="Cadastre professores na aba Configuração primeiro"
          >
            {professorFiltrado.map(p => {
              const profLinks = allLinks.filter(l => l.professor_id === p.id);
              const lastLink = profLinks[0];
              const answered = lastLink?.respondido;
              return (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.email || '-'}</td>
                  <td>{lastLink ? new Date(lastLink.criado_em).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    {!lastLink && <Badge variant="extra">Sem link</Badge>}
                    {lastLink && answered && <Badge variant="aula">Respondido</Badge>}
                    {lastLink && !answered && <Badge variant="intervalo">Pendente</Badge>}
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button onClick={() => handleGenerate(p.id)}>
                        {lastLink ? 'Novo Link' : 'Gerar Link'}
                      </Button>
                      {lastLink && !answered && (
                        <Button variant="info" onClick={() => copyLink(lastLink.token)}>Copiar</Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      </div>
    </div>
  );
}
