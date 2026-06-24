-- ============================================================
-- MOCK DATA - PROJETO INTEGRADOR
-- Sistema de Grade Horaria Escolar
--
-- Origem: bkp_cadastro.json (school_slug "escola-apresentacao"),
-- o cadastro real usado pelo grupo. Professores, turmas, disciplinas e
-- atribuicoes (respeitando niveis_excluidos) vem desse JSON.
--
-- TURNOS POR NIVEL (ajuste a pedido):
--   * Ensino Medio (1EM/2EM/3EM) -> turno "Integral": aulas de manha E tarde,
--     de segunda a sexta, EXCETO quarta-feira a tarde.
--   * Ensino Fundamental (6/7/8/9EF) -> turno "Manha": somente periodo da manha.
--
-- LIMITACAO CONHECIDA (modelo de dados): cada turma tem um unico turno e cada
-- periodo pertence a um unico turno. Como EF e EM ficam em turnos distintos, os
-- slots de manha do EF e os de manha do EM sao linhas time_slot DIFERENTES.
-- Consequencia: se um professor leciona para EF e para EM na MESMA manha, o
-- gerador NAO detecta o conflito (HC1) entre esses dois slots, pois sao slots
-- distintos. Varios professores cruzam niveis (Carlos/ING nas 9 turmas, Magnus,
-- Jader, Luane, Carla, Fabiane). Aceito para este mock; corrigir exigiria turma
-- com multiplos turnos (mudanca no scheduler).
--
-- VIABILIDADE (HC4): o gerador atual e o OR-Tools (CP-SAT) com HC4 DURA
-- (alocar 100% das aulas) e sem fallback -> dados inviaveis fariam TODA
-- requisicao falhar. Este mock foi dimensionado para ser 100% alocavel:
--   * EF: turno Manha = 6 aulas/dia x 5 dias = 30 slots; demanda 26/turma.
--         Maior carga de professor no EF: Alan (MAT, 5 turmas x 5) = 25 <= 30.
--   * EM: turno Integral = 6 manha + 5 tarde (seg/ter/qui/sex) + 6 (quarta)
--         = 50 slots; demanda 44/turma (escola integral, ~6 vagos); maior carga
--         de professor no EM: Luane (PORT6+LIT3, 3 turmas) = 27 <= 50.
-- A viabilidade e verificada rodando o solver sobre estes dados (HC4 + no-gap
-- de turma) antes de cada release do mock.
--
-- Mapeamento de IDs: os UUIDs do JSON foram convertidos para os SERIAL
-- inteiros do schema, preservando nomes e cargas.
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
-- "Manha" para o EF (somente manha) e "Integral" para o EM (manha + tarde).
-- "Tarde"/"Noite" ficam para compatibilidade, sem turmas associadas.
-- ============================================================
INSERT INTO turno (id, nome) VALUES
    (1, 'Manha'),
    (2, 'Tarde'),
    (3, 'Noite'),
    (4, 'Integral');

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
INSERT INTO professor (id, nome, email, carga_horaria_max, ativo) VALUES
    (1,  'Alan',     NULL,                          12, TRUE),  -- MAT (todos os niveis)
    (2,  'Carla',    NULL,                          12, TRUE),  -- MAT (sem 6/7/8EF)
    (3,  'Carlos',   'igor.paslauski123@gmail.com', 14, TRUE),  -- ING (todos)
    (4,  'Elis',     NULL,                           6, TRUE),  -- CIE (so 6EF)
    (5,  'Fabiane',  NULL,                           5, TRUE),  -- GEO (so 9EF e EM)
    (6,  'Gabriela', NULL,                          12, TRUE),  -- RED (so EM)
    (7,  'Ieda',     NULL,                           9, TRUE),  -- COMP (todos)
    (8,  'Jader',    NULL,                          22, TRUE),  -- QUI, CIE (sem 6EF)
    (9,  'Janaina',  NULL,                           9, TRUE),  -- ART (sem 6EF)
    (10, 'Josei',    NULL,                           6, TRUE),  -- HIS (so EM)
    (11, 'Juliana',  NULL,                          11, TRUE),  -- FIS (so 9EF e EM)
    (12, 'Luane',    NULL,                          18, TRUE),  -- PORT, LIT (sem 6EF)
    (13, 'Magnus',   NULL,                          22, TRUE),  -- GEO, SOC, FIL (todos)
    (14, 'Murilo',   NULL,                          11, TRUE),  -- BIO (so 9EF e EM)
    (15, 'Patricia', NULL,                          12, TRUE),  -- HIS (so EF)
    (16, 'Rosana',   NULL,                          19, TRUE),  -- LIT, PORT, ART (so 6/7/8EF)
    (17, 'Silvana',  NULL,                           8, TRUE),  -- EDF (so 9EF e EM)
    (18, 'Tatiana',  NULL,                          10, TRUE);  -- EDF (so 6/7/8EF)

