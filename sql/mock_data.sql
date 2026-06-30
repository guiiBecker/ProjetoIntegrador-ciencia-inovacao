-- ============================================================
-- MOCK DATA - PROJETO INTEGRADOR
-- Sistema de Grade Horaria Escolar
--
-- Origem: bkp_cadastro.json (school_slug "escola-apresentacao"),
-- o cadastro real usado pelo grupo. Professores, turmas, disciplinas e
-- atribuicoes (respeitando niveis_excluidos) vem desse JSON.
--
-- ARQUITETURA DE TURNOS:
--   * Todos os turnos compartilham o turno "Manha" (id=1) para as manha.
--     Isso garante deteccao correta de conflitos de professor entre EF e EM
--     que ocorram no mesmo horario de manha (HC1 funciona entre niveis).
--   * Ensino Medio (1EM/2EM/3EM) -> segmento='ensino_medio' e
--     allowed_turno_ids=[1, 2]: podem usar slots do turno Manha (todos os dias)
--     E do turno Tarde (segunda-feira apenas, marcado com para_ensino_medio=TRUE).
--   * Ensino Fundamental (6/7/8/9EF) -> segmento='anos_finais' e
--     allowed_turno_ids=[1]: somente manha, todos os dias.
--   * O no-gap de turma e aplicado POR TURNO de forma independente:
--     manha (turno 1) e tarde (turno 2) nao interferem entre si.
--
-- CURRICULO EM (30 aulas, conforme Quadro Sintese EM 2026):
--   PORT4 MAT4 EDF2 ING1 LIT1 FIS3 QUI3 BIO3 HIS2 GEO2 FIL1 SOC1 COMP1 RED2 = 30
--
-- VIABILIDADE (HC4): o gerador com HC4 DURA (alocar 100% das aulas):
--   * EF: turno Manha = 6 aulas/dia x 5 dias = 30 slots; demanda 26/turma.
--         Maior carga professor EF: Alan (MAT 5 turmas x 5) = 25 <= 30.
--   * EM: 6 manha x 5 dias + 5 tarde x 1 dia (segunda) = 35 slots; demanda 30.
--         Maior carga professor EM: Luane (PORT4+LIT1, 3 turmas) = 15 <= 35.
--   * Conflitos cruzados EF/EM agora detectados (slots de manha compartilhados).
-- ============================================================

-- Limpar dados existentes para garantir insert limpo
TRUNCATE
    schedule_option_item,
    schedule_option,
    schedule_request,
    professor_form_link,
    professor_disponibilidade,
    turma_disciplina,
    curriculo,
    horario,
    time_slot,
    periodo,
    turma,
    professor,
    disciplina,
    turno,
    dia_semana
RESTART IDENTITY CASCADE;

-- ============================================================
-- TURNOS
-- "Manha" (id=1): usado por EF e EM para as aulas da manha (compartilhado).
-- "Tarde" (id=2): para_ensino_medio=TRUE -> slots gerados somente na segunda-feira.
--                 O scheduler inclui este turno em allowed_turno_ids das turmas EM.
-- "Noite"/"Integral": sem turmas associadas neste mock.
-- ============================================================
INSERT INTO turno (id, nome, para_ensino_medio) VALUES
    (1, 'Manha',    FALSE),
    (2, 'Tarde',    TRUE),
    (3, 'Noite',    FALSE),
    (4, 'Integral', FALSE);

-- ============================================================
-- DIAS DA SEMANA (dias letivos)
-- ============================================================
INSERT INTO dia_semana (id, nome) VALUES
    (1, 'Segunda'),
    (2, 'Terca'),
    (3, 'Quarta'),
    (4, 'Quinta'),
    (5, 'Sexta');

