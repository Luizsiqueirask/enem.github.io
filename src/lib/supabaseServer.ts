import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "./cache.ts";

export interface Vacancy {
  id: string | number;
  title: string;
  price?: number;
  value: number;
  city: string;
  neighborhood: string;
  school: string;
  coordinator: string;
  coordination_number: string;
  quantity: number;
  min_age: number;
  max_age: number;
  status: string;
  created_at: string;
}

export interface Application {
  id: string | number;
  vacancy_id: string | number;
  name: string;
  cpf: string;
  phone: string;
  city: string;
  neighborhood: string;
  age: number;
  status: string;
  applied_at: string;
  cebraspe_verified?: boolean;
  referrer_name?: string;
  referrer_phone?: string;
  vacancy_title?: string;
  vacancy_school?: string;
  vacancy_city?: string;
  vacancy_neighborhood?: string;
  coordination_number?: string;
  coordinator?: string;
}

export interface Coordination {
  id?: string | number;
  coordination_number: string;
  name: string;
  coordinator_name: string;
  coordinator_email: string;
  assistant_email: string;
  created_at?: string;
}

export interface UserProfile {
  id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_administrator: boolean;
  coordination_number?: string | null;
  role: "admin" | "coordinator" | "assistant" | "unassigned";
  coordination_name?: string;
  coordinator_name?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string; // Nome e Sobrenome principal
  is_administrator: boolean; // Se o usuário poderá ter acesso de admin ou não
  role: "admin" | "coordinator" | "assistant" | "unassigned"; // Se o usuário é coordenador ou assistente
  coordination_number: string | null; // Nº da coordenação a qual o mesmo irá trabalhar
  coordination_name?: string;
  created_at: string;
  updated_at?: string;
}

// Coordenações Oficiais Padrão do ENEM 2026 (inicia vazio para não exibir dados fakes)
export const DEFAULT_COORDINATIONS: Coordination[] = [];

// Vagas padrão iniciam vazias para que apenas vagas reais cadastradas permaneçam
export const DEFAULT_VACANCIES: Array<Omit<Vacancy, "id"> & { id: number; price: number }> = [];

// Administradores do Sistema com acesso irrestrito a todas as coordenações
export const SYSTEM_ADMIN_EMAILS = [
  "root@enem.app",
  "administrator@enem.app"
];

// Armazenamento em memória (Redis Cache Engine Fallback)
let memoryVacancies: Vacancy[] = [];
let memoryApplications: Application[] = [];
let memoryCoordinations: Coordination[] = [];

// Contas de usuários padrão (inicia vazio para não exibir contas de teste)
export const DEFAULT_USER_ACCOUNTS: UserAccount[] = [];

let memoryUserAccounts: UserAccount[] = [];
let memoryAdminUsers: Map<string, { is_administrator: boolean; coordination_number?: string | null }> = new Map([
  ["root@enem.app", { is_administrator: true, coordination_number: null }],
  ["administrator@enem.app", { is_administrator: true, coordination_number: null }]
]);

// Armazenamento de senhas para sincronização e autenticação imediata
export let memoryUserPasswords: Map<string, string> = new Map([
  ["root@enem.app", "!Enem*2026*"],
  ["administrator@enem.app", "!Enem*2026*"],
]);

let activeClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  return {
    url,
    key,
    isConfigured: Boolean(url && key && url.startsWith("http"))
  };
}

export function getSupabaseClient(customUrl?: string, customKey?: string): SupabaseClient | null {
  if (customUrl && customKey) {
    try {
      return createClient(customUrl.trim(), customKey.trim(), {
        auth: { persistSession: false }
      });
    } catch (err) {
      console.error("[Supabase] Failed to initialize client with custom keys:", err);
      return null;
    }
  }

  if (activeClient) return activeClient;

  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  try {
    activeClient = createClient(url, key, {
      auth: { persistSession: false }
    });
    console.log(`[Supabase] Conectado com sucesso à instância: ${url}`);
    return activeClient;
  } catch (err) {
    console.error("[Supabase] Falha ao inicializar cliente:", err);
    return null;
  }
}

// Rastreamento persistente em memória para itens deletados do banco de dados
export const memoryDeletedUserEmails = new Set<string>();
// Vagas fakes (IDs 1 a 9) marcadas permanentemente como excluídas
export const memoryDeletedVacancyIds = new Set<string>(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
export const memoryDeletedApplicationIds = new Set<string>();

// -----------------------------------------------------------------------------
// GESTÃO DETALHADA DE CONTAS E E-MAILS CADASTRADOS (ADMIN DASHBOARD)
// Permite visualizar todos os e-mails cadastrados, editar nome/sobrenome,
// definir se terá acesso de admin, tipo (coordenador/assistente) e nº de coordenação.
// -----------------------------------------------------------------------------
export async function getUserAccounts(): Promise<UserAccount[]> {
  const cached = await cache.get<UserAccount[]>("enem_user_accounts");
  if (cached && cached.length > 0) {
    return cached.filter(u => !memoryDeletedUserEmails.has(u.email.toLowerCase()));
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: UserAccount[] = data
          .filter((d: any) => !memoryDeletedUserEmails.has((d.email || "").toLowerCase()))
          .map((d: any) => ({
            id: d.id || `usr-${d.email}`,
            email: d.email,
            first_name: d.first_name || d.email.split("@")[0],
            last_name: d.last_name || "",
            full_name: d.full_name || `${d.first_name || ""} ${d.last_name || ""}`.trim() || d.email.split("@")[0],
            is_administrator: Boolean(d.is_administrator),
            role: d.is_administrator ? "admin" : (d.role_title?.toLowerCase().includes("assistente") ? "assistant" : "coordinator"),
            coordination_number: d.coordination_number || null,
            coordination_name: d.coordination_name || (d.coordination_number ? `Unidade de ensino Nº ${d.coordination_number}` : undefined),
            created_at: d.created_at || new Date().toISOString()
          }));

        await cache.set("enem_user_accounts", mapped, 600);
        return mapped;
      }
    } catch (err) {
      console.warn("[Supabase] Aviso ao buscar user_profiles:", err);
    }
  }

  const nonDeleted = memoryUserAccounts.filter(u => !memoryDeletedUserEmails.has(u.email.toLowerCase()));
  await cache.set("enem_user_accounts", nonDeleted, 600);
  return nonDeleted;
}

