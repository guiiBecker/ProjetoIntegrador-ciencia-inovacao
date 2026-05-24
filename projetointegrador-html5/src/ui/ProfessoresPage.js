import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import TabBar from '../components/TabBar';
import './ProfessoresPage.css';

const TABS = [
  { key: 'professores', label: 'Professores' },
  { key: 'historico', label: 'Histórico de Links' },
];

export default function ProfessoresPage() {
  const [professores, setProfessores] = useState([]);
  const [links, setLinks] = useState([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('professores');
  const [filtroNome, setFiltroNome] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [profs, lks] = await Promise.all([
        apiJson('/api/config/professores'),
        apiJson('/api/form/links'),
      ]);
      setProfessores(profs);
      setLinks(lks);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 5000); };

  const handleGenerate = async (profId) => {
    try {
      const res = await apiFetch(`/api/form/generate/${profId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showMsg(data.message || 'Erro'); return; }
      showMsg('Link gerado com sucesso!');
      loadData();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/#form/${token}`;
    navigator.clipboard.writeText(url).then(() => showMsg('Link copiado!')).catch(() => showMsg(url));
  };

  const professorFiltrado = professores.filter(p => 
    p.nome.toLowerCase().includes(filtroNome.toLowerCase())
  );

  return (
    <div className="prof-page">
      <Toast message={msg} />

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'professores' && (
        <>
          <div className="prof-page-header">
            <div>
              <h3>Gerar Links de Disponibilidade</h3>
              <p className="config-hint">Gere um link único para cada professor preencher sua disponibilidade de horários.</p>
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
            <DataTable headers={['Professor', 'Email', 'Status', 'Ação']} rows={professorFiltrado} emptyText="Cadastre professores na aba Configuração primeiro">
              {professorFiltrado.map(p => {
                const profLinks = links.filter(l => l.professor_id === p.id);
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
      </>
      )}

      {activeTab === 'historico' && (
        <>
          <div className="prof-page-header">
            <div>
              <h3>Histórico de Links</h3>
              <p className="config-hint">Visualize todos os links gerados e seus status de resposta.</p>
            </div>
          </div>

          <div className="config-section">
            <div className="data-table-wrapper">
              {links.length > 0 ? (
                <DataTable headers={['Professor', 'Criado em', 'Respondido', 'Link']} rows={links}>
                  {links.map(l => (
                    <tr key={l.id}>
                      <td>{l.professor_nome}</td>
                      <td>{new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                      <td>{l.respondido ? new Date(l.respondido_em).toLocaleString('pt-BR') : 'Pendente'}</td>
                      <td>
                        <Button variant="info" onClick={() => copyLink(l.token)}>Copiar</Button>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              ) : (
                <p className="empty-text">Nenhum link gerado ainda.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
