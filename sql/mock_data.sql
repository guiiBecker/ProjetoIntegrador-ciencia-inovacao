-- ============================================================
-- MOCK DATA - PROJETO INTEGRADOR
-- Sistema de Grade Horaria Escolar
--
-- ENSINO MEDIO (EM):  turno Integral (manha + tarde, 8 aulas/dia)
-- ENSINO FUNDAMENTAL (EF, anos finais): turno Tarde (5 aulas/dia)
--
-- Professores especializados (EM-only ou EF-only) para evitar
-- conflitos de horario no mundo real entre os turnos sobrepostos.
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
-- ============================================================
INSERT INTO turno (id, nome) VALUES
    (1, 'Manha'),     -- nao usado nesta mock (existe para compat)
    (2, 'Tarde'),     -- Ensino Fundamental (anos finais)
    (3, 'Noite'),     -- nao usado nesta mock
    (4, 'Integral');  -- Ensino Medio (manha + tarde combinados)

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
-- DISCIPLINAS
-- IDs 1-15: Formacao Geral Basica do EM
-- IDs 16-20: Itinerarios Formativos do EM
-- ID 21: Ciencias (apenas EF; no EM se desdobra em FIS/QUI/BIO)
-- ============================================================
INSERT INTO disciplina (id, nome, sigla, peso) VALUES
    (1,  'Matematica',                              'MAT',  4),
    (2,  'Lingua Portuguesa',                       'PORT', 4),
    (3,  'Literatura',                              'LIT',  2),
    (4,  'Historia',                                'HIS',  3),
    (5,  'Geografia',                               'GEO',  3),
    (6,  'Educacao Fisica',                         'EDF',  1),
    (7,  'Arte',                                    'ART',  1),
    (8,  'Lingua Inglesa',                          'ING',  2),
    (9,  'Lingua Espanhola',                        'ESP',  2),
    (10, 'Fisica',                                  'FIS',  4),
    (11, 'Quimica',                                 'QUI',  4),
    (12, 'Biologia',                                'BIO',  4),
    (13, 'Filosofia',                               'FIL',  2),
    (14, 'Sociologia',                              'SOC',  2),
    (15, 'Computacao',                              'COMP', 2),
    (16, 'Projeto de Vida e Mundo do Trabalho',     'PROJ', 2),
    (17, 'Trilha I - Protagonismo Juvenil',         'TR1',  2),
    (18, 'Trilha II - Economia e Sociedade',        'TR2',  3),
    (19, 'Trilha III - Futuro das Cidades',         'TR3',  3),
    (20, 'Trilha IV - Praticas Profissionais',      'TR4',  3),
    (21, 'Ciencias',                                'CIE',  3);

