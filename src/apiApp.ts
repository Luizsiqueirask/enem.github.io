import express from "express";
import dotenv from "dotenv";
import type { Vacancy, Application, Coordination, UserProfile } from "./lib/supabaseServer.ts";
import {
  getSupabaseConfig,
  signInWithSupabase,
  verifySupabaseToken,
  testSupabaseConnection,
  getVacancies,
  getVacancyById,
  insertVacancy,
  updateVacancy,
  decrementVacancySlot,
  deleteVacancy,
  resetVacancies,
  restoreDefaultVacancies,
  getApplications,
  getApplicationByCpf,
  insertApplication,
  updateApplicationStatus,
  deleteApplication,
  resetApplications,
  getCoordinations,
  saveCoordination,
  deleteCoordination,
  bindUserToCoordination,
  resolveUserProfile,
  getUserAccounts,
  saveUserAccount,
  deleteUserAccount,
  getDatabaseAndCacheStats,
  purgeFakeDataFromServer,
  SUPABASE_SQL_SCHEMA,
  DEFAULT_VACANCIES,
  type UserAccount
} from "./lib/supabaseServer.ts";

dotenv.config();

// Cache em memória de CPFs verificados / confirmados
const verifiedCebraspeCpfs = new Set<string>();

function validateCPFDigits(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean[10])) return false;
  return true;
}

const CEBRASPE_URL = "https://extranet.cebraspe.org.br/Sinapse/aspx/administrarusuario/QueroMeCadastrar.aspx";

async function verifyCebraspeInRealTime(cpf: string): Promise<{
  valid: boolean;
  registered: boolean;
  status: 'registered' | 'not_registered' | 'invalid' | 'error';
  message: string;
  cebraspeUrl: string;
}> {
  const clean = cpf.replace(/\D/g, "");
  if (!validateCPFDigits(clean)) {
    return {
      valid: false,
      registered: false,
      status: "invalid",
      message: "CPF inválido conforme cálculo dos dígitos verificadores.",
      cebraspeUrl: CEBRASPE_URL
    };
  }

  if (verifiedCebraspeCpfs.has(clean)) {
    return {
      valid: true,
      registered: true,
      status: "registered",
      message: "CPF já cadastrado e confirmado no sistema Cebraspe (Sinapse).",
      cebraspeUrl: CEBRASPE_URL
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const getRes = await fetch(CEBRASPE_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8"
      }
    });

    const rawCookies = getRes.headers.get("set-cookie") || "";
    const cookies = rawCookies.split(/,(?=[^;]+=[^;]+)/).map(c => c.split(";")[0].trim()).join("; ");
    const getHtml = await getRes.text();

    const vs = getHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1];
    const vsg = getHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1];
    const ev = getHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1];

    if (!vs || !vsg || !ev) {
      clearTimeout(timeout);
      return {
        valid: true,
        registered: false,
        status: "not_registered",
        message: "Não foi possível carregar o formulário do Cebraspe. Realize o cadastro na página oficial.",
        cebraspeUrl: CEBRASPE_URL
      };
    }

    const body = new URLSearchParams();
    body.append("__VIEWSTATE", vs);
    body.append("__VIEWSTATEGENERATOR", vsg);
    body.append("__EVENTVALIDATION", ev);
    body.append("__EVENTTARGET", "ctl00$conteudo$CPF");
    body.append("__EVENTARGUMENT", "");
    body.append("ctl00$conteudo$CPF", clean);

    const postRes = await fetch(CEBRASPE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": CEBRASPE_URL
      },
      body: body.toString()
    });

    clearTimeout(timeout);
    const postHtml = await postRes.text();

    const isUnregistered = 
      postHtml.includes("ctl00_conteudo_EnderecoEmail") ||
      postHtml.includes("cmdEnviarEmail") ||
      postHtml.includes("Digite o e-mail");

    const isRegistered =
      postHtml.toLowerCase().includes("já possui cadastro") ||
      postHtml.toLowerCase().includes("já cadastrado") ||
      postHtml.toLowerCase().includes("recuperar senha") ||
      postHtml.toLowerCase().includes("usuário já existe");

    if (isUnregistered) {
      return {
        valid: true,
        registered: false,
        status: "not_registered",
        message: "CPF não cadastrado no Cebraspe. É necessário realizar o cadastro na página oficial.",
        cebraspeUrl: CEBRASPE_URL
      };
    } else if (isRegistered) {
      verifiedCebraspeCpfs.add(clean);
      return {
        valid: true,
        registered: true,
        status: "registered",
        message: "CPF já cadastrado com sucesso no Cebraspe (Sinapse)!",
        cebraspeUrl: CEBRASPE_URL
      };
    } else {
      return {
        valid: true,
        registered: false,
        status: "not_registered",
        message: "CPF não identificado como cadastrado no Cebraspe. Realize o cadastro para continuar.",
        cebraspeUrl: CEBRASPE_URL
      };
    }
  } catch (err: any) {
    return {
      valid: true,
      registered: false,
      status: "error",
      message: "Falha de conexão com o portal Cebraspe: " + (err.message || "tempo limite"),
      cebraspeUrl: CEBRASPE_URL
    };
  }
}