-- ============================================================
-- TURMAS (9 do cadastro, ano 2026)
-- serie <- nivel do JSON. turno por nivel: EM -> Integral (4), EF -> Manha (1).
-- ============================================================
INSERT INTO turma (id, nome, serie, ano_letivo, turno_id, ativa) VALUES
    (1, '211', '1EM', 2026, 4, TRUE),
    (2, '221', '2EM', 2026, 4, TRUE),
    (3, '231', '3EM', 2026, 4, TRUE),
    (4, 'C61', '6EF', 2026, 1, TRUE),
    (5, 'C62', '6EF', 2026, 1, TRUE),
    (6, 'C71', '7EF', 2026, 1, TRUE),
    (7, 'C81', '8EF', 2026, 1, TRUE),
    (8, 'C82', '8EF', 2026, 1, TRUE),
    (9, 'C91', '9EF', 2026, 1, TRUE);

-- ============================================================
-- PERIODOS
-- Turno Manha (EF):   6 aulas + 1 recreio (apos o 3o periodo).
-- Turno Integral (EM): 6 aulas de manha + recreio + almoco + 5 aulas a tarde.
-- O numero do intervalo garante que blocos de aulas nao o atravessem; a tarde
-- comeca em numero 9 (usado abaixo para excluir a quarta-feira a tarde).
-- ============================================================
INSERT INTO periodo (id, numero, hora_inicio, hora_fim, tipo, turno_id) VALUES
    -- Turno Manha (EF)
    (1,  1, '07:00', '07:50', 'aula',      1),
    (2,  2, '07:50', '08:40', 'aula',      1),
    (3,  3, '08:40', '09:30', 'aula',      1),
    (4,  4, '09:30', '09:50', 'intervalo', 1),  -- recreio
    (5,  5, '09:50', '10:40', 'aula',      1),
    (6,  6, '10:40', '11:30', 'aula',      1),
    (7,  7, '11:30', '12:20', 'aula',      1),
    -- Turno Integral (EM): manha
    (8,  1, '07:00', '07:50', 'aula',      4),
    (9,  2, '07:50', '08:40', 'aula',      4),
    (10, 3, '08:40', '09:30', 'aula',      4),
    (11, 4, '09:30', '09:50', 'intervalo', 4),  -- recreio
    (12, 5, '09:50', '10:40', 'aula',      4),
    (13, 6, '10:40', '11:30', 'aula',      4),
    (14, 7, '11:30', '12:20', 'aula',      4),
    -- Turno Integral (EM): almoco + tarde (numero >= 9)
    (15, 8, '12:20', '13:30', 'intervalo', 4),  -- almoco
    (16, 9, '13:30', '14:20', 'aula',      4),
    (17, 10,'14:20', '15:10', 'aula',      4),
    (18, 11,'15:10', '16:00', 'aula',      4),
    (19, 12,'16:00', '16:50', 'aula',      4),
    (20, 13,'16:50', '17:40', 'aula',      4);

-- ============================================================
-- TIME SLOTS (dia x periodo, apenas periodos de aula)
-- EF (turno 1): 6 aulas x 5 dias = 30.
-- EM (turno 4): manha 6 x 5 = 30; tarde 5 x 4 (sem quarta = dia 3) = 20 -> 50.
-- Total = 80 time_slots.
-- ============================================================
INSERT INTO time_slot (dia_id, periodo_id)
SELECT d.id, p.id
FROM dia_semana d
CROSS JOIN periodo p
WHERE p.tipo = 'aula'
  -- EM nao tem aula na quarta-feira (dia 3) a tarde (numero >= 9).
  AND NOT (p.turno_id = 4 AND p.numero >= 9 AND d.id = 3)
ORDER BY p.turno_id, d.id, p.numero;