-- ============================================================
-- DISCIPLINAS (17 do cadastro)
-- peso reflete eh_densa/eh_exata do JSON (densas/exatas = peso alto).
-- Obs.: Espanhol existe no cadastro mas NENHUM professor a leciona,
-- portanto nao aparece em nenhuma turma_disciplina (sem FK possivel).
-- ============================================================
INSERT INTO disciplina (id, nome, sigla, peso) VALUES
    (1,  'Matemática',       'MAT',  4),  -- densa
    (2,  'Português',        'PORT', 4),  -- densa
    (3,  'Literatura',       'LIT',  2),
    (4,  'História',         'HIS',  3),
    (5,  'Geografia',        'GEO',  3),
    (6,  'Educação Fisica',  'EDF',  1),
    (7,  'Arte',             'ART',  1),
    (8,  'Inglês',           'ING',  2),
    (9,  'Espanhol',         'ESP',  2),  -- sem professor cadastrado
    (10, 'Fisica',           'FIS',  4),  -- exata
    (11, 'Química',          'QUI',  4),
    (12, 'Biologia',         'BIO',  4),
    (13, 'Filosofia',        'FIL',  2),
    (14, 'Sociologia',       'SOC',  2),
    (15, 'Computação',       'COMP', 2),
    (16, 'Ciências',         'CIE',  3),
    (17, 'Redação',          'RED',  2);

-- ============================================================
-- PROFESSORES (18 do cadastro)
-- carga_horaria_max <- carga_horaria do JSON.
-- O comentario indica disciplina(s) e niveis que cada um NAO leciona.
-- ============================================================
-- carga_horaria_max = total de aulas/semana atribuidas ao professor no mock.
-- Cada periodo letivo = 50 min. Professores marcados com (*) ensinam em mais
-- turmas que o limite original; os valores abaixo refletem a carga real
-- necessaria para cobrir todas as turmas do mock 2026.
INSERT INTO professor (id, nome, email, carga_horaria_max, ativo) VALUES
    (1,  'Alan',     NULL,                          24, TRUE),  -- MAT 5EF(C61-C82)=20 + 211=4 = 24 aulas
    (2,  'Carla',    NULL,                          12, TRUE),  -- MAT C91(4)+221(4)+231(4) = 12
    (3,  'Carlos',   NULL,                          14, TRUE),  -- ING 5EF(2*5)+C91(1)+3EM(1*3) = 14
    (4,  'Elis',     NULL,                           6, TRUE),  -- CIE 2xEF (C61-C62): 2t*3=6
    (5,  'Fabiane',  NULL,                           8, TRUE),  -- GEO C91(2)+3EM(2*3) = 8
    (6,  'Gabriela', NULL,                          17, TRUE),  -- PORT+RED: 211(5)+221(6)+231(6) = 17
    (7,  'Ieda',     NULL,                           9, TRUE),  -- COMP 9 turmas x1 = 9
    (8,  'Jader',    NULL,                          22, TRUE),  -- CIE C71(3)+C81(4)+C82(4)+QUI C91+3EM = 22
    (9,  'Janaina',  NULL,                           9, TRUE),  -- ART C71-C91(2*4)+211(1) = 9
    (10, 'Josei',    NULL,                           6, TRUE),  -- HIS 3EM: 3t*2=6
    (11, 'Juliana',  NULL,                          11, TRUE),  -- FIS C91(2)+3EM(3*3) = 11
    (12, 'Luane',    NULL,                          20, TRUE),  -- PORT C71(5)+C81(4)+C82(4)+C91(3)+LIT 4t = 20
    (13, 'Magnus',   NULL,                          22, TRUE),  -- GEO 5EF(2*5)+FIL 9t+SOC 3EM = 22
    (14, 'Murilo',   NULL,                          11, TRUE),  -- BIO C91(2)+3EM(3*3) = 11
    (15, 'Patricia', NULL,                          12, TRUE),  -- HIS C61-C91: 6t*2 = 12
    (16, 'Rosana',   NULL,                          19, TRUE),  -- PORT C61+C62(5*2)+ART C61+C62(2*2)+LIT C61-C82(1*5) = 19
    (17, 'Silvana',  NULL,                           8, TRUE),  -- EDF C91(2)+3EM(2*3=6)=8
    (18, 'Tatiana',  NULL,                          10, TRUE);  -- EDF 5xEF (C61-C81): 5t*2=10

