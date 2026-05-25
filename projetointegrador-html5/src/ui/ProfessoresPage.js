import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import PaginationControls from '../components/PaginationControls';
import { normalizePaginatedResponse } from '../utils/pagination';
import './ProfessoresPage.css';

const DEFAULT_PAGE_LIMIT = 20;

export default function ProfessoresPage() {
  const [pageLimit, setPageLimit] = useState(() => DEFAULT_PAGE_LIMIT);
  const [professoresPage, setProfessoresPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [linksPage, setLinksPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [allLinks, setAllLinks] = useState([]);
  const [msg, setMsg] = useState('');

  const loadData = useCallback(async (profPage = 1, linkPage = 1) => {
    try {
      const [profs, lks] = await Promise.all([
        apiJson(`/api/config/professores?page=${profPage}&limit=${pageLimit}`),
        apiJson('/api/form/links'),
      ]);
      const history = await apiJson(`/api/form/links?page=${linkPage}&limit=${pageLimit}`);
      setProfessoresPage(normalizePaginatedResponse(profs, pageLimit));
      setAllLinks(Array.isArray(lks) ? lks : []);
      setLinksPage(normalizePaginatedResponse(history, pageLimit));
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  useEffect(() => { loadData(1, 1); }, [loadData]);

  const handleChangeLimit = (newLimit) => {
    setPageLimit(newLimit);
    setProfessoresPage((current) => ({ ...current, page: 1, limit: newLimit }));
    setLinksPage((current) => ({ ...current, page: 1, limit: newLimit }));
  };

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 5000); };

  const handleGenerate = async (profId) => {
    try {
      const res = await apiFetch(`/api/form/generate/${profId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showMsg(data.message || 'Erro'); return; }
      showMsg('Link gerado com sucesso!');
      loadData(professoresPage.page, 1);
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/#form/${token}`;
    navigator.clipboard.writeText(url).then(() => showMsg('Link copiado!')).catch(() => showMsg(url));
  };

  const handlePreviousProfessores = () => {
    if (professoresPage.page > 1) {
      loadData(professoresPage.page - 1, linksPage.page);
    }
  };

  const handleNextProfessores = () => {
    if (professoresPage.page < professoresPage.totalPages) {
      loadData(professoresPage.page + 1, linksPage.page);
    }
  };

  const handlePreviousLinks = () => {
    if (linksPage.page > 1) {
      loadData(professoresPage.page, linksPage.page - 1);
    }
  };

  const handleNextLinks = () => {
    if (linksPage.page < linksPage.totalPages) {
      loadData(professoresPage.page, linksPage.page + 1);
    }
  };

  return (
    <div className="prof-page">
      <Toast message={msg} />

      <h3>Gerar Links de Disponibilidade</h3>
      <p className="config-hint">Gere um link unico para cada professor preencher sua disponibilidade de horarios.</p>

      <DataTable headers={['Professor', 'Email', 'Status', 'Acao']} rows={professoresPage.items} emptyText="Cadastre professores na aba Configuracao primeiro">
        {professoresPage.items.map(p => {
          const profLinks = allLinks.filter(l => l.professor_id === p.id);
          const lastLink = profLinks[0];
          const answered = lastLink?.respondido;
          return (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td>{p.email || '-'}</td>
              <td>
                {!lastLink && <Badge variant="extra">Sem link</Badge>}
                {lastLink && answered && <Badge variant="aula">Respondido</Badge>}
                {lastLink && !answered && <Badge variant="intervalo">Pendente</Badge>}
              </td>
              <td className="link-actions">
                <Button onClick={() => handleGenerate(p.id)}>
                  {lastLink ? 'Novo Link' : 'Gerar Link'}
                </Button>
                {lastLink && !answered && (
                  <Button variant="info" onClick={() => copyLink(lastLink.token)}>Copiar Link</Button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>

      <PaginationControls
        label="Professores"
        page={professoresPage.page}
        totalPages={professoresPage.totalPages}
        total={professoresPage.total}
        limit={professoresPage.limit}
        onPrevious={handlePreviousProfessores}
        onNext={handleNextProfessores}
        onLimitChange={handleChangeLimit}
      />

      {linksPage.items.length > 0 && (
        <div className="links-history">
          <h4>Historico de Links</h4>
          <DataTable headers={['Professor', 'Criado em', 'Respondido', 'Link']} rows={linksPage.items} small>
            {linksPage.items.map(l => (
              <tr key={l.id}>
                <td>{l.professor_nome}</td>
                <td>{new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                <td>{l.respondido ? new Date(l.respondido_em).toLocaleString('pt-BR') : 'Pendente'}</td>
                <td><Button variant="info" className="btn-sm" onClick={() => copyLink(l.token)}>Copiar</Button></td>
              </tr>
            ))}
          </DataTable>
          <PaginationControls
            label="Links"
            page={linksPage.page}
            totalPages={linksPage.totalPages}
            total={linksPage.total}
            limit={linksPage.limit}
            onPrevious={handlePreviousLinks}
            onNext={handleNextLinks}
            onLimitChange={handleChangeLimit}
          />
        </div>
      )}
    </div>
  );
}