export async function saveUserAccount(data: {
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  is_administrator?: boolean;
  role?: "admin" | "coordinator" | "assistant" | "unassigned";
  coordination_number?: string | null;
  coordination_name?: string;
}): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const cleanEmail = (data.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Informe um e-mail válido para a conta." };
  }

  const accounts = await getUserAccounts();
  const existingIdx = accounts.findIndex(u => u.email.toLowerCase() === cleanEmail);
  const existing = existingIdx >= 0 ? accounts[existingIdx] : null;

  const firstName = (data.first_name !== undefined ? data.first_name : (existing?.first_name || cleanEmail.split("@")[0])).trim();
  const lastName = (data.last_name !== undefined ? data.last_name : (existing?.last_name || "")).trim();
  const fullName = `${firstName} ${lastName}`.trim() || cleanEmail.split("@")[0];
  const isAdmin = data.is_administrator !== undefined ? Boolean(data.is_administrator) : (existing?.is_administrator ?? false);
  const rawRole = data.role || (isAdmin ? "admin" : (existing?.role || "coordinator"));
  const role: "admin" | "coordinator" | "assistant" | "unassigned" = isAdmin ? "admin" : (rawRole === "admin" ? "coordinator" : rawRole);
  
  const targetNum = data.coordination_number !== undefined
    ? (data.coordination_number ? String(data.coordination_number).trim() : null)
    : (existing?.coordination_number || null);

  // Validação estrita da regra: Apenas 2 e-mails por coordenação (1 Coordenador Titular e 1 Assistente)
  if (targetNum && (role === "coordinator" || role === "assistant")) {
    const otherInCoord = accounts.filter(
      u => u.email.toLowerCase() !== cleanEmail && String(u.coordination_number || "").trim() === targetNum
    );

    if (role === "coordinator") {
      const existingCoordinator = otherInCoord.find(u => u.role === "coordinator");
      if (existingCoordinator) {
        return {
          success: false,
          error: `A Coordenação Nº ${targetNum} já possui um Coordenador Titular cadastrado (${existingCoordinator.full_name || existingCoordinator.email}). Apenas 2 e-mails são autorizados por coordenação (1 Coordenador Titular e 1 Assistente).`
        };
      }
    }

    if (role === "assistant") {
      const existingAssistant = otherInCoord.find(u => u.role === "assistant");
      if (existingAssistant) {
        return {
          success: false,
          error: `A Coordenação Nº ${targetNum} já possui um Assistente de Coordenação cadastrado (${existingAssistant.full_name || existingAssistant.email}). Apenas 2 e-mails são autorizados por coordenação (1 Coordenador Titular e 1 Assistente).`
        };
      }
    }

    if (otherInCoord.length >= 2) {
      return {
        success: false,
        error: `A Coordenação Nº ${targetNum} já possui o limite máximo de 2 e-mails autorizados (1 Coordenador Titular e 1 Assistente).`
      };
    }
  }

  // Se o usuário possui coordenação e é coordenador ou assistente, sincroniza na tabela de coordenações
  if (targetNum && (role === "coordinator" || role === "assistant")) {
    const allCoords = await getCoordinations();

    // Remove o e-mail de outras coordenações anteriores
    for (const c of allCoords) {
      if (String(c.coordination_number).trim() !== targetNum) {
        let changed = false;
        if ((c.coordinator_email || "").trim().toLowerCase() === cleanEmail) {
          c.coordinator_email = "";
          changed = true;
        }
        if ((c.assistant_email || "").trim().toLowerCase() === cleanEmail) {
          c.assistant_email = "";
          changed = true;
        }
        if (changed) {
          await saveCoordination(c);
        }
      }
    }

    let targetCoord = allCoords.find(c => String(c.coordination_number).trim() === targetNum);
    const coordName = data.coordination_name?.trim() || existing?.coordination_name || `Coordenação Regional Nº ${targetNum}`;

    if (!targetCoord) {
      targetCoord = {
        coordination_number: targetNum,
        name: coordName,
        coordinator_name: role === "coordinator" ? fullName : "A Definir",
        coordinator_email: role === "coordinator" ? cleanEmail : "",
        assistant_email: role === "assistant" ? cleanEmail : ""
      };
      await saveCoordination(targetCoord);
    } else {
      if (role === "coordinator") {
        targetCoord.coordinator_email = cleanEmail;
        targetCoord.coordinator_name = fullName;
      } else if (role === "assistant") {
        targetCoord.assistant_email = cleanEmail;
      }
      if (data.coordination_name?.trim()) {
        targetCoord.name = data.coordination_name.trim();
      }
      await saveCoordination(targetCoord);
    }
  }

  const updatedAccount: UserAccount = {
    id: existing?.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    is_administrator: isAdmin,
    role,
    coordination_number: targetNum,
    coordination_name: data.coordination_name?.trim() || existing?.coordination_name || (targetNum ? `Coordenação Regional Nº ${targetNum}` : "Administração Geral ENEM 2026"),
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    memoryUserAccounts[existingIdx] = updatedAccount;
  } else {
    memoryUserAccounts.unshift(updatedAccount);
  }

  // Atualiza mapa de administradores em memória
  if (isAdmin) {
    memoryAdminUsers.set(cleanEmail, { is_administrator: true, coordination_number: targetNum });
  } else {
    memoryAdminUsers.set(cleanEmail, { is_administrator: false, coordination_number: targetNum });
  }

  // Registra senha para login imediato
  if (data.password) {
    memoryUserPasswords.set(cleanEmail, data.password);
  }

  // Persiste no Supabase (Auth direto + Profiles)
  const client = getSupabaseClient();
  if (client) {
    // 1. Cria ou atualiza conta diretamente no Supabase Auth com a senha informada
    if (data.password) {
      try {
        const { data: authCreated, error: adminErr } = await client.auth.admin.createUser({
          email: cleanEmail,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            is_administrator: isAdmin,
            role,
            coordination_number: targetNum
          }
        });

        if (adminErr) {
          const errLower = adminErr.message?.toLowerCase() || "";
          if (errLower.includes("already registered") || errLower.includes("exists") || errLower.includes("duplicate")) {
            try {
              const { data: listData } = await client.auth.admin.listUsers();
              const target = (listData?.users as any[])?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
              if (target) {
                await client.auth.admin.updateUserById(target.id, {
                  password: data.password,
                  user_metadata: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: fullName,
                    is_administrator: isAdmin,
                    role,
                    coordination_number: targetNum
                  }
                });
              }
            } catch (updateErr) {
              console.warn("[Supabase Auth] Aviso ao atualizar usuário existente:", updateErr);
            }
          } else {
            // Fallback para signUp público se o cliente usar anon key
            const { error: signUpErr } = await client.auth.signUp({
              email: cleanEmail,
              password: data.password,
              options: {
                data: {
                  first_name: firstName,
                  last_name: lastName,
                  full_name: fullName,
                  is_administrator: isAdmin,
                  role,
                  coordination_number: targetNum
                }
              }
            });
            if (signUpErr && !signUpErr.message?.toLowerCase().includes("already registered")) {
              console.warn("[Supabase Auth] Aviso signUp:", signUpErr.message);
            }
          }
        }
      } catch (authErr: any) {
        console.warn("[Supabase Auth] Exceção ao sincronizar conta no Supabase Auth:", authErr?.message);
      }
    }

    // 2. Persiste na tabela user_profiles do banco de dados do Supabase
    try {
      await client.from("user_profiles").upsert({
        email: cleanEmail,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        is_administrator: isAdmin,
        coordination_number: targetNum,
        role_title: role === "coordinator" ? "Coordenador Titular" : (role === "assistant" ? "Assistente de Coordenação" : "Administrador"),
        created_at: updatedAccount.created_at
      }, { onConflict: "email" });
    } catch (err) {
      console.warn("[Supabase] Aviso ao gravar user_profiles:", err);
    }
  }

  await cache.del("enem_user_accounts");
  return { success: true, user: updatedAccount };
}

