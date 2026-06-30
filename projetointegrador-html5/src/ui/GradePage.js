import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch, apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';
import OptionCard from '../components/OptionCard';
import './GradePage.css';

// ── PDF export ─────────────────────────────────────────────────────────────────
const STRATEGY_LABELS_PDF = {
  balanced_distribution: 'Distribuição Equilibrada',
  or_tools_cpsat: 'OR-Tools (CP-SAT)',
};
function hashString(str) {
  let hash = 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// Returns [r, g, b] arrays for bg, border, text
function discColorRgb(key) {
  const hue = hashString(key) % 360;
  const hsl2rgb = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  };
  return {
    bg: hsl2rgb(hue, 70, 93),
    border: hsl2rgb(hue, 55, 70),
    text: hsl2rgb(hue, 60, 30),
  };
}

function exportSchedulePDF(option, requestId) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Group items by turma
  const groups = {};
  for (const item of option.items || []) {
    if (!groups[item.turma_nome]) groups[item.turma_nome] = [];
    groups[item.turma_nome].push(item);
  }
  const turmaNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const stratLabel = STRATEGY_LABELS_PDF[option.strategy] || option.strategy;

  turmaNames.forEach((nome, idx) => {
    if (idx > 0) doc.addPage();

    const items = groups[nome];
    const periodos = [...new Set(items.map(i => i.periodo_numero))].sort((a, b) => a - b);
    const grid = {};
    for (const item of items) grid[`${item.dia_nome}-${item.periodo_numero}`] = item;

    // Derive day order from actual dia_id values — never hardcode day names
    const diaMap = {};
    for (const item of items) {
      if (!diaMap[item.dia_nome]) diaMap[item.dia_nome] = item.dia_id;
    }
    const dias = Object.keys(diaMap).sort((a, b) => diaMap[a] - diaMap[b]);

    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 46);
    doc.text(`Grade Horária — Turma ${nome}`, margin, 12);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Versão #${requestId}  ·  ${stratLabel}`, margin, 18);

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 20, pageW - margin, 20);

    // Equal width for every day column: (usable width − horário col) ÷ number of days
    const horarioColW = 20;
    const dayColW = (pageW - margin * 2 - horarioColW) / dias.length;
    const dayColStyles = {};
    for (let i = 1; i <= dias.length; i++) dayColStyles[i] = { cellWidth: dayColW };

    // Body cells are left empty — text is drawn manually in didDrawCell to avoid
    // double-rendering. minCellHeight keeps rows tall enough for the content.
    const body = periodos.map((pNum) => {
      const ref = items.find(i => i.periodo_numero === pNum);
      const horario = ref ? (ref.hora_inicio?.slice(0, 5) ?? String(pNum)) : String(pNum);
      return [horario, ...dias.map(() => '')];
    });

    autoTable(doc, {
      startY: 23,
      margin: { left: margin, right: margin },
      head: [['Horário', ...dias]],
      body,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle',
        halign: 'center',
        lineColor: [200, 200, 200],
        lineWidth: 0.3,
        overflow: 'linebreak',
        minCellHeight: 14,
      },
      headStyles: {
        fillColor: [26, 26, 46],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: [60, 60, 60], cellWidth: horarioColW },
        ...dayColStyles,
      },
      // Set background color per discipline in parse phase
      didParseCell(data) {
        if (data.section !== 'body' || data.column.index === 0) return;
        const pNum = periodos[data.row.index];
        const dia = dias[data.column.index - 1];
        const cell = grid[`${dia}-${pNum}`];
        if (!cell?.disciplina_sigla) return;
        const c = discColorRgb(cell.disciplina_id ?? cell.disciplina_sigla ?? '');
        data.cell.styles.fillColor = c.bg;
      },
      // Draw text and accent bar manually (body is empty so no double-render)
      didDrawCell(data) {
        if (data.section !== 'body' || data.column.index === 0) return;
        const pNum = periodos[data.row.index];
        const dia = dias[data.column.index - 1];
        const cell = grid[`${dia}-${pNum}`];
        if (!cell?.disciplina_sigla) return;
        const c = discColorRgb(cell.disciplina_id ?? cell.disciplina_sigla ?? '');
        // Left-side color accent bar
        doc.setDrawColor(...c.border);
        doc.setLineWidth(1.2);
        doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        // Text: sigla (bold) + nome + professor
        const x = data.cell.x + 3;
        let y = data.cell.y + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...c.text);
        doc.text(cell.disciplina_sigla, x, y);
        y += 3.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(60, 60, 60);
        if (cell.disciplina_nome) { doc.text(cell.disciplina_nome, x, y); y += 2.8; }
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(80, 80, 80);
        if (cell.professor_nome) doc.text(cell.professor_nome, x, y);
        // Reset state
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
      },
      // Footer with page info
      didDrawPage(data) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.text(`${dateStr}  —  Grade Horária Versão #${requestId}`, margin, pageH - 5);
        doc.text(`${idx + 1}/${turmaNames.length}`, pageW - margin, pageH - 5, { align: 'right' });
      },
    });
  });

  doc.save(`grade-v${requestId}.pdf`);
}