-- ============================================================
-- PROFESSORES
-- IDs 1-11: EM (atribuidos somente a turmas Integral)
-- IDs 12-15: EF (atribuidos somente a turmas Tarde)
-- A separacao evita que o algoritmo precise reconciliar conflitos
-- de tempo real entre turnos cujos slots se sobrepoem.
-- ============================================================
INSERT INTO professor (id, nome, email, carga_horaria_max, ativo) VALUES
    -- Ensino Medio
    (1,  'Carlos Almeida',     'carlos.almeida@escola.edu.br',     40, TRUE),  -- MAT
    (2,  'Julia Mendes',       'julia.mendes@escola.edu.br',       40, TRUE),  -- FIS
    (3,  'Roberto Lima',       'roberto.lima@escola.edu.br',       40, TRUE),  -- QUI
    (4,  'Lucas Pereira',      'lucas.pereira@escola.edu.br',      40, TRUE),  -- BIO
    (5,  'Ana Souza',          'ana.souza@escola.edu.br',          40, TRUE),  -- PORT, LIT
    (6,  'Maria Oliveira',     'maria.oliveira@escola.edu.br',     40, TRUE),  -- ING, ESP, ART
    (7,  'Fernanda Ribeiro',   'fernanda.ribeiro@escola.edu.br',   40, TRUE),  -- HIS, GEO
    (8,  'Bruno Santana',      'bruno.santana@escola.edu.br',      40, TRUE),  -- FIL, SOC, COMP
    (9,  'Paulo Santos',       'paulo.santos@escola.edu.br',       40, TRUE),  -- EDF
    (10, 'Daniela Reis',       'daniela.reis@escola.edu.br',       40, TRUE),  -- PROJ, TR1
    (11, 'Edson Ribeiro',      'edson.ribeiro@escola.edu.br',      40, TRUE),  -- TR2, TR4
    -- Ensino Medio (reforco - dividem carga de disciplinas pesadas)
    (12, 'Beatriz Mello',      'beatriz.mello@escola.edu.br',      40, TRUE),  -- MAT (3A)
    (13, 'Larissa Costa',      'larissa.costa@escola.edu.br',      40, TRUE),  -- PORT, LIT (3A)
    (14, 'Patricia Vieira',    'patricia.vieira@escola.edu.br',    40, TRUE),  -- GEO (todas EM)
    -- Ensino Fundamental (anos finais)
    (15, 'Marina Silva',       'marina.silva@escola.edu.br',       30, TRUE),  -- PORT-EF, HIS-EF (6A)
    (16, 'Pedro Costa',        'pedro.costa@escola.edu.br',        30, TRUE),  -- MAT-EF, CIE-EF (6A)
    (17, 'Helena Rocha',       'helena.rocha@escola.edu.br',       30, TRUE),  -- GEO-EF, ART-EF
    (18, 'Tiago Borges',       'tiago.borges@escola.edu.br',       30, TRUE),  -- EDF-EF, ING-EF
    (19, 'Mateus Rocha',       'mateus.rocha@escola.edu.br',       30, TRUE),  -- MAT-EF, CIE-EF (9A)
    (20, 'Camila Lopes',       'camila.lopes@escola.edu.br',       30, TRUE);  -- PORT-EF, HIS-EF (9A)

-- ============================================================
-- TURMAS
-- 3 turmas EM (uma por ano) no turno Integral
-- 2 turmas EF (6 e 9 anos) no turno Tarde
-- ============================================================
INSERT INTO turma (id, nome, serie, ano_letivo, turno_id, ativa) VALUES
    (1, '1A', '1ano', 2026, 4, TRUE),  -- EM 1ano - Integral
    (2, '2A', '2ano', 2026, 4, TRUE),  -- EM 2ano - Integral
    (3, '3A', '3ano', 2026, 4, TRUE),  -- EM 3ano - Integral
    (4, '6A', '6ano', 2026, 2, TRUE),  -- EF 6ano - Tarde
    (5, '9A', '9ano', 2026, 2, TRUE);  -- EF 9ano - Tarde

-- ============================================================
-- PERIODOS
--
-- Tarde (id=2, EF): 5 aulas + 1 intervalo (recreio) = 6 periodos
--   Total de slots por turma: 5 aulas/dia x 5 dias = 25 slots/semana
--
-- Integral (id=4, EM): 8 aulas + 1 intervalo (almoco) = 9 periodos
--   Total de slots por turma: 8 aulas/dia x 5 dias = 40 slots/semana
--
-- Numeros nao-consecutivos onde ha intervalo asseguram que blocos
-- de aulas (tamanho_bloco > 1) nao atravessem o intervalo.
-- ============================================================
INSERT INTO periodo (id, numero, hora_inicio, hora_fim, tipo, turno_id) VALUES
    -- Tarde (turno 2) - Ensino Fundamental
    (1,  1, '13:00', '13:50', 'aula',      2),
    (2,  2, '13:50', '14:40', 'aula',      2),
    (3,  3, '14:40', '15:00', 'intervalo', 2),
    (4,  4, '15:00', '15:50', 'aula',      2),
    (5,  5, '15:50', '16:40', 'aula',      2),
    (6,  6, '16:40', '17:30', 'aula',      2),
    -- Integral (turno 4) - Ensino Medio
    (7,  1, '07:00', '07:50', 'aula',      4),
    (8,  2, '07:50', '08:40', 'aula',      4),
    (9,  3, '08:40', '09:30', 'aula',      4),
    (10, 4, '09:30', '10:20', 'aula',      4),
    (11, 5, '10:20', '12:00', 'intervalo', 4),  -- almoco
    (12, 6, '12:00', '12:50', 'aula',      4),
    (13, 7, '12:50', '13:40', 'aula',      4),
    (14, 8, '13:40', '14:30', 'aula',      4),
    (15, 9, '14:30', '15:20', 'aula',      4);