-- ============================================================
-- TURMAS (9 do cadastro, ano 2026)
-- EM -> turno_id=1 (Manha compartilhado); EF -> turno_id=1 (Manha).
-- O scheduler diferencia pelo campo segmento + allowed_turno_ids calculado em
-- loadData(): 'ensino_medio' recebe [1, 2] (manha + tarde segunda),
-- 'anos_finais' recebe [1] (so manha).
-- ============================================================
INSERT INTO turma (id, nome, serie, ano_letivo, turno_id, segmento, ativa) VALUES
    (1, '211', '1EM', 2026, 1, 'ensino_medio', TRUE),
    (2, '221', '2EM', 2026, 1, 'ensino_medio', TRUE),
    (3, '231', '3EM', 2026, 1, 'ensino_medio', TRUE),
    (4, 'C61', '6EF', 2026, 1, 'anos_finais',  TRUE),
    (5, 'C62', '6EF', 2026, 1, 'anos_finais',  TRUE),
    (6, 'C71', '7EF', 2026, 1, 'anos_finais',  TRUE),
    (7, 'C81', '8EF', 2026, 1, 'anos_finais',  TRUE),
    (8, 'C82', '8EF', 2026, 1, 'anos_finais',  TRUE),
    (9, 'C91', '9EF', 2026, 1, 'anos_finais',  TRUE);

-- ============================================================
-- PERIODOS
-- Turno Manha (1): periodos letivos num=1,2,3,5,6 (07:30-12:00, 50 min cada)
--   + recreio num=4 (10:00-10:20) + almoco num=7 (12:00-13:30). EF e EM compartilham.
-- Turno Tarde (2): periodos letivos num=9,10,11,13,14 (13:30-18:00, 50 min cada)
--   + recreio num=12 (16:00-16:20) + almoco num=8 (12:00-13:30).
--   Exclusivo para EM, segunda-feira apenas.
--   Numeros separados do turno Manha: no-gap opera por turno de forma independente.
-- ============================================================
INSERT INTO periodo (id, numero, hora_inicio, hora_fim, tipo, turno_id) VALUES
    -- Turno Manha (EF e EM: segunda a sexta) - 5 periodos letivos de 50 min
    (1,  1, '07:30', '08:20', 'aula',      1),
    (2,  2, '08:20', '09:10', 'aula',      1),
    (3,  3, '09:10', '10:00', 'aula',      1),   -- 3o periodo
    (4,  4, '10:00', '10:20', 'intervalo', 1),   -- recreio
    (5,  5, '10:20', '11:10', 'aula',      1),
    (6,  6, '11:10', '12:00', 'aula',      1),
    -- Turno Tarde (EM: somente segunda-feira) - 5 periodos letivos de 50 min
    (9,  9, '13:30', '14:20', 'aula',      2),
    (10, 10,'14:20', '15:10', 'aula',      2),
    (11, 11,'15:10', '16:00', 'aula',      2),   -- 3o periodo tarde
    (12, 12,'16:00', '16:20', 'intervalo', 2),   -- recreio
    (13, 13,'16:20', '17:10', 'aula',      2),
    (14, 14,'17:10', '18:00', 'aula',      2);

-- ============================================================
-- TIME SLOTS (dia x periodo, apenas periodos de aula)
-- Turno Manha (1): 5 aulas x 5 dias = 25 slots  (EF e EM compartilham).
--   (periodo 7 = intervalo/almoco, nao gera slot)
-- Turno Tarde  (2): 5 aulas x 1 dia (segunda) = 5 slots  (EM apenas).
-- Total = 30 time_slots.
-- ============================================================
INSERT INTO time_slot (dia_id, periodo_id)
SELECT d.id, p.id
FROM dia_semana d
CROSS JOIN periodo p
WHERE p.tipo = 'aula'
  -- Turno Tarde: slots somente na segunda-feira (dia_id = 1).
  AND NOT (p.turno_id = 2 AND d.id != 1)
ORDER BY p.turno_id, d.id, p.numero;

