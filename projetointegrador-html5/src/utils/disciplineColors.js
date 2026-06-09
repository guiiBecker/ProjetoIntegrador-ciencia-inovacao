// Deterministic, distinct colors per discipline so each subject is easy to scan
// in the timetable. The same key (disciplina_id, falling back to sigla) always
// maps to the same hue, across every view and across reloads. Colors are derived
// in HSL from a string hash, giving readable pastel backgrounds with matching
// darker text/border — no fixed palette to run out of.

function hashString(str) {
  let hash = 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function disciplineColor(key) {
  const hue = hashString(key) % 360;
  return {
    bg: `hsl(${hue}, 70%, 93%)`,
    border: `hsl(${hue}, 55%, 70%)`,
    text: `hsl(${hue}, 60%, 30%)`,
  };
}

// Convenience: pick the most stable key available on a schedule item.
export function disciplineColorForItem(item) {
  return disciplineColor(item?.disciplina_id ?? item?.disciplina_sigla ?? '');
}
