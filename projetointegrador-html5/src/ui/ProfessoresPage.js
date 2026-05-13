import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import './ProfessoresPage.css';

export default function ProfessoresPage() {
  const [professores, setProfessores] = useState([]);
  const [links, setLinks] = useState([]);
  const [msg, setMsg] = useState('');

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

  return (
    <div className="prof-page">
      <Toast message={msg} />

      <h3>Gerar Links de Disponibilidade</h3>
      <p className="config-hint">Gere um link unico para cada professor preencher sua disponibilidade de horarios.</p>

      <DataTable headers={['Professor', 'Email', 'Status', 'Acao']} rows={professores} emptyText="Cadastre professores na aba Configuracao primeiro">
        {professores.map(p => {
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

      {links.length > 0 && (
        <div className="links-history">
          <h4>Historico de Links</h4>
          <DataTable headers={['Professor', 'Criado em', 'Respondido', 'Link']} rows={links} small>
            {links.map(l => (
              <tr key={l.id}>
                <td>{l.professor_nome}</td>
                <td>{new Date(l.criado_em).toLocaleString('pt-BR')}</td>
                <td>{l.respondido ? new Date(l.respondido_em).toLocaleString('pt-BR') : 'Pendente'}</td>
                <td><Button variant="info" className="btn-sm" onClick={() => copyLink(l.token)}>Copiar</Button></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