-- ============================================================
-- CURRICULO (template por serie/nivel - informativo, nao usado pelo worker)
-- EF (25 aulas): PORT5 MAT5 CIE3 HIS3 GEO3 ING2 ART2 EDF2 = 25
--   25 aulas = 5 periodos/dia x 5 dias (manha apenas). 100% de ocupacao.
-- EM (30 aulas, conforme Quadro Sintese EM 2026):
--   MAT4 PORT4 EDF2 ING1 LIT1 FIS3 QUI3 BIO3 HIS2 GEO2 FIL1 SOC1 COMP1 RED2 = 30
--   30 aulas = 5 manha x 5 dias (25) + 5 tarde segunda (5). 100% de ocupacao.
--   (Espanhol no EM fica fora: sem professor cadastrado.)
-- ============================================================
INSERT INTO curriculo (serie, disciplina_id, aulas_semana, tamanho_bloco) VALUES
    -- 6EF: PORT5 MAT4 CIE3 ING2 ART2 EDF2 HIS2 GEO2 LIT1 FIL1 COMP1 = 25
    ('6EF',  2, 5, 2), ('6EF',  1, 4, 2), ('6EF', 16, 3, 2), ('6EF',  8, 2, 2),
    ('6EF',  7, 2, 2), ('6EF',  6, 2, 2), ('6EF',  4, 2, 2), ('6EF',  5, 2, 2),
    ('6EF',  3, 1, 1), ('6EF', 13, 1, 1), ('6EF', 15, 1, 1),
    -- 7EF: igual a 6EF
    ('7EF',  2, 5, 2), ('7EF',  1, 4, 2), ('7EF', 16, 3, 2), ('7EF',  8, 2, 2),
    ('7EF',  7, 2, 2), ('7EF',  6, 2, 2), ('7EF',  4, 2, 2), ('7EF',  5, 2, 2),
    ('7EF',  3, 1, 1), ('7EF', 13, 1, 1), ('7EF', 15, 1, 1),
    -- 8EF: PORT4 MAT4 CIE4 ING2 ART2 EDF2 HIS2 GEO2 LIT1 FIL1 COMP1 = 25
    ('8EF',  2, 4, 2), ('8EF',  1, 4, 2), ('8EF', 16, 4, 2), ('8EF',  8, 2, 2),
    ('8EF',  7, 2, 2), ('8EF',  6, 2, 2), ('8EF',  4, 2, 2), ('8EF',  5, 2, 2),
    ('8EF',  3, 1, 1), ('8EF', 13, 1, 1), ('8EF', 15, 1, 1),
    -- 9EF: PORT3 MAT4 QUI2 FIS2 BIO2 HIS2 GEO2 ART2 EDF2 ING1 LIT1 FIL1 COMP1 = 25
    ('9EF',  2, 3, 2), ('9EF',  1, 4, 2), ('9EF', 11, 2, 2), ('9EF', 10, 2, 2),
    ('9EF', 12, 2, 2), ('9EF',  4, 2, 2), ('9EF',  5, 2, 2), ('9EF',  7, 2, 2),
    ('9EF',  6, 2, 2), ('9EF',  8, 1, 1), ('9EF',  3, 1, 1), ('9EF', 13, 1, 1),
    ('9EF', 15, 1, 1),
    -- 1EM: MAT4 PORT3 FIS3 QUI3 BIO3 HIS2 GEO2 EDF2 RED2 LIT1 ART1 ING1 FIL1 SOC1 COMP1 = 30
    ('1EM',  1, 4, 2), ('1EM',  2, 3, 2), ('1EM', 10, 3, 2), ('1EM', 11, 3, 2),
    ('1EM', 12, 3, 2), ('1EM',  4, 2, 2), ('1EM',  5, 2, 2), ('1EM',  6, 2, 2),
    ('1EM', 17, 2, 2), ('1EM',  3, 1, 1), ('1EM',  7, 1, 1), ('1EM',  8, 1, 1),
    ('1EM', 13, 1, 1), ('1EM', 14, 1, 1), ('1EM', 15, 1, 1),
    -- 2EM/3EM: MAT4 PORT4 FIS3 QUI3 BIO3 HIS2 GEO2 EDF2 RED2 LIT1 ING1 FIL1 SOC1 COMP1 = 30
    ('2EM',  1, 4, 2), ('2EM',  2, 4, 2), ('2EM', 10, 3, 2), ('2EM', 11, 3, 2),
    ('2EM', 12, 3, 2), ('2EM',  4, 2, 2), ('2EM',  5, 2, 2), ('2EM',  6, 2, 2),
    ('2EM', 17, 2, 2), ('2EM',  3, 1, 1), ('2EM',  8, 1, 1), ('2EM', 13, 1, 1),
    ('2EM', 14, 1, 1), ('2EM', 15, 1, 1),
    ('3EM',  1, 4, 2), ('3EM',  2, 4, 2), ('3EM', 10, 3, 2), ('3EM', 11, 3, 2),
    ('3EM', 12, 3, 2), ('3EM',  4, 2, 2), ('3EM',  5, 2, 2), ('3EM',  6, 2, 2),
    ('3EM', 17, 2, 2), ('3EM',  3, 1, 1), ('3EM',  8, 1, 1), ('3EM', 13, 1, 1),
    ('3EM', 14, 1, 1), ('3EM', 15, 1, 1);

