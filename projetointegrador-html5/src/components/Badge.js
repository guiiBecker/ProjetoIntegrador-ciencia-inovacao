import './Badge.css';

const VARIANT_CLASSES = {
  aula: 'badge-aula',
  intervalo: 'badge-intervalo',
  extra: 'badge-extra',
  pending: 'badge-pending',
  processing: 'badge-processing',
  completed: 'badge-completed',
  failed: 'badge-failed',
  confirmed: 'badge-confirmed',
  selected: 'badge-selected',
  score: 'badge-score',
};

export default function Badge({ variant, children }) {
  return (
    <span className={`badge ${VARIANT_CLASSES[variant] || ''}`}>
      {children}
    </span>
  );
}