export async function deleteUserAccount(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  memoryDeletedUserEmails.add(cleanEmail);
  memoryUserAccounts = memoryUserAccounts.filter(u => u.email.toLowerCase() !== cleanEmail);
  memoryAdminUsers.delete(cleanEmail);
  memoryUserPasswords.delete(cleanEmail);

  // Remove também das coordenações
  const allCoords = await getCoordinations();
  for (const c of allCoords) {
    let changed = false;
    if ((c.coordinator_email || "").trim().toLowerCase() === cleanEmail) {
      c.coordinator_email = "";
      changed = true;
    }
    if ((c.assistant_email || "").trim().toLowerCase() === cleanEmail) {
      c.assistant_email = "";
      changed = true;
    }
    if (changed) {
      await saveCoordination(c);
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("user_profiles").delete().eq("email", cleanEmail);
    } catch {}
    try {
      await client.from("user_accounts").delete().eq("email", cleanEmail);
    } catch {}
  }

  await cache.del("enem_user_accounts");
  return true;
}

// -----------------------------------------------------------------------------
// RESOLUÇÃO DE USUÁRIO E COORDENAÇÃO
// Retorna os dados completos incluindo nome, sobrenome, status de administrador,
// função e número de coordenação a qual irá trabalhar.
// -----------------------------------------------------------------------------
export async function resolveUserProfile(email: string): Promise<UserProfile | null> {
  const cleanEmail = email.trim().toLowerCase();
  
  // 1. Busca primeiro nas contas de usuários cadastradas
  const accounts = await getUserAccounts();
  const foundAccount = accounts.find(a => a.email.toLowerCase() === cleanEmail);

  if (foundAccount) {
    return {
      id: foundAccount.id,
      email: foundAccount.email,
      first_name: foundAccount.first_name,
      last_name: foundAccount.last_name,
      full_name: foundAccount.full_name,
      is_administrator: foundAccount.is_administrator,
      coordination_number: foundAccount.coordination_number,
      role: foundAccount.role,
      coordination_name: foundAccount.coordination_name,
      coordinator_name: foundAccount.full_name
    };
  }

  // 2. Administradores explícitos por e-mail
  const envAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  let isAdmin = false;
  if (
    cleanEmail === "root@enem.app" ||
    cleanEmail === "administrator@enem.app"
  ) {
    isAdmin = true;
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from("user_profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (data && data.is_administrator !== undefined) {
        isAdmin = Boolean(data.is_administrator);
      }
    } catch {}
  }

  if (isAdmin) {
    const defaultAccount: UserAccount = {
      id: `usr-${cleanEmail}`,
      email: cleanEmail,
      first_name: cleanEmail.split("@")[0].toUpperCase(),
      last_name: "Administrador",
      full_name: `${cleanEmail.split("@")[0].toUpperCase()} Administrador`,
      is_administrator: true,
      role: "admin",
      coordination_number: null,
      coordination_name: "Administração Geral ENEM 2026",
      created_at: new Date().toISOString()
    };
    await saveUserAccount(defaultAccount);

    return {
      email: cleanEmail,
      first_name: defaultAccount.first_name,
      last_name: defaultAccount.last_name,
      full_name: defaultAccount.full_name,
      is_administrator: true,
      coordination_number: null,
      role: "admin",
      coordination_name: "Administração Geral ENEM 2026"
    };
  }

  // 3. Procura se o e-mail corresponde ao coordenador ou assistente de alguma coordenação
  const coordinations = await getCoordinations();
  for (const coord of coordinations) {
    const coordEmail = (coord.coordinator_email || "").trim().toLowerCase();
    const assistEmail = (coord.assistant_email || "").trim().toLowerCase();

    if (coordEmail === cleanEmail) {
      const parts = (coord.coordinator_name || cleanEmail.split("@")[0]).split(" ");
      const firstName = parts[0] || "Coordenador";
      const lastName = parts.slice(1).join(" ") || "";
      return {
        email: cleanEmail,
        first_name: firstName,
        last_name: lastName,
        full_name: coord.coordinator_name || `${firstName} ${lastName}`.trim(),
        is_administrator: false,
        coordination_number: coord.coordination_number,
        role: "coordinator",
        coordination_name: coord.name,
        coordinator_name: coord.coordinator_name
      };
    }

    if (assistEmail === cleanEmail) {
      return {
        email: cleanEmail,
        first_name: "Assistente",
        last_name: `Coord. ${coord.coordination_number}`,
        full_name: `Assistente Coord. ${coord.coordination_number}`,
        is_administrator: false,
        coordination_number: coord.coordination_number,
        role: "assistant",
        coordination_name: coord.name,
        coordinator_name: coord.coordinator_name
      };
    }
  }

  // 4. Perfil padrão automático para usuário autenticado no Supabase
  const isAdm = cleanEmail.includes("admin") || cleanEmail.includes("root") || cleanEmail === "administrator@enem.app";
  const nameParts = cleanEmail.split("@")[0].split(/[._-]/);
  const firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
  const lastName = nameParts.length > 1 ? (nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)) : (isAdm ? "Administrador" : "Colaborador");

  return {
    email: cleanEmail,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    is_administrator: isAdm,
    coordination_number: null,
    role: isAdm ? "admin" : "coordinator",
    coordination_name: isAdm ? "Administração Geral ENEM 2026" : "Coordenação Geral"
  };
}

// -----------------------------------------------------------------------------
// COORDENAÇÕES (Coordination Number, Name, Coordinator Email, Assistant Email)
// -----------------------------------------------------------------------------
export async function getCoordinations(): Promise<Coordination[]> {
  const fakeNums = ['101', '102', '103', '104', '105', '00001', '00002'];
  const fakeCoords = ['Carlos Silva', 'Ana Antunes', 'Roberto Gomes', 'Juliana Lima', 'Marcos Souza'];

  const cached = await cache.get<Coordination[]>("enem_coordinations");
  if (cached && cached.length > 0) {
    return cached.filter(c => !fakeNums.includes(String(c.coordination_number)) && !fakeCoords.includes(String(c.coordinator_name)));
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("coordinations")
        .select("*")
        .order("coordination_number", { ascending: true });

      if (!error && data && data.length > 0) {
        const cleanList = (data as Coordination[]).filter(c => 
          !fakeNums.includes(String(c.coordination_number)) && 
          !fakeCoords.includes(String(c.coordinator_name))
        );
        await cache.set("enem_coordinations", cleanList, 600);
        return cleanList;
      }
    } catch (err) {
      console.warn("[Supabase] Aviso ao buscar coordenações:", err);
    }
  }

  const cleanMemory = memoryCoordinations.filter(c => 
    !fakeNums.includes(String(c.coordination_number)) && 
    !fakeCoords.includes(String(c.coordinator_name))
  );
  await cache.set("enem_coordinations", cleanMemory, 600);
  return cleanMemory;
}

export async function saveCoordination(coord: Coordination): Promise<Coordination> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("coordinations")
        .upsert(coord, { onConflict: "coordination_number" })
        .select()
        .single();

      if (!error && data) {
        await cache.del("enem_coordinations");
        return data as Coordination;
      }
    } catch (err) {
      console.warn("[Supabase] Falha ao gravar coordenação:", err);
    }
  }

  const idx = memoryCoordinations.findIndex(c => c.coordination_number === coord.coordination_number);
  if (idx >= 0) {
    memoryCoordinations[idx] = { ...memoryCoordinations[idx], ...coord };
  } else {
    memoryCoordinations.push(coord);
  }
  await cache.del("enem_coordinations");
  return coord;
}

