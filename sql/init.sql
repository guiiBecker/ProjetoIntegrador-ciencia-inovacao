-- ============================================================
-- PROJETO INTEGRADOR - CIENCIA E INOVACAO
-- Sistema de Grade Horaria Escolar
-- Schema definitivo - PostgreSQL 16
-- ============================================================

-- =========================
-- TURNO (Manha, Tarde, Noite)
-- =========================
CREATE TABLE turno (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE
);

-- =========================
-- DIA DA SEMANA
-- =========================
CREATE TABLE dia_semana (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(20) NOT NULL UNIQUE
);

-- =========================
-- PROFESSOR
-- =========================
CREATE TABLE professor (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    carga_horaria_max INT NOT NULL DEFAULT 40,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- USUARIO DO SISTEMA
-- =========================
CREATE TABLE app_user (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =========================
-- DISCIPLINA
-- =========================
CREATE TABLE disciplina (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    sigla VARCHAR(10),
    peso INT NOT NULL DEFAULT 1
);

-- =========================
-- TURMA
-- =========================
CREATE TABLE turma (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    serie VARCHAR(20) NOT NULL,
    ano_letivo INT NOT NULL,
    turno_id INT NOT NULL REFERENCES turno(id) ON DELETE RESTRICT,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(nome, ano_letivo)
);

-- =========================
-- PERIODO (horarios dentro de um turno)
-- =========================
CREATE TABLE periodo (
    id SERIAL PRIMARY KEY,
    numero INT NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'aula',
    turno_id INT NOT NULL REFERENCES turno(id) ON DELETE CASCADE,
    UNIQUE(numero, turno_id),
    CHECK (hora_fim > hora_inicio),
    CHECK (tipo IN ('aula', 'intervalo', 'extra'))
);

-- =========================
-- TIME SLOT (combinacao dia + periodo - apenas periodos de aula)
-- =========================
CREATE TABLE time_slot (
    id SERIAL PRIMARY KEY,
    dia_id INT NOT NULL REFERENCES dia_semana(id) ON DELETE CASCADE,
    periodo_id INT NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
    UNIQUE(dia_id, periodo_id)
);

-- =========================
-- DISPONIBILIDADE DO PROFESSOR
-- =========================
CREATE TABLE professor_disponibilidade (
    id SERIAL PRIMARY KEY,
    professor_id INT NOT NULL REFERENCES professor(id) ON DELETE CASCADE,
    time_slot_id INT NOT NULL REFERENCES time_slot(id) ON DELETE CASCADE,
    disponivel BOOLEAN NOT NULL DEFAULT TRUE,
    preferencia INT NOT NULL DEFAULT 0 CHECK (preferencia BETWEEN 0 AND 5),
    UNIQUE(professor_id, time_slot_id)
);

-- =========================
-- CURRICULO (quais disciplinas cada serie tem)
-- =========================
CREATE TABLE curriculo (
    id SERIAL PRIMARY KEY,
    serie VARCHAR(20) NOT NULL,
    disciplina_id INT NOT NULL REFERENCES disciplina(id) ON DELETE CASCADE,
    aulas_semana INT NOT NULL CHECK (aulas_semana > 0),
    tamanho_bloco INT NOT NULL DEFAULT 1 CHECK (tamanho_bloco > 0),
    UNIQUE(serie, disciplina_id)
);

-- =========================
-- TURMA_DISCIPLINA (atribuicao professor-turma-disciplina)
-- =========================
CREATE TABLE turma_disciplina (
    id SERIAL PRIMARY KEY,
    turma_id INT NOT NULL REFERENCES turma(id) ON DELETE CASCADE,
    disciplina_id INT NOT NULL REFERENCES disciplina(id) ON DELETE RESTRICT,
    professor_id INT NOT NULL REFERENCES professor(id) ON DELETE RESTRICT,
    aulas_semana INT NOT NULL CHECK (aulas_semana > 0),
    tamanho_bloco INT NOT NULL DEFAULT 1 CHECK (tamanho_bloco > 0),
    UNIQUE(turma_id, disciplina_id)
);

-- =========================
-- HORARIO (grade final gerada)
-- =========================
CREATE TABLE horario (
    id SERIAL PRIMARY KEY,
    turma_disciplina_id INT NOT NULL REFERENCES turma_disciplina(id) ON DELETE CASCADE,
    time_slot_id INT NOT NULL REFERENCES time_slot(id) ON DELETE CASCADE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(turma_disciplina_id, time_slot_id)
);

-- =========================
-- LINK DE FORMULARIO DO PROFESSOR
-- =========================
CREATE TABLE professor_form_link (
    id SERIAL PRIMARY KEY,
    professor_id INT NOT NULL REFERENCES professor(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    respondido BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    respondido_em TIMESTAMP
);

-- ============================================================
-- TABELAS DO SISTEMA DE AGENDAMENTO
-- ============================================================

CREATE TABLE schedule_request (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_option (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES schedule_request(id) ON DELETE CASCADE,
    strategy VARCHAR(50) NOT NULL,
    score NUMERIC(6,2) DEFAULT 0,
    selected BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_option_item (
    id SERIAL PRIMARY KEY,
    option_id INT NOT NULL REFERENCES schedule_option(id) ON DELETE CASCADE,
    turma_disciplina_id INT NOT NULL REFERENCES turma_disciplina(id) ON DELETE CASCADE,
    time_slot_id INT NOT NULL REFERENCES time_slot(id) ON DELETE CASCADE,
    UNIQUE(option_id, turma_disciplina_id, time_slot_id)
);

-- =========================
-- RESTRICOES SOFT (pesos ajustaveis pelo moderador)
-- Cada linha e uma restricao soft que o gerador de grade pondera. O moderador
-- ajusta o `peso` (0 = restricao ignorada; maior = mais importante). O worker
-- le esta tabela a cada geracao; os defaults espelham os pesos historicos do
-- codigo do scheduler.
-- =========================
CREATE TABLE soft_constraint (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    peso NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (peso >= 0),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX idx_professor_ativo ON professor(ativo);
CREATE INDEX idx_turma_ano_letivo ON turma(ano_letivo);
CREATE INDEX idx_turma_turno ON turma(turno_id);
CREATE INDEX idx_periodo_turno ON periodo(turno_id);
CREATE INDEX idx_timeslot_dia_periodo ON time_slot(dia_id, periodo_id);
CREATE INDEX idx_prof_disp_professor ON professor_disponibilidade(professor_id);
CREATE INDEX idx_prof_disp_slot ON professor_disponibilidade(time_slot_id);
CREATE INDEX idx_turma_disc_turma ON turma_disciplina(turma_id);
CREATE INDEX idx_turma_disc_professor ON turma_disciplina(professor_id);
CREATE INDEX idx_horario_slot ON horario(time_slot_id);
CREATE INDEX idx_horario_turma_disc ON horario(turma_disciplina_id);
CREATE INDEX idx_schedule_option_request ON schedule_option(request_id);
CREATE INDEX idx_schedule_item_option ON schedule_option_item(option_id);
CREATE INDEX idx_form_link_token ON professor_form_link(token);
CREATE INDEX idx_form_link_professor ON professor_form_link(professor_id);

-- ============================================================
-- DADOS INICIAIS (apenas estrutura fixa)
-- ============================================================

-- Turnos
INSERT INTO turno (nome) VALUES
    ('Manha'),
    ('Tarde'),
    ('Noite');

-- Dias da semana (dias letivos)
INSERT INTO dia_semana (nome) VALUES
    ('Segunda'),
    ('Terca'),
    ('Quarta'),
    ('Quinta'),
    ('Sexta');

-- Restricoes soft com pesos default (espelham os pesos historicos do scheduler).
INSERT INTO soft_constraint (codigo, nome, descricao, peso) VALUES
    ('SC1', 'Concentracao diaria da disciplina',
     'Penaliza muitas aulas da mesma disciplina no mesmo dia para uma turma.', 3),
    ('SC2', 'Aulas consecutivas da disciplina',
     'Penaliza sequencias longas de periodos seguidos da mesma disciplina.', 3),
    ('SC5', 'Janela ociosa do professor',
     'Penaliza horarios vagos entre aulas do professor no mesmo dia.', 1),
    ('SC6', 'Disciplina pesada no ultimo periodo',
     'Penaliza disciplinas cognitivamente pesadas alocadas no ultimo periodo do dia.', 1.5),
    ('SC7', 'Disciplina pratica no primeiro periodo',
     'Penaliza disciplinas praticas alocadas no primeiro periodo do dia.', 1);