-- ============================================================
-- CURRICULO (template por serie/nivel - informativo, nao usado pelo worker)
-- EF (26 aulas): PORT5 MAT5 CIE4 HIS3 GEO3 ING2 ART2 EDF2
-- EM (44 aulas): MAT6 PORT6 LIT3 HIS3 GEO3 ING3 FIS4 QUI4 BIO3 FIL2 SOC2 COMP2 RED3
-- (grade ampliada para a escola integral preencher manha+tarde; ~6 vagos/turma.)
-- (Espanhol no EM fica fora: sem professor cadastrado.)
-- ============================================================
INSERT INTO curriculo (serie, disciplina_id, aulas_semana, tamanho_bloco) VALUES
    -- Ensino Fundamental (6EF, 7EF, 8EF, 9EF)
    ('6EF', 2, 5, 1), ('6EF', 1, 5, 1), ('6EF', 16, 4, 1), ('6EF', 4, 3, 1),
    ('6EF', 5, 3, 1), ('6EF', 8, 2, 1), ('6EF', 7, 2, 1), ('6EF', 6, 2, 1),
    ('7EF', 2, 5, 1), ('7EF', 1, 5, 1), ('7EF', 16, 4, 1), ('7EF', 4, 3, 1),
    ('7EF', 5, 3, 1), ('7EF', 8, 2, 1), ('7EF', 7, 2, 1), ('7EF', 6, 2, 1),
    ('8EF', 2, 5, 1), ('8EF', 1, 5, 1), ('8EF', 16, 4, 1), ('8EF', 4, 3, 1),
    ('8EF', 5, 3, 1), ('8EF', 8, 2, 1), ('8EF', 7, 2, 1), ('8EF', 6, 2, 1),
    ('9EF', 2, 5, 1), ('9EF', 1, 5, 1), ('9EF', 16, 4, 1), ('9EF', 4, 3, 1),
    ('9EF', 5, 3, 1), ('9EF', 8, 2, 1), ('9EF', 7, 2, 1), ('9EF', 6, 2, 1),
    -- Ensino Medio (1EM, 2EM, 3EM) - 44 aulas (turno Integral, manha + tarde)
    ('1EM', 1, 6, 1), ('1EM', 2, 6, 1), ('1EM', 3, 3, 1), ('1EM', 4, 3, 1),
    ('1EM', 5, 3, 1), ('1EM', 8, 3, 1), ('1EM', 10, 4, 1), ('1EM', 11, 4, 1),
    ('1EM', 12, 3, 1), ('1EM', 13, 2, 1), ('1EM', 14, 2, 1), ('1EM', 15, 2, 1),
    ('1EM', 17, 3, 1),
    ('2EM', 1, 6, 1), ('2EM', 2, 6, 1), ('2EM', 3, 3, 1), ('2EM', 4, 3, 1),
    ('2EM', 5, 3, 1), ('2EM', 8, 3, 1), ('2EM', 10, 4, 1), ('2EM', 11, 4, 1),
    ('2EM', 12, 3, 1), ('2EM', 13, 2, 1), ('2EM', 14, 2, 1), ('2EM', 15, 2, 1),
    ('2EM', 17, 3, 1),
    ('3EM', 1, 6, 1), ('3EM', 2, 6, 1), ('3EM', 3, 3, 1), ('3EM', 4, 3, 1),
    ('3EM', 5, 3, 1), ('3EM', 8, 3, 1), ('3EM', 10, 4, 1), ('3EM', 11, 4, 1),
    ('3EM', 12, 3, 1), ('3EM', 13, 2, 1), ('3EM', 14, 2, 1), ('3EM', 15, 2, 1),
    ('3EM', 17, 3, 1);