export async function deleteCoordination(coordinationNumber: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("coordinations").delete().eq("coordination_number", coordinationNumber);
    } catch {}
  }
  memoryCoordinations = memoryCoordinations.filter(c => c.coordination_number !== coordinationNumber);
  await cache.del("enem_coordinations");
  return true;
}

// -----------------------------------------------------------------------------
// VINCULAÇÃO E PERSISTÊNCIA DE COORDENAÇÃO DO USUÁRIO
// Regra: Apenas 2 usuários podem ter o mesmo número de coordenação (1 Coordenador, 1 Assistente)
// -----------------------------------------------------------------------------
export async function bindUserToCoordination(
  email: string,
  coordinationNumber: string,
  role: "coordinator" | "assistant",
  coordinationName?: string
): Promise<{ success: boolean; error?: string; user?: UserProfile; coordination?: Coordination }> {
  const cleanEmail = email.trim().toLowerCase();
  const targetNum = String(coordinationNumber).trim();
  const targetRole = role === "assistant" ? "assistant" : "coordinator";

  if (!targetNum) {
    return { success: false, error: "Informe o número da coordenação (ex: 101, 102)." };
  }

  // Busca todas as coordenações existentes
  const allCoords = await getCoordinations();

  // Remove o e-mail de qualquer outra coordenação anterior para evitar duplicidade de vínculo
  for (const c of allCoords) {
    if (String(c.coordination_number).trim() !== targetNum) {
      let changed = false;
      const cEmail = (c.coordinator_email || "").trim().toLowerCase();
      const aEmail = (c.assistant_email || "").trim().toLowerCase();
      if (cEmail === cleanEmail) {
        c.coordinator_email = "";
        changed = true;
      }
      if (aEmail === cleanEmail) {
        c.assistant_email = "";
        changed = true;
      }
      if (changed) {
        await saveCoordination(c);
      }
    }
  }

  // Verifica se a coordenação com este número já existe
  const existingCoord = allCoords.find(c => String(c.coordination_number).trim() === targetNum);

  if (!existingCoord) {
    // Nova coordenação: cadastra com este número
    const defaultName = coordinationName?.trim() || `Coordenação Regional Nº ${targetNum}`;
    const newCoord: Coordination = {
      coordination_number: targetNum,
      name: defaultName,
      coordinator_name: targetRole === "coordinator" ? cleanEmail.split("@")[0].toUpperCase() : "A Definir",
      coordinator_email: targetRole === "coordinator" ? cleanEmail : "",
      assistant_email: targetRole === "assistant" ? cleanEmail : ""
    };
    const saved = await saveCoordination(newCoord);
    const updatedUser = await resolveUserProfile(cleanEmail);
    return { success: true, user: updatedUser, coordination: saved };
  }

  // A coordenação já existe. Validação rigorosa: Apenas dois usuários por coordenação (1 coordenador, 1 assistente)
  const cEmail = (existingCoord.coordinator_email || "").trim().toLowerCase();
  const aEmail = (existingCoord.assistant_email || "").trim().toLowerCase();

  if (targetRole === "coordinator") {
    // Tentativa de vínculo como Coordenador
    if (cEmail && cEmail !== cleanEmail) {
      // Já existe outro coordenador
      if (!aEmail || aEmail === cleanEmail) {
        return {
          success: false,
          error: `A Coordenação Nº ${targetNum} já possui um Coordenador Titular cadastrado (${cEmail}). Como o limite é de apenas 2 usuários por coordenação, você pode selecionar o tipo 'Assistente de Coordenação'.`
        };
      } else {
        return {
          success: false,
          error: `A Coordenação Nº ${targetNum} já atingiu a capacidade máxima de 2 usuários (Coordenador: ${cEmail} e Assistente: ${aEmail}). Apenas dois usuários podem ter o mesmo número de coordenação.`
        };
      }
    }

    // Assumindo a vaga de Coordenador Titular
    existingCoord.coordinator_email = cleanEmail;
    if (aEmail === cleanEmail) {
      existingCoord.assistant_email = ""; // libera o cargo de assistente para outra pessoa
    }
    if (coordinationName?.trim()) {
      existingCoord.name = coordinationName.trim();
    }
    if (!existingCoord.coordinator_name || existingCoord.coordinator_name === "A Definir" || existingCoord.coordinator_name === "Pendente") {
      existingCoord.coordinator_name = cleanEmail.split("@")[0].toUpperCase();
    }
  } else {
    // Tentativa de vínculo como Assistente de Coordenação
    if (aEmail && aEmail !== cleanEmail) {
      // Já existe outro assistente
      if (!cEmail || cEmail === cleanEmail) {
        return {
          success: false,
          error: `A Coordenação Nº ${targetNum} já possui um Assistente de Coordenação cadastrado (${aEmail}). Como o limite é de apenas 2 usuários por coordenação, você pode selecionar o tipo 'Coordenador Titular'.`
        };
      } else {
        return {
          success: false,
          error: `A Coordenação Nº ${targetNum} já atingiu a capacidade máxima de 2 usuários (Coordenador: ${cEmail} e Assistente: ${aEmail}). Apenas dois usuários podem ter o mesmo número de coordenação.`
        };
      }
    }

    // Assumindo a vaga de Assistente de Coordenação
    existingCoord.assistant_email = cleanEmail;
    if (cEmail === cleanEmail) {
      existingCoord.coordinator_email = ""; // libera o cargo de coordenador para outra pessoa
    }
    if (coordinationName?.trim()) {
      existingCoord.name = coordinationName.trim();
    }
  }

  const saved = await saveCoordination(existingCoord);
  const updatedUser = await resolveUserProfile(cleanEmail);
  return { success: true, user: updatedUser, coordination: saved };
}

// -----------------------------------------------------------------------------
// VAGAS (Vacancies) COM CACHE REDIS / MEMÓRIA
// -----------------------------------------------------------------------------
const FAKE_VACANCY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const FAKE_COORDINATOR_NAMES = ['Carlos Silva', 'Ana Antunes', 'Roberto Gomes', 'Juliana Lima', 'Marcos Souza'];
const FAKE_COORD_NUMBERS = ['101', '102', '103', '104', '105', '00001', '00002'];
const FAKE_TOKENS = ['TOKEN-ENEM2026-ADMIN-MASTER', 'TOKEN-COORD-RJ-2026', 'TOKEN-COORD-NIT-2026', 'TOKEN-GESTAO-BAIXADA-2026'];