const STRATEGY_LABELS = {
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
  const [confirmedBannerVisible, setConfirmedBannerVisible] = useState(false);
  const [activeOptionId, setActiveOptionId] = useState(null);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [preEditSnapshot, setPreEditSnapshot] = useState(null); // {optionId, items: [{id, time_slot_id}]}
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

  // Enter manual edit mode: snapshot current items, then call select API.
  const handleEditToggle = async (optionId) => {
    if (!activeRequest) return;
    const option = activeRequest.options?.find(o => o.id === optionId);
    if (!option) return;
    // Snapshot items (item_id + time_slot_id) for potential revert
    const snapshot = {
      optionId,
      items: option.items.map(i => ({ id: i.item_id, time_slot_id: i.time_slot_id })),
    };
    setPreEditSnapshot(snapshot);
    try {
      await apiFetch(`/api/schedule/${activeRequest.id}/select`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      setEditingOptionId(optionId); setSelectedItem(null); setEditError('');
    } catch (err) { console.error(err); }
  };

  // Cancel edit: restore items to pre-edit snapshot via backend, then re-fetch.
  const handleCancelEdit = async () => {
    if (preEditSnapshot && activeRequest) {
      try {
        await apiFetch(`/api/schedule/${activeRequest.id}/restore-items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionId: preEditSnapshot.optionId, items: preEditSnapshot.items }),
        });
        await fetchDetail(activeRequest.id);
      } catch (err) { console.error(err); }
    }
    setEditingOptionId(null); setSelectedItem(null); setEditError(''); setPreEditSnapshot(null);
  };

  // Save edit: exit edit mode and keep backend changes (already persisted by drag-drop).
  const handleSaveEdit = async () => {
    setEditingOptionId(null); setSelectedItem(null); setEditError(''); setPreEditSnapshot(null);
    await fetchDetail(activeRequest.id);
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
        setEditError('❌ Movimento bloqueado: só é possível trocar aulas dentro da mesma turma.');
        setSelectedItem(null);
        return;
      }
      if (isProfessorUnavailable(selectedItem.professor_id, cell.dia_id, cell.periodo_numero)
        || isProfessorUnavailable(cell.professor_id, selectedItem.dia_id, selectedItem.periodo_numero)) {
        setEditError('❌ Movimento bloqueado: professor não disponível no horário de destino.');
        setSelectedItem(null);
        return;
      }
      try {
        const res = await apiFetch(`/api/schedule/${activeRequest.id}/items/${selectedItem.item_id}/swap/${cell.item_id}`, {
          method: 'POST',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setEditError(`❌ Movimento bloqueado: ${data.message || 'conflito de horário detectado.'}`); }
        else { await fetchDetail(activeRequest.id); }
      } catch (err) { setEditError('Erro de conexão ao trocar aulas'); }
      setSelectedItem(null);
      return;
    }
    if (!selectedItem) return;
    if (selectedItem.turma_id !== turmaId) {
      setEditError('❌ Movimento bloqueado: só é possível mover aulas dentro da mesma turma.');
      setSelectedItem(null);
      return;
    }
    if (!diaId || !periodoNum) {
      setEditError('❌ Não foi possível identificar o horário de destino.');
      setSelectedItem(null);
      return;
    }
    if (selectedItem.dia_id === diaId && selectedItem.periodo_numero === periodoNum) {
      setSelectedItem(null);
      return;
    }
    if (isProfessorUnavailable(selectedItem.professor_id, diaId, periodoNum)) {
      setEditError('❌ Movimento bloqueado: professor não disponível neste horário.');
      setSelectedItem(null);
      return;
    }
    try {
      const res = await apiFetch(`/api/schedule/${activeRequest.id}/items/${selectedItem.item_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diaId, periodoNumero: periodoNum }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setEditError(`❌ Movimento bloqueado: ${data.message || 'conflito de horário detectado.'}`); }
      else { await fetchDetail(activeRequest.id); }
    } catch (err) { setEditError('Erro de conexão ao mover aula'); }
    setSelectedItem(null);
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = () => {
    if (!activeRequest) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activeRequest) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/api/schedule/${activeRequest.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setEditError(d.message || 'Erro ao deletar'); setDeleteConfirmOpen(false); setDeleteLoading(false); return; }
      setActiveRequest(null);
      setSelectedItem(null);
      setEditError('');
      setPolling(false);
      setDeleteConfirmOpen(false);
      await fetchRequests();
    } catch (err) {
      setEditError('Erro de conexão ao deletar');
      setDeleteConfirmOpen(false);
    }
    setDeleteLoading(false);
  };

  const handleExportPDF = () => {
    if (!activeRequest) return;
    const option = activeRequest.options?.find(o => o.id === activeOptionId) || activeRequest.options?.[0];
    if (!option) return;
    exportSchedulePDF(option, activeRequest.id);
  };

  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const executeSave = async () => {
    if (!activeRequest || !activeOptionId) return;
    setSaveLoading(true);
    try {
      await apiFetch(`/api/schedule/${activeRequest.id}/select`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: activeOptionId }),
      });
      const res = await apiFetch(`/api/schedule/${activeRequest.id}/confirm`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setEditError(data.message || 'Erro ao salvar'); setSaveConfirmOpen(false); setSaveLoading(false); return; }
      setSelectedItem(null); setEditError(''); setEditingOptionId(null);
      setConfirmedBannerVisible(true);
      setSaveConfirmOpen(false);
      await fetchDetail(activeRequest.id);
      await fetchRequests();
    } catch (err) { setEditError('Erro de conexão ao salvar'); setSaveConfirmOpen(false); }
    setSaveLoading(false);
  };

  // Save: if already confirmed, show overwrite confirmation first.
  const handleSave = () => {
    if (!activeRequest || !activeOptionId) return;
    if (activeRequest.status === 'confirmed') { setSaveConfirmOpen(true); return; }
    executeSave();
  };

  const statusLabel = { pending: 'Pendente', processing: 'Processando', completed: 'Concluído', failed: 'Falhou', confirmed: 'Salvo' };
  const isConfirmed = activeRequest?.status === 'confirmed';
  const canSave = (activeRequest?.status === 'completed' || activeRequest?.status === 'confirmed') && !!activeOptionId;

  return (
    <div className="grade-page">
      <div className="grade-toolbar">
        <div className="toolbar-buttons">
          <Button variant="generate" onClick={handleGenerate} disabled={loading || polling}>
            {loading ? 'Criando...' : polling ? 'Processando...' : 'Gerar Nova Grade'}
          </Button>
          <select
            id="request-select"
            className="request-select"
            value={activeRequest?.id ?? ''}
            onChange={(e) => {
              const id = Number(e.target.value);
              if (!id) return;
              setSelectedItem(null); setEditError(''); setPolling(false); setEditingOptionId(null); setConfirmedBannerVisible(false); fetchDetail(id);
            }}
          >
            <option value="" disabled>
              {requests.length ? 'Selecionar Versão' : 'Nenhuma requisição ainda'}
            </option>
            {requests.map(r => (
              <option key={r.id} value={r.id}>
                #{r.id} — {statusLabel[r.status] || r.status}{r.criado_em ? ` — ${formatRequestDate(r.criado_em)}` : ''}
              </option>
            ))}
          </select>
          <Button
            variant="pdf"
            onClick={handleExportPDF}
            disabled={!activeRequest || (activeRequest.status !== 'completed' && activeRequest.status !== 'confirmed')}
            title="Exportar PDF com todas as turmas"
          >
            Exportar PDF
          </Button>
          <Button
            variant="confirm"
            onClick={handleSave}
            disabled={!canSave}
            title="Salvar a grade do algoritmo selecionado"
          >
            Salvar Grade
          </Button>
          <Button
            variant="delete"
            onClick={handleDelete}
            disabled={!activeRequest}
            title="Deletar esta versão"
          >
            Deletar Grade
          </Button>
        </div>
        <div className="toolbar-right">
          {activeRequest && (
            <Badge variant={activeRequest.status}>{statusLabel[activeRequest.status] || activeRequest.status}</Badge>
          )}
        </div>
      </div>

      <section className="content">
          {!activeRequest && <div className="placeholder">Clique em "Gerar Nova Grade" para começar ou selecione uma requisição existente.</div>}
          {activeRequest?.status === 'processing' && <div className="placeholder"><Spinner /><p>Gerando opções de grade horária...</p></div>}
          {activeRequest?.status === 'pending' && <div className="placeholder"><p>Aguardando processamento...</p></div>}
          {activeRequest?.status === 'failed' && <div className="placeholder error"><p>Falha ao gerar grade. Verifique os dados de entrada.</p></div>}

          {activeRequest && (activeRequest.status === 'completed' || activeRequest.status === 'confirmed') && activeRequest.options && (
            <div className="options-container">
              <div className="options-header-bar">
                <h2>{isConfirmed ? `Grade Salva — Requisição #${activeRequest.id}` : `Opções de Grade — Requisição #${activeRequest.id}`}</h2>
              </div>
              {confirmedBannerVisible && (
                <div className="confirmed-banner">
                  Grade salva com sucesso na base de dados.
                  <button className="banner-close" onClick={() => setConfirmedBannerVisible(false)} title="Fechar">✕</button>
                </div>
              )}
              {editError && (
                <div className="edit-error">
                  {editError}
                  <button className="banner-close error" onClick={() => setEditError('')} title="Fechar">✕</button>
                </div>
              )}

              <div className="option-tabs" role="tablist">
                {activeRequest.options.map(opt => (
                  <button key={opt.id}
                    role="tab"
                    aria-selected={activeOptionId === opt.id}
                    className={`option-tab ${activeOptionId === opt.id ? 'active' : ''} ${editingOptionId === opt.id ? 'is-selected' : ''}`}
                    onClick={() => { setActiveOptionId(opt.id); setSelectedItem(null); setEditError(''); if (editingOptionId !== opt.id) setEditingOptionId(null); }}>
                    <span className="option-tab-label">{STRATEGY_LABELS[opt.strategy] || opt.strategy}</span>
                    {editingOptionId === opt.id && <span className="option-tab-meta">Em edição</span>}
                  </button>
                ))}
              </div>

              {activeRequest.options.filter(opt => opt.id === activeOptionId).map(opt => (
                <OptionCard key={opt.id} option={opt}
                  onEditToggle={() => handleEditToggle(opt.id)}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  isEditing={editingOptionId === opt.id}
                  editable={editingOptionId === opt.id}
                  selectedItem={selectedItem} onCellClick={handleCellClick}
                  onCellDragStart={(cell) => { setEditError(''); setSelectedItem(cell); }}
                  onCellDrop={handleCellClick}
                  onCellDragEnd={() => { setSelectedItem(null); }}
                  professorAvailability={activeRequest.professorAvailability}
                  isConfirmed={false}
                  activeTurma={activeTurmaByOption[opt.id]}
                  onTurmaChange={(turma) => {
                    setSelectedItem(null); setEditError('');
                    setActiveTurmaByOption(prev => ({ ...prev, [opt.id]: turma }));
                  }} />
              ))}
            </div>
          )}
        </section>

      {/* Save overwrite confirmation modal */}
      {saveConfirmOpen && (
        <div className="modal-overlay" onClick={() => !saveLoading && setSaveConfirmOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">💾</div>
            <h3 className="modal-title">Sobrescrever grade salva?</h3>
            <p className="modal-body">Já existe uma grade salva para esta versão. Salvar novamente irá substituir o registro atual pelo algoritmo selecionado.</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setSaveConfirmOpen(false)} disabled={saveLoading}>
                Cancelar
              </Button>
              <Button variant="confirm" onClick={executeSave} disabled={saveLoading}>
                {saveLoading ? 'Salvando...' : 'Sim, sobrescrever'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmOpen && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setDeleteConfirmOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-icon danger">🗑️</div>
            <h3 className="modal-title">Deletar Grade #{activeRequest?.id}?</h3>
            <p className="modal-body">Esta ação é permanente e não pode ser desfeita. Todas as grades geradas nesta versão serão removidas.</p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteLoading}>
                {deleteLoading ? 'Deletando...' : 'Sim, deletar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