export const app = express();

app.use(express.json());

// Normalização de URL e Headers para compatibilidade universal (Vercel Serverless & Local)
app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-supabase-auth-token");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Se o ambiente Vercel remover o prefixo /api na reescrita, restaura para roteamento do Express
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/_")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  next();
});

// Health check endpoint
app.get(["/api/health", "/health"], async (req, res) => {
  const config = getSupabaseConfig();
  const stats = getDatabaseAndCacheStats();
  res.json({ 
    status: "ok", 
    storage: "supabase_cloud_postgresql",
    database: stats.database,
    cache: stats.cache,
    counts: stats.counts,
    supabase: {
      configured: config.isConfigured,
      provider: "Supabase Free Tier (PostgreSQL)"
    },
    robots: "noindex, nofollow"
  });
});

// Endpoint de Diagnóstico e Debug em Tempo Real (Vercel & Supabase)
app.get(["/api/debug/status", "/debug/status"], async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const startTime = Date.now();
    const test = await testSupabaseConnection();
    const latencyMs = Date.now() - startTime;

    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const rawAnonKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.SUPABASE_ANON_KEY || 
      process.env.VITE_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
      process.env.SUPABASE_PUBLISHABLE_KEY || 
      "";
    const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

    return res.json({
      timestamp: new Date().toISOString(),
      platform: process.env.VERCEL ? "Vercel Serverless" : "Local / Node.js",
      vercel: {
        isVercel: Boolean(process.env.VERCEL),
        env: process.env.VERCEL_ENV || "none",
        region: process.env.VERCEL_REGION || "local"
      },
      environmentVariables: {
        hasSupabaseUrl: Boolean(rawUrl),
        NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
        VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
        effectiveUrl: rawUrl ? rawUrl.replace(/(https?:\/\/)([^.]+)(.*)/, "$1$2***$3") : "NÃO DEFINIDA",
        hasAnonKey: Boolean(rawAnonKey),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
        VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
        SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
        effectiveAnonKeyLength: rawAnonKey ? `${rawAnonKey.substring(0, 12)}... (${rawAnonKey.length} caracteres)` : "NÃO DEFINIDA",
        hasServiceRoleKey: Boolean(rawServiceKey),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
        hasPostgresUrl: Boolean(process.env.POSTGRES_URL)
      },
      supabaseTest: {
        configured: config.isConfigured,
        connected: test.connected,
        tablesCreated: (test as any).tablesCreated ?? false,
        message: test.message,
        latencyMs
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Middleware de Autenticação Obrigatória Supabase e Resolução de Perfil
const requireSupabaseAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Acesso restrito. Faça login com o e-mail e senha cadastrados no Supabase para acessar o sistema."
    });
  }
  const token = authHeader.substring(7).trim();
  const verification = await verifySupabaseToken(token);
  if (!verification.valid || !verification.user) {
    return res.status(401).json({
      error: verification.error || "Sessão não autorizada ou expirada."
    });
  }
  (req as any).user = verification.user;
  next();
};

// Endpoints de Autenticação Supabase
app.post(["/api/auth/login", "/auth/login"], async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Informe o e-mail e a senha cadastrados no Supabase." });
  }
  const result = await signInWithSupabase(String(email), String(password));
  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }
  return res.json(result);
});

app.get(["/api/auth/session", "/auth/session"], async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ valid: false, error: "Token não fornecido." });
  }
  const token = authHeader.substring(7).trim();
  const verification = await verifySupabaseToken(token);
  if (!verification.valid) {
    return res.status(401).json({ valid: false, error: verification.error });
  }
  return res.json({ valid: true, user: verification.user });
});

// Status público e seguro de conexão do Supabase para o indicador no cabeçalho e login
app.get(["/api/auth/config", "/api/supabase/public-status", "/supabase/public-status"], async (req, res) => {
  try {
    const config = getSupabaseConfig();
    const test = await testSupabaseConnection();
    return res.json({
      configured: config.isConfigured,
      connected: test.connected,
      tablesCreated: (test as any).tablesCreated ?? false,
      message: test.message,
      url: config.url ? config.url.replace(/(https?:\/\/)([^.]+)(.*)/, "$1***$3") : null,
      authProvider: "Supabase Auth (E-mail e Senha) + Regras de Coordenação ENEM 2026"
    });
  } catch (err: any) {
    return res.json({
      configured: false,
      connected: false,
      tablesCreated: false,
      message: err.message || "Erro ao verificar conexão com o banco de dados."
    });
  }
});