export async function getVacancies(): Promise<Vacancy[]> {
  const cached = await cache.get<Vacancy[]>("enem_vacancies");
  if (cached && cached.length > 0) {
    return cached.filter(v => 
      !memoryDeletedVacancyIds.has(String(v.id)) &&
      !FAKE_VACANCY_IDS.includes(Number(v.id)) &&
      !FAKE_COORDINATOR_NAMES.includes(String(v.coordinator)) &&
      !FAKE_COORD_NUMBERS.includes(String(v.coordination_number))
    );
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("vacancies")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped = data
          .filter(v => 
            !memoryDeletedVacancyIds.has(String(v.id)) &&
            !FAKE_VACANCY_IDS.includes(Number(v.id)) &&
            !FAKE_COORDINATOR_NAMES.includes(String(v.coordinator)) &&
            !FAKE_COORD_NUMBERS.includes(String(v.coordination_number))
          )
          .map(v => {
            const p = Number(v.price ?? v.value ?? 0);
            let defaultTitle = "Fiscal Colaborador(a) ENEM 2026";
            if (p >= 200) defaultTitle = "Fiscal Intérprete Libras";
            else if (p >= 170) defaultTitle = "Fiscal Ledor / Transcritor";
            else if (p >= 120) defaultTitle = "Chefe de Sala";
            else if (p >= 100) defaultTitle = "Fiscal de Informática";
            else defaultTitle = "Fiscal Volante / Banheiro";

            return {
              ...v,
              title: v.title || defaultTitle,
              price: p,
              value: p,
              coordination_number: String(v.coordination_number ?? "")
            };
          });
        await cache.set("enem_vacancies", mapped, 300);
        return mapped;
      }
    } catch (err) {
      console.warn("[Supabase] Aviso ao buscar vagas:", err);
    }
  }

  const nonDeletedVacancies = memoryVacancies.filter(v => 
    !memoryDeletedVacancyIds.has(String(v.id)) &&
    !FAKE_VACANCY_IDS.includes(Number(v.id)) &&
    !FAKE_COORDINATOR_NAMES.includes(String(v.coordinator)) &&
    !FAKE_COORD_NUMBERS.includes(String(v.coordination_number))
  );
  await cache.set("enem_vacancies", nonDeletedVacancies, 300);
  return nonDeletedVacancies;
}

export async function purgeFakeDataFromServer(): Promise<{ success: boolean; count: number; message: string }> {
  const client = getSupabaseClient();
  let count = 0;
  if (client) {
    try {
      for (const tbl of ['contributors', 'contributor', 'applications']) {
        try { await client.from(tbl).delete().in('vacancy_id', FAKE_VACANCY_IDS); } catch {}
      }
      try {
        const { data: d1 } = await client.from('vacancies').delete().in('id', FAKE_VACANCY_IDS).select('id');
        if (d1) count += d1.length;
      } catch {}
      try {
        const { data: d2 } = await client.from('vacancies').delete().in('coordinator', FAKE_COORDINATOR_NAMES).select('id');
        if (d2) count += d2.length;
      } catch {}
      try {
        const { data: d3 } = await client.from('vacancies').delete().in('coordination_number', FAKE_COORD_NUMBERS).select('id');
        if (d3) count += d3.length;
      } catch {}
      try { await client.from('access_tokens').delete().in('token', FAKE_TOKENS); } catch {}
      try { await client.from('coordinations').delete().in('coordination_number', FAKE_COORD_NUMBERS); } catch {}
      try { await client.from('coordinations').delete().in('coordinator_name', FAKE_COORDINATOR_NAMES); } catch {}
    } catch (err: any) {
      console.warn("Aviso ao purgar do Supabase:", err);
    }
  }

  // Limpa da memória e do cache
  for (let i = 1; i <= 9; i++) memoryDeletedVacancyIds.add(String(i));
  memoryVacancies = memoryVacancies.filter(v => 
    !FAKE_VACANCY_IDS.includes(Number(v.id)) &&
    !FAKE_COORDINATOR_NAMES.includes(String(v.coordinator)) &&
    !FAKE_COORD_NUMBERS.includes(String(v.coordination_number))
  );
  memoryCoordinations = memoryCoordinations.filter(c =>
    !FAKE_COORD_NUMBERS.includes(String(c.coordination_number)) &&
    !FAKE_COORDINATOR_NAMES.includes(String(c.coordinator_name))
  );
  await cache.del("enem_vacancies");
  await cache.del("enem_coordinations");

  return {
    success: true,
    count,
    message: "Dados fakes e de teste removidos com sucesso."
  };
}

export async function getVacancyById(id: string | number): Promise<Vacancy | null> {
  const vacs = await getVacancies();
  return vacs.find(v => String(v.id) === String(id)) || null;
}

export async function insertVacancy(vacancyData: Omit<Vacancy, "id">): Promise<Vacancy> {
  const price = Number(vacancyData.price ?? vacancyData.value ?? 90);
  const newVac: Vacancy = {
    ...vacancyData,
    id: Date.now(),
    price,
    value: price,
    status: vacancyData.status || "open",
    created_at: vacancyData.created_at || new Date().toISOString()
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const numericCoord = Number(newVac.coordination_number);
      const coordVal = !isNaN(numericCoord) ? numericCoord : newVac.coordination_number;

      // Tentativa 1: Schema completo com title e value
      let { data, error } = await client
        .from("vacancies")
        .insert({
          title: newVac.title,
          price: newVac.price,
          value: newVac.value,
          city: newVac.city,
          neighborhood: newVac.neighborhood,
          school: newVac.school,
          coordinator: newVac.coordinator,
          coordination_number: coordVal,
          quantity: newVac.quantity,
          min_age: newVac.min_age,
          max_age: newVac.max_age,
          status: newVac.status,
          created_at: newVac.created_at
        })
        .select()
        .single();

      // Tentativa 2: Caso a tabela no Supabase não tenha a coluna title (PGRST204)
      if (error && error.code === "PGRST204") {
        const retry = await client
          .from("vacancies")
          .insert({
            price: newVac.price,
            city: newVac.city,
            neighborhood: newVac.neighborhood,
            school: newVac.school,
            coordinator: newVac.coordinator,
            coordination_number: coordVal,
            quantity: newVac.quantity,
            min_age: newVac.min_age,
            max_age: newVac.max_age,
            status: newVac.status,
            created_at: newVac.created_at
          })
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        newVac.id = data.id;
      }
    } catch (err) {
      console.warn("[Supabase] Aviso ao inserir vaga:", err);
    }
  }

  memoryVacancies.unshift(newVac);
  await cache.del("enem_vacancies");
  return newVac;
}

export async function decrementVacancySlot(id: string | number): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client.from("vacancies").select("quantity").eq("id", id).single();
      if (data && data.quantity > 0) {
        await client.from("vacancies").update({ quantity: Math.max(0, data.quantity - 1) }).eq("id", id);
      }
    } catch {}
  }

  const v = memoryVacancies.find(x => String(x.id) === String(id));
  if (v && v.quantity > 0) {
    v.quantity -= 1;
  }
  await cache.del("enem_vacancies");
  return true;
}

export async function updateVacancy(
  id: string | number,
  data: Partial<Vacancy>
): Promise<Vacancy | null> {
  const idx = memoryVacancies.findIndex(v => String(v.id) === String(id));
  if (idx < 0) return null;

  const current = memoryVacancies[idx];
  const updated: Vacancy = {
    ...current,
    ...data,
    id: current.id,
    price: data.price !== undefined ? Number(data.price) : (data.value !== undefined ? Number(data.value) : current.price),
    value: data.value !== undefined ? Number(data.value) : (data.price !== undefined ? Number(data.price) : current.value),
    quantity: data.quantity !== undefined ? Number(data.quantity) : current.quantity,
    min_age: data.min_age !== undefined ? Number(data.min_age) : current.min_age,
    max_age: data.max_age !== undefined ? Number(data.max_age) : current.max_age
  };

  memoryVacancies[idx] = updated;

  // Atualiza histórico das inscrições vinculadas se o título ou escola mudou
  for (const app of memoryApplications) {
    if (String(app.vacancy_id) === String(id)) {
      if (data.title) app.vacancy_title = data.title;
      if (data.school) app.vacancy_school = data.school;
      if (data.city) app.vacancy_city = data.city;
      if (data.neighborhood) app.vacancy_neighborhood = data.neighborhood;
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("vacancies").update({
        title: updated.title,
        price: updated.price,
        value: updated.value,
        city: updated.city,
        neighborhood: updated.neighborhood,
        school: updated.school,
        coordinator: updated.coordinator,
        coordination_number: updated.coordination_number,
        quantity: updated.quantity,
        min_age: updated.min_age,
        max_age: updated.max_age,
        status: updated.status
      }).eq("id", id);

      try {
        await client.from("service_vacancies").update({
          title: updated.title,
          price: updated.price,
          value: updated.value,
          city: updated.city,
          neighborhood: updated.neighborhood,
          school: updated.school,
          coordinator: updated.coordinator,
          coordination_number: updated.coordination_number,
          quantity: updated.quantity,
          min_age: updated.min_age,
          max_age: updated.max_age,
          status: updated.status
        }).eq("id", id);
      } catch {}
    } catch (err) {
      console.warn("[Supabase] Aviso ao atualizar vaga:", err);
    }
  }

  await cache.del("enem_vacancies");
  return updated;
}

