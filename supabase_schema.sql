-- ==============================================================================
-- ENEM 2026 - ESQUEMA COMPLETO DO BANCO DE DADOS SUPABASE (POSTGRESQL)
-- Script DDL, Constraints, RLS, Chaves de Acesso e Consultas de Gestão
-- ==============================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA DE VAGAS (vacancies)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vacancies (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    value NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
    city TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    school TEXT NOT NULL,
    coordinator TEXT NOT NULL,
    coordination_number TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    min_age INTEGER NOT NULL DEFAULT 18,
    max_age INTEGER NOT NULL DEFAULT 75,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de performance para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_vacancies_city ON public.vacancies (city);
CREATE INDEX IF NOT EXISTS idx_vacancies_school ON public.vacancies (school);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON public.vacancies (status);
CREATE INDEX IF NOT EXISTS idx_vacancies_coord ON public.vacancies (coordination_number);

-- ==============================================================================
-- 3. TABELA DE INSCRIÇÕES / COLABORADORES (contributor)
-- Regra Estrita: Apenas 1 inscrição por CPF em todo o sistema
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.contributor (
    id BIGSERIAL PRIMARY KEY,
    vacancy_id BIGINT NOT NULL REFERENCES public.vacancies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    city TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 16 AND age <= 100),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cadastrado', 'recusado')),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    cebraspe_verified BOOLEAN NOT NULL DEFAULT false,
    referrer_name TEXT,
    referrer_phone TEXT,
    -- REGRA FUNDAMENTAL: Só pode haver 1 CPF cadastrado no sistema (não pode cadastrar em mais de uma vaga)
    CONSTRAINT unique_applicant_cpf UNIQUE (cpf)
);

-- Índices para integridade e busca ágil
CREATE INDEX IF NOT EXISTS idx_contributor_cpf ON public.contributor (cpf);
CREATE INDEX IF NOT EXISTS idx_contributor_vacancy ON public.contributor (vacancy_id);
CREATE INDEX IF NOT EXISTS idx_contributor_status ON public.contributor (status);
CREATE INDEX IF NOT EXISTS idx_contributor_city ON public.contributor (city);

