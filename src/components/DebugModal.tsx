import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  Database, 
  Server, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldAlert,
  Clock,
  Terminal,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  getSupabaseClient, 
  getSupabaseCredentials, 
  testSupabaseConnection,
  purgeFakeDataFromSupabase
} from '../lib/supabase.ts';

interface DebugModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export function DebugModal({ isOpen = true, onClose, isEmbedded = false }: DebugModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'env' | 'database' | 'api' | 'auth'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  
  // Dados de diagnóstico
  const [frontendCreds, setFrontendCreds] = useState<any>(null);
  const [backendDebug, setBackendDebug] = useState<any>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  
  // Testes de tabelas
  const [tableTests, setTableTests] = useState<{
    vacancies: { status: 'idle' | 'testing' | 'ok' | 'error'; count?: number; latency?: number; message?: string };
    contributors: { status: 'idle' | 'testing' | 'ok' | 'error'; count?: number; latency?: number; message?: string };
    coordinations: { status: 'idle' | 'testing' | 'ok' | 'error'; count?: number; latency?: number; message?: string };
    user_profiles: { status: 'idle' | 'testing' | 'ok' | 'error'; count?: number; latency?: number; message?: string };
  }>({
    vacancies: { status: 'idle' },
    contributors: { status: 'idle' },
    coordinations: { status: 'idle' },
    user_profiles: { status: 'idle' }
  });

  // Testes de rotas API
  const [apiTests, setApiTests] = useState<{
    health: { status: 'idle' | 'testing' | 'ok' | 'error'; httpCode?: number; latency?: number; data?: any };
    debug: { status: 'idle' | 'testing' | 'ok' | 'error'; httpCode?: number; latency?: number; data?: any };
    vacancies: { status: 'idle' | 'testing' | 'ok' | 'error'; httpCode?: number; latency?: number; data?: any };
  }>({
    health: { status: 'idle' },
    debug: { status: 'idle' },
    vacancies: { status: 'idle' }
  });

  // Teste interativo de autenticação
  const [testEmail, setTestEmail] = useState('administrator@enem.app');
  const [testPassword, setTestPassword] = useState('!Enem*2026*');
  const [showPassword, setShowPassword] = useState(false);
  const [authTestResult, setAuthTestResult] = useState<any>(null);
  const [isTestingAuth, setIsTestingAuth] = useState(false);
  const [isPurgingData, setIsPurgingData] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  const handlePurgeFakeData = async () => {
    setIsPurgingData(true);
    setPurgeMessage(null);
    try {
      const res = await purgeFakeDataFromSupabase();
      setPurgeMessage(res.message);
      await testTablesDirectly();
    } catch (err: any) {
      setPurgeMessage(`Erro: ${err?.message || 'Falha ao expurgar dados'}`);
    } finally {
      setIsPurgingData(false);
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    setBackendError(null);

    // 1. Coleta dados do Frontend
    const creds = getSupabaseCredentials();
    const metaEnv = (import.meta as any).env || {};
    setFrontendCreds({
      url: creds.url,
      hasUrl: Boolean(creds.url),
      anonKeyLength: creds.anonKey ? creds.anonKey.length : 0,
      anonKeyPreview: creds.anonKey ? `${creds.anonKey.substring(0, 10)}...` : 'NÃO DEFINIDA',
      hasAnonKey: Boolean(creds.anonKey),
      isCustom: creds.isCustom,
      rawMetaNextPublicUrl: metaEnv.NEXT_PUBLIC_SUPABASE_URL || 'vazio',
      rawMetaViteUrl: metaEnv.VITE_SUPABASE_URL || 'vazio',
      rawMetaSupabaseUrl: metaEnv.SUPABASE_URL || 'vazio',
      rawMetaNextPublicAnonKey: metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'presente' : 'vazio',
      rawMetaViteAnonKey: metaEnv.VITE_SUPABASE_ANON_KEY ? 'presente' : 'vazio',
      rawMetaSupabaseAnonKey: metaEnv.SUPABASE_ANON_KEY ? 'presente' : 'vazio',
      rawMetaPublishableKey: (metaEnv.SUPABASE_PUBLISHABLE_KEY || metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ? 'presente' : 'vazio'
    });

    // 2. Consulta Backend (/api/debug/status)
    try {
      const start = Date.now();
      const res = await fetch('/api/debug/status');
      const latency = Date.now() - start;
      const contentType = res.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data) {
          setBackendDebug({ ...data, latencyMs: latency, httpStatus: res.status });
        } else {
          setBackendError(`Backend respondeu com JSON inválido (${res.status})`);
        }
      } else {
        const text = await res.text();
        setBackendError(`Backend respondeu com formato não-JSON (${res.status} ${res.statusText}): ${text.substring(0, 150)}`);
      }
    } catch (err: any) {
      setBackendError(`Falha ao contactar /api/debug/status: ${err.message}`);
    }

    // 3. Testa tabelas via cliente direto Supabase
    await testTablesDirectly();

    // 4. Testa rotas de API da Vercel
    await testApiRoutes();

    setIsLoading(false);
  };

  const testTablesDirectly = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setTableTests({
        vacancies: { status: 'error', message: 'Cliente Supabase não configurado (URL ou Anon Key ausente).' },
        contributors: { status: 'error', message: 'Cliente Supabase não configurado.' },
        coordinations: { status: 'error', message: 'Cliente Supabase não configurado.' },
        user_profiles: { status: 'error', message: 'Cliente Supabase não configurado.' }
      });
      return;
    }

    const testSingleTable = async (tableName: string, fallbackTable?: string) => {
      const start = Date.now();
      try {
        let { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        // Tenta tabela de fallback se a primeira não existir
        if (error && fallbackTable && error.code === '42P01') {
          const resFallback = await supabase.from(fallbackTable).select('*', { count: 'exact', head: true });
          if (!resFallback.error) {
            return {
              status: 'ok' as const,
              count: resFallback.count ?? 0,
              latency: Date.now() - start,
              message: `Tabela '${fallbackTable}' acessada com sucesso!`
            };
          }
        }

        if (error) {
          return {
            status: 'error' as const,
            latency: Date.now() - start,
            message: `Erro [${error.code || 'Desconhecido'}]: ${error.message}`
          };
        }

        return {
          status: 'ok' as const,
          count: count ?? 0,
          latency: Date.now() - start,
          message: 'Tabela acessada e responsiva.'
        };
      } catch (err: any) {
        return {
          status: 'error' as const,
          latency: Date.now() - start,
          message: err.message || 'Erro de rede'
        };
      }
    };

    const [vacRes, contRes, coordRes, profRes] = await Promise.all([
      testSingleTable('vacancies'),
      testSingleTable('contributor', 'applications'),
      testSingleTable('coordinations'),
      testSingleTable('user_profiles')
    ]);

    setTableTests({
      vacancies: vacRes,
      contributors: contRes,
      coordinations: coordRes,
      user_profiles: profRes
    });
  };

  const testApiRoutes = async () => {
    const testRoute = async (endpoint: string) => {
      const start = Date.now();
      try {
        const res = await fetch(endpoint);
        const latency = Date.now() - start;
        const contentType = res.headers.get('content-type') || '';
        let data: any = null;
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => null);
        } else {
          data = await res.text().catch(() => '');
        }
        return {
          status: res.ok ? ('ok' as const) : ('error' as const),
          httpCode: res.status,
          latency,
          data
        };
      } catch (err: any) {
        return {
          status: 'error' as const,
          httpCode: 0,
          latency: Date.now() - start,
          data: err.message
        };
      }
    };

    const [health, debug, vac] = await Promise.all([
      testRoute('/api/health'),
      testRoute('/api/debug/status'),
      testRoute('/api/vacancies')
    ]);

    setApiTests({ health, debug, vacancies: vac });
  };

  const handleTestAuth = async () => {
    setIsTestingAuth(true);
    setAuthTestResult(null);

    const log: any = {
      testedAt: new Date().toISOString(),
      email: testEmail.trim().toLowerCase(),
      steps: []
    };

    // Etapa 1: Teste via API Serverless (/api/auth/login)
    try {
      const apiStart = Date.now();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail.trim(), password: testPassword.trim() })
      });
      const apiLatency = Date.now() - apiStart;
      const contentType = res.headers.get('content-type') || '';
      let apiData: any = null;
      if (contentType.includes('application/json')) {
        apiData = await res.json().catch(() => null);
      } else {
        apiData = await res.text().catch(() => '');
      }
      log.steps.push({
        step: '1. API Serverless (/api/auth/login)',
        status: res.ok ? 'SUCESSO' : 'FALHA',
        httpCode: res.status,
        latencyMs: apiLatency,
        response: apiData
      });
    } catch (err: any) {
      log.steps.push({
        step: '1. API Serverless (/api/auth/login)',
        status: 'ERRO_DE_REDE',
        error: err.message
      });
    }

    // Etapa 2: Teste Direto via SDK Supabase no Navegador
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const clientStart = Date.now();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: testEmail.trim(),
          password: testPassword.trim()
        });
        const clientLatency = Date.now() - clientStart;
        log.steps.push({
          step: '2. SDK Supabase Direto (Navegador -> Supabase Auth)',
          status: !error && data?.user ? 'SUCESSO' : 'FALHA',
          latencyMs: clientLatency,
          userId: data?.user?.id,
          hasAccessToken: Boolean(data?.session?.access_token),
          error: error ? error.message : null
        });
      } catch (err: any) {
        log.steps.push({
          step: '2. SDK Supabase Direto',
          status: 'EXCECAO',
          error: err.message
        });
      }
    } else {
      log.steps.push({
        step: '2. SDK Supabase Direto',
        status: 'NAO_CONFIGURADO',
        error: 'Cliente Supabase não inicializado no frontend.'
      });
    }

    // Etapa 3: Validação da Conta Master Interna
    const isMaster = (testEmail.trim().toLowerCase() === 'administrator@enem.app' || testEmail.trim().toLowerCase() === 'root@enem.app') &&
      (testPassword.trim() === '!Enem*2026*' || testPassword.trim() === 'enem2026');
    log.steps.push({
      step: '3. Regra de Conta Master Geral Interna',
      status: isMaster ? 'VALIDADO (Acesso imediato garantido)' : 'NÃO É CONTA MASTER',
      isMaster
    });

    setAuthTestResult(log);
    setIsTestingAuth(false);
  };

  const copyDiagnosticReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      frontend: frontendCreds,
      backend: backendDebug || { error: backendError },
      databaseTables: tableTests,
      apiRoutes: apiTests,
      authSimulation: authTestResult
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  useEffect(() => {
    if (isOpen || isEmbedded) {
      runAllTests();
    }
  }, [isOpen, isEmbedded]);

  const authUserStr = typeof window !== 'undefined' ? localStorage.getItem('enem_supabase_auth_user') : null;
  let currentAuthUser: any = null;
  try {
    currentAuthUser = authUserStr ? JSON.parse(authUserStr) : null;
  } catch {}

  if (!isEmbedded && !isOpen) return null;

  if (!currentAuthUser?.is_administrator) {
    return isEmbedded ? (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-200 space-y-2">
        <ShieldAlert className="w-8 h-8 text-red-500 mx-auto" />
        <h3 className="font-bold text-slate-800">Acesso Restrito ao Administrador Geral</h3>
        <p className="text-xs text-slate-500">O painel de diagnóstico em tempo real é reservado exclusivamente a contas administradoras.</p>
      </div>
    ) : null;
  }

  const innerContent = (
    <div className={`bg-white w-full ${isEmbedded ? 'rounded-2xl border border-slate-200 shadow-sm' : 'max-w-4xl rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh]'} overflow-hidden flex flex-col`}>
      {/* Cabeçalho do Diagnóstico */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-indigo-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
            <Terminal className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">Diagnóstico em Tempo Real • Vercel & Supabase</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                Acesso Exclusivo Administrador
              </span>
            </div>
            <p className="text-xs text-indigo-200">
              Verifique variáveis de ambiente, conexão ao banco de dados e rotas serverless
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runAllTests}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Testando...' : 'Re-testar'}</span>
          </button>
          <button
            onClick={copyDiagnosticReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            title="Copiar relatório em JSON"
          >
            {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedReport ? 'Copiado!' : 'Copiar Relatório'}</span>
          </button>
          {onClose && !isEmbedded && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Abas de Navegação Interna */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-white text-indigo-900 shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Visão Geral</span>
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'env' ? 'bg-white text-indigo-900 shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>Variáveis de Ambiente</span>
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'database' ? 'bg-white text-indigo-900 shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tabelas do Banco</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'api' ? 'bg-white text-indigo-900 shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-600" />
            <span>Rotas API (Vercel)</span>
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'auth' ? 'bg-white text-indigo-900 shadow-xs' : 'hover:bg-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
            <span>Simulador de Login</span>
          </button>
        </div>

        {/* Corpo do Diagnóstico */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-sm">
          
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Frontend Env */}
                <div className={`p-4 rounded-xl border ${
                  frontendCreds?.hasUrl && frontendCreds?.hasAnonKey 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : 'bg-red-50/70 border-red-200'
                }`}>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Frontend (Vite)</div>
                  <div className="flex items-center gap-2 mt-1">
                    {frontendCreds?.hasUrl && frontendCreds?.hasAnonKey ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900">
                      {frontendCreds?.hasUrl && frontendCreds?.hasAnonKey ? 'Variáveis OK' : 'Variáveis Ausentes'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 truncate">
                    URL: {frontendCreds?.hasUrl ? 'Definida' : 'Não encontrada'}
                  </p>
                </div>

                {/* Card 2: Backend Env (Vercel) */}
                <div className={`p-4 rounded-xl border ${
                  backendDebug?.environmentVariables?.hasSupabaseUrl && backendDebug?.environmentVariables?.hasAnonKey
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : backendError ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'
                }`}>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Backend (Vercel)</div>
                  <div className="flex items-center gap-2 mt-1">
                    {backendDebug?.environmentVariables?.hasSupabaseUrl && backendDebug?.environmentVariables?.hasAnonKey ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900">
                      {backendDebug?.environmentVariables?.hasSupabaseUrl ? 'Variáveis OK' : 'Verificando...'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 truncate">
                    Ambiente: {backendDebug?.platform || 'Local/Serverless'}
                  </p>
                </div>

                {/* Card 3: Conexão com Supabase */}
                <div className={`p-4 rounded-xl border ${
                  tableTests.vacancies.status === 'ok' 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : tableTests.vacancies.status === 'error' ? 'bg-red-50/70 border-red-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Banco de Dados</div>
                  <div className="flex items-center gap-2 mt-1">
                    {tableTests.vacancies.status === 'ok' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900">
                      {tableTests.vacancies.status === 'ok' ? 'Conectado (PostgreSQL)' : 'Verificando...'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Latência: {tableTests.vacancies.latency ? `${tableTests.vacancies.latency}ms` : '--'}
                  </p>
                </div>

                {/* Card 4: Rotas de API */}
                <div className={`p-4 rounded-xl border ${
                  apiTests.health.status === 'ok' 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : 'bg-amber-50/70 border-amber-200'
                }`}>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rotas Serverless</div>
                  <div className="flex items-center gap-2 mt-1">
                    {apiTests.health.status === 'ok' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900">
                      {apiTests.health.status === 'ok' ? 'Rotas Ativas (200 OK)' : 'Verificando API...'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    /api/health: {apiTests.health.httpCode ? `HTTP ${apiTests.health.httpCode}` : '--'}
                  </p>
                </div>
              </div>

              {/* Status do Diagnóstico Geral */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Resumo do Diagnóstico do Sistema
                </h4>
                <ul className="text-xs space-y-1.5 text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${frontendCreds?.hasUrl ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <strong>URL do Supabase no Frontend:</strong> {frontendCreds?.url || 'Não identificada'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${backendDebug?.environmentVariables?.hasSupabaseUrl ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <strong>URL do Supabase no Backend (Vercel):</strong> {backendDebug?.environmentVariables?.effectiveUrl || (backendError ? 'Aviso: API externa' : 'Consultando...')}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${tableTests.vacancies.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <strong>Tabela 'vacancies':</strong> {tableTests.vacancies.message || 'Testando...'} ({tableTests.vacancies.count ?? 0} registros)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${tableTests.contributors.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <strong>Tabela 'contributor':</strong> {tableTests.contributors.message || 'Testando...'} ({tableTests.contributors.count ?? 0} registros)
                  </li>
                </ul>
              </div>

              {/* Alerta explicativo */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  Instruções para Testar em Andamento:
                </p>
                <p>
                  1. Se as variáveis estiverem com <strong>bolinha vermelha</strong>, vá em <em>Vercel &gt; Settings &gt; Environment Variables</em>, adicione <code className="bg-blue-100 px-1 rounded font-mono">SUPABASE_URL</code> e <code className="bg-blue-100 px-1 rounded font-mono">SUPABASE_ANON_KEY</code> e faça <strong>Redeploy</strong>.
                </p>
                <p>
                  2. Use a aba <strong>Simulador de Login</strong> logo acima para simular a autenticação e verificar o que cada camada (API e Supabase Direto) retorna.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: VARIÁVEIS DE AMBIENTE */}
          {activeTab === 'env' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">Variáveis Injetadas no Frontend (Navegador)</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Valores lidos diretamente via <code className="bg-slate-100 px-1 rounded">import.meta.env</code> durante a compilação do Vite:
                </p>
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-2 overflow-x-auto">
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-indigo-400">NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL</span>
                    <span className={frontendCreds?.hasUrl ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {frontendCreds?.url || 'NÃO ENCONTRADO'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-indigo-400">NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY</span>
                    <span className={frontendCreds?.hasAnonKey ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {frontendCreds?.hasAnonKey ? `${frontendCreds?.anonKeyPreview} (${frontendCreds?.anonKeyLength} chars)` : 'NÃO ENCONTRADO'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-800">
                    <span className="text-indigo-400">SUPABASE_PUBLISHABLE_KEY</span>
                    <span className="text-slate-300">
                      {frontendCreds?.rawMetaPublishableKey === 'presente' ? 'Detectada ✓' : 'Compatibilizada com Anon Key'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-indigo-400">Fonte dos Dados</span>
                    <span className="text-slate-300">{frontendCreds?.isCustom ? 'Configuração Manual (LocalStorage)' : 'Ambiente Vercel / Vite Build'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">Variáveis Reconhecidas no Backend (Vercel Serverless)</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Valores lidos na execução do Node.js em <code className="bg-slate-100 px-1 rounded">process.env</code>:
                </p>
                {backendError ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    {backendError}
                  </div>
                ) : (
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-2 overflow-x-auto">
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-indigo-400">NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL</span>
                      <span className={backendDebug?.environmentVariables?.hasSupabaseUrl ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {backendDebug?.environmentVariables?.effectiveUrl || 'NÃO DEFINIDO'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-indigo-400">NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY</span>
                      <span className={backendDebug?.environmentVariables?.hasAnonKey ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {backendDebug?.environmentVariables?.effectiveAnonKeyLength || 'NÃO DEFINIDO'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-indigo-400">SUPABASE_SERVICE_ROLE_KEY / SECRET_KEY</span>
                      <span className={backendDebug?.environmentVariables?.hasServiceRoleKey ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {backendDebug?.environmentVariables?.hasServiceRoleKey ? 'Configurada ✓' : 'Opcional (Não definida)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-indigo-400">POSTGRES_URL</span>
                      <span className={backendDebug?.environmentVariables?.hasPostgresUrl ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {backendDebug?.environmentVariables?.hasPostgresUrl ? 'Detectada ✓' : 'Opcional'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-indigo-400">Plataforma / Região Vercel</span>
                      <span className="text-slate-300">
                        {backendDebug?.platform} • {backendDebug?.vercel?.region || 'local'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Guia Importante de Resolução na Vercel */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                <p className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Atenção: Por que continua sem conexão se as variáveis foram adicionadas?
                </p>
                <div className="space-y-1.5 leading-relaxed text-amber-900">
                  <p>
                    <strong>1. É OBRIGATÓRIO fazer REDEPLOY na Vercel:</strong> Quando você instala a integração ou adiciona variáveis no painel da Vercel, o deploy ativo que já estava no ar <em>NÃO</em> recebe essas variáveis automaticamente. O Vite empacota as variáveis durante o comando de build (<code className="bg-amber-100 px-1 rounded font-mono">npm run build</code>).
                  </p>
                  <p>
                    👉 <em>Como resolver:</em> No painel da Vercel, clique na aba <strong>Deployments</strong> &gt; clique nos três pontinhos <strong>(...)</strong> do último deploy &gt; e selecione <strong>Redeploy</strong>.
                  </p>
                  <p>
                    <strong>2. Verifique os ambientes (Environments):</strong> Certifique-se de que as variáveis estão marcadas para <strong>Production</strong>, <strong>Preview</strong> e <strong>Development</strong>. Se você estiver acessando uma URL de preview (ex: <code>...git-...vercel.app</code>) e a variável estiver apenas em Production, o preview não terá acesso.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TABELAS DO BANCO DE DADOS */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Acesso Direto às Tabelas do Supabase</h4>
                  <p className="text-xs text-slate-500">
                    O teste é executado com uma consulta <code className="bg-slate-100 px-1 rounded">HEAD count</code> diretamente para o seu banco:
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={testTablesDirectly}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Testar Novamente
                  </button>
                  <button
                    onClick={handlePurgeFakeData}
                    disabled={isPurgingData}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Exclui do Supabase todas as vagas fakes 1 a 9 e dados de teste"
                  >
                    {isPurgingData ? 'Expurgando...' : 'Expurgar Dados Fakes do Banco'}
                  </button>
                </div>
              </div>

              {purgeMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  {purgeMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tabela Vacancies */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">public.vacancies</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tableTests.vacancies.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tableTests.vacancies.status === 'ok' ? 'Disponível' : 'Erro / Pendente'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <div>Registros: <strong>{tableTests.vacancies.count ?? '--'} vagas</strong></div>
                    <div>Latência: <strong>{tableTests.vacancies.latency ?? '--'}ms</strong></div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">{tableTests.vacancies.message}</div>
                  </div>
                </div>

                {/* Tabela Contributor */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">public.contributor</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tableTests.contributors.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tableTests.contributors.status === 'ok' ? 'Disponível' : 'Erro / Pendente'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <div>Registros: <strong>{tableTests.contributors.count ?? '--'} colaboradores</strong></div>
                    <div>Latência: <strong>{tableTests.contributors.latency ?? '--'}ms</strong></div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">{tableTests.contributors.message}</div>
                  </div>
                </div>

                {/* Tabela Coordinations */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">public.coordinations</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tableTests.coordinations.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tableTests.coordinations.status === 'ok' ? 'Disponível' : 'Erro / Pendente'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <div>Registros: <strong>{tableTests.coordinations.count ?? '--'} coordenações</strong></div>
                    <div>Latência: <strong>{tableTests.coordinations.latency ?? '--'}ms</strong></div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">{tableTests.coordinations.message}</div>
                  </div>
                </div>

                {/* Tabela User Profiles */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-slate-900">public.user_profiles</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tableTests.user_profiles.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tableTests.user_profiles.status === 'ok' ? 'Disponível' : 'Erro / Pendente'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <div>Registros: <strong>{tableTests.user_profiles.count ?? '--'} contas</strong></div>
                    <div>Latência: <strong>{tableTests.user_profiles.latency ?? '--'}ms</strong></div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">{tableTests.user_profiles.message}</div>
                  </div>
                </div>
              </div>

              {Object.values(tableTests).some((t: any) => t?.status === 'error') && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <p className="font-bold">⚠️ Uma ou mais tabelas não foram encontradas no Supabase:</p>
                  <p>
                    Vá até o seu painel em <strong>supabase.com &gt; SQL Editor</strong>, cole o código do arquivo <code className="font-mono bg-amber-100 px-1 rounded">supabase_schema.sql</code> e clique em <strong>Run</strong> para criar as tabelas.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ROTAS DE API DA VERCEL */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Respostas das Rotas Serverless (/api/*)</h4>
                  <p className="text-xs text-slate-500">
                    Verifica se a Vercel está executando as funções sem retornar HTML de 404/500:
                  </p>
                </div>
                <button
                  onClick={testApiRoutes}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Testar Rotas
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Rota Health */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-indigo-700">GET /api/health</span>
                    <span className="text-slate-400 ml-2">({apiTests.health.latency ?? '--'}ms)</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    apiTests.health.httpCode === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {apiTests.health.httpCode ? `HTTP ${apiTests.health.httpCode}` : 'Falha'}
                  </span>
                </div>

                {/* Rota Debug */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-indigo-700">GET /api/debug/status</span>
                    <span className="text-slate-400 ml-2">({apiTests.debug.latency ?? '--'}ms)</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    apiTests.debug.httpCode === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {apiTests.debug.httpCode ? `HTTP ${apiTests.debug.httpCode}` : 'Falha'}
                  </span>
                </div>

                {/* Rota Vacancies */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-indigo-700">GET /api/vacancies</span>
                    <span className="text-slate-400 ml-2">({apiTests.vacancies.latency ?? '--'}ms)</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    apiTests.vacancies.httpCode === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {apiTests.vacancies.httpCode ? `HTTP ${apiTests.vacancies.httpCode}` : 'Falha'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SIMULADOR DE LOGIN */}
          {activeTab === 'auth' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Simulador de Autenticação em Tempo Real</h4>
                <p className="text-xs text-slate-500">
                  Teste o fluxo de login e veja exatamente o que cada serviço retorna:
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Teste:</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      placeholder="seu-email@enem.app"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Teste:</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={testPassword}
                        onChange={(e) => setTestPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono pr-8"
                        placeholder="senha"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => { setTestEmail('administrator@enem.app'); setTestPassword('!Enem*2026*'); }}
                      className="text-indigo-600 hover:underline cursor-pointer font-semibold"
                    >
                      Preencher Admin Padrão
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestAuth}
                    disabled={isTestingAuth}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isTestingAuth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    <span>Executar Teste de Login</span>
                  </button>
                </div>
              </div>

              {authTestResult && (
                <div className="space-y-3">
                  <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Resultado da Execução:</h5>
                  <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-xs space-y-3 overflow-x-auto">
                    {authTestResult.steps?.map((step: any, idx: number) => (
                      <div key={idx} className="border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-300 font-bold">{step.step}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            step.status.includes('SUCESSO') || step.status.includes('VALIDADO')
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 pl-2">
                          {step.latencyMs !== undefined && <div>Tempo: {step.latencyMs}ms</div>}
                          {step.httpCode !== undefined && <div>Código HTTP: {step.httpCode}</div>}
                          {step.error && <div className="text-red-400">Erro: {step.error}</div>}
                          {step.response && <div>Resposta: {JSON.stringify(step.response)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Rodapé com Informação de Remoção */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Este painel é temporário para depuração de deploy na Vercel e será removido após validação.</span>
          </div>
          {onClose && !isEmbedded && (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg cursor-pointer transition-colors"
            >
              Fechar Diagnóstico
            </button>
          )}
        </div>
      </div>
  );

  if (isEmbedded) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      {innerContent}
    </div>
  );
}