-- ============================================================
-- TURMA_DISCIPLINA (atribuicao professor-turma-disciplina)
-- Fonte de verdade para o worker. Cada professor respeita sua(s)
-- disciplina(s) e seus niveis_excluidos. tamanho_bloco = 1 para todas
-- (o cadastro marca exige_blocos = false / blocos_consecutivos = 1).
-- EM: 30 aulas/turma (manha compartilhada + segunda tarde).
-- Conflitos de professor entre EF e EM agora detectados (turno_id=1 compartilhado).
-- ============================================================
INSERT INTO turma_disciplina (id, turma_id, disciplina_id, professor_id, aulas_semana, tamanho_bloco) VALUES
    -- Turma 211 (1EM) - 30 aulas (manha + tarde segunda)
    (1,  1, 1,  1,  4, 2),  -- MAT  -> Alan
    (2,  1, 2,  6,  3, 2),  -- PORT -> Gabriela
    (3,  1, 3,  12, 1, 1),  -- LIT  -> Luane
    (4,  1, 4,  10, 2, 2),  -- HIS  -> Josei
    (5,  1, 5,  5,  2, 2),  -- GEO  -> Fabiane
    (6,  1, 6,  17, 2, 2),  -- EDF  -> Silvana
    (7,  1, 7,  9,  1, 1),  -- ART  -> Janaina
    (8,  1, 8,  3,  1, 1),  -- ING  -> Carlos
    (9,  1, 10, 11, 3, 2),  -- FIS  -> Juliana
    (10, 1, 11, 8,  3, 2),  -- QUI  -> Jader
    (11, 1, 12, 14, 3, 2),  -- BIO  -> Murilo
    (12, 1, 13, 13, 1, 1),  -- FIL  -> Magnus
    (13, 1, 14, 13, 1, 1),  -- SOC  -> Magnus
    (14, 1, 15, 7,  1, 1),  -- COMP -> Ieda
    (15, 1, 17, 6,  2, 2),  -- RED  -> Gabriela
    -- Turma 221 (2EM) - 30 aulas
    (16, 2, 1,  2,  4, 2),  -- MAT  -> Carla
    (17, 2, 2,  6,  4, 2),  -- PORT -> Gabriela
    (18, 2, 3,  12, 1, 1),  -- LIT  -> Luane
    (19, 2, 4,  10, 2, 2),  -- HIS  -> Josei
    (20, 2, 5,  5,  2, 2),  -- GEO  -> Fabiane
    (21, 2, 6,  17, 2, 2),  -- EDF  -> Silvana
    (22, 2, 8,  3,  1, 1),  -- ING  -> Carlos
    (23, 2, 10, 11, 3, 2),  -- FIS  -> Juliana
    (24, 2, 11, 8,  3, 2),  -- QUI  -> Jader
    (25, 2, 12, 14, 3, 2),  -- BIO  -> Murilo
    (26, 2, 13, 13, 1, 1),  -- FIL  -> Magnus
    (27, 2, 14, 13, 1, 1),  -- SOC  -> Magnus
    (28, 2, 15, 7,  1, 1),  -- COMP -> Ieda
    (29, 2, 17, 6,  2, 2),  -- RED  -> Gabriela
    -- Turma 231 (3EM) - 30 aulas
    (30, 3, 1,  2,  4, 2),  -- MAT  -> Carla
    (31, 3, 2,  6,  4, 2),  -- PORT -> Gabriela
    (32, 3, 3,  12, 1, 1),  -- LIT  -> Luane
    (33, 3, 4,  10, 2, 2),  -- HIS  -> Josei
    (34, 3, 5,  5,  2, 2),  -- GEO  -> Fabiane
    (35, 3, 6,  17, 2, 2),  -- EDF  -> Silvana
    (36, 3, 8,  3,  1, 1),  -- ING  -> Carlos
    (37, 3, 10, 11, 3, 2),  -- FIS  -> Juliana
    (38, 3, 11, 8,  3, 2),  -- QUI  -> Jader
    (39, 3, 12, 14, 3, 2),  -- BIO  -> Murilo
    (40, 3, 13, 13, 1, 1),  -- FIL  -> Magnus
    (41, 3, 14, 13, 1, 1),  -- SOC  -> Magnus
    (42, 3, 15, 7,  1, 1),  -- COMP -> Ieda
    (43, 3, 17, 6,  2, 2),  -- RED  -> Gabriela
    -- Turma C61 (6EF) - 25 aulas
    (44, 4, 2,  16, 5, 2),  -- PORT -> Rosana
    (45, 4, 1,  1,  4, 2),  -- MAT  -> Alan
    (46, 4, 16, 4,  3, 2),  -- CIE  -> Elis
    (47, 4, 4,  15, 2, 2),  -- HIS  -> Patricia
    (48, 4, 5,  13, 2, 2),  -- GEO  -> Magnus
    (49, 4, 8,  3,  2, 2),  -- ING  -> Carlos
    (50, 4, 7,  16, 2, 2),  -- ART  -> Rosana
    (51, 4, 6,  18, 2, 2),  -- EDF  -> Tatiana
    (52, 4, 3,  16, 1, 1),  -- LIT  -> Rosana
    (53, 4, 13, 13, 1, 1),  -- FIL  -> Magnus
    (54, 4, 15, 7,  1, 1),  -- COMP -> Ieda
    -- Turma C62 (6EF) - 25 aulas
    (55, 5, 2,  16, 5, 2),  -- PORT -> Rosana
    (56, 5, 1,  1,  4, 2),  -- MAT  -> Alan
    (57, 5, 16, 4,  3, 2),  -- CIE  -> Elis
    (58, 5, 4,  15, 2, 2),  -- HIS  -> Patricia
    (59, 5, 5,  13, 2, 2),  -- GEO  -> Magnus
    (60, 5, 8,  3,  2, 2),  -- ING  -> Carlos
    (61, 5, 7,  16, 2, 2),  -- ART  -> Rosana
    (62, 5, 6,  18, 2, 2),  -- EDF  -> Tatiana
    (63, 5, 3,  16, 1, 1),  -- LIT  -> Rosana
    (64, 5, 13, 13, 1, 1),  -- FIL  -> Magnus
    (65, 5, 15, 7,  1, 1),  -- COMP -> Ieda
    -- Turma C71 (7EF) - 25 aulas
    (66, 6, 2,  12, 5, 2),  -- PORT -> Luane
    (67, 6, 1,  1,  4, 2),  -- MAT  -> Alan
    (68, 6, 16, 8,  3, 2),  -- CIE  -> Jader
    (69, 6, 4,  15, 2, 2),  -- HIS  -> Patricia
    (70, 6, 5,  13, 2, 2),  -- GEO  -> Magnus
    (71, 6, 8,  3,  2, 2),  -- ING  -> Carlos
    (72, 6, 7,  9,  2, 2),  -- ART  -> Janaina
    (73, 6, 6,  18, 2, 2),  -- EDF  -> Tatiana
    (74, 6, 3,  16, 1, 1),  -- LIT  -> Rosana
    (75, 6, 13, 13, 1, 1),  -- FIL  -> Magnus
    (76, 6, 15, 7,  1, 1),  -- COMP -> Ieda
    -- Turma C81 (8EF) - 25 aulas
    (77, 7, 2,  12, 4, 2),  -- PORT -> Luane
    (78, 7, 1,  1,  4, 2),  -- MAT  -> Alan
    (79, 7, 16, 8,  4, 2),  -- CIE  -> Jader
    (80, 7, 4,  15, 2, 2),  -- HIS  -> Patricia
    (81, 7, 5,  13, 2, 2),  -- GEO  -> Magnus
    (82, 7, 8,  3,  2, 2),  -- ING  -> Carlos
    (83, 7, 7,  9,  2, 2),  -- ART  -> Janaina
    (84, 7, 6,  18, 2, 2),  -- EDF  -> Tatiana
    (85, 7, 3,  16, 1, 1),  -- LIT  -> Rosana
    (86, 7, 13, 13, 1, 1),  -- FIL  -> Magnus
    (87, 7, 15, 7,  1, 1),  -- COMP -> Ieda
    -- Turma C82 (8EF) - 25 aulas
    (88, 8, 2,  12, 4, 2),  -- PORT -> Luane
    (89, 8, 1,  1,  4, 2),  -- MAT  -> Alan
    (90, 8, 16, 8,  4, 2),  -- CIE  -> Jader
    (91, 8, 4,  15, 2, 2),  -- HIS  -> Patricia
    (92, 8, 5,  13, 2, 2),  -- GEO  -> Magnus
    (93, 8, 8,  3,  2, 2),  -- ING  -> Carlos
    (94, 8, 7,  9,  2, 2),  -- ART  -> Janaina
    (95, 8, 6,  18, 2, 2),  -- EDF  -> Tatiana
    (96, 8, 3,  16, 1, 1),  -- LIT  -> Rosana
    (97, 8, 13, 13, 1, 1),  -- FIL  -> Magnus
    (98, 8, 15, 7,  1, 1),  -- COMP -> Ieda
    -- Turma C91 (9EF) - 25 aulas (Ciencias divididas em FIS/QUI/BIO)
    (99,  9, 2,  12, 3, 2),  -- PORT -> Luane
    (100, 9, 1,  2,  4, 2),  -- MAT  -> Carla
    (101, 9, 11, 8,  2, 2),  -- QUI  -> Jader
    (102, 9, 10, 11, 2, 2),  -- FIS  -> Juliana
    (103, 9, 12, 14, 2, 2),  -- BIO  -> Murilo
    (104, 9, 4,  15, 2, 2),  -- HIS  -> Patricia
    (105, 9, 5,  5,  2, 2),  -- GEO  -> Fabiane
    (106, 9, 8,  3,  1, 1),  -- ING  -> Carlos
    (107, 9, 7,  9,  2, 2),  -- ART  -> Janaina
    (108, 9, 6,  17, 2, 2),  -- EDF  -> Silvana
    (109, 9, 3,  12, 1, 1),  -- LIT  -> Luane
    (110, 9, 13, 13, 1, 1),  -- FIL  -> Magnus
    (111, 9, 15, 7,  1, 1);  -- COMP -> Ieda  -- EDF  -> Silvana

