import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiJson } from '../api';
import TabBar from '../components/TabBar';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import PaginationControls from '../components/PaginationControls';
import { normalizePaginatedResponse } from '../utils/pagination';
import './ConfigPage.css';

const DEFAULT_PAGE_LIMIT = 20;

const TABS = [
  { key: 'periodos', label: 'Periodos' },
  { key: 'professores', label: 'Professores' },
  { key: 'disciplinas', label: 'Disciplinas' },
  { key: 'turmas', label: 'Turmas' },
  { key: 'atribuicoes', label: 'Atribuicoes' },
];

export default function ConfigPage() {
  const [turnos, setTurnos] = useState([]);
  const [pageLimit, setPageLimit] = useState(() => DEFAULT_PAGE_LIMIT);
  const [periodos, setPeriodos] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [professores, setProfessores] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [professoresPage, setProfessoresPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [disciplinasPage, setDisciplinasPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [turmasPage, setTurmasPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [turmaDisciplinasPage, setTurmaDisciplinasPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('periodos');
  const [editingProfessorId, setEditingProfessorId] = useState(null);
  const [editingDisciplinaId, setEditingDisciplinaId] = useState(null);
  const [editingTurmaId, setEditingTurmaId] = useState(null);
  const [editingPeriodoId, setEditingPeriodoId] = useState(null);
  const [editingTdId, setEditingTdId] = useState(null);

  const [periodoForm, setPeriodoForm] = useState({ numero: '', hora_inicio: '', hora_fim: '', tipo: 'aula', turno_id: '' });
  const [profForm, setProfForm] = useState({ nome: '', email: '', carga_horaria_max: 40 });
  const [discForm, setDiscForm] = useState({ nome: '', sigla: '', peso: 1 });
  const [turmaForm, setTurmaForm] = useState({ nome: '', serie: '', ano_letivo: new Date().getFullYear(), turno_id: '' });
  const [tdForm, setTdForm] = useState({ turma_id: '', disciplina_id: '', professor_id: '', aulas_semana: '', tamanho_bloco: 1 });

  const loadReferenceData = useCallback(async () => {
    try {
      const [t, pr, d, tu] = await Promise.all([
        apiJson('/api/config/turnos'),
        apiJson('/api/config/professores'),
        apiJson('/api/config/disciplinas'),
        apiJson('/api/config/turmas'),
      ]);
      setTurnos(t);
      setProfessores(pr);
      setDisciplinas(d);
      setTurmas(tu);
    } catch (err) { console.error(err); }
  }, []);

  const loadPeriodosPage = useCallback(async (page = 1) => {
    try {
      const data = await apiJson(`/api/config/periodos?page=${page}&limit=${pageLimit}`);
      setPeriodos(normalizePaginatedResponse(data, pageLimit));
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  const loadProfessoresPage = useCallback(async (page = 1) => {
    try {
      const data = await apiJson(`/api/config/professores?page=${page}&limit=${pageLimit}`);
      setProfessoresPage(normalizePaginatedResponse(data, pageLimit));
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  const loadDisciplinasPage = useCallback(async (page = 1) => {
    try {
      const data = await apiJson(`/api/config/disciplinas?page=${page}&limit=${pageLimit}`);
      setDisciplinasPage(normalizePaginatedResponse(data, pageLimit));
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  const loadTurmasPage = useCallback(async (page = 1) => {
    try {
      const data = await apiJson(`/api/config/turmas?page=${page}&limit=${pageLimit}`);
      setTurmasPage(normalizePaginatedResponse(data, pageLimit));
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  const loadTurmaDisciplinasPage = useCallback(async (page = 1) => {
    try {
      const data = await apiJson(`/api/config/turma-disciplinas?page=${page}&limit=${pageLimit}`);
      setTurmaDisciplinasPage(normalizePaginatedResponse(data, pageLimit));
    } catch (err) { console.error(err); }
  }, [pageLimit]);

  const refreshAllData = useCallback(async () => {
    await Promise.all([
      loadReferenceData(),
      loadPeriodosPage(periodos.page),
      loadProfessoresPage(professoresPage.page),
      loadDisciplinasPage(disciplinasPage.page),
      loadTurmasPage(turmasPage.page),
      loadTurmaDisciplinasPage(turmaDisciplinasPage.page),
    ]);
  }, [
    loadReferenceData,
    loadPeriodosPage,
    loadProfessoresPage,
    loadDisciplinasPage,
    loadTurmasPage,
    loadTurmaDisciplinasPage,
    periodos.page,
    professoresPage.page,
    disciplinasPage.page,
    turmasPage.page,
    turmaDisciplinasPage.page,
  ]);

  const handleChangeLimit = (newLimit) => {
    setPageLimit(newLimit);
    setPeriodos((current) => ({ ...current, page: 1, limit: newLimit }));
    setProfessoresPage((current) => ({ ...current, page: 1, limit: newLimit }));
    setDisciplinasPage((current) => ({ ...current, page: 1, limit: newLimit }));
    setTurmasPage((current) => ({ ...current, page: 1, limit: newLimit }));
    setTurmaDisciplinasPage((current) => ({ ...current, page: 1, limit: newLimit }));
  };

  const resetProfessorForm = () => {
    setProfForm({ nome: '', email: '', carga_horaria_max: 40 });
    setEditingProfessorId(null);
  };

  const resetDisciplinaForm = () => {
    setDiscForm({ nome: '', sigla: '', peso: 1 });
    setEditingDisciplinaId(null);
  };

  const resetTurmaForm = () => {
    setTurmaForm({ nome: '', serie: '', ano_letivo: new Date().getFullYear(), turno_id: '' });
    setEditingTurmaId(null);
  };

  const resetPeriodoForm = () => {
    setPeriodoForm({ numero: '', hora_inicio: '', hora_fim: '', tipo: 'aula', turno_id: '' });
    setEditingPeriodoId(null);
  };

  const resetTdForm = () => {
    setTdForm({ turma_id: '', disciplina_id: '', professor_id: '', aulas_semana: '', tamanho_bloco: 1 });
    setEditingTdId(null);
  };

  // Initial load only; later reloads are driven explicitly by mutations and page controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshAllData(); }, []);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleAddPeriodo = async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingPeriodoId !== null;
      const res = await apiFetch(isEditing ? `/api/config/periodos/${editingPeriodoId}` : '/api/config/periodos', {
        method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...periodoForm,
          numero: Number(periodoForm.numero),
          turno_id: Number(periodoForm.turno_id),
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      resetPeriodoForm();
      showMsg(isEditing ? 'Periodo atualizado!' : 'Periodo adicionado!');
      refreshAllData();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleEditPeriodo = (periodo) => {
    setPeriodoForm({
      numero: periodo.numero ?? '',
      hora_inicio: periodo.hora_inicio?.slice(0, 5) || '',
      hora_fim: periodo.hora_fim?.slice(0, 5) || '',
      tipo: periodo.tipo || 'aula',
      turno_id: periodo.turno_id ?? '',
    });
    setEditingPeriodoId(periodo.id);
    setActiveTab('periodos');
  };

  const handleCancelPeriodoEdit = () => {
    resetPeriodoForm();
  };

  const handleDeletePeriodo = async (id) => {
    try {
      await apiFetch(`/api/config/periodos/${id}`, { method: 'DELETE' });
      refreshAllData();
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
      const isEditing = editingProfessorId !== null;
      const res = await apiFetch(isEditing ? `/api/config/professores/${editingProfessorId}` : '/api/config/professores', {
        method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profForm,
          carga_horaria_max: Number(profForm.carga_horaria_max || 40),
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      resetProfessorForm();
      showMsg(isEditing ? 'Professor atualizado!' : 'Professor adicionado!');
      refreshAllData();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleEditProfessor = (professor) => {
    setProfForm({
      nome: professor.nome || '',
      email: professor.email || '',
      carga_horaria_max: professor.carga_horaria_max ?? 40,
    });
    setEditingProfessorId(professor.id);
    setActiveTab('professores');
  };

  const handleCancelProfessorEdit = () => {
    resetProfessorForm();
  };

  const handleDeleteProfessor = async (id) => {
    try {
      await apiFetch(`/api/config/professores/${id}`, { method: 'DELETE' });
      refreshAllData();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleAddDisciplina = async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingDisciplinaId !== null;
      const res = await apiFetch(isEditing ? `/api/config/disciplinas/${editingDisciplinaId}` : '/api/config/disciplinas', {
        method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...discForm,
          peso: Number(discForm.peso || 1),
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      resetDisciplinaForm();
      showMsg(isEditing ? 'Disciplina atualizada!' : 'Disciplina adicionada!');
      refreshAllData();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleEditDisciplina = (disciplina) => {
    setDiscForm({
      nome: disciplina.nome || '',
      sigla: disciplina.sigla || '',
      peso: disciplina.peso ?? 1,
    });
    setEditingDisciplinaId(disciplina.id);
    setActiveTab('disciplinas');
  };

  const handleCancelDisciplinaEdit = () => {
    resetDisciplinaForm();
  };

  const handleDeleteDisciplina = async (id) => {
    try {
      await apiFetch(`/api/config/disciplinas/${id}`, { method: 'DELETE' });
      refreshAllData();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleAddTurma = async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingTurmaId !== null;
      const res = await apiFetch(isEditing ? `/api/config/turmas/${editingTurmaId}` : '/api/config/turmas', {
        method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...turmaForm,
          ano_letivo: Number(turmaForm.ano_letivo),
          turno_id: Number(turmaForm.turno_id),
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      resetTurmaForm();
      showMsg(isEditing ? 'Turma atualizada!' : 'Turma adicionada!');
      refreshAllData();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleEditTurma = (turma) => {
    setTurmaForm({
      nome: turma.nome || '',
      serie: turma.serie || '',
      ano_letivo: turma.ano_letivo ?? new Date().getFullYear(),
      turno_id: turma.turno_id ?? '',
    });
    setEditingTurmaId(turma.id);
    setActiveTab('turmas');
  };

  const handleCancelTurmaEdit = () => {
    resetTurmaForm();
  };

  const handleDeleteTurma = async (id) => {
    try {
      await apiFetch(`/api/config/turmas/${id}`, { method: 'DELETE' });
      refreshAllData();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handleAddTD = async (e) => {
    e.preventDefault();
    try {
      const isEditing = editingTdId !== null;
      const res = await apiFetch(isEditing ? `/api/config/turma-disciplinas/${editingTdId}` : '/api/config/turma-disciplinas', {
        method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turma_id: Number(tdForm.turma_id),
          disciplina_id: Number(tdForm.disciplina_id),
          professor_id: Number(tdForm.professor_id),
          aulas_semana: Number(tdForm.aulas_semana),
          tamanho_bloco: Number(tdForm.tamanho_bloco),
        }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      resetTdForm();
      showMsg(isEditing ? 'Atribuição atualizada!' : 'Atribuição adicionada!');
      refreshAllData();
    } catch (err) { showMsg('Erro de conexao'); }
  };

  const handleEditTD = (td) => {
    setTdForm({
      turma_id: td.turma_id ?? '',
      disciplina_id: td.disciplina_id ?? '',
      professor_id: td.professor_id ?? '',
      aulas_semana: td.aulas_semana ?? '',
      tamanho_bloco: td.tamanho_bloco ?? 1,
    });
    setEditingTdId(td.id);
    setActiveTab('atribuicoes');
  };

  const handleCancelTDEdit = () => {
    resetTdForm();
  };

  const handleDeleteTD = async (id) => {
    try {
      await apiFetch(`/api/config/turma-disciplinas/${id}`, { method: 'DELETE' });
      refreshAllData();
    } catch (err) { showMsg('Erro ao remover'); }
  };

  const handlePeriodosPrevious = () => {
    if (periodos.page > 1) {
      const nextPage = periodos.page - 1;
      setPeriodos((current) => ({ ...current, page: nextPage }));
      loadPeriodosPage(nextPage);
    }
  };

  const handlePeriodosNext = () => {
    if (periodos.page < periodos.totalPages) {
      const nextPage = periodos.page + 1;
      setPeriodos((current) => ({ ...current, page: nextPage }));
      loadPeriodosPage(nextPage);
    }
  };

  const handleProfessoresPrevious = () => {
    if (professoresPage.page > 1) {
      const nextPage = professoresPage.page - 1;
      setProfessoresPage((current) => ({ ...current, page: nextPage }));
      loadProfessoresPage(nextPage);
    }
  };

  const handleProfessoresNext = () => {
    if (professoresPage.page < professoresPage.totalPages) {
      const nextPage = professoresPage.page + 1;
      setProfessoresPage((current) => ({ ...current, page: nextPage }));
      loadProfessoresPage(nextPage);
    }
  };

  const handleDisciplinasPrevious = () => {
    if (disciplinasPage.page > 1) {
      const nextPage = disciplinasPage.page - 1;
      setDisciplinasPage((current) => ({ ...current, page: nextPage }));
      loadDisciplinasPage(nextPage);
    }
  };

  const handleDisciplinasNext = () => {
    if (disciplinasPage.page < disciplinasPage.totalPages) {
      const nextPage = disciplinasPage.page + 1;
      setDisciplinasPage((current) => ({ ...current, page: nextPage }));
      loadDisciplinasPage(nextPage);
    }
  };

  const handleTurmasPrevious = () => {
    if (turmasPage.page > 1) {
      const nextPage = turmasPage.page - 1;
      setTurmasPage((current) => ({ ...current, page: nextPage }));
      loadTurmasPage(nextPage);
    }
  };

  const handleTurmasNext = () => {
    if (turmasPage.page < turmasPage.totalPages) {
      const nextPage = turmasPage.page + 1;
      setTurmasPage((current) => ({ ...current, page: nextPage }));
      loadTurmasPage(nextPage);
    }
  };

  const handleTDPrevious = () => {
    if (turmaDisciplinasPage.page > 1) {
      const nextPage = turmaDisciplinasPage.page - 1;
      setTurmaDisciplinasPage((current) => ({ ...current, page: nextPage }));
      loadTurmaDisciplinasPage(nextPage);
    }
  };

  const handleTDNext = () => {
    if (turmaDisciplinasPage.page < turmaDisciplinasPage.totalPages) {
      const nextPage = turmaDisciplinasPage.page + 1;
      setTurmaDisciplinasPage((current) => ({ ...current, page: nextPage }));
      loadTurmaDisciplinasPage(nextPage);
    }
  };

  return (
    <div className="config-page">
      <Toast message={msg} />

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'periodos' && (
        <div className="config-section">
          <h3>Horarios da Escola (Periodos)</h3>
          <p className="config-hint">Configure os horarios de aula, intervalo e periodos extras para cada turno.</p>
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
            <Button type="submit">{editingPeriodoId ? 'Salvar edição' : 'Adicionar'}</Button>
            {editingPeriodoId && <Button type="button" variant="warning" onClick={handleCancelPeriodoEdit}>Cancelar</Button>}
          </form>
          <Button variant="warning" onClick={handleRegenerateSlots} style={{ marginBottom: '1rem' }}>Regenerar Time Slots</Button>
          <DataTable headers={['Turno', 'N', 'Inicio', 'Fim', 'Tipo', '']} rows={periodos.items} emptyText="Nenhum periodo cadastrado">
            {periodos.items.map(p => (
              <tr key={p.id} className={p.tipo !== 'aula' ? 'row-intervalo' : ''}>
                <td>{p.turno_nome}</td>
                <td>{p.numero}</td>
                <td>{p.hora_inicio?.slice(0,5)}</td>
                <td>{p.hora_fim?.slice(0,5)}</td>
                <td><Badge variant={p.tipo}>{p.tipo}</Badge></td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="button" variant="info" onClick={() => handleEditPeriodo(p)}>Editar</Button>
                  <Button type="button" variant="danger" onClick={() => handleDeletePeriodo(p.id)}>Deletar</Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <PaginationControls
            label="Períodos"
            page={periodos.page}
            totalPages={periodos.totalPages}
            total={periodos.total}
            limit={periodos.limit}
            onPrevious={handlePeriodosPrevious}
            onNext={handlePeriodosNext}
            onLimitChange={handleChangeLimit}
          />
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
            <Button type="submit">{editingProfessorId ? 'Salvar edição' : 'Adicionar'}</Button>
            {editingProfessorId && <Button type="button" variant="warning" onClick={handleCancelProfessorEdit}>Cancelar</Button>}
          </form>
          <DataTable headers={['Nome', 'Email', 'Carga Max', '']} rows={professoresPage.items} emptyText="Nenhum professor cadastrado">
            {professoresPage.items.map(p => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.email || '-'}</td>
                <td>{p.carga_horaria_max}h</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="button" variant="info" onClick={() => handleEditProfessor(p)}>Editar</Button>
                  <Button type="button" variant="danger" onClick={() => handleDeleteProfessor(p.id)}>Deletar</Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <PaginationControls
            label="Professores"
            page={professoresPage.page}
            totalPages={professoresPage.totalPages}
            total={professoresPage.total}
            limit={professoresPage.limit}
            onPrevious={handleProfessoresPrevious}
            onNext={handleProfessoresNext}
            onLimitChange={handleChangeLimit}
          />
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
            <Button type="submit">{editingDisciplinaId ? 'Salvar edição' : 'Adicionar'}</Button>
            {editingDisciplinaId && <Button type="button" variant="warning" onClick={handleCancelDisciplinaEdit}>Cancelar</Button>}
          </form>
          <DataTable headers={['Nome', 'Sigla', 'Peso', '']} rows={disciplinasPage.items} emptyText="Nenhuma disciplina cadastrada">
            {disciplinasPage.items.map(d => (
              <tr key={d.id}>
                <td>{d.nome}</td>
                <td>{d.sigla || '-'}</td>
                <td>{d.peso}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="button" variant="info" onClick={() => handleEditDisciplina(d)}>Editar</Button>
                  <Button type="button" variant="danger" onClick={() => handleDeleteDisciplina(d.id)}>Deletar</Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <PaginationControls
            label="Disciplinas"
            page={disciplinasPage.page}
            totalPages={disciplinasPage.totalPages}
            total={disciplinasPage.total}
            limit={disciplinasPage.limit}
            onPrevious={handleDisciplinasPrevious}
            onNext={handleDisciplinasNext}
            onLimitChange={handleChangeLimit}
          />
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
            <Button type="submit">{editingTurmaId ? 'Salvar edição' : 'Adicionar'}</Button>
            {editingTurmaId && <Button type="button" variant="warning" onClick={handleCancelTurmaEdit}>Cancelar</Button>}
          </form>
          <DataTable headers={['Nome', 'Serie', 'Ano', 'Turno', '']} rows={turmasPage.items} emptyText="Nenhuma turma cadastrada">
            {turmasPage.items.map(t => (
              <tr key={t.id}>
                <td>{t.nome}</td>
                <td>{t.serie}</td>
                <td>{t.ano_letivo}</td>
                <td>{t.turno_nome}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="button" variant="info" onClick={() => handleEditTurma(t)}>Editar</Button>
                  <Button type="button" variant="danger" onClick={() => handleDeleteTurma(t.id)}>Deletar</Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <PaginationControls
            label="Turmas"
            page={turmasPage.page}
            totalPages={turmasPage.totalPages}
            total={turmasPage.total}
            limit={turmasPage.limit}
            onPrevious={handleTurmasPrevious}
            onNext={handleTurmasNext}
            onLimitChange={handleChangeLimit}
          />
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
            <Button type="submit">{editingTdId ? 'Salvar edição' : 'Adicionar'}</Button>
            {editingTdId && <Button type="button" variant="warning" onClick={handleCancelTDEdit}>Cancelar</Button>}
          </form>
          <DataTable headers={['Turma', 'Disciplina', 'Professor', 'Aulas/sem', 'Bloco', '']} rows={turmaDisciplinasPage.items} emptyText="Nenhuma atribuicao cadastrada">
            {turmaDisciplinasPage.items.map(td => (
              <tr key={td.id}>
                <td>{td.turma_nome}</td>
                <td>{td.disciplina_nome}</td>
                <td>{td.professor_nome}</td>
                <td>{td.aulas_semana}</td>
                <td>{td.tamanho_bloco}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button type="button" variant="info" onClick={() => handleEditTD(td)}>Editar</Button>
                  <Button type="button" variant="danger" onClick={() => handleDeleteTD(td.id)}>Deletar</Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <PaginationControls
            label="Atribuições"
            page={turmaDisciplinasPage.page}
            totalPages={turmaDisciplinasPage.totalPages}
            total={turmaDisciplinasPage.total}
            limit={turmaDisciplinasPage.limit}
            onPrevious={handleTDPrevious}
            onNext={handleTDNext}
            onLimitChange={handleChangeLimit}
          />
        </div>
      )}
    </div>
  );
}
