import { useState, useEffect } from 'react';
import { API_URL } from '../api';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import './ProfessorFormPage.css';

export default function ProfessorFormPage({ token }) {
  const [formData, setFormData] = useState(null);
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/form/${token}`)
      .then(r => r.json())
      .then(data => {
        setFormData(data);
        if (!data.already_answered && data.slots) {
          const initial = {};
          for (const slot of data.slots) {
            initial[slot.time_slot_id] = { disponivel: true, preferencia: 3 };
          }
          setAvailability(initial);
        }
        setLoading(false);
      })
      .catch(() => { setError('Link invalido'); setLoading(false); });
  }, [token]);

  const toggleDisponivel = (slotId) => {
    setAvailability(prev => ({
      ...prev,
      [slotId]: { ...prev[slotId], disponivel: !prev[slotId].disponivel },
    }));
  };

  const setPreferencia = (slotId, val) => {
    setAvailability(prev => ({
      ...prev,
      [slotId]: { ...prev[slotId], preferencia: val },
    }));
  };

  const handleSubmit = async () => {
    setError('');
    const disponibilidade = Object.entries(availability).map(([slotId, data]) => ({
      time_slot_id: Number(slotId),
      disponivel: data.disponivel,
      preferencia: data.preferencia,
    }));
    try {
      const res = await fetch(`${API_URL}/api/form/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disponibilidade }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message || 'Erro ao enviar');
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError('Erro de conexao');
    }
  };

  if (loading) return <div className="form-page"><Spinner /></div>;
  if (error && !formData) return <div className="form-page"><div className="form-error">{error}</div></div>;
  if (formData?.already_answered || submitted) {
    return (
      <div className="form-page">
        <div className="form-success">
          <h2>Obrigado, {formData?.professor_nome}!</h2>
          <p>Sua disponibilidade ja foi registrada com sucesso.</p>
        </div>
      </div>
    );
  }

  const turnoGroups = {};
  for (const slot of formData.slots) {
    if (!turnoGroups[slot.turno_nome]) turnoGroups[slot.turno_nome] = [];
    turnoGroups[slot.turno_nome].push(slot);
  }

  const dias = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta'];

  return (
    <div className="form-page">
      <div className="form-header">
        <h2>Disponibilidade - {formData.professor_nome}</h2>
        <p>Marque os horarios em que voce esta disponivel e sua preferencia (1-5).</p>
        <p className="form-legend">
          <span className="legend-available">Disponivel</span>
          <span className="legend-unavailable">Indisponivel</span>
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}

      {Object.entries(turnoGroups).map(([turnoNome, slots]) => {
        const periodos = [...new Set(slots.map(s => s.periodo_numero))].sort((a, b) => a - b);
        const slotMap = {};
        for (const s of slots) {
          slotMap[`${s.dia_nome}-${s.periodo_numero}`] = s;
        }

        return (
          <div key={turnoNome} className="form-turno-section">
            <h3>Turno: {turnoNome}</h3>
            <table className="form-grid">
              <thead>
                <tr>
                  <th>Horario</th>
                  {dias.map(d => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {periodos.map(pNum => {
                  const refSlot = slots.find(s => s.periodo_numero === pNum);
                  return (
                    <tr key={pNum}>
                      <td className="periodo-cell">{refSlot?.hora_inicio?.slice(0,5)} - {refSlot?.hora_fim?.slice(0,5)}</td>
                      {dias.map(dia => {
                        const slot = slotMap[`${dia}-${pNum}`];
                        if (!slot) return <td key={dia} className="empty-cell">-</td>;
                        const av = availability[slot.time_slot_id];
                        const isAvailable = av?.disponivel;
                        return (
                          <td key={dia}
                            className={`form-slot-cell ${isAvailable ? 'slot-available' : 'slot-unavailable'}`}
                            onClick={() => toggleDisponivel(slot.time_slot_id)}>
                            <div className="slot-status">{isAvailable ? 'Sim' : 'Nao'}</div>
                            {isAvailable && (
                              <select className="pref-select"
                                value={av.preferencia}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setPreferencia(slot.time_slot_id, Number(e.target.value))}>
                                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      <Button variant="submit" onClick={handleSubmit}>Enviar Disponibilidade</Button>
    </div>
  );
}