// Endpoints de gerenciamento e conexão com o Supabase e Cache Redis (Apenas Administrador Geral)
app.get(["/api/supabase/status", "/supabase/status"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Acesso restrito: apenas administradores do sistema podem visualizar a configuração do banco de dados." });
  }
  const config = getSupabaseConfig();
  const test = await testSupabaseConnection();
  const stats = getDatabaseAndCacheStats();
  return res.json({
    configured: config.isConfigured,
    url: config.url ? config.url.replace(/(https?:\/\/)([^.]+)(.*)/, "$1***$3") : null,
    connected: test.connected,
    tablesCreated: (test as any).tablesCreated ?? false,
    message: test.message,
    cache: stats.cache,
    counts: stats.counts
  });
});

app.post(["/api/supabase/test", "/supabase/test"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Acesso restrito: apenas administradores do sistema podem testar conexão do banco de dados." });
  }
  const { url, key } = req.body;
  const test = await testSupabaseConnection(url, key);
  return res.json(test);
});

app.get(["/api/supabase/schema.sql", "/supabase/schema.sql"], requireSupabaseAuth, (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(SUPABASE_SQL_SCHEMA);
});

// Status do Banco de Dados Supabase e Cache (Apenas Administrador Geral)
app.get(["/api/database/status", "/database/status", "/api/admin/encryption-status"], requireSupabaseAuth, (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Acesso restrito: apenas administradores podem visualizar o status e configurações do banco de dados." });
  }
  try {
    const stats = getDatabaseAndCacheStats();
    return res.json({
      enabled: true,
      type: "Supabase Cloud Database (PostgreSQL) + Memory Cache",
      storage: "supabase_postgresql",
      cache: stats.cache,
      database: stats.database,
      counts: stats.counts
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// VAGAS (Vacancies)
// Público: Todas as vagas abertas
// =========================================================================
app.get(["/api/vacancies", "/vacancies"], async (req, res) => {
  try {
    let vacancies = await getVacancies();
    if (!vacancies || vacancies.length === 0) {
      vacancies = [...DEFAULT_VACANCIES] as any;
    }

    const openVacancies = vacancies
      .filter(v => (!v.status || v.status === "open") && (v.quantity === undefined || v.quantity > 0))
      .map(v => {
        const numPrice = Number(v.price !== undefined ? v.price : (v.value !== undefined ? v.value : 0));
        return {
          ...v,
          price: numPrice,
          value: numPrice,
          status: "open",
          quantity: v.quantity ?? 1
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.json(openVacancies);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// ADMIN - VAGAS (Filtradas por Regra: Admin vê tudo, Coordenador vê só a sua)
// =========================================================================
app.get(["/api/admin/vacancies", "/admin/vacancies"], requireSupabaseAuth, async (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    let vacancies = await getVacancies();

    if (!user.is_administrator) {
      const userCoord = String(user.coordination_number || "").trim();
      vacancies = vacancies.filter(v => String(v.coordination_number || "").trim() === userCoord);
    }

    return res.json(vacancies);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Criar nova vaga (CRUD - Create)
app.post(["/api/vacancies", "/vacancies"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const { title, price, value, city, neighborhood, school, coordinator, coordination_number, quantity, min_age, max_age } = req.body;
  const vacancyCity = (city || "Rio de Janeiro").trim();
  const finalPrice = price !== undefined ? price : value;

  let targetCoordNumber = coordination_number;
  let targetCoordinator = coordinator;
  if (!user.is_administrator) {
    if (!user.coordination_number) {
      return res.status(403).json({ error: "Você não possui uma coordenação vinculada para criar vagas." });
    }
    targetCoordNumber = user.coordination_number;
    targetCoordinator = user.coordinator_name || user.coordination_name || coordinator;
  }

  if (!title || finalPrice === undefined || !neighborhood || !school || !targetCoordinator || !targetCoordNumber || !quantity) {
    return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
  }

  try {
    const parsedPrice = parseFloat(finalPrice);
    const newVacancy = await insertVacancy({
      title,
      price: parsedPrice,
      value: parsedPrice,
      city: vacancyCity,
      neighborhood,
      school,
      coordinator: targetCoordinator,
      coordination_number: targetCoordNumber,
      quantity: parseInt(quantity),
      min_age: parseInt(min_age) || 18,
      max_age: parseInt(max_age) || 100,
      status: "open",
      created_at: new Date().toISOString()
    });

    const broadcast = app.get("wss_broadcast");
    if (broadcast) broadcast({ type: "vacancy_updated" });

    return res.json({ id: newVacancy.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Limpar e expurgar dados fakes/de teste
app.post(["/api/admin/purge-fakes", "/admin/purge-fakes"], requireSupabaseAuth, async (req, res) => {
  try {
    const result = await purgeFakeDataFromServer();
    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "vacancy_updated" });
      broadcast({ type: "coordination_updated" });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao purgar dados fakes." });
  }
});

// Atualizar vaga existente (CRUD - Update / Editar Vaga)
app.put(["/api/admin/vacancies/:id", "/admin/vacancies/:id"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const id = req.params.id;

  try {
    const existing = await getVacancyById(id);
    if (!existing) {
      return res.status(404).json({ error: "Vaga não encontrada para edição." });
    }

    if (!user.is_administrator && String(existing.coordination_number) !== String(user.coordination_number)) {
      return res.status(403).json({ error: "Você não tem permissão para editar vagas de outra coordenação." });
    }

    const { title, price, value, city, neighborhood, school, coordinator, coordination_number, quantity, min_age, max_age, status } = req.body;
    const finalPrice = price !== undefined ? price : value;

    const updated = await updateVacancy(id, {
      title: title ? String(title).trim() : undefined,
      price: finalPrice !== undefined ? parseFloat(finalPrice) : undefined,
      value: finalPrice !== undefined ? parseFloat(finalPrice) : undefined,
      city: city ? String(city).trim() : undefined,
      neighborhood: neighborhood ? String(neighborhood).trim() : undefined,
      school: school ? String(school).trim() : undefined,
      coordinator: user.is_administrator ? (coordinator ? String(coordinator).trim() : undefined) : existing.coordinator,
      coordination_number: user.is_administrator ? (coordination_number ? String(coordination_number).trim() : undefined) : existing.coordination_number,
      quantity: quantity !== undefined ? parseInt(quantity) : undefined,
      min_age: min_age !== undefined ? parseInt(min_age) : undefined,
      max_age: max_age !== undefined ? parseInt(max_age) : undefined,
      status: status ? String(status).trim() : undefined
    });

    if (!updated) {
      return res.status(500).json({ error: "Falha ao atualizar dados da vaga." });
    }

    const broadcast = app.get("wss_broadcast");
    if (broadcast) broadcast({ type: "vacancy_updated" });

    return res.json({ success: true, vacancy: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao atualizar vaga." });
  }
});

// Deletar vaga individual (CRUD - Delete)
app.delete(["/api/admin/vacancies/:id", "/admin/vacancies/:id"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const id = req.params.id;

  try {
    const vacancy = await getVacancyById(id);
    if (!vacancy) {
      return res.status(404).json({ error: "Vaga não encontrada." });
    }

    if (!user.is_administrator && String(vacancy.coordination_number) !== String(user.coordination_number)) {
      return res.status(403).json({ error: "Você não tem permissão para deletar vagas de outra coordenação." });
    }

    await deleteVacancy(id);

    const broadcast = app.get("wss_broadcast");
    if (broadcast) broadcast({ type: "vacancy_updated" });

    return res.json({
      success: true,
      message: "Vaga deletada com sucesso! As inscrições dos candidatos permanecem salvas e preservadas no sistema."
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao deletar vaga." });
  }
});

// Deletar múltiplos postos/vagas selecionados do banco de dados (Batch Delete)
app.post(["/api/admin/vacancies/batch-delete", "/admin/vacancies/batch-delete"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Nenhum posto/vaga informado para exclusão." });
  }

  let deletedCount = 0;
  for (const id of ids) {
    try {
      const vacancy = await getVacancyById(id);
      if (vacancy) {
        if (!user.is_administrator && String(vacancy.coordination_number) !== String(user.coordination_number)) {
          continue;
        }
        await deleteVacancy(id);
        deletedCount++;
      }
    } catch {}
  }

  const broadcast = app.get("wss_broadcast");
  if (broadcast) broadcast({ type: "vacancy_updated" });

  return res.json({
    success: true,
    deletedCount,
    message: `${deletedCount} posto(s)/vaga(s) deletado(s) com sucesso do banco de dados! Candidatos preservados.`
  });
});

// Deletar todas as vagas (Apenas Administrador Geral)
app.delete(["/api/admin/vacancies", "/admin/vacancies"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Apenas o Administrador Geral pode executar a limpeza de todas as vagas." });
  }

  try {
    const applications = await getApplications();
    if (applications.length > 0) {
      return res.status(400).json({ 
        error: "Não é possível deletar todas as vagas pois existem inscrições vinculadas." 
      });
    }

    await resetVacancies();
    const broadcast = app.get("wss_broadcast");
    if (broadcast) broadcast({ type: "vacancy_updated" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao deletar todas as vagas." });
  }
});

// Reset completo do sistema (Apenas Administrador Geral)
app.post(["/api/admin/reset", "/admin/reset"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Apenas o Administrador Geral pode resetar o sistema." });
  }

  try {
    await resetApplications();
    await resetVacancies();

    const broadcast = app.get("wss_broadcast");
    if (broadcast) broadcast({ type: "vacancy_updated" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao resetar sistema." });
  }
});

// Restaurar dados padrão de vagas (Apenas Administrador Geral)
app.post(["/api/admin/restore-defaults", "/admin/restore-defaults"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Apenas o Administrador Geral pode restaurar as vagas oficiais padrão." });
  }

  try {
    await restoreDefaultVacancies();
    const broadcast = app.get("wss_broadcast");
    if (broadcast) broadcast({ type: "vacancy_updated" });
    return res.json({ success: true, count: DEFAULT_VACANCIES.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// COORDENAÇÕES (Regra: Apenas 2 e-mails por coordenação: coordenador e assistente)
// =========================================================================
app.get(["/api/admin/coordinations", "/admin/coordinations"], requireSupabaseAuth, async (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const allCoords = await getCoordinations();

    if (user.is_administrator) {
      return res.json(allCoords);
    }

    const cleanEmail = (user.email || "").trim().toLowerCase();
    const myCoord = allCoords.filter(c => 
      (user.coordination_number && String(c.coordination_number).trim() === String(user.coordination_number).trim()) ||
      (c.coordinator_email && c.coordinator_email.trim().toLowerCase() === cleanEmail) ||
      (c.assistant_email && c.assistant_email.trim().toLowerCase() === cleanEmail)
    );
    return res.json(myCoord);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Criar ou atualizar coordenação (Apenas Administrador Geral)
app.post(["/api/admin/coordinations", "/admin/coordinations"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Apenas o Administrador Geral pode cadastrar ou alterar coordenações." });
  }

  const { coordination_number, name, coordinator_name, coordinator_email, assistant_email } = req.body;
  if (!coordination_number || !name || !coordinator_name || !coordinator_email || !assistant_email) {
    return res.status(400).json({
      error: "Todos os campos são obrigatórios: número da coordenação, nome, nome do coordenador, e-mail do coordenador e e-mail do assistente."
    });
  }

  const cEmail = String(coordinator_email).trim().toLowerCase();
  const aEmail = String(assistant_email).trim().toLowerCase();
  if (cEmail === aEmail) {
    return res.status(400).json({
      error: "O e-mail do coordenador e o e-mail do assistente devem ser diferentes."
    });
  }

  try {
    const saved = await saveCoordination({
      coordination_number: String(coordination_number).trim(),
      name: String(name).trim(),
      coordinator_name: String(coordinator_name).trim(),
      coordinator_email: cEmail,
      assistant_email: aEmail
    });

    return res.json({ success: true, coordination: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao salvar coordenação." });
  }
});

// Deletar coordenação (Apenas Administrador Geral)
app.delete(["/api/admin/coordinations/:number", "/admin/coordinations/:number"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.is_administrator) {
    return res.status(403).json({ error: "Apenas o Administrador Geral pode remover coordenações." });
  }

  try {
    await deleteCoordination(req.params.number);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Perfil do usuário atual
app.get(["/api/admin/profile", "/admin/profile"], requireSupabaseAuth, (req, res) => {
  const user = (req as any).user;
  return res.json(user);
});

// Consulta de disponibilidade de vaga da Coordenação
app.get(["/api/user/coordination-status/:number", "/user/coordination-status/:number"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    const targetNum = String(req.params.number).trim();
    const allCoords = await getCoordinations();
    const found = allCoords.find(c => String(c.coordination_number).trim() === targetNum);

    if (!found) {
      return res.json({
        exists: false,
        coordination_number: targetNum,
        name: `Coordenação Regional Nº ${targetNum}`,
        coordinator_email: "",
        assistant_email: "",
        coordinator_occupied: false,
        assistant_occupied: false,
        slots_occupied: 0,
        can_register_coordinator: true,
        can_register_assistant: true,
        full: false
      });
    }

    const cleanUserEmail = (authUser.email || "").trim().toLowerCase();
    const cEmail = (found.coordinator_email || "").trim().toLowerCase();
    const aEmail = (found.assistant_email || "").trim().toLowerCase();

    const cOccupied = Boolean(cEmail && cEmail !== cleanUserEmail);
    const aOccupied = Boolean(aEmail && aEmail !== cleanUserEmail);

    let count = 0;
    if (cEmail) count++;
    if (aEmail) count++;

    return res.json({
      exists: true,
      coordination_number: found.coordination_number,
      name: found.name,
      coordinator_name: found.coordinator_name,
      coordinator_email: cEmail,
      assistant_email: aEmail,
      coordinator_occupied: cOccupied,
      assistant_occupied: aOccupied,
      slots_occupied: count,
      can_register_coordinator: !cOccupied,
      can_register_assistant: !aOccupied,
      full: count >= 2 && cEmail !== cleanUserEmail && aEmail !== cleanUserEmail
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Salvar/vincular coordenação e tipo de usuário para a própria conta
app.post(["/api/user/coordination", "/user/coordination"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    const { coordination_number, role, coordination_name } = req.body;

    if (!coordination_number) {
      return res.status(400).json({ error: "Informe o número da coordenação (ex: 101, 102)." });
    }

    const selectedRole = role === "assistant" ? "assistant" : "coordinator";

    const result = await bindUserToCoordination(
      authUser.email,
      String(coordination_number),
      selectedRole,
      coordination_name
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      user: result.user,
      coordination: result.coordination
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao salvar coordenação da conta." });
  }
});

// =========================================================================
// GESTÃO DE CONTAS E E-MAILS CADASTRADOS (ADMIN DASHBOARD)
// =========================================================================
app.get(["/api/admin/users", "/admin/users"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    if (!authUser.is_administrator) {
      return res.status(403).json({ error: "Acesso restrito: apenas administradores podem visualizar todas as contas cadastradas." });
    }
    const users = await getUserAccounts();
    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao listar contas de usuários." });
  }
});

app.post(["/api/admin/users", "/admin/users"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    if (!authUser.is_administrator) {
      return res.status(403).json({ error: "Acesso restrito: apenas administradores podem cadastrar novas contas." });
    }

    const { email, password, first_name, last_name, is_administrator, role, coordination_number, coordination_name } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Informe o e-mail da conta." });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ error: "Informe uma senha com no mínimo 6 caracteres para a criação da conta no Supabase." });
    }

    const result = await saveUserAccount({
      email,
      password: String(password).trim(),
      first_name,
      last_name,
      is_administrator: Boolean(is_administrator),
      role,
      coordination_number,
      coordination_name
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "users_updated" });
      broadcast({ type: "coordination_updated" });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao salvar conta de usuário." });
  }
});

app.put(["/api/admin/users/:email", "/admin/users/:email"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    if (!authUser.is_administrator) {
      return res.status(403).json({ error: "Acesso restrito: apenas administradores podem editar contas." });
    }

    const targetEmail = req.params.email;
    const { password, first_name, last_name, is_administrator, role, coordination_number, coordination_name } = req.body;

    const result = await saveUserAccount({
      email: targetEmail,
      password: password ? String(password).trim() : undefined,
      first_name,
      last_name,
      is_administrator: Boolean(is_administrator),
      role,
      coordination_number,
      coordination_name
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "users_updated" });
      broadcast({ type: "coordination_updated" });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao atualizar conta de usuário." });
  }
});

app.delete(["/api/admin/users/:email", "/admin/users/:email"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    if (!authUser.is_administrator) {
      return res.status(403).json({ error: "Acesso restrito: apenas administradores podem excluir contas." });
    }

    const targetEmail = String(req.params.email).trim().toLowerCase();
    if (targetEmail === authUser.email.toLowerCase()) {
      return res.status(400).json({ error: "Você não pode excluir sua própria conta de administrador conectada." });
    }

    await deleteUserAccount(targetEmail);

    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "users_updated" });
      broadcast({ type: "coordination_updated" });
    }

    return res.json({ success: true, message: `Conta ${targetEmail} excluída com sucesso do banco de dados.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao excluir conta de usuário." });
  }
});

// Deletar múltiplas contas de e-mails selecionadas do banco de dados (Batch Delete)
app.post(["/api/admin/users/batch-delete", "/admin/users/batch-delete"], requireSupabaseAuth, async (req, res) => {
  try {
    const authUser = (req as any).user as UserProfile;
    if (!authUser.is_administrator) {
      return res.status(403).json({ error: "Acesso restrito: apenas administradores podem excluir contas." });
    }

    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "Nenhum e-mail informado para exclusão." });
    }

    let deletedCount = 0;
    for (const email of emails) {
      const clean = String(email).trim().toLowerCase();
      if (clean === authUser.email.toLowerCase()) {
        continue;
      }
      await deleteUserAccount(clean);
      deletedCount++;
    }

    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "users_updated" });
      broadcast({ type: "coordination_updated" });
    }

    return res.json({
      success: true,
      deletedCount,
      message: `${deletedCount} conta(s) excluída(s) com sucesso do banco de dados.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao excluir contas de usuário." });
  }
});

// =========================================================================
// INSCRIÇÕES / COLABORADORES
// =========================================================================
app.post(["/api/applications", "/api/contributors", "/applications", "/contributors"], async (req, res) => {
  const { vacancy_id, name, cpf, phone, city, neighborhood, age, cebraspe_verified, referrer_name, referrer_phone } = req.body;
  if (!vacancy_id || !name || !cpf || !phone || !city || !neighborhood || !age) {
    return res.status(400).json({ error: "Campos obrigatórios não fornecidos." });
  }

  try {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!validateCPFDigits(cleanCpf)) {
      return res.status(400).json({ error: "CPF inválido pelos dígitos verificadores." });
    }

    const vacancy = await getVacancyById(vacancy_id);
    if (!vacancy) {
      return res.status(404).json({ error: "Vaga não encontrada no sistema." });
    }

    if (vacancy.quantity <= 0) {
      return res.status(400).json({ error: "Essa vaga já foi preenchida." });
    }

    const userAge = parseInt(age);
    if (userAge < vacancy.min_age || userAge > vacancy.max_age) {
      return res.status(403).json({ 
        error: `Idade fora dos limites da vaga (${vacancy.min_age} a ${vacancy.max_age} anos).` 
      });
    }

    const existing = await getApplicationByCpf(cleanCpf);
    if (existing) {
      return res.status(400).json({ 
        error: "Este CPF já possui uma inscrição cadastrada no sistema. Não é permitido se cadastrar em mais de uma vaga." 
      });
    }

    const appData = {
      vacancy_id,
      name,
      cpf: cleanCpf,
      phone,
      city,
      neighborhood,
      age: userAge,
      status: "pending",
      applied_at: new Date().toISOString(),
      cebraspe_verified: Boolean(cebraspe_verified),
      referrer_name: referrer_name || null,
      referrer_phone: referrer_phone || null,
      vacancy_title: vacancy.title,
      vacancy_school: vacancy.school,
      vacancy_city: vacancy.city,
      vacancy_neighborhood: vacancy.neighborhood,
      coordination_number: vacancy.coordination_number,
      coordinator: vacancy.coordinator
    };

    const result = await insertApplication(appData);
    await decrementVacancySlot(vacancy_id);

    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "application_updated" });
      broadcast({ type: "vacancy_updated" });
    }

    return res.json({ id: result.data?.id || Date.now() });
  } catch (err: any) {
    if (err.message?.toLowerCase().includes("já possui") || err.message?.toLowerCase().includes("unique")) {
      return res.status(400).json({ error: "Este CPF já possui uma inscrição cadastrada no sistema." });
    }
    return res.status(500).json({ error: err.message });
  }
});

// Verificação de CPF no Cebraspe em tempo real
app.post(["/api/verify-cebraspe-cpf", "/verify-cebraspe-cpf"], async (req, res) => {
  const { cpf } = req.body;
  if (!cpf) {
    return res.status(400).json({ error: "CPF não informado." });
  }
  const result = await verifyCebraspeInRealTime(cpf);
  return res.json(result);
});

// Confirmação manual de cadastro Cebraspe
app.post(["/api/confirm-cebraspe-cpf", "/confirm-cebraspe-cpf"], async (req, res) => {
  const { cpf } = req.body;
  if (!cpf) {
    return res.status(400).json({ error: "CPF não informado." });
  }
  const clean = cpf.replace(/\D/g, "");
  if (!validateCPFDigits(clean)) {
    return res.status(400).json({ error: "CPF inválido pelos dígitos verificadores." });
  }
  verifiedCebraspeCpfs.add(clean);
  return res.json({ 
    success: true, 
    registered: true, 
    status: "registered", 
    message: "Cadastro confirmado com sucesso para este CPF no Cebraspe." 
  });
});

// Consultar colaboradores / inscrições para o painel admin
app.get(["/api/admin/applications", "/api/admin/contributors", "/admin/applications", "/admin/contributors"], requireSupabaseAuth, async (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const applications = await getApplications();
    const vacancies = await getVacancies();
    const vacancyMap = new Map<string, Vacancy>();
    vacancies.forEach(v => vacancyMap.set(String(v.id), v));

    let enriched = applications
      .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime())
      .map(a => {
        const v = vacancyMap.get(String(a.vacancy_id));
        return {
          ...a,
          cebraspe_verified: a.cebraspe_verified ?? true,
          referrer_name: a.referrer_name || "",
          referrer_phone: a.referrer_phone || "",
          vacancy_title: v ? v.title : (a.vacancy_title || "Vaga não especificada"),
          vacancy_school: v ? v.school : (a.vacancy_school || "-"),
          vacancy_city: v ? v.city : (a.vacancy_city || "-"),
          vacancy_neighborhood: v ? v.neighborhood : (a.vacancy_neighborhood || "-"),
          coordination_number: v ? v.coordination_number : (a.coordination_number || "-"),
          coordinator: v ? v.coordinator : (a.coordinator || "-")
        };
      });

    if (!user.is_administrator) {
      const userCoord = String(user.coordination_number || "").trim();
      enriched = enriched.filter(item => String(item.coordination_number || "").trim() === userCoord);
    }

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Atualizar status de um colaborador (pending, cadastrado, recusado)
app.patch(["/api/admin/applications/:id/status", "/api/admin/contributors/:id/status", "/admin/applications/:id/status", "/admin/contributors/:id/status"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const id = req.params.id;
  const { status } = req.body;

  if (!['pending', 'cadastrado', 'recusado'].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  try {
    if (!user.is_administrator) {
      const apps = await getApplications();
      const appItem = apps.find(a => String(a.id) === String(id));
      if (!appItem) {
        return res.status(404).json({ error: "Inscrição não encontrada." });
      }
      const vacancy = await getVacancyById(appItem.vacancy_id);
      const itemCoord = vacancy ? vacancy.coordination_number : appItem.coordination_number;
      if (String(itemCoord) !== String(user.coordination_number)) {
        return res.status(403).json({ error: "Você não tem permissão para alterar o status de inscritos de outra coordenação." });
      }
    }

    await updateApplicationStatus(id, status);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao atualizar status." });
  }
});

// Excluir colaborador inscrito
app.delete(["/api/admin/applications/:id", "/api/admin/contributors/:id", "/admin/applications/:id", "/admin/contributors/:id"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const id = req.params.id;

  try {
    const apps = await getApplications();
    const appItem = apps.find(a => String(a.id) === String(id));
    if (!appItem) {
      return res.status(404).json({ error: "Inscrição de colaborador não encontrada." });
    }

    if (!user.is_administrator) {
      const vacancy = await getVacancyById(appItem.vacancy_id);
      const itemCoord = vacancy ? vacancy.coordination_number : appItem.coordination_number;
      if (String(itemCoord) !== String(user.coordination_number)) {
        return res.status(403).json({ error: "Você não tem permissão para excluir colaboradores de outra coordenação." });
      }
    }

    await deleteApplication(id);

    const broadcast = app.get("wss_broadcast");
    if (broadcast) {
      broadcast({ type: "application_updated" });
      broadcast({ type: "vacancy_updated" });
    }

    return res.json({
      success: true,
      message: `Inscrição do colaborador(a) ${appItem.name} excluída com sucesso do banco de dados.`
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao excluir colaborador." });
  }
});

// Exportação de dados do sistema (JSON)
app.get(["/api/admin/download/:type", "/admin/download/:type"], requireSupabaseAuth, async (req, res) => {
  const user = (req as any).user as UserProfile;
  const type = req.params.type;

  if (type === "vacancies") {
    let data = await getVacancies();
    if (!user.is_administrator) {
      data = data.filter(v => String(v.coordination_number) === String(user.coordination_number));
    }
    res.setHeader("Content-Disposition", `attachment; filename=vagas_enem2026_${user.coordination_number || "todas"}.json`);
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(data, null, 2));
  } else if (type === "applications" || type === "contributors") {
    let data = await getApplications();
    if (!user.is_administrator) {
      const vacancies = await getVacancies();
      const myVacIds = new Set(vacancies.filter(v => String(v.coordination_number) === String(user.coordination_number)).map(v => String(v.id)));
      data = data.filter(a => myVacIds.has(String(a.vacancy_id)) || String(a.coordination_number) === String(user.coordination_number));
    }
    res.setHeader("Content-Disposition", `attachment; filename=colaboradores_enem2026_${user.coordination_number || "todas"}.json`);
    res.setHeader("Content-Type", "application/json");
    return res.send(JSON.stringify(data, null, 2));
  }
  return res.status(400).json({ error: "Tipo de download inválido." });
});

export default app;
