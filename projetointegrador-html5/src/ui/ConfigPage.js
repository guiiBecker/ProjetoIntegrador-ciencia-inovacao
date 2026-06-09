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
  { key: 'restricoes', label: 'Restricoes' },
];

export default function ConfigPage() {
  const [turnos, setTurnos] = useState([]);
  const [pageLimit, setPageLimit] = useState(() => DEFAULT_PAGE_LIMIT);
  const [dias, setDias] = useState([]);
  const [periodos, setPeriodos] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [professores, setProfessores] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [professoresPage, setProfessoresPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [disciplinasPage, setDisciplinasPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [turmasPage, setTurmasPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [turmaDisciplinasPage, setTurmaDisciplinasPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [softConstraints, setSoftConstraints] = useState([]);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('periodos');
  const [editingProfessorId, setEditingProfessorId] = useState(null);
  const [editingDisciplinaId, setEditingDisciplinaId] = useState(null);
  const [editingTurmaId, setEditingTurmaId] = useState(null);
  const [editingPeriodoId, setEditingPeriodoId] = useState(null);
  const [editingTdId, setEditingTdId] = useState(null);

  const [periodoForm, setPeriodoForm] = useState({ numero: '', hora_inicio: '', hora_fim: '', tipo: 'aula', turno_id: '' });
  const [turnoForms, setTurnoForms] = useState({}); // por turno_id: regras de geracao
  const [profForm, setProfForm] = useState({ nome: '', email: '', carga_horaria_max: 40 });
  const [discForm, setDiscForm] = useState({ nome: '', sigla: '', peso: 1 });
  const [turmaForm, setTurmaForm] = useState({ nome: '', serie: '', ano_letivo: new Date().getFullYear(), turno_id: '' });
  const [tdForm, setTdForm] = useState({ turma_id: '', disciplina_id: '', professor_id: '', aulas_semana: '', tamanho_bloco: 1 });

  const loadReferenceData = useCallback(async () => {
    try {
      const [t, dia, pr, d, tu] = await Promise.all([
        apiJson('/api/config/turnos'),
        apiJson('/api/config/dias'),
        apiJson('/api/config/professores'),
        apiJson('/api/config/disciplinas'),
        apiJson('/api/config/turmas'),
      ]);
      setTurnos(t);
      setDias(dia);
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

  const loadSoftConstraints = useCallback(async () => {
    try {
      const data = await apiJson('/api/config/soft-constraints');
      setSoftConstraints(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  }, []);

  const refreshAllData = useCallback(async () => {
    await Promise.all([
      loadReferenceData(),
      loadPeriodosPage(periodos.page),
      loadProfessoresPage(professoresPage.page),
      loadDisciplinasPage(disciplinasPage.page),
      loadTurmasPage(turmasPage.page),
      loadTurmaDisciplinasPage(turmaDisciplinasPage.page),
      loadSoftConstraints(),
    ]);
  }, [
    loadReferenceData,
    loadPeriodosPage,
    loadProfessoresPage,
    loadDisciplinasPage,
    loadTurmasPage,
    loadTurmaDisciplinasPage,
    loadSoftConstraints,
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
  const aulasDoTurno = (turnoId) => periodos.items.filter(p => p.turno_id === turnoId && p.tipo === 'aula').length;

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

  const setSoftConstraintPeso = (codigo, peso) => {
    setSoftConstraints((current) =>
      current.map((sc) => (sc.codigo === codigo ? { ...sc, peso } : sc)),
    );
  };

  const handleSaveSoftConstraints = async () => {
    const items = softConstraints.map((sc) => ({ codigo: sc.codigo, peso: Number(sc.peso) }));
    if (items.some((it) => !Number.isFinite(it.peso) || it.peso < 0)) {
      showMsg('Pesos devem ser numeros maiores ou iguais a zero.');
      return;
    }
    try {
      const res = await apiFetch('/api/config/soft-constraints', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.message || 'Erro'); return; }
      const data = await res.json();
      if (Array.isArray(data)) setSoftConstraints(data);
      showMsg('Pesos das restricoes salvos!');
    } catch (err) { showMsg('Erro de conexao'); }
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
        <div className="config-section config-section--stacked">
          <h3>Horarios da Escola (Periodos)</h3>
          <p className="config-hint">Para cada turno, marque os dias da semana, defina a hora do 1o periodo e clique em Gerar. Os horarios sao calculados e os time slots criados apenas para os dias marcados. Gerar substitui os periodos existentes do turno.</p>

          <div className="periodos-block">
            <h4>Turnos</h4>
            <div className="data-table-wrapper">
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
            </div>
          </div>

          <div className="periodos-block">
            <div className="periodos-block-header">
              <h4>Periodos cadastrados</h4>
              <Button variant="warning" onClick={handleRegenerateSlots}>Regenerar Time Slots</Button>
            </div>
            <div className="data-table-wrapper">
              <DataTable headers={['Turno', 'N', 'Inicio', 'Fim', 'Tipo', '']} rows={periodos.items} emptyText="Nenhum periodo cadastrado">
                {periodos.items.map(p => (
                  <tr key={p.id} className={p.tipo !== 'aula' ? 'row-intervalo' : ''}>
                    <td>{p.turno_nome}</td>
                    <td>{p.numero}</td>
                    <td>{p.hora_inicio?.slice(0,5)}</td>
                    <td>{p.hora_fim?.slice(0,5)}</td>
                    <td><Badge variant={p.tipo}>{p.tipo}</Badge></td>
                    <td>
                      <Button type="button" variant="danger" onClick={() => handleDeletePeriodo(p.id)}>Deletar</Button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'professores' && (
        <div className="config-section">
          <h3>Professores</h3>
          <div className="config-form-wrapper">
            <form className="config-form" onSubmit={handleAddProfessor}>
              <label>Nome</label>
              <input type="text" placeholder="Nome completo" value={profForm.nome}
                onChange={e => setProfForm({...profForm, nome: e.target.value})} required />
              <label>Email</label>
              <input type="email" placeholder="email@exemplo.com" value={profForm.email}
                onChange={e => setProfForm({...profForm, email: e.target.value})} />
              <label>Carga Máxima (horas)</label>
              <input type="number" placeholder="40" value={profForm.carga_horaria_max}
                onChange={e => setProfForm({...profForm, carga_horaria_max: e.target.value})} min="1" />
              <Button type="submit">Adicionar</Button>
            </form>
          </div>
          <div className="data-table-wrapper">
            <DataTable headers={['Nome', 'Email', 'Carga Max', '']} rows={professores} emptyText="Nenhum professor cadastrado">
            {professores.map(p => (
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
          </div>
        </div>
      )}

      {activeTab === 'disciplinas' && (
        <div className="config-section">
          <h3>Disciplinas</h3>
          <div className="config-form-wrapper">
            <form className="config-form" onSubmit={handleAddDisciplina}>
              <label>Nome</label>
              <input type="text" placeholder="Ex: Matemática" value={discForm.nome}
                onChange={e => setDiscForm({...discForm, nome: e.target.value})} required />
              <label>Sigla</label>
              <input type="text" placeholder="Ex: MAT" value={discForm.sigla}
                onChange={e => setDiscForm({...discForm, sigla: e.target.value})} maxLength={10} />
              <label>Peso</label>
              <input type="number" placeholder="1" value={discForm.peso}
                onChange={e => setDiscForm({...discForm, peso: e.target.value})} min="1" />
              <Button type="submit">Adicionar</Button>
            </form>
          </div>
          <div className="data-table-wrapper">
            <DataTable headers={['Nome', 'Sigla', 'Peso', '']} rows={disciplinas} emptyText="Nenhuma disciplina cadastrada">
            {disciplinas.map(d => (
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
          </div>
        </div>
      )}

      {activeTab === 'turmas' && (
        <div className="config-section">
          <h3>Turmas</h3>
          <div className="config-form-wrapper">
            <form className="config-form" onSubmit={handleAddTurma}>
              <label>Nome</label>
              <input type="text" placeholder="Ex: 1A" value={turmaForm.nome}
                onChange={e => setTurmaForm({...turmaForm, nome: e.target.value})} required />
              <label>Série</label>
              <input type="text" placeholder="Ex: 1º ano" value={turmaForm.serie}
                onChange={e => setTurmaForm({...turmaForm, serie: e.target.value})} required />
              <label>Ano Letivo</label>
              <input type="number" placeholder="2024" value={turmaForm.ano_letivo}
                onChange={e => setTurmaForm({...turmaForm, ano_letivo: e.target.value})} required />
              <label>Turno</label>
              <select value={turmaForm.turno_id} onChange={e => setTurmaForm({...turmaForm, turno_id: e.target.value})} required>
                <option value="">Selecione...</option>
                {turnos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <Button type="submit">Adicionar</Button>
            </form>
          </div>
          <div className="data-table-wrapper">
            <DataTable headers={['Nome', 'Serie', 'Ano', 'Turno', '']} rows={turmas} emptyText="Nenhuma turma cadastrada">
            {turmas.map(t => (
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
          </div>
        </div>
      )}

      {activeTab === 'atribuicoes' && (
        <div className="config-section">
          <h3>Atribuicoes (Turma + Disciplina + Professor)</h3>
          <div className="config-form-wrapper">
            <form className="config-form" onSubmit={handleAddTD}>
              <label>Turma</label>
              <select value={tdForm.turma_id} onChange={e => setTdForm({...tdForm, turma_id: e.target.value})} required>
                <option value="">Selecione...</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.turno_nome})</option>)}
              </select>
              <label>Disciplina</label>
              <select value={tdForm.disciplina_id} onChange={e => setTdForm({...tdForm, disciplina_id: e.target.value})} required>
                <option value="">Selecione...</option>
                {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
              <label>Professor</label>
              <select value={tdForm.professor_id} onChange={e => setTdForm({...tdForm, professor_id: e.target.value})} required>
                <option value="">Selecione...</option>
                {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <label>Aulas por Semana</label>
              <input type="number" placeholder="2, 3, 4..." value={tdForm.aulas_semana}
                onChange={e => setTdForm({...tdForm, aulas_semana: e.target.value})} required min="1" />
              <label>Tamanho do Bloco</label>
              <input type="number" placeholder="1" value={tdForm.tamanho_bloco}
                onChange={e => setTdForm({...tdForm, tamanho_bloco: e.target.value})} min="1" />
              <Button type="submit">Adicionar</Button>
            </form>
          </div>
          <div className="data-table-wrapper">
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
          </div>
        </div>
      )}

      {activeTab === 'restricoes' && (
        <div className="config-section config-section--stacked">
          <h3>Restricoes Soft (pesos do gerador)</h3>
          <p className="config-hint">
            Ajuste a importancia de cada restricao soft usada ao gerar a grade. Peso maior
            torna a restricao mais forte; peso 0 a desativa. As mudancas valem para as
            proximas geracoes de grade.
          </p>
          <div className="data-table-wrapper">
            <DataTable
              headers={['Codigo', 'Restricao', 'Descricao', 'Peso']}
              rows={softConstraints}
              emptyText="Nenhuma restricao cadastrada"
            >
              {softConstraints.map((sc) => (
                <tr key={sc.codigo}>
                  <td>{sc.codigo}</td>
                  <td>{sc.nome}</td>
                  <td>{sc.descricao}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      style={{ width: '5rem' }}
                      value={sc.peso}
                      onChange={(e) => setSoftConstraintPeso(sc.codigo, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
          <div>
            <Button onClick={handleSaveSoftConstraints}>Salvar pesos</Button>
          </div>
        </div>
      )}
    </div>
  );
}