-- ============================================================
-- TIME SLOTS (gerados automaticamente: dia x periodo, apenas aulas)
-- Tarde:    5 aulas x 5 dias = 25
-- Integral: 8 aulas x 5 dias = 40
-- Total: 65 time_slots
-- ============================================================
INSERT INTO time_slot (dia_id, periodo_id)
SELECT d.id, p.id
FROM dia_semana d
CROSS JOIN periodo p
WHERE p.tipo = 'aula'
ORDER BY p.turno_id, d.id, p.numero;

-- ============================================================
-- CURRICULO (template por serie - informativo, nao usado pelo worker)
-- ============================================================
INSERT INTO curriculo (serie, disciplina_id, aulas_semana, tamanho_bloco) VALUES
    -- 1ano EM (36h: 28 FGB + 8 Itinerarios com Trilha II)
    ('1ano', 1,  4, 1),  -- MAT
    ('1ano', 2,  3, 1),  -- PORT
    ('1ano', 3,  1, 1),  -- LIT
    ('1ano', 4,  2, 1),  -- HIS
    ('1ano', 5,  2, 1),  -- GEO
    ('1ano', 6,  2, 1),  -- EDF
    ('1ano', 7,  1, 1),  -- ART
    ('1ano', 8,  1, 1),  -- ING
    ('1ano', 9,  1, 1),  -- ESP
    ('1ano', 10, 3, 1),  -- FIS
    ('1ano', 11, 3, 1),  -- QUI
    ('1ano', 12, 3, 1),  -- BIO
    ('1ano', 13, 1, 1),  -- FIL
    ('1ano', 14, 1, 1),  -- SOC
    ('1ano', 16, 3, 1),  -- PROJ
    ('1ano', 17, 2, 1),  -- TR1
    ('1ano', 18, 3, 1),  -- TR2
    -- 2ano EM (36h: 28 FGB + 8 Itinerarios com Trilha II)
    ('2ano', 1,  4, 1),  -- MAT
    ('2ano', 2,  4, 1),  -- PORT
    ('2ano', 3,  1, 1),  -- LIT
    ('2ano', 4,  2, 1),  -- HIS
    ('2ano', 5,  2, 1),  -- GEO
    ('2ano', 6,  2, 1),  -- EDF
    ('2ano', 8,  1, 1),  -- ING
    ('2ano', 9,  1, 1),  -- ESP
    ('2ano', 10, 3, 1),  -- FIS
    ('2ano', 11, 3, 1),  -- QUI
    ('2ano', 12, 3, 1),  -- BIO
    ('2ano', 13, 1, 1),  -- FIL
    ('2ano', 14, 1, 1),  -- SOC
    ('2ano', 16, 3, 1),  -- PROJ
    ('2ano', 17, 2, 1),  -- TR1
    ('2ano', 18, 3, 1),  -- TR2
    -- 3ano EM (32h: 28 FGB + 4 Itinerarios com Trilha IV)
    ('3ano', 1,  4, 1),  -- MAT
    ('3ano', 2,  4, 1),  -- PORT
    ('3ano', 3,  1, 1),  -- LIT
    ('3ano', 4,  2, 1),  -- HIS
    ('3ano', 5,  2, 1),  -- GEO
    ('3ano', 6,  2, 1),  -- EDF
    ('3ano', 8,  1, 1),  -- ING
    ('3ano', 10, 3, 1),  -- FIS
    ('3ano', 11, 3, 1),  -- QUI
    ('3ano', 12, 3, 1),  -- BIO
    ('3ano', 13, 1, 1),  -- FIL
    ('3ano', 14, 1, 1),  -- SOC
    ('3ano', 15, 1, 1),  -- COMP
    ('3ano', 17, 2, 1),  -- TR1
    ('3ano', 20, 2, 1),  -- TR4
    -- 6ano EF (25h - encaixa exatamente nos 25 slots/semana do turno Tarde)
    ('6ano', 2,  4, 1),  -- PORT
    ('6ano', 1,  5, 1),  -- MAT
    ('6ano', 21, 4, 1),  -- CIE
    ('6ano', 4,  3, 1),  -- HIS
    ('6ano', 5,  3, 1),  -- GEO
    ('6ano', 7,  2, 1),  -- ART
    ('6ano', 6,  2, 1),  -- EDF
    ('6ano', 8,  2, 1),  -- ING
    -- 9ano EF (25h - mesma estrutura)
    ('9ano', 2,  4, 1),  -- PORT
    ('9ano', 1,  5, 1),  -- MAT
    ('9ano', 21, 4, 1),  -- CIE
    ('9ano', 4,  3, 1),  -- HIS
    ('9ano', 5,  3, 1),  -- GEO
    ('9ano', 7,  2, 1),  -- ART
    ('9ano', 6,  2, 1),  -- EDF
    ('9ano', 8,  2, 1);  -- ING