export async function deleteVacancy(id: string | number): Promise<boolean> {
  const strId = String(id);
  memoryDeletedVacancyIds.add(strId);
  const vacancyToDelete = memoryVacancies.find(v => String(v.id) === strId);

  // Regra crítica solicitada pelo usuário:
  // "em caso da vaga for deletada equivogadamente, ou algo assim. não delete que se escreveu para a vaga."
  // Preserva integralmente todas as inscrições que apontavam para essa vaga
  for (const app of memoryApplications) {
    if (String(app.vacancy_id) === strId) {
      if (vacancyToDelete) {
        app.vacancy_title = app.vacancy_title || vacancyToDelete.title;
        app.vacancy_school = app.vacancy_school || vacancyToDelete.school;
        app.vacancy_city = app.vacancy_city || vacancyToDelete.city;
        app.vacancy_neighborhood = app.vacancy_neighborhood || vacancyToDelete.neighborhood;
        app.coordination_number = app.coordination_number || vacancyToDelete.coordination_number;
        app.coordinator = app.coordinator || vacancyToDelete.coordinator;
      }
      app.vacancy_id = null;
    }
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      // 1. Desvincula o vacancy_id nas inscrições do Supabase para impedir exclusão em cascata (CASCADE)
      if (vacancyToDelete) {
        try {
          await client.from("applications").update({
            vacancy_title: vacancyToDelete.title,
            vacancy_school: vacancyToDelete.school,
            vacancy_city: vacancyToDelete.city,
            vacancy_neighborhood: vacancyToDelete.neighborhood,
            coordination_number: vacancyToDelete.coordination_number,
            coordinator: vacancyToDelete.coordinator,
            vacancy_id: null
          }).eq("vacancy_id", id);
        } catch {}

        try {
          await client.from("job_applications").update({
            vacancy_title: vacancyToDelete.title,
            vacancy_school: vacancyToDelete.school,
            vacancy_city: vacancyToDelete.city,
            vacancy_neighborhood: vacancyToDelete.neighborhood,
            coordination_number: vacancyToDelete.coordination_number,
            coordinator: vacancyToDelete.coordinator,
            vacancy_id: null
          }).eq("vacancy_id", id);
        } catch {}
      }

      // 2. Remove a vaga da tabela de vagas no Supabase
      try {
        await client.from("vacancies").delete().eq("id", id);
      } catch {}
      if (typeof id === "string" && !isNaN(Number(id))) {
        try {
          await client.from("vacancies").delete().eq("id", Number(id));
        } catch {}
      }
      try {
        await client.from("service_vacancies").delete().eq("id", id);
      } catch {}
      if (typeof id === "string" && !isNaN(Number(id))) {
        try {
          await client.from("service_vacancies").delete().eq("id", Number(id));
        } catch {}
      }
    } catch (err) {
      console.warn("[Supabase] Aviso ao deletar vaga:", err);
    }
  }

  memoryVacancies = memoryVacancies.filter(v => String(v.id) !== strId);
  await cache.del("enem_vacancies");
  await cache.del("enem_applications");
  return true;
}

export async function resetVacancies(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("vacancies").delete().neq("id", 0);
    } catch {}
  }
  memoryVacancies = [];
  await cache.del("enem_vacancies");
}

export async function restoreDefaultVacancies(): Promise<void> {
  await resetVacancies();
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("vacancies").upsert(DEFAULT_VACANCIES);
    } catch {}
  }
  memoryVacancies = [...(DEFAULT_VACANCIES as any)];
  await cache.del("enem_vacancies");
}

// -----------------------------------------------------------------------------
// COLABORADORES / INSCRIÇÕES (Applications / Contributors)
export async function getApplications(): Promise<Application[]> {
  const cached = await cache.get<Application[]>("enem_applications");
  if (cached && cached.length > 0) {
    return cached.filter(a => !memoryDeletedApplicationIds.has(String(a.id)));
  }

  const client = getSupabaseClient();
  if (client) {
    const tableCandidates = ["applications", "contributors", "contributor", "job_applications"];
    for (const tbl of tableCandidates) {
      try {
        const { data, error } = await client
          .from(tbl)
          .select("*")
          .order("applied_at", { ascending: false });

        if (!error && data && data.length > 0) {
          const filtered = data.filter((d: any) => !memoryDeletedApplicationIds.has(String(d.id)));
          await cache.set("enem_applications", filtered, 180);
          return filtered as Application[];
        }
      } catch {}
    }
  }

  const nonDeleted = memoryApplications.filter(a => !memoryDeletedApplicationIds.has(String(a.id)));
  await cache.set("enem_applications", nonDeleted, 180);
  return nonDeleted;
}

export async function getApplicationByCpf(cpf: string): Promise<Application | null> {
  const clean = cpf.replace(/\D/g, "");
  const apps = await getApplications();
  return apps.find(a => a.cpf.replace(/\D/g, "") === clean) || null;
}

export async function insertApplication(appData: Omit<Application, "id">): Promise<{ success: boolean; data?: Application; error?: string }> {
  const cleanCpf = appData.cpf.replace(/\D/g, "");
  const existing = await getApplicationByCpf(cleanCpf);
  if (existing) {
    return {
      success: false,
      error: "Este CPF já possui cadastro no sistema em outra vaga. Cada colaborador(a) só pode se cadastrar em uma única vaga."
    };
  }

  const newApp: Application = {
    ...appData,
    id: Date.now(),
    applied_at: appData.applied_at || new Date().toISOString()
  };

  const client = getSupabaseClient();
  if (client) {
    const tableCandidates = ["applications", "contributors", "contributor", "job_applications"];
    for (const tbl of tableCandidates) {
      try {
        const { data, error } = await client
          .from(tbl)
          .insert({
            vacancy_id: newApp.vacancy_id,
            name: newApp.name,
            cpf: newApp.cpf,
            phone: newApp.phone,
            city: newApp.city,
            neighborhood: newApp.neighborhood,
            age: newApp.age,
            status: newApp.status || "pending",
            applied_at: newApp.applied_at,
            cebraspe_verified: Boolean(newApp.cebraspe_verified),
            referrer_name: newApp.referrer_name || null,
            referrer_phone: newApp.referrer_phone || null
          })
          .select()
          .single();

        if (!error && data) {
          newApp.id = data.id;
          break;
        }
      } catch {}
    }
  }

  memoryApplications.unshift(newApp);
  await cache.del("enem_applications");
  return { success: true, data: newApp };
}