-- ============================================================
-- DISPONIBILIDADE DOS PROFESSORES
-- Default: todos disponiveis em todos os time_slots, preferencia 3.
-- Preferencia maior nos 3 primeiros periodos da manha; menor nos ultimos
-- periodos do dia (manha periodo 6; tarde segunda periodos 12 e 13).
-- ============================================================
INSERT INTO professor_disponibilidade (professor_id, time_slot_id, disponivel, preferencia)
SELECT p.id, ts.id, TRUE, 3
FROM professor p
CROSS JOIN time_slot ts;

UPDATE professor_disponibilidade pd
SET preferencia = 4
FROM time_slot ts
JOIN periodo p ON ts.periodo_id = p.id
WHERE pd.time_slot_id = ts.id
  AND p.numero IN (1, 2, 3);  -- primeiros 3 periodos letivos da manha (4=recreio, 5 e 6 seguem)

UPDATE professor_disponibilidade pd
SET preferencia = 2
FROM time_slot ts
JOIN periodo p ON ts.periodo_id = p.id
WHERE pd.time_slot_id = ts.id
  AND ((p.turno_id = 1 AND p.numero = 6)          -- ultimo periodo da manha (11:10-12:00)
    OR (p.turno_id = 2 AND p.numero IN (13, 14))); -- ultimos 2 da tarde (16:20-18:00)