-- ============================================================
-- TURMA_DISCIPLINA (atribuicao professor-turma-disciplina)
-- Esta e a fonte de verdade para o worker
-- ============================================================
INSERT INTO turma_disciplina (id, turma_id, disciplina_id, professor_id, aulas_semana, tamanho_bloco) VALUES
    -- Turma 1A (1ano EM, Integral) - 17 disciplinas, 36h/semana
    (1,  1, 1,  1,  4, 1),  -- MAT  -> Carlos
    (2,  1, 2,  5,  3, 1),  -- PORT -> Ana
    (3,  1, 3,  5,  1, 1),  -- LIT  -> Ana
    (4,  1, 4,  7,  2, 1),  -- HIS  -> Fernanda
    (5,  1, 5,  14, 2, 1),  -- GEO  -> Patricia (novo)
    (6,  1, 6,  9,  2, 1),  -- EDF  -> Paulo
    (7,  1, 7,  6,  1, 1),  -- ART  -> Maria
    (8,  1, 8,  6,  1, 1),  -- ING  -> Maria
    (9,  1, 9,  6,  1, 1),  -- ESP  -> Maria
    (10, 1, 10, 2,  3, 1),  -- FIS  -> Julia
    (11, 1, 11, 3,  3, 1),  -- QUI  -> Roberto
    (12, 1, 12, 4,  3, 1),  -- BIO  -> Lucas
    (13, 1, 13, 8,  1, 1),  -- FIL  -> Bruno
    (14, 1, 14, 8,  1, 1),  -- SOC  -> Bruno
    (15, 1, 16, 10, 3, 1),  -- PROJ -> Daniela
    (16, 1, 17, 10, 2, 1),  -- TR1  -> Daniela
    (17, 1, 18, 11, 3, 1),  -- TR2  -> Edson
    -- Turma 2A (2ano EM, Integral) - 16 disciplinas, 36h/semana
    (18, 2, 1,  1,  4, 1),  -- MAT  -> Carlos
    (19, 2, 2,  5,  4, 1),  -- PORT -> Ana
    (20, 2, 3,  5,  1, 1),  -- LIT  -> Ana
    (21, 2, 4,  7,  2, 1),  -- HIS  -> Fernanda
    (22, 2, 5,  14, 2, 1),  -- GEO  -> Patricia (novo)
    (23, 2, 6,  9,  2, 1),  -- EDF  -> Paulo
    (24, 2, 8,  6,  1, 1),  -- ING  -> Maria
    (25, 2, 9,  6,  1, 1),  -- ESP  -> Maria
    (26, 2, 10, 2,  3, 1),  -- FIS  -> Julia
    (27, 2, 11, 3,  3, 1),  -- QUI  -> Roberto
    (28, 2, 12, 4,  3, 1),  -- BIO  -> Lucas
    (29, 2, 13, 8,  1, 1),  -- FIL  -> Bruno
    (30, 2, 14, 8,  1, 1),  -- SOC  -> Bruno
    (31, 2, 16, 10, 3, 1),  -- PROJ -> Daniela
    (32, 2, 17, 10, 2, 1),  -- TR1  -> Daniela
    (33, 2, 18, 11, 3, 1),  -- TR2  -> Edson
    -- Turma 3A (3ano EM, Integral) - 15 disciplinas, 32h/semana
    (34, 3, 1,  12, 4, 1),  -- MAT  -> Beatriz (novo, libera Carlos)
    (35, 3, 2,  13, 4, 1),  -- PORT -> Larissa (novo, libera Ana)
    (36, 3, 3,  13, 1, 1),  -- LIT  -> Larissa
    (37, 3, 4,  7,  2, 1),  -- HIS  -> Fernanda
    (38, 3, 5,  14, 2, 1),  -- GEO  -> Patricia (novo)
    (39, 3, 6,  9,  2, 1),  -- EDF  -> Paulo
    (40, 3, 8,  6,  1, 1),  -- ING  -> Maria
    (41, 3, 10, 2,  3, 1),  -- FIS  -> Julia
    (42, 3, 11, 3,  3, 1),  -- QUI  -> Roberto
    (43, 3, 12, 4,  3, 1),  -- BIO  -> Lucas
    (44, 3, 13, 8,  1, 1),  -- FIL  -> Bruno
    (45, 3, 14, 8,  1, 1),  -- SOC  -> Bruno
    (46, 3, 15, 8,  1, 1),  -- COMP -> Bruno
    (47, 3, 17, 10, 2, 1),  -- TR1  -> Daniela
    (48, 3, 20, 11, 2, 1),  -- TR4  -> Edson
    -- Turma 6A (6ano EF, Tarde) - 8 disciplinas, 25h/semana (encaixa em 25 slots)
    (49, 4, 2,  15, 4, 1),  -- PORT -> Marina
    (50, 4, 1,  16, 5, 1),  -- MAT  -> Pedro
    (51, 4, 21, 16, 4, 1),  -- CIE  -> Pedro
    (52, 4, 4,  15, 3, 1),  -- HIS  -> Marina
    (53, 4, 5,  17, 3, 1),  -- GEO  -> Helena
    (54, 4, 7,  17, 2, 1),  -- ART  -> Helena
    (55, 4, 6,  18, 2, 1),  -- EDF  -> Tiago
    (56, 4, 8,  18, 2, 1),  -- ING  -> Tiago
    -- Turma 9A (9ano EF, Tarde) - 8 disciplinas, 25h/semana
    (57, 5, 2,  20, 4, 1),  -- PORT -> Camila (novo, libera Marina)
    (58, 5, 1,  19, 5, 1),  -- MAT  -> Mateus (novo, libera Pedro)
    (59, 5, 21, 19, 4, 1),  -- CIE  -> Mateus
    (60, 5, 4,  20, 3, 1),  -- HIS  -> Camila
    (61, 5, 5,  17, 3, 1),  -- GEO  -> Helena
    (62, 5, 7,  17, 2, 1),  -- ART  -> Helena
    (63, 5, 6,  18, 2, 1),  -- EDF  -> Tiago
    (64, 5, 8,  18, 2, 1);  -- ING  -> Tiago

