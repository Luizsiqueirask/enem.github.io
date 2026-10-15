# ENEM 2026 - Portal de Inscrição e Gestão de Colaboradores

Portal completo e autônomo para cadastro de vagas e inscrição de colaboradores para o ENEM 2026, com suporte às cidades da Região Metropolitana do Rio de Janeiro: **Rio de Janeiro, Niterói, São Gonçalo, Duque de Caxias, Nova Iguaçu, Belford Roxo e Maricá**.

O sistema utiliza armazenamento direto em **arquivos JSON puros** na pasta `data/`, sendo **100% compatível com o GitHub**, permitindo versionamento direto, consumo via AJAX (`fetch`) e execução tanto em servidores Node.js quanto em hospedagens estáticas gratuitas como o **GitHub Pages**.

---

## 📁 Estrutura de Arquivos JSON (`data/`)

Todos os dados do sistema são salvos na pasta `/data`:

1. **`data/vacancies.json`**:
   - Contém a lista de todas as vagas cadastradas com título, valor da diária, cidade, bairro, escola, coordenação, número de vagas e faixas etárias permitidas.
2. **`data/applications.json`**:
   - Contém a lista de todos os candidatos inscritos com nome, CPF, WhatsApp, cidade, idade, status da inscrição (`pending`, `cadastrado`, `recusado`) e data de cadastro.

Ambos os arquivos também são espelhados em `public/data/` para acesso estático direto via AJAX na web.

---

## 🚀 Como Usar no GitHub

### 1. Clonar e Rodar com Node.js (Servidor Full-Stack)
Ao rodar com Node.js, qualquer vaga adicionada ou inscrição feita pelo formulário é gravada instantaneamente e fisicamente nos arquivos `data/vacancies.json` e `data/applications.json`:

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```
Acesse em seu navegador em `http://localhost:3000`.

### 2. Hospedar no GitHub Pages (Estático com AJAX)
O frontend detecta automaticamente quando está rodando em ambiente estático:
- Carrega as vagas de `data/vacancies.json` e `data/applications.json` via **AJAX (`fetch`)**.
- Permite realizar todo o CRUD (criação de vagas, inscrições e atualização de status) no navegador.
- Pelo Painel Administrativo, você pode clicar em **"Baixar vacancies.json"** e **"Baixar applications.json"** para baixar os dados atualizados e versioná-los no Git.

### 3. Versionando os Dados no GitHub
Sempre que desejar salvar novos dados no seu repositório:
```bash
git add data/
git commit -m "feat: atualiza vagas e inscritos em JSON"
git push
```

---

## 🔐 Acesso Administrativo
- **Senha**: `!ENEM#2026` (chave Base64: `IUVORU0jMjAyNg==`)
- O painel conta com abas para:
  - **Candidatos Inscritos**: gestão e mudança de status com filtros avançados.
  - **Lista de Escolas**: visualização agregada por escola, coordenação e vagas.
  - **Pasta data/*.json (GitHub)**: download direto dos arquivos JSON, upload/substituição de JSON e restauração das vagas padrão.