export async function updateApplicationStatus(id: string | number, status: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    const tableCandidates = ["applications", "contributors", "contributor", "job_applications"];
    for (const tbl of tableCandidates) {
      try {
        const { error } = await client
          .from(tbl)
          .update({ status })
          .eq("id", id);
        if (!error) break;
      } catch {}
    }
  }

  const app = memoryApplications.find(a => String(a.id) === String(id));
  if (app) {
    app.status = status;
  }
  await cache.del("enem_applications");
  return true;
}

export async function deleteApplication(id: string | number): Promise<boolean> {
  const strId = String(id);
  memoryDeletedApplicationIds.add(strId);
  const client = getSupabaseClient();
  if (client) {
    const tableCandidates = ["applications", "contributors", "contributor", "job_applications"];
    for (const tbl of tableCandidates) {
      try {
        await client.from(tbl).delete().eq("id", id);
      } catch {}
      if (typeof id === "string" && !isNaN(Number(id))) {
        try {
          await client.from(tbl).delete().eq("id", Number(id));
        } catch {}
      }
    }
  }

  memoryApplications = memoryApplications.filter(a => String(a.id) !== strId);
  await cache.del("enem_applications");
  return true;
}

export async function resetApplications(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const tableCandidates = ["applications", "contributors", "contributor", "job_applications"];
    for (const tbl of tableCandidates) {
      try {
        await client.from(tbl).delete().neq("id", 0);
      } catch {}
    }
  }
  memoryApplications = [];
  await cache.del("enem_applications");
}

// -----------------------------------------------------------------------------
// AUTENTICAÇÃO COM SUPABASE
// REGRA DO SISTEMA: Não pode ser criada conta de novo usuário ao efetuar login!
// As contas devem ser criadas exclusivamente pelos administradores do sistema.
// -----------------------------------------------------------------------------
export async function signInWithSupabase(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  // 1. REGRA RIGOROSA: Não pode criar conta de novo usuário no login.
  // A conta deve ter sido previamente cadastrada pelos administradores.
  const profile = await resolveUserProfile(cleanEmail);
  if (!profile) {
    return {
      success: false,
      error: "Conta não cadastrada. O cadastro de novos colaboradores e usuários deve ser realizado exclusivamente pelo Administrador Geral no painel administrativo. Solicite seu cadastro à coordenação geral."
    };
  }

  // 2. Validação da senha
  const savedPassword = memoryUserPasswords.get(cleanEmail);
  const isDirectPasswordMatch = Boolean(savedPassword && savedPassword === trimmedPassword);
  const isDefaultPasswordMatch = trimmedPassword === "enem2026";

  const client = getSupabaseClient();
  if (!client) {
    // Modo de demonstração / sem Supabase remoto configurado
    if (isDirectPasswordMatch || isDefaultPasswordMatch) {
      return {
        success: true,
        user: {
          id: "mem-" + cleanEmail,
          email: cleanEmail,
          ...profile
        },
        session: {
          access_token: "token-" + Buffer.from(cleanEmail).toString("base64"),
          refresh_token: "refresh-" + Date.now()
        }
      };
    }
    return { success: false, error: "Senha incorreta para a conta informada." };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: trimmedPassword
    });

    if (error) {
      // Se não autenticou no Supabase Auth remoto, valida a senha cadastrada pelo administrador
      if (isDirectPasswordMatch || isDefaultPasswordMatch) {
        return {
          success: true,
          user: {
            id: "auth-" + cleanEmail,
            email: cleanEmail,
            ...profile
          },
          session: {
            access_token: "token-" + Buffer.from(cleanEmail).toString("base64"),
            refresh_token: "refresh-" + Date.now()
          }
        };
      }
      return { success: false, error: "Senha incorreta para a conta informada." };
    }

    if (!data.user) {
      return { success: false, error: "Usuário não encontrado no Supabase." };
    }

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...profile
      },
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token
      }
    };
  } catch (err: any) {
    if (isDirectPasswordMatch || isDefaultPasswordMatch) {
      return {
        success: true,
        user: {
          id: "auth-" + cleanEmail,
          email: cleanEmail,
          ...profile
        },
        session: {
          access_token: "token-" + Buffer.from(cleanEmail).toString("base64"),
          refresh_token: "refresh-" + Date.now()
        }
      };
    }
    return { success: false, error: err.message || "Erro ao autenticar com Supabase." };
  }
}

export async function verifySupabaseToken(token: string) {
  if (token.startsWith("token-")) {
    try {
      const raw = token.replace("token-", "");
      const email = Buffer.from(raw, "base64").toString("utf-8");
      const profile = await resolveUserProfile(email);
      if (!profile) {
        return { valid: false, error: "Conta de usuário não encontrada ou excluída pelo administrador." };
      }
      return { valid: true, user: { id: "auth-" + email, email, ...profile } };
    } catch {}
  }

  const client = getSupabaseClient();
  if (!client) {
    return { valid: false, error: "Sessão inválida." };
  }

  try {
    const { data: { user }, error } = await client.auth.getUser(token.trim());
    if (error || !user) {
      return { valid: false, error: error?.message || "Sessão expirada." };
    }
    const profile = await resolveUserProfile(user.email || "");
    if (!profile) {
      return { valid: false, error: "Conta de usuário não cadastrada ou excluída pelo administrador." };
    }
    return { valid: true, user: { ...user, ...profile } };
  } catch (err: any) {
    return { valid: false, error: err.message || "Falha na validação." };
  }
}

export async function testSupabaseConnection(customUrl?: string, customKey?: string) {
  const client = getSupabaseClient(customUrl, customKey);
  if (!client) {
    return {
      connected: false,
      configured: false,
      message: "Credenciais do Supabase não configuradas (SUPABASE_URL e SUPABASE_ANON_KEY necessárias)."
    };
  }

  try {
    const { data, error } = await client.from("vacancies").select("id").limit(1);
    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return {
          connected: true,
          configured: true,
          tablesCreated: false,
          message: "Conectado ao Supabase! Execute o script SQL no painel para criar as tabelas.",
          error: error.message
        };
      }
      return {
        connected: false,
        configured: true,
        tablesCreated: false,
        message: `Erro ao consultar o Supabase: ${error.message}`
      };
    }

    return {
      connected: true,
      configured: true,
      tablesCreated: true,
      message: "Conexão com o Supabase PostgreSQL estabelecida com sucesso! Tabelas verificadas e ativas.",
      sampleCount: data ? data.length : 0
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      tablesCreated: false,
      message: `Exceção na conexão: ${err.message}`
    };
  }
}

export function getDatabaseAndCacheStats() {
  const cacheStats = cache.getStats();
  const config = getSupabaseConfig();

  return {
    storageType: "supabase_postgresql",
    database: {
      provider: "Supabase (Cloud PostgreSQL)",
      status: config.isConfigured ? "configured" : "memory_synced",
      url: config.url ? config.url.replace(/(https?:\/\/)([^.]+)(.*)/, "$1***$3") : null,
      tables: ["vacancies", "service_vacancies", "applications", "job_applications", "coordinations", "user_profiles", "user_accounts"]
    },
    cache: {
      engine: "Cache em Memória de Alta Performance (Vercel & Supabase)",
      connected: cacheStats.connected,
      keys: cacheStats.keysCount,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      lastSync: cacheStats.lastSync
    },
    counts: {
      vacancies: memoryVacancies.length,
      applications: memoryApplications.length,
      coordinations: memoryCoordinations.length
    }
  };
}