-- ============================================================
-- AULAS GEMINADAS (tamanho_bloco = 2)
-- Materias do nucleo pesado (peso >= 3) sao agendadas em blocos de 2
-- aulas seguidas. Ex.: Matematica 4 aulas -> [2,2]; 5 aulas -> [2,2,1].
-- Disciplinas leves (peso <= 2) e de 1 aula permanecem em blocos de 1.
-- O scheduler usa tamanho_bloco para colocar as aulas de forma contigua.
-- ============================================================
UPDATE turma_disciplina td
SET tamanho_bloco = 2
FROM disciplina d
WHERE td.disciplina_id = d.id
  AND d.peso >= 3
  AND td.aulas_semana >= 2;

UPDATE curriculo c
SET tamanho_bloco = 2
FROM disciplina d
WHERE c.disciplina_id = d.id
  AND d.peso >= 3
  AND c.aulas_semana >= 2;

-- ============================================================
-- DISPONIBILIDADE DOS PROFESSORES
-- Default: todos os professores disponiveis em todos os time_slots,
-- preferencia 3. As variacoes abaixo dao as duas estrategias do
-- algoritmo material para diferenciar suas escolhas.
-- ============================================================
INSERT INTO professor_disponibilidade (professor_id, time_slot_id, disponivel, preferencia)
SELECT p.id, ts.id, TRUE, 3
FROM professor p
CROSS JOIN time_slot ts;