-- ============================================================
-- TURMA_DISCIPLINA (atribuicao professor-turma-disciplina)
-- Fonte de verdade para o worker. Cada professor respeita sua(s)
-- disciplina(s) e seus niveis_excluidos. tamanho_bloco = 1 para todas
-- (o cadastro marca exige_blocos = false / blocos_consecutivos = 1).
-- ============================================================
INSERT INTO turma_disciplina (id, turma_id, disciplina_id, professor_id, aulas_semana, tamanho_bloco) VALUES
    -- Turma 211 (1EM) - 44 aulas (turno Integral manha+tarde)
    (1,  1, 1,  2,  6, 1),  -- MAT  -> Carla
    (2,  1, 2,  12, 6, 1),  -- PORT -> Luane
    (3,  1, 3,  12, 3, 1),  -- LIT  -> Luane
    (4,  1, 4,  10, 3, 1),  -- HIS  -> Josei
    (5,  1, 5,  5,  3, 1),  -- GEO  -> Fabiane
    (6,  1, 8,  3,  3, 1),  -- ING  -> Carlos
    (7,  1, 10, 11, 4, 1),  -- FIS  -> Juliana
    (8,  1, 11, 8,  4, 1),  -- QUI  -> Jader
    (9,  1, 12, 14, 3, 1),  -- BIO  -> Murilo
    (10, 1, 13, 13, 2, 1),  -- FIL  -> Magnus
    (11, 1, 14, 13, 2, 1),  -- SOC  -> Magnus
    (12, 1, 15, 7,  2, 1),  -- COMP -> Ieda
    (13, 1, 17, 6,  3, 1),  -- RED  -> Gabriela
    -- Turma 221 (2EM) - 44 aulas
    (14, 2, 1,  2,  6, 1),  -- MAT  -> Carla
    (15, 2, 2,  12, 6, 1),  -- PORT -> Luane
    (16, 2, 3,  12, 3, 1),  -- LIT  -> Luane
    (17, 2, 4,  10, 3, 1),  -- HIS  -> Josei
    (18, 2, 5,  13, 3, 1),  -- GEO  -> Magnus
    (19, 2, 8,  3,  3, 1),  -- ING  -> Carlos
    (20, 2, 10, 11, 4, 1),  -- FIS  -> Juliana
    (21, 2, 11, 8,  4, 1),  -- QUI  -> Jader
    (22, 2, 12, 14, 3, 1),  -- BIO  -> Murilo
    (23, 2, 13, 13, 2, 1),  -- FIL  -> Magnus
    (24, 2, 14, 13, 2, 1),  -- SOC  -> Magnus
    (25, 2, 15, 7,  2, 1),  -- COMP -> Ieda
    (26, 2, 17, 6,  3, 1),  -- RED  -> Gabriela
    -- Turma 231 (3EM) - 44 aulas
    (27, 3, 1,  2,  6, 1),  -- MAT  -> Carla
    (28, 3, 2,  12, 6, 1),  -- PORT -> Luane
    (29, 3, 3,  12, 3, 1),  -- LIT  -> Luane
    (30, 3, 4,  10, 3, 1),  -- HIS  -> Josei
    (31, 3, 5,  13, 3, 1),  -- GEO  -> Magnus
    (32, 3, 8,  3,  3, 1),  -- ING  -> Carlos
    (33, 3, 10, 11, 4, 1),  -- FIS  -> Juliana
    (34, 3, 11, 8,  4, 1),  -- QUI  -> Jader
    (35, 3, 12, 14, 3, 1),  -- BIO  -> Murilo
    (36, 3, 13, 13, 2, 1),  -- FIL  -> Magnus
    (37, 3, 14, 13, 2, 1),  -- SOC  -> Magnus
    (38, 3, 15, 7,  2, 1),  -- COMP -> Ieda
    (39, 3, 17, 6,  3, 1),  -- RED  -> Gabriela
    -- Turma C61 (6EF)
    (40, 4, 2,  16, 5, 1),  -- PORT -> Rosana
    (41, 4, 1,  1,  5, 1),  -- MAT  -> Alan
    (42, 4, 16, 4,  4, 1),  -- CIE  -> Elis
    (43, 4, 4,  15, 3, 1),  -- HIS  -> Patricia
    (44, 4, 5,  13, 3, 1),  -- GEO  -> Magnus
    (45, 4, 8,  3,  2, 1),  -- ING  -> Carlos
    (46, 4, 7,  16, 2, 1),  -- ART  -> Rosana
    (47, 4, 6,  18, 2, 1),  -- EDF  -> Tatiana
    -- Turma C62 (6EF)
    (48, 5, 2,  16, 5, 1),  -- PORT -> Rosana
    (49, 5, 1,  1,  5, 1),  -- MAT  -> Alan
    (50, 5, 16, 4,  4, 1),  -- CIE  -> Elis
    (51, 5, 4,  15, 3, 1),  -- HIS  -> Patricia
    (52, 5, 5,  13, 3, 1),  -- GEO  -> Magnus
    (53, 5, 8,  3,  2, 1),  -- ING  -> Carlos
    (54, 5, 7,  16, 2, 1),  -- ART  -> Rosana
    (55, 5, 6,  18, 2, 1),  -- EDF  -> Tatiana
    -- Turma C71 (7EF)
    (56, 6, 2,  12, 5, 1),  -- PORT -> Luane
    (57, 6, 1,  1,  5, 1),  -- MAT  -> Alan
    (58, 6, 16, 8,  4, 1),  -- CIE  -> Jader
    (59, 6, 4,  15, 3, 1),  -- HIS  -> Patricia
    (60, 6, 5,  13, 3, 1),  -- GEO  -> Magnus
    (61, 6, 8,  3,  2, 1),  -- ING  -> Carlos
    (62, 6, 7,  9,  2, 1),  -- ART  -> Janaina
    (63, 6, 6,  18, 2, 1),  -- EDF  -> Tatiana
    -- Turma C81 (8EF)
    (64, 7, 2,  12, 5, 1),  -- PORT -> Luane
    (65, 7, 1,  1,  5, 1),  -- MAT  -> Alan
    (66, 7, 16, 8,  4, 1),  -- CIE  -> Jader
    (67, 7, 4,  15, 3, 1),  -- HIS  -> Patricia
    (68, 7, 5,  13, 3, 1),  -- GEO  -> Magnus
    (69, 7, 8,  3,  2, 1),  -- ING  -> Carlos
    (70, 7, 7,  9,  2, 1),  -- ART  -> Janaina
    (71, 7, 6,  18, 2, 1),  -- EDF  -> Tatiana
    -- Turma C82 (8EF)
    (72, 8, 2,  12, 5, 1),  -- PORT -> Luane
    (73, 8, 1,  1,  5, 1),  -- MAT  -> Alan
    (74, 8, 16, 8,  4, 1),  -- CIE  -> Jader
    (75, 8, 4,  15, 3, 1),  -- HIS  -> Patricia
    (76, 8, 5,  13, 3, 1),  -- GEO  -> Magnus
    (77, 8, 8,  3,  2, 1),  -- ING  -> Carlos
    (78, 8, 7,  9,  2, 1),  -- ART  -> Janaina
    (79, 8, 6,  18, 2, 1),  -- EDF  -> Tatiana
    -- Turma C91 (9EF)
    (80, 9, 2,  12, 5, 1),  -- PORT -> Luane
    (81, 9, 1,  2,  5, 1),  -- MAT  -> Carla
    (82, 9, 16, 8,  4, 1),  -- CIE  -> Jader
    (83, 9, 4,  15, 3, 1),  -- HIS  -> Patricia
    (84, 9, 5,  5,  3, 1),  -- GEO  -> Fabiane
    (85, 9, 8,  3,  2, 1),  -- ING  -> Carlos
    (86, 9, 7,  9,  2, 1),  -- ART  -> Janaina
    (87, 9, 6,  17, 2, 1);  -- EDF  -> Silvana

-- ============================================================
-- DISPONIBILIDADE DOS PROFESSORES
-- Default: todos disponiveis em todos os time_slots, preferencia 3.
-- Preferencia maior nos 3 primeiros periodos da manha; menor nos ultimos
-- periodos do dia (EF periodo 7; EM tarde 12 e 13).
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
  AND p.numero IN (1, 2, 3);

UPDATE professor_disponibilidade pd
SET preferencia = 2
FROM time_slot ts
JOIN periodo p ON ts.periodo_id = p.id
WHERE pd.time_slot_id = ts.id
  AND ((p.turno_id = 1 AND p.numero = 7)
    OR (p.turno_id = 4 AND p.numero IN (12, 13)));

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
-- VIABILIDADE (HC4) - demanda x capacidade por turno
-- Com o EM no turno Integral (50 slots) e o EF no turno Manha (30 slots), toda
-- a demanda cabe e o gerador OR-Tools (HC4 dura) consegue alocar 100%:
--   EF (30 slots, demanda 26/turma): maior carga de professor = Alan MAT 25.
--   EM (50 slots, demanda 44/turma): maior carga de professor = Luane 27.
-- Espanhol nao e ofertada (nenhum professor cadastrado a leciona).
-- ============================================================