-- ============================================================
-- PROFESSOR_FORM_LINK (link unico por professor)
-- ============================================================
INSERT INTO professor_form_link (id, professor_id, token, respondido, respondido_em) VALUES
    (1,  1,  'tok_alan_2026',     FALSE, NULL),
    (2,  2,  'tok_carla_2026',    FALSE, NULL),
    (3,  3,  'tok_carlos_2026',   FALSE, NULL),
    (4,  4,  'tok_elis_2026',     FALSE, NULL),
    (5,  5,  'tok_fabiane_2026',  FALSE, NULL),
    (6,  6,  'tok_gabriela_2026', FALSE, NULL),
    (7,  7,  'tok_ieda_2026',     FALSE, NULL),
    (8,  8,  'tok_jader_2026',    FALSE, NULL),
    (9,  9,  'tok_janaina_2026',  FALSE, NULL),
    (10, 10, 'tok_josei_2026',    FALSE, NULL),
    (11, 11, 'tok_juliana_2026',  FALSE, NULL),
    (12, 12, 'tok_luane_2026',    FALSE, NULL),
    (13, 13, 'tok_magnus_2026',   FALSE, NULL),
    (14, 14, 'tok_murilo_2026',   FALSE, NULL),
    (15, 15, 'tok_patricia_2026', FALSE, NULL),
    (16, 16, 'tok_rosana_2026',   FALSE, NULL),
    (17, 17, 'tok_silvana_2026',  FALSE, NULL),
    (18, 18, 'tok_tatiana_2026',  FALSE, NULL);