-- Preferencia mais alta para os 4 primeiros periodos do dia (qualquer turno)
UPDATE professor_disponibilidade pd
SET preferencia = 4
FROM time_slot ts
JOIN periodo p ON ts.periodo_id = p.id
WHERE pd.time_slot_id = ts.id
  AND p.numero IN (1, 2, 3, 4);

-- Preferencia mais baixa para os 2 ultimos periodos do dia
UPDATE professor_disponibilidade pd
SET preferencia = 2
FROM time_slot ts
JOIN periodo p ON ts.periodo_id = p.id
WHERE pd.time_slot_id = ts.id
  AND p.numero IN (8, 9);

-- ============================================================
-- PROFESSOR_FORM_LINK (link unico por professor para preencher disponibilidade)
-- ============================================================
INSERT INTO professor_form_link (id, professor_id, token, respondido, respondido_em) VALUES
    (1,  1,  'tok_carlos_almeida_2026',     FALSE, NULL),
    (2,  2,  'tok_julia_mendes_2026',       FALSE, NULL),
    (3,  3,  'tok_roberto_lima_2026',       FALSE, NULL),
    (4,  4,  'tok_lucas_pereira_2026',      FALSE, NULL),
    (5,  5,  'tok_ana_souza_2026',          FALSE, NULL),
    (6,  6,  'tok_maria_oliveira_2026',     FALSE, NULL),
    (7,  7,  'tok_fernanda_ribeiro_2026',   FALSE, NULL),
    (8,  8,  'tok_bruno_santana_2026',      FALSE, NULL),
    (9,  9,  'tok_paulo_santos_2026',       FALSE, NULL),
    (10, 10, 'tok_daniela_reis_2026',       FALSE, NULL),
    (11, 11, 'tok_edson_ribeiro_2026',      FALSE, NULL),
    (12, 12, 'tok_beatriz_mello_2026',      FALSE, NULL),
    (13, 13, 'tok_larissa_costa_2026',      FALSE, NULL),
    (14, 14, 'tok_patricia_vieira_2026',    FALSE, NULL),
    (15, 15, 'tok_marina_silva_2026',       FALSE, NULL),
    (16, 16, 'tok_pedro_costa_2026',        FALSE, NULL),
    (17, 17, 'tok_helena_rocha_2026',       FALSE, NULL),
    (18, 18, 'tok_tiago_borges_2026',       FALSE, NULL),
    (19, 19, 'tok_mateus_rocha_2026',       FALSE, NULL),
    (20, 20, 'tok_camila_lopes_2026',       FALSE, NULL);

-- ============================================================
-- AJUSTAR SEQUENCES (para novos inserts via UI nao conflitarem)
-- schedule_request / schedule_option / schedule_option_item ficam vazios
-- de proposito: a aplicacao gera a grade em runtime.
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
