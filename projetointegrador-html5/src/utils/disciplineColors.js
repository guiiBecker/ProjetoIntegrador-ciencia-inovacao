// Fixed color palette grouped by subject area.
// Each sigla maps to { bg, border, text } using the design system ramps:
//   Humanas   → âmbar   (FIL/HIS/SOC)
//   Linguagens→ roxo    (PORT/LIT/RED/ING)
//   Natureza  → teal    (BIO/QUI/FIS)
//   Exatas    → azul    (MAT/COMP)
//   Geografia → verde   (GEO)
//   Corpo/Art → coral   (EDF/ART/MUS)

const PALETTE = {
  // Humanas — âmbar (tons pastéis, máx. âmbar 100)
  FIL:  { bg: '#FAEEDA', border: '#FAC775', text: '#854F0B' },
  HIS:  { bg: '#FAE0A8', border: '#EF9F27', text: '#633806' },
  SOC:  { bg: '#FAD59A', border: '#EF9F27', text: '#633806' },
  FIL2: { bg: '#FAEEDA', border: '#FAC775', text: '#854F0B' }, // alias

  // Linguagens — roxo/lilás (todos deslocados para tons mais claros)
  PORT: { bg: '#F2F1FF', border: '#AFA9EC', text: '#3C3489' },
  LIT:  { bg: '#EEEDFE', border: '#7F77DD', text: '#3C3489' },
  RED:  { bg: '#DDDCFC', border: '#AFA9EC', text: '#3C3489' },
  ING:  { bg: '#CECBF6', border: '#7F77DD', text: '#26215C' },

  // Ciências da natureza — teal (máx. teal 100)
  BIO:  { bg: '#E1F5EE', border: '#1D9E75', text: '#085041' },
  QUI:  { bg: '#C8EDDF', border: '#5DCAA5', text: '#0F6E56' },
  FIS:  { bg: '#9FE1CB', border: '#1D9E75', text: '#085041' },

  // Ciências exatas — azul (inalterado, já estava claro)
  MAT:  { bg: '#E6F1FB', border: '#85B7EB', text: '#0C447C' },
  COMP: { bg: '#C8DEFA', border: '#378ADD', text: '#0C447C' },
  INFO: { bg: '#C8DEFA', border: '#378ADD', text: '#0C447C' },

  // Geografia — verde (um tom mais claro)
  GEO:  { bg: '#D4EBB0', border: '#97C459', text: '#27500A' },

  // Corpo & artes — coral/rosa (inalterado, já estava claro)
  EDF:  { bg: '#FAECE7', border: '#F0997B', text: '#993C1D' },
  ART:  { bg: '#F5C4B3', border: '#D85A30', text: '#712B13' },
  MUS:  { bg: '#FBEAF0', border: '#ED93B1', text: '#72243E' },
};

// Fallback: derive a readable color from a string hash (same approach as before)
// so that any discipline not in the palette still gets a consistent color.
function hashString(str) {
  let hash = 0;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function fallbackColor(key) {
  const hue = hashString(key) % 360;
  return {
    bg: `hsl(${hue}, 55%, 92%)`,
    border: `hsl(${hue}, 45%, 65%)`,
    text: `hsl(${hue}, 55%, 28%)`,
  };
}

export function disciplineColor(key) {
  // Try matching by sigla (uppercase, strip numbers/spaces).
  const sigla = String(key ?? '').toUpperCase().trim();
  if (PALETTE[sigla]) return PALETTE[sigla];
  return fallbackColor(key);
}

// Convenience: pick the most stable key available on a schedule item.
// Prefers sigla over id so the palette lookup works by subject name.
export function disciplineColorForItem(item) {
  const sigla = item?.disciplina_sigla;
  if (sigla && PALETTE[sigla.toUpperCase().trim()]) {
    return PALETTE[sigla.toUpperCase().trim()];
  }
  return disciplineColor(item?.disciplina_sigla ?? item?.disciplina_id ?? '');
}
