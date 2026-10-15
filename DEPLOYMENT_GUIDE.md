# Guia de Implantação e Configuração: ENEM 2026

Este projeto está totalmente preparado e configurado para ser executado e implantado nas seguintes plataformas:
- **Vercel**
- **GitLab Pages**
- **GitHub Pages**
- **Google Cloud Run / Servidor Node.js**

E para utilizar o banco de dados relacional **Supabase** (PostgreSQL) com controle de chaves de acesso (tokens) e regras estritas de integridade.

---

## 1. Configuração do Banco de Dados no Supabase

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No painel do seu projeto no Supabase, acesse **SQL Editor**.
3. Abra o arquivo `supabase_schema.sql` deste projeto, copie todo o seu conteúdo e execute no SQL Editor do Supabase.
4. O script criará:
   - Tabela `vacancies` (vagas com cidades, escolas e coordenações)
   - Tabela `applications` (colaboradores/candidatos com constraint UNIQUE no CPF)
   - Tabela `access_tokens` (chaves de acesso ao portal)
   - Políticas de Segurança RLS (Row Level Security)
   - Views analíticas (`vw_vagas_ocupacao`, `vw_colaboradores_detalhados`)
   - Vagas e chaves de acesso iniciais
5. Vá em **Project Settings > API** e copie:
   - **Project URL** (ex: `https://xyzcompany.supabase.co`)
   - **anon / public key** (chave de acesso do cliente)

---

## 2. Implantação no Vercel

O arquivo `vercel.json` já está configurado na raiz com roteamento SPA e cabeçalhos de segurança contra indexação.

### Como publicar no Vercel:
1. Conecte seu repositório no [vercel.com](https://vercel.com/new).
2. Em **Environment Variables**, adicione as seguintes variáveis:
   - `VITE_SUPABASE_URL`: sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY`: sua chave anon do Supabase
3. Clique em **Deploy**.
4. O Vercel executará o comando `npm run build` e publicará o diretório `dist`.

---

## 3. Implantação no GitHub Pages

O fluxo automatizado via **GitHub Actions** já está criado em `.github/workflows/deploy.yml`.

### Como ativar no GitHub:
1. Faça push do código para o seu repositório GitHub (`main` ou `master`).
2. Acesse **Settings > Pages** do seu repositório.
3. Em **Build and deployment > Source**, selecione **GitHub Actions**.
4. Em **Settings > Secrets and variables > Actions**, adicione os segredos:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. A action iniciará automaticamente e publicará o site no link `https://seu-usuario.github.io/nome-do-repositorio/`.
*(Nota: O arquivo `public/404.html` e a configuração `base: './'` no `vite.config.ts` já garantem que rotas e ativos funcionem perfeitamente no GitHub Pages).*

---

## 4. Implantação no GitLab Pages

O arquivo `.gitlab-ci.yml` já está configurado na raiz para compilar e publicar automaticamente.

### Como ativar no GitLab:
1. Envie o projeto para o GitLab.
2. Em **Settings > CI/CD > Variables**, configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. O pipeline compilará com `npm run build` e moverá os arquivos para a pasta `public/`.
4. O link do seu GitLab Pages ficará disponível em **Deploy > Pages**.

---

## 5. Sistema de Chaves de Acesso (Tokens) ao Site

Qualquer chave cadastrada na tabela `access_tokens` do Supabase concede acesso de administração e coordenação ao site:

### Chaves Padrão Pré-Cadastradas:
- `TOKEN-ENEM2026-ADMIN-MASTER` (Acesso Master Geral)
- `TOKEN-COORD-RJ-2026` (Coordenação Rio de Janeiro)
- `TOKEN-COORD-NIT-2026` (Coordenação Niterói)
- `TOKEN-GESTAO-BAIXADA-2026` (Gestão Baixada Fluminense)
- Ou a senha mestre administrativa: `!ENEM#2026`

No painel administrativo, há uma aba exclusiva **"Chaves de Acesso / Tokens"** onde você pode criar novos tokens, ativar, desativar ou revogar chaves a qualquer momento.

---

## 6. Regras de Negócio Implementadas

1. **Unicidade Estrita de CPF**:
   - Cada CPF só pode se cadastrar em **uma única vaga** em todo o sistema.
   - Qualquer tentativa de recadastro com o mesmo CPF é imediatamente bloqueada com aviso claro.
2. **Nomenclatura Inclusiva**:
   - `Coordenador(a)` e `Professor(a)` padronizados em todos os textos, formulários, filtros e relatórios.
3. **Segurança de Dados e Sigilo**:
   - Cabeçalhos `X-Robots-Tag: noindex, nofollow` em todas as páginas para impedir rastreamento por buscadores.
   - Criptografia AES-256-GCM + Base64 Armor em disco quando executado em servidor Node.js.
