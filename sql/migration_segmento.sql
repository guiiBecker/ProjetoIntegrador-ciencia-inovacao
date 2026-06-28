-- ============================================================
-- Migration: suporte a segmentos (Anos Finais / Ensino Médio)
-- Rodar em bancos de dados existentes que usaram init.sql
-- anterior à adição do campo segmento.
-- ============================================================

-- 1. Marcar o turno "Tarde" como extra para Ensino Médio.
ALTER TABLE turno ADD COLUMN IF NOT EXISTS para_ensino_medio BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE turno SET para_ensino_medio = TRUE WHERE nome = 'Tarde';

-- 2. Adicionar segmento às turmas (default: anos_finais para turmas existentes).
ALTER TABLE turma ADD COLUMN IF NOT EXISTS segmento VARCHAR(20) NOT NULL DEFAULT 'anos_finais';

-- Tentar adicionar a constraint (falha silenciosamente se já existir).
DO $$
BEGIN
    ALTER TABLE turma ADD CONSTRAINT turma_segmento_check
        CHECK (segmento IN ('anos_finais', 'ensino_medio'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_turma_segmento ON turma(segmento);

-- 3. (Opcional) Marcar turmas existentes de Ensino Médio pelo nome da série.
-- Descomente e ajuste conforme necessário:
-- UPDATE turma SET segmento = 'ensino_medio'
--   WHERE serie ILIKE '%1%ano%' OR serie ILIKE '%2%ano%' OR serie ILIKE '%3%ano%'
--      OR nome LIKE '1%' OR nome LIKE '2%' OR nome LIKE '3%';
