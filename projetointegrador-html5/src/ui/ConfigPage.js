import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import TabBar from '../components/TabBar';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import './ConfigPage.css';

const TABS = [
  { key: 'periodos', label: 'Periodos' },
  { key: 'professores', label: 'Professores' },
  { key: 'disciplinas', label: 'Disciplinas' },
  { key: 'turmas', label: 'Turmas' },
  { key: 'atribuicoes', label: 'Atribuicoes' },
];

export default function ConfigPage() {
  const [turnos, setTurnos] = useState([]);
  const [dias, setDias] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [turmaDisciplinas, setTurmaDisciplinas] = useState([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('periodos');

  const [periodoForm, setPeriodoForm] = useState({ numero: '', hora_inicio: '', hora_fim: '', tipo: 'aula', turno_id: '' });
  const [turnoForms, setTurnoForms] = useState({}); // por turno_id: regras de geracao
  const [profForm, setProfForm] = useState({ nome: '', email: '', carga_horaria_max: 40 });
  const [discForm, setDiscForm] = useState({ nome: '', sigla: '', peso: 1 });
  const [turmaForm, setTurmaForm] = useState({ nome: '', serie: '', ano_letivo: new Date().getFullYear(), turno_id: '' });
  const [tdForm, setTdForm] = useState({ turma_id: '', disciplina_id: '', professor_id: '', aulas_semana: '', tamanho_bloco: 1 });

  const loadAll = useCallback(async () => {
    try {
      const [t, dia, p, pr, d, tu, td] = await Promise.all([
        apiJson('/api/config/turnos'),
        apiJson('/api/config/dias'),
        apiJson('/api/config/periodos'),
        apiJson('/api/config/professores'),
        apiJson('/api/config/disciplinas'),
        apiJson('/api/config/turmas'),
        apiJson('/api/config/turma-disciplinas'),
      ]);
      setTurnos(t); setDias(dia); setPeriodos(p); setProfessores(pr); setDisciplinas(d); setTurmas(tu); setTurmaDisciplinas(td);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Garante uma linha de formulario com defaults para cada turno carregado.
  // Por padrao, todos os dias da semana ficam marcados.
  useEffect(() => {
    const allDiaIds = dias.map(d => d.id);
    setTurnoForms(prev => {
      const next = { ...prev };
      for (const t of turnos) {
        if (!next[t.id]) {
          next[t.id] = { hora_inicio: '', duracao_aula: 50, quantidade_aulas: 5, intervalo_apos_aula: '', duracao_intervalo: 20, dia_ids: allDiaIds };
        } else if (next[t.id].dia_ids === undefined && allDiaIds.length > 0) {
          next[t.id] = { ...next[t.id], dia_ids: allDiaIds };
        }
      }
      return next;
    });
  }, [turnos, dias]);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const setTurnoField = (turnoId, field, value) => {
    setTurnoForms(prev => ({ ...prev, [turnoId]: { ...prev[turnoId], [field]: value } }));
  };

  const toggleTurnoDia = (turnoId, diaId) => {
    setTurnoForms(prev => {
      const cur = prev[turnoId] || {};
      const set = new Set(cur.dia_ids || []);
      if (set.has(diaId)) set.delete(diaId); else set.add(diaId);
      return { ...prev, [turnoId]: { ...cur, dia_ids: Array.from(set).sort((a, b) => a - b) } };
    });
  };

  // Conta quantos periodos de aula um turno ja possui (mostrado na tabela).
  const aulasDoTurno = (turnoId) => periodos.filter(p => p.turno_id === turnoId && p.tipo === 'aula').length;

  const handleAddPeriodo = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/config/periodos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...periodoForm, numero: Number(periodoForm.numero), turno_id: Number(periodoForm.turno_id) }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      setPeriodoForm({ numero: '', hora_inicio: '', hora_fim: '', tipo: 'aula', turno_id: '' });
      showMsg('Periodo adicionado!');
      loadAll();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleGerarTurno = async (turnoId) => {
    const f = turnoForms[turnoId];
    if (!f || !f.hora_inicio) { showMsg('Informe a hora do 1o periodo.'); return; }
    if (!f.dia_ids || f.dia_ids.length === 0) { showMsg('Selecione ao menos um dia.'); return; }
    try {
      const res = await apiFetch('/api/config/periodos/gerar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: Number(turnoId),
          hora_inicio: f.hora_inicio,
          duracao_aula: Number(f.duracao_aula),
          quantidade_aulas: Number(f.quantidade_aulas),
          intervalo_apos_aula: f.intervalo_apos_aula ? Number(f.intervalo_apos_aula) : null,
          duracao_intervalo: f.duracao_intervalo ? Number(f.duracao_intervalo) : null,
          dia_ids: f.dia_ids,
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      const d = await res.json();
      showMsg(`Gerados ${d.periodos} periodos e ${d.slots} time slots.`);
      loadAll();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleDeletePeriodo = async (id) => {
    try {
      await apiFetch(`/api/config/periodos/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleRegenerateSlots = async () => {
    try {
      const res = await apiFetch('/api/config/periodos/regenerar-slots', { method: 'POST' });
      const data = await res.json();
      showMsg(`Time slots regenerados: ${data.count} criados`);
    } catch (err) { showMsg('Erro ao regenerar'); }
  };

  const handleAddProfessor = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/config/professores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profForm, carga_horaria_max: Number(profForm.carga_horaria_max) }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      setProfForm({ nome: '', email: '', carga_horaria_max: 40 });
      showMsg('Professor adicionado!');
      loadAll();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleDeleteProfessor = async (id) => {
    try {
      await apiFetch(`/api/config/professores/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleAddDisciplina = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/config/disciplinas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...discForm, peso: Number(discForm.peso) }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      setDiscForm({ nome: '', sigla: '', peso: 1 });
      showMsg('Disciplina adicionada!');
      loadAll();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleDeleteDisciplina = async (id) => {
    try {
      await apiFetch(`/api/config/disciplinas/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleAddTurma = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/config/turmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...turmaForm, ano_letivo: Number(turmaForm.ano_letivo), turno_id: Number(turmaForm.turno_id) }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      setTurmaForm({ nome: '', serie: '', ano_letivo: new Date().getFullYear(), turno_id: '' });
      showMsg('Turma adicionada!');
      loadAll();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleDeleteTurma = async (id) => {
    try {
      await apiFetch(`/api/config/turmas/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleAddTD = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/config/turma-disciplinas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turma_id: Number(tdForm.turma_id),
          disciplina_id: Number(tdForm.disciplina_id),
          professor_id: Number(tdForm.professor_id),
          aulas_semana: Number(tdForm.aulas_semana),
          tamanho_bloco: Number(tdForm.tamanho_bloco),
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      setTdForm({ turma_id: '', disciplina_id: '', professor_id: '', aulas_semana: '', tamanho_bloco: 1 });
      showMsg('Atribuicao adicionada!');
      loadAll();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleDeleteTD = async (id) => {
    try {
      await apiFetch(`/api/config/turma-disciplinas/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  return (
    <div className="config-page">
      <Toast message={msg} />

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'periodos' && (
        <div className="config-section">
          <h3>Horarios da Escola (Periodos)</h3>
          <p className="config-hint">Para cada turno, marque os dias da semana, defina a hora do 1o periodo e clique em Gerar. Os horarios sao calculados e os time slots criados apenas para os dias marcados. Gerar substitui os periodos existentes do turno.</p>

          <h4>Turnos</h4>
          <DataTable
            headers={['Turno', 'Aulas hoje', '1o inicio', 'Aulas', 'Min/aula', 'Interv. apos', 'Min interv.', 'Dias', '']}
            rows={turnos}
            emptyText="Nenhum turno"
          >
            {turnos.map(t => {
              const f = turnoForms[t.id] || {};
              const selDias = f.dia_ids || [];
              return (
                <tr key={t.id}>
                  <td>{t.nome}</td>
                  <td>{aulasDoTurno(t.id)}</td>
                  <td><input type="time" value={f.hora_inicio || ''}
                    onChange={e => setTurnoField(t.id, 'hora_inicio', e.target.value)} /></td>
                  <td><input type="number" min="1" style={{ width: '4rem' }} value={f.quantidade_aulas ?? ''}
                    onChange={e => setTurnoField(t.id, 'quantidade_aulas', e.target.value)} /></td>
                  <td><input type="number" min="1" style={{ width: '4rem' }} value={f.duracao_aula ?? ''}
                    onChange={e => setTurnoField(t.id, 'duracao_aula', e.target.value)} /></td>
                  <td><input type="number" min="1" style={{ width: '4rem' }} placeholder="-" value={f.intervalo_apos_aula ?? ''}
                    onChange={e => setTurnoField(t.id, 'intervalo_apos_aula', e.target.value)} /></td>
                  <td><input type="number" min="1" style={{ width: '4rem' }} value={f.duracao_intervalo ?? ''}
                    onChange={e => setTurnoField(t.id, 'duracao_intervalo', e.target.value)} /></td>
                  <td>
                    <div className="dias-check">
                      {dias.map(d => (
                        <label key={d.id} className="dia-check">
                          <input type="checkbox" checked={selDias.includes(d.id)}
                            onChange={() => toggleTurnoDia(t.id, d.id)} />
                          {d.nome.slice(0, 3)}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td><Button onClick={() => handleGerarTurno(t.id)}>Gerar</Button></td>
                </tr>
              );
            })}
          </DataTable>

          <h4>Periodos cadastrados</h4>
          <DataTable headers={['Turno', 'N', 'Inicio', 'Fim', 'Tipo', '']} rows={periodos} emptyText="Nenhum periodo cadastrado">
            {periodos.map(p => (
              <tr key={p.id} className={p.tipo !== 'aula' ? 'row-intervalo' : ''}>
                <td>{p.turno_nome}</td>
                <td>{p.numero}</td>
                <td>{p.hora_inicio?.slice(0,5)}</td>
                <td>{p.hora_fim?.slice(0,5)}</td>
                <td><Badge variant={p.tipo}>{p.tipo}</Badge></td>
                <td><Button variant="danger" onClick={() => handleDeletePeriodo(p.id)}>X</Button></td>
              </tr>
            ))}
          </DataTable>

          <details className="periodos-avancado">
            <summary>Ajuste fino (adicionar periodo manual / regenerar slots)</summary>
            <form className="config-form" onSubmit={handleAddPeriodo}>
              <select value={periodoForm.turno_id} onChange={e => setPeriodoForm({...periodoForm, turno_id: e.target.value})} required>
                <option value="">Turno...</option>
                {turnos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <input type="number" placeholder="Numero" value={periodoForm.numero}
                onChange={e => setPeriodoForm({...periodoForm, numero: e.target.value})} required min="1" />
              <input type="time" value={periodoForm.hora_inicio}
                onChange={e => setPeriodoForm({...periodoForm, hora_inicio: e.target.value})} required />
              <input type="time" value={periodoForm.hora_fim}
                onChange={e => setPeriodoForm({...periodoForm, hora_fim: e.target.value})} required />
              <select value={periodoForm.tipo} onChange={e => setPeriodoForm({...periodoForm, tipo: e.target.value})}>
                <option value="aula">Aula</option>
                <option value="intervalo">Intervalo</option>
                <option value="extra">Extra</option>
              </select>
              <Button type="submit">Adicionar</Button>
            </form>
            <Button variant="warning" onClick={handleRegenerateSlots}>Regenerar Time Slots</Button>
          </details>
        </div>
      )}

      {activeTab === 'professores' && (
        <div className="config-section">
          <h3>Professores</h3>
          <form className="config-form" onSubmit={handleAddProfessor}>
            <input type="text" placeholder="Nome" value={profForm.nome}
              onChange={e => setProfForm({...profForm, nome: e.target.value})} required />
            <input type="email" placeholder="Email" value={profForm.email}
              onChange={e => setProfForm({...profForm, email: e.target.value})} />
            <input type="number" placeholder="Carga max" value={profForm.carga_horaria_max}
              onChange={e => setProfForm({...profForm, carga_horaria_max: e.target.value})} min="1" />
            <Button type="submit">Adicionar</Button>
          </form>
          <DataTable headers={['Nome', 'Email', 'Carga Max', '']} rows={professores} emptyText="Nenhum professor cadastrado">
            {professores.map(p => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.email || '-'}</td>
                <td>{p.carga_horaria_max}h</td>
                <td><Button variant="danger" onClick={() => handleDeleteProfessor(p.id)}>X</Button></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {activeTab === 'disciplinas' && (
        <div className="config-section">
          <h3>Disciplinas</h3>
          <form className="config-form" onSubmit={handleAddDisciplina}>
            <input type="text" placeholder="Nome" value={discForm.nome}
              onChange={e => setDiscForm({...discForm, nome: e.target.value})} required />
            <input type="text" placeholder="Sigla (ex: MAT)" value={discForm.sigla}
              onChange={e => setDiscForm({...discForm, sigla: e.target.value})} maxLength={10} />
            <input type="number" placeholder="Peso" value={discForm.peso}
              onChange={e => setDiscForm({...discForm, peso: e.target.value})} min="1" />
            <Button type="submit">Adicionar</Button>
          </form>
          <DataTable headers={['Nome', 'Sigla', 'Peso', '']} rows={disciplinas} emptyText="Nenhuma disciplina cadastrada">
            {disciplinas.map(d => (
              <tr key={d.id}>
                <td>{d.nome}</td>
                <td>{d.sigla || '-'}</td>
                <td>{d.peso}</td>
                <td><Button variant="danger" onClick={() => handleDeleteDisciplina(d.id)}>X</Button></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {activeTab === 'turmas' && (
        <div className="config-section">
          <h3>Turmas</h3>
          <form className="config-form" onSubmit={handleAddTurma}>
            <input type="text" placeholder="Nome (ex: 1A)" value={turmaForm.nome}
              onChange={e => setTurmaForm({...turmaForm, nome: e.target.value})} required />
            <input type="text" placeholder="Serie (ex: 1 ano)" value={turmaForm.serie}
              onChange={e => setTurmaForm({...turmaForm, serie: e.target.value})} required />
            <input type="number" placeholder="Ano letivo" value={turmaForm.ano_letivo}
              onChange={e => setTurmaForm({...turmaForm, ano_letivo: e.target.value})} required />
            <select value={turmaForm.turno_id} onChange={e => setTurmaForm({...turmaForm, turno_id: e.target.value})} required>
              <option value="">Turno...</option>
              {turnos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <Button type="submit">Adicionar</Button>
          </form>
          <DataTable headers={['Nome', 'Serie', 'Ano', 'Turno', '']} rows={turmas} emptyText="Nenhuma turma cadastrada">
            {turmas.map(t => (
              <tr key={t.id}>
                <td>{t.nome}</td>
                <td>{t.serie}</td>
                <td>{t.ano_letivo}</td>
                <td>{t.turno_nome}</td>
                <td><Button variant="danger" onClick={() => handleDeleteTurma(t.id)}>X</Button></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {activeTab === 'atribuicoes' && (
        <div className="config-section">
          <h3>Atribuicoes (Turma + Disciplina + Professor)</h3>
          <form className="config-form" onSubmit={handleAddTD}>
            <select value={tdForm.turma_id} onChange={e => setTdForm({...tdForm, turma_id: e.target.value})} required>
              <option value="">Turma...</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.turno_nome})</option>)}
            </select>
            <select value={tdForm.disciplina_id} onChange={e => setTdForm({...tdForm, disciplina_id: e.target.value})} required>
              <option value="">Disciplina...</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <select value={tdForm.professor_id} onChange={e => setTdForm({...tdForm, professor_id: e.target.value})} required>
              <option value="">Professor...</option>
              {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <input type="number" placeholder="Aulas/semana" value={tdForm.aulas_semana}
              onChange={e => setTdForm({...tdForm, aulas_semana: e.target.value})} required min="1" />
            <input type="number" placeholder="Tam. bloco" value={tdForm.tamanho_bloco}
              onChange={e => setTdForm({...tdForm, tamanho_bloco: e.target.value})} min="1" />
            <Button type="submit">Adicionar</Button>
          </form>
          <DataTable headers={['Turma', 'Disciplina', 'Professor', 'Aulas/sem', 'Bloco', '']} rows={turmaDisciplinas} emptyText="Nenhuma atribuicao cadastrada">
            {turmaDisciplinas.map(td => (
              <tr key={td.id}>
                <td>{td.turma_nome}</td>
                <td>{td.disciplina_nome}</td>
                <td>{td.professor_nome}</td>
                <td>{td.aulas_semana}</td>
                <td>{td.tamanho_bloco}</td>
                <td><Button variant="danger" onClick={() => handleDeleteTD(td.id)}>X</Button></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}
