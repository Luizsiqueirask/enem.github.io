import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Interfaces compatíveis com o sistema
export interface Vacancy {
  id: number;
  title: string;
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
  id: number;
  vacancy_id: number;
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

export interface AccessToken {
  id: number;
  token: string;
  label: string;
  role: 'admin' | 'coordenador' | 'gestor' | 'consulta';
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
}

const STORAGE_KEY_URL = 'enem2026_supabase_url';
const STORAGE_KEY_ANON = 'enem2026_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string; isCustom: boolean } {
  const metaEnv = (import.meta as any).env || {};
  const procEnv = typeof process !== 'undefined' ? (process.env || {}) : {};

  const envUrl = (
    metaEnv.VITE_SUPABASE_URL ||
    metaEnv.SUPABASE_URL ||
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    procEnv.VITE_SUPABASE_URL ||
    procEnv.SUPABASE_URL ||
    procEnv.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ) as string;

  const envKey = (
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    metaEnv.SUPABASE_ANON_KEY ||
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    procEnv.VITE_SUPABASE_ANON_KEY ||
    procEnv.SUPABASE_ANON_KEY ||
    procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    procEnv.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ) as string;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ANON) || '' : '';

  const finalUrl = (localUrl || envUrl).trim();
  const finalKey = (localKey || envKey).trim();

  return {
    url: finalUrl,
    anonKey: finalKey,
    isCustom: Boolean(localUrl || localKey)
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  if (!url && !anonKey) {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
  } else {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
  }
  supabaseInstance = null;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return supabaseInstance;
  } catch (err) {
    console.warn('Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey && url.startsWith('http'));
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; tableCount?: number }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase não configurado. Forneça o Project URL e Anon API Key.'
    };
  }

  try {
    const { data, error } = await client.from('vacancies').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Conectado ao Supabase, mas a tabela "vacancies" ainda não existe. Execute o script supabase_schema.sql no editor SQL do Supabase!'
        };
      }
      return {
        success: false,
        message: `Erro ao conectar com Supabase: ${error.message} (${error.code || ''})`
      };
    }
    return {
      success: true,
      message: 'Conexão com o Supabase estabelecida com sucesso! Tabelas verificadas.',
      tableCount: data ? data.length : 0
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Falha na requisição para o Supabase: ${err.message || 'Erro de rede'}`
    };
  }
}

// -----------------------------------------------------------------------------
// Operações de Chaves de Acesso / Tokens
// -----------------------------------------------------------------------------

export async function verifyAccessTokenInSupabase(tokenInput: string): Promise<{
  valid: boolean;
  tokenRecord?: AccessToken;
  message: string;
}> {
  const cleanInput = tokenInput.trim();
  if (!cleanInput) {
    return { valid: false, message: 'Token não fornecido.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { valid: false, message: 'Supabase não conectado.' };
  }

  try {
    const { data, error } = await client
      .from('access_tokens')
      .select('*')
      .eq('token', cleanInput)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return { valid: false, message: `Erro ao consultar chaves no Supabase: ${error.message}` };
    }

    if (!data) {
      return { valid: false, message: 'Chave de acesso não encontrada ou desativada no Supabase.' };
    }

    // Registra último uso
    try {
      await client
        .from('access_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id);
    } catch {}

    return {
      valid: true,
      tokenRecord: data as AccessToken,
      message: `Acesso autorizado com sucesso para: ${data.label} (${data.role})`
    };
  } catch (err: any) {
    return { valid: false, message: err.message || 'Erro ao validar chave.' };
  }
}

export async function getAccessTokensFromSupabase(): Promise<AccessToken[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('access_tokens')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar tokens do Supabase:', error);
    return [];
  }
  return data as AccessToken[];
}

export async function createAccessTokenInSupabase(token: string, label: string, role: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase não conectado' };

  const { error } = await client.from('access_tokens').insert({
    token: token.trim(),
    label: label.trim(),
    role: role || 'admin',
    is_active: true
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function toggleAccessTokenInSupabase(id: number, isActive: boolean): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.from('access_tokens').update({ is_active: isActive }).eq('id', id);
  return !error;
}

export async function deleteAccessTokenInSupabase(id: number): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client.from('access_tokens').delete().eq('id', id);
  return !error;
}

// -----------------------------------------------------------------------------
// Operações de Vagas (Vacancies)
// -----------------------------------------------------------------------------

export async function getVacanciesFromSupabase(): Promise<Vacancy[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('vacancies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vagas do Supabase:', error);
    return [];
  }
  return data as Vacancy[];
}

export async function createVacancyInSupabase(vacancy: Omit<Vacancy, 'id' | 'created_at'>): Promise<{ success: boolean; id?: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase não conectado' };

  const { data, error } = await client
    .from('vacancies')
    .insert([vacancy])
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, id: data?.id };
}

export async function deleteVacancyInSupabase(id: number): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase não conectado' };

  const { error } = await client.from('vacancies').delete().eq('id', id);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// -----------------------------------------------------------------------------
// Operações de Inscrições / Colaboradores (Applications)
// -----------------------------------------------------------------------------

export async function checkCpfInSupabase(cpf: string): Promise<{ exists: boolean; existingApp?: any }> {
  const client = getSupabaseClient();
  if (!client) return { exists: false };

  const cleanCpf = cpf.replace(/\D/g, '');
  // Verifica tanto formatado quanto só dígitos
  const { data, error } = await client
    .from('applications')
    .select('id, name, cpf, status, vacancy_id, vacancies(title, school)')
    .or(`cpf.eq.${cpf},cpf.eq.${cleanCpf}`)
    .maybeSingle();

  if (error || !data) {
    return { exists: false };
  }
  return { exists: true, existingApp: data };
}

export async function createApplicationInSupabase(appData: {
  vacancy_id: number;
  name: string;
  cpf: string;
  phone: string;
  city: string;
  neighborhood: string;
  age: number;
  cebraspe_verified?: boolean;
  referrer_name?: string;
  referrer_phone?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase não conectado' };

  // 1. Verificação Estrita de Unicidade de CPF: Só pode haver 1 cadastro por CPF
  const cleanCpf = appData.cpf.replace(/\D/g, '');
  const { data: existing } = await client
    .from('applications')
    .select('id, name')
    .or(`cpf.eq.${appData.cpf},cpf.eq.${cleanCpf}`)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: 'Este CPF já possui uma inscrição cadastrada no sistema. Não é permitido se cadastrar em mais de uma vaga.'
    };
  }

  // 2. Inserir aplicação
  const { data, error } = await client
    .from('applications')
    .insert([{
      vacancy_id: appData.vacancy_id,
      name: appData.name,
      cpf: appData.cpf,
      phone: appData.phone,
      city: appData.city,
      neighborhood: appData.neighborhood,
      age: appData.age,
      status: 'pending',
      cebraspe_verified: appData.cebraspe_verified ?? false,
      referrer_name: appData.referrer_name || null,
      referrer_phone: appData.referrer_phone || null
    }])
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: 'Este CPF já está cadastrado em outra vaga. Cada CPF só pode se cadastrar em uma única vaga.'
      };
    }
    return { success: false, error: error.message };
  }

  // 3. Decrementar vaga
  try {
    const { data: vac } = await client
      .from('vacancies')
      .select('quantity')
      .eq('id', appData.vacancy_id)
      .single();

    if (vac && vac.quantity > 0) {
      await client
        .from('vacancies')
        .update({ quantity: vac.quantity - 1 })
        .eq('id', appData.vacancy_id);
    }
  } catch {}

  return { success: true, id: data?.id };
}

export async function getApplicationsFromSupabase(): Promise<Application[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('applications')
    .select(`
      *,
      vacancies (
        title,
        school,
        city,
        neighborhood,
        coordination_number,
        coordinator
      )
    `)
    .order('applied_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar colaboradores do Supabase:', error);
    return [];
  }

  return (data || []).map((item: any) => {
    const v = item.vacancies;
    return {
      ...item,
      vacancy_title: v?.title || 'Vaga não especificada',
      vacancy_school: v?.school || '-',
      vacancy_city: v?.city || '-',
      vacancy_neighborhood: v?.neighborhood || '-',
      coordination_number: v?.coordination_number || '-',
      coordinator: v?.coordinator || '-'
    };
  });
}

export async function updateApplicationStatusInSupabase(id: number, status: 'pending' | 'cadastrado' | 'recusado'): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from('applications')
    .update({ status })
    .eq('id', id);

  return !error;
}