-- ============================================================
-- AJUSTAR SEQUENCES (para novos inserts via UI nao conflitarem)
-- ============================================================
SELECT setval('turno_id_seq',                     (SELECT MAX(id) FROM turno));
SELECT setval('dia_semana_id_seq',                (SELECT MAX(id) FROM dia_semana));
SELECT setval('professor_id_seq',                 (SELECT MAX(id) FROM professor));
SELECT setval('disciplina_id_seq',                (SELECT MAX(id) FROM disciplina));
SELECT setval('turma_id_seq',                     (SELECT MAX(id) FROM turma));
SELECT setval('periodo_id_seq',                   (SELECT MAX(id) FROM periodo));
SELECT setval('time_slot_id_seq',                 (SELECT MAX(id) FROM time_slot));
SELECT setval('turma_disciplina_id_seq',          (SELECT MAX(id) FROM turma_disciplina));
SELECT setval('professor_disponibilidade_id_seq', (SELECT MAX(id) FROM professor_disponibilidade));
SELECT setval('professor_form_link_id_seq',       (SELECT MAX(id) FROM professor_form_link));
SELECT setval('curriculo_id_seq',                 (SELECT MAX(id) FROM curriculo));

-- ============================================================
-- VIABILIDADE (HC4) - demanda x capacidade
-- EF: 25 slots (turno 1, manha, 5 periodos x 5 dias), demanda 25/turma.
--     100% de ocupacao. Maior carga professor: Alan (MAT 5 turmas EF x 5) = 25. OK.
--     Elis  (CIE C61+C62, 3x2) = 6 = carga_max. OK.
-- EM: 30 slots (25 manha turno 1 + 5 tarde turno 2 somente segunda),
--     demanda 30/turma. 100% de ocupacao.
--     Maior carga: Carla (MAT 4 x 3 EM + C91 MAT 5) = 17 <= 30. OK.
--     Josei (HIS 2 x 3 EM) = 6 = carga_max. OK.
--     Silvana (EDF 2 x 3 EM + C91 EDF 2) = 8 = carga_max. OK.
-- Conflitos EF/EM detectados: turno 1 compartilhado (mesmo time_slot_id).
-- Espanhol nao ofertada (sem professor cadastrado).
-- ============================================================