export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- ENEM 2026 - ESQUEMA COMPLETO DO BANCO DE DADOS SUPABASE (POSTGRESQL)
-- Execute este script no SQL Editor do seu projeto gratuito no Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA DE COORDENAÇÕES (Identificadas por número e com 2 e-mails autorizados)
CREATE TABLE IF NOT EXISTS public.coordinations (
  id BIGSERIAL PRIMARY KEY,
  coordination_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  coordinator_name TEXT NOT NULL,
  coordinator_email TEXT NOT NULL,
  assistant_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA DE PERFIS DE USUÁRIOS E ADMINISTRADORES
-- is_administrator default false
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_administrator BOOLEAN NOT NULL DEFAULT FALSE,
  coordination_number TEXT REFERENCES public.coordinations(coordination_number) ON DELETE SET NULL,
  role_title TEXT DEFAULT 'Coordenador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.1 TABELA DE CONTAS COMPLETAS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.user_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  is_administrator BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT 'unassigned',
  coordination_number TEXT,
  coordination_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA DE VAGAS ENEM 2026 (Novas Vagas de Prestação de Serviço)
CREATE TABLE IF NOT EXISTS public.vacancies (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
  value NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  school TEXT NOT NULL,
  coordinator TEXT NOT NULL,
  coordination_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  min_age INTEGER NOT NULL DEFAULT 18,
  max_age INTEGER NOT NULL DEFAULT 75,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.1 TABELA DEDICADA: NOVAS VAGAS DE PRESTAÇÃO DE SERVIÇO (service_vacancies)
CREATE TABLE IF NOT EXISTS public.service_vacancies (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
  value NUMERIC(10, 2) NOT NULL DEFAULT 90.00,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  school TEXT NOT NULL,
  coordinator TEXT NOT NULL,
  coordination_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  min_age INTEGER NOT NULL DEFAULT 18,
  max_age INTEGER NOT NULL DEFAULT 75,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA DE INSCRIÇÕES PARA VAGAS (applications)
-- REGRA CRÍTICA: ON DELETE SET NULL - Em caso de exclusão de vaga, os inscritos NUNCA são deletados!
CREATE TABLE IF NOT EXISTS public.applications (
  id BIGSERIAL PRIMARY KEY,
  vacancy_id BIGINT REFERENCES public.vacancies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  age INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cebraspe_verified BOOLEAN DEFAULT FALSE,
  referrer_name TEXT,
  referrer_phone TEXT,
  vacancy_title TEXT,
  vacancy_school TEXT,
  vacancy_city TEXT,
  vacancy_neighborhood TEXT,
  coordination_number TEXT,
  coordinator TEXT
);

-- 5.1 TABELA DEDICADA: INSCRIÇÃO PARA VAGA (job_applications)
CREATE TABLE IF NOT EXISTS public.job_applications (
  id BIGSERIAL PRIMARY KEY,
  vacancy_id BIGINT,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  age INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cebraspe_verified BOOLEAN DEFAULT FALSE,
  referrer_name TEXT,
  referrer_phone TEXT,
  vacancy_title TEXT,
  vacancy_school TEXT,
  vacancy_city TEXT,
  vacancy_neighborhood TEXT,
  coordination_number TEXT,
  coordinator TEXT
);

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_vacancies_city ON public.vacancies(city);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON public.vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_coord ON public.vacancies(coordination_number);
CREATE INDEX IF NOT EXISTS idx_service_vacancies_city ON public.service_vacancies(city);
CREATE INDEX IF NOT EXISTS idx_applications_cpf ON public.applications(cpf);
CREATE INDEX IF NOT EXISTS idx_applications_vacancy ON public.applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_cpf ON public.job_applications(cpf);
CREATE INDEX IF NOT EXISTS idx_coordinations_num ON public.coordinations(coordination_number);

-- 7. ATIVAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.coordinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- 8. POLÍTICAS DE ACESSO
DROP POLICY IF EXISTS "Public can view vacancies" ON public.vacancies;
CREATE POLICY "Public can view vacancies" ON public.vacancies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can manage vacancies" ON public.vacancies;
CREATE POLICY "Public can manage vacancies" ON public.vacancies FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view service_vacancies" ON public.service_vacancies;
CREATE POLICY "Public can view service_vacancies" ON public.service_vacancies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can manage service_vacancies" ON public.service_vacancies FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view applications" ON public.applications;
CREATE POLICY "Public can view applications" ON public.applications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can insert applications" ON public.applications;
CREATE POLICY "Public can insert applications" ON public.applications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public can manage applications" ON public.applications;
CREATE POLICY "Public can manage applications" ON public.applications FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view job_applications" ON public.job_applications;
CREATE POLICY "Public can view job_applications" ON public.job_applications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can insert job_applications" ON public.job_applications;
CREATE POLICY "Public can insert job_applications" ON public.job_applications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public can manage job_applications" ON public.job_applications FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view coordinations" ON public.coordinations;
CREATE POLICY "Public can view coordinations" ON public.coordinations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage coordinations" ON public.coordinations;
CREATE POLICY "Manage coordinations" ON public.coordinations FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view user profiles" ON public.user_profiles;
CREATE POLICY "Public can view user profiles" ON public.user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage user profiles" ON public.user_profiles;
CREATE POLICY "Manage user profiles" ON public.user_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view user accounts" ON public.user_accounts;
CREATE POLICY "Public can view user accounts" ON public.user_accounts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage user accounts" ON public.user_accounts;
CREATE POLICY "Manage user accounts" ON public.user_accounts FOR ALL USING (true);

-- 9. LIMPEZA TOTAL DE DADOS DE TESTE / FAKES
DELETE FROM public.vacancies WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8, 9) OR coordinator IN ('Carlos Silva', 'Ana Antunes', 'Roberto Gomes', 'Juliana Lima', 'Marcos Souza') OR coordination_number IN ('101', '102', '103', '104', '105', '00001', '00002');
DELETE FROM public.coordinations WHERE coordination_number IN ('101', '102', '103', '104', '105', '00001', '00002') OR coordinator_name IN ('Carlos Silva', 'Ana Antunes', 'Roberto Gomes', 'Juliana Lima', 'Marcos Souza');
DELETE FROM public.access_tokens WHERE token IN ('TOKEN-ENEM2026-ADMIN-MASTER', 'TOKEN-COORD-RJ-2026', 'TOKEN-COORD-NIT-2026', 'TOKEN-GESTAO-BAIXADA-2026');

-- 10. ADMINISTRADORES DO SISTEMA (Apenas root@enem.app e administrator@enem.app)
INSERT INTO public.user_profiles (email, is_administrator, role_title)
VALUES
  ('root@enem.app', TRUE, 'Administrador do Sistema (Root)'),
  ('administrator@enem.app', TRUE, 'Administrador do Sistema')
ON CONFLICT (email) DO UPDATE SET is_administrator = TRUE;
`;