-- ==============================================================================
-- 4. TABELA DE COORDENAÇÕES (coordinations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coordinations (
    id BIGSERIAL PRIMARY KEY,
    coordination_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    coordinator_name TEXT NOT NULL,
    coordinator_email TEXT NOT NULL,
    assistant_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coordinations_number ON public.coordinations (coordination_number);

-- ==============================================================================
-- 5. TABELA DE PERFIS DE USUÁRIOS E CONTAS (user_profiles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    is_administrator BOOLEAN NOT NULL DEFAULT false,
    coordination_number TEXT REFERENCES public.coordinations(coordination_number) ON DELETE SET NULL,
    role_title TEXT DEFAULT 'Coordenador Titular',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_coord ON public.user_profiles (coordination_number);

-- ==============================================================================
-- 6. TABELA DE CHAVES DE ACESSO AO SITE (access_tokens)
-- Qualquer chave cadastrada concede acesso administrativo/gestão ao portal
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.access_tokens (
    id BIGSERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'coordenador', 'gestor', 'consulta')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON public.access_tokens (token);
CREATE INDEX IF NOT EXISTS idx_access_tokens_active ON public.access_tokens (is_active);

-- ==============================================================================
-- 7. POLÍTICAS DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- Permite leitura e gravação integrada
-- ==============================================================================
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Manage Coordinations" ON public.coordinations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Manage User Profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);

-- Vagas: Leitura pública de todas as vagas abertas
CREATE POLICY "Public Read Vacancies" 
ON public.vacancies FOR SELECT 
USING (true);

-- Vagas: Inserção/Atualização/Deleção liberada para a aplicação / chaves de acesso
CREATE POLICY "Manage Vacancies" 
ON public.vacancies FOR ALL 
USING (true)
WITH CHECK (true);

-- Inscrições: Candidatos podem se inscrever publicamente
CREATE POLICY "Public Insert contributor" 
ON public.contributor FOR INSERT 
WITH CHECK (true);

-- Inscrições: Leitura e gestão para painel administrativo / portal
CREATE POLICY "Manage contributor" 
ON public.contributor FOR ALL 
USING (true)
WITH CHECK (true);

-- Chaves de Acesso: Leitura de validação de tokens ativos
CREATE POLICY "Validate Access Tokens" 
ON public.access_tokens FOR SELECT 
USING (is_active = true);

-- Chaves de Acesso: Gestão completa de chaves
CREATE POLICY "Manage Access Tokens" 
ON public.access_tokens FOR ALL 
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- ==============================================================================
-- 6. LIMPEZA DE DADOS FAKES E DE TESTE
-- Garante banco de dados 100% limpo, sem vagas ou dados de exemplo
-- ==============================================================================

DELETE FROM public.vacancies WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9) OR coordinator IN ('Carlos Silva', 'Ana Antunes', 'Roberto Gomes', 'Juliana Lima', 'Marcos Souza');
DELETE FROM public.access_tokens WHERE token IN ('TOKEN-ENEM2026-ADMIN-MASTER', 'TOKEN-COORD-RJ-2026', 'TOKEN-COORD-NIT-2026', 'TOKEN-GESTAO-BAIXADA-2026');
DELETE FROM public.coordinations WHERE coordination_number IN ('101', '102', '103', '104', '105', '00001', '00002');

-- Ajustar a sequência do ID da tabela vacancies para novos cadastros reais
SELECT setval('vacancies_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.vacancies));

-- ==============================================================================
-- 7. VIEWS ÚTEIS PARA DASHBOARDS E RELATÓRIOS
-- ==============================================================================

-- View: Ocupação e saldo de vagas em tempo real
CREATE OR REPLACE VIEW public.vw_vagas_ocupacao AS
SELECT 
    v.id,
    v.title,
    v.school,
    v.city,
    v.neighborhood,
    v.coordinator,
    v.coordination_number,
    v.quantity AS vagas_disponiveis,
    v.value,
    COUNT(a.id) AS total_inscritos,
    COUNT(CASE WHEN a.status = 'cadastrado' THEN 1 END) AS total_confirmados,
    COUNT(CASE WHEN a.status = 'pending' THEN 1 END) AS total_pendentes,
    COUNT(CASE WHEN a.status = 'recusado' THEN 1 END) AS total_recusados
FROM public.vacancies v
LEFT JOIN public.contributor a ON a.vacancy_id = v.id
GROUP BY v.id, v.title, v.school, v.city, v.neighborhood, v.coordinator, v.coordination_number, v.quantity, v.value;

-- View: Lista consolidada de colaboradores com detalhes da vaga e escola
CREATE OR REPLACE VIEW public.vw_colaboradores_detalhados AS
SELECT 
    a.id AS inscricao_id,
    a.name AS colaborador_nome,
    a.cpf,
    a.phone AS telefone,
    a.age AS idade,
    a.city AS moradia_cidade,
    a.neighborhood AS moradia_bairro,
    a.status,
    a.applied_at AS data_inscricao,
    a.cebraspe_verified AS verificado_cebraspe,
    a.referrer_name AS quem_indicou,
    a.referrer_phone AS telefone_indicador,
    v.id AS vaga_id,
    v.title AS cargo,
    v.school AS escola_alocacao,
    v.city AS escola_cidade,
    v.neighborhood AS escola_bairro,
    v.coordinator AS coordenador_responsavel,
    v.coordination_number AS numero_coordenacao,
    v.value AS remuneracao
FROM public.contributor a
INNER JOIN public.vacancies v ON a.vacancy_id = v.id;

-- ==============================================================================
-- 8. CONSULTAS FREQUENTES (QUERIES PRONTAS PARA O SUPABASE SQL EDITOR)
-- ==============================================================================

-- QUERY 1: Validar se uma chave de acesso (token) é válida
-- Substitua 'TOKEN-DIGITADO' pelo token inserido pelo usuário
/*
SELECT id, token, label, role, is_active 
FROM public.access_tokens 
WHERE token = 'TOKEN-ENEM2026-ADMIN-MASTER' AND is_active = true;
*/

-- QUERY 2: Verificar se um CPF já possui cadastro (Unicidade de CPF)
-- Substitua '000.000.000-00' pelo CPF a verificar
/*
SELECT a.id, a.name, a.cpf, a.status, v.title AS vaga, v.school AS escola
FROM public.contributor a
JOIN public.vacancies v ON a.vacancy_id = v.id
WHERE a.cpf = '123.456.789-00' OR REPLACE(REPLACE(a.cpf, '.', ''), '-', '') = '12345678900';
*/

-- QUERY 3: Inserir novo Colaborador com transação e decremento seguro de vaga
/*
BEGIN;
  -- 1. Inserir aplicação (falhará automaticamente se o CPF já existir devido à UNIQUE constraint)
  INSERT INTO public.contributor (
    vacancy_id, name, cpf, phone, city, neighborhood, age, status, cebraspe_verified, referrer_name, referrer_phone
  ) VALUES (
    1, 'João da Silva', '123.456.789-00', '(21) 98765-4321', 'Rio de Janeiro', 'Copacabana', 28, 'pending', true, 'Carlos', '(21) 99999-0000'
  );

  -- 2. Decrementar quantidade de vagas disponíveis
  UPDATE public.vacancies 
  SET quantity = quantity - 1 
  WHERE id = 1 AND quantity > 0;
COMMIT;
*/

-- QUERY 4: Cadastrar nova Chave de Acesso / Token para um coordenador
/*
INSERT INTO public.access_tokens (token, label, role, is_active)
VALUES ('COORD-COPACABANA-2026', 'Coordenador(a) Carlos Silva - Copacabana', 'coordenador', true);
*/

-- QUERY 5: Atualizar status do colaborador (cadastrado / recusado / pendente)
/*
UPDATE public.contributor 
SET status = 'cadastrado' 
WHERE id = 1;
*/

-- QUERY 6: Relatório de fechamento por Escola e Coordenação
/*
SELECT 
    school AS escola,
    coordination_number AS coordenacao,
    coordinator AS coordenador,
    COUNT(a.id) AS total_inscritos,
    SUM(CASE WHEN a.status = 'cadastrado' THEN 1 ELSE 0 END) AS confirmados
FROM public.vacancies v
LEFT JOIN public.contributor a ON a.vacancy_id = v.id
GROUP BY school, coordination_number, coordinator
ORDER BY coordination_number;
*/
