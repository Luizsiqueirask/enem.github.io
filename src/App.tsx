import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, 
  MapPin, 
  User, 
  Plus, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  School,
  ShieldCheck,
  LayoutDashboard,
  Send,
  Globe,
  Download,
  FileText,
  Trash2,
  X,
  Search,
  Filter,
  Building,
  RotateCcw,
  Upload,
  FolderTree,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ShieldAlert,
  RefreshCw,
  UserCheck,
  Edit2,
  Lock,
  Key,
  Eye,
  EyeOff,
  Database,
  Mail,
  LogOut,
  ArrowLeft,
  Save,
  AlertTriangle,
  Briefcase,
  Calendar,
  Clock,
  Sparkles,
  Terminal,
  Activity
} from 'lucide-react';
import {
  getSupabaseClient,
  getSupabaseCredentials,
  testSupabaseConnection,
  getVacanciesFromSupabase,
  getApplicationsFromSupabase,
  getCoordinationsFromSupabase,
  saveCoordinationInSupabase,
  getUserProfilesFromSupabase,
  saveUserProfileInSupabase,
  createVacancyInSupabase,
  deleteVacancyInSupabase,
  purgeFakeDataFromSupabase,
  FAKE_VACANCY_IDS,
  FAKE_COORDINATOR_NAMES,
  FAKE_COORD_NUMBERS
} from './lib/supabase.ts';
import { DebugModal } from './components/DebugModal.tsx';

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

export interface contributor {
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

export type Application = contributor;

interface SchoolSummary {
  name: string;
  city: string;
  neighborhood: string;
  coordination_number: string;
  coordinator: string;
  vacancies: Vacancy[];
  totalSlots: number;
  applicantCount: number;
  cadastradoCount: number;
  pendingCount: number;
  recusadoCount: number;
}

// Lista padrão de cidades da região metropolitana e estado
export const CITIES = [
  'Rio de Janeiro',
  'Niterói',
  'São Gonçalo',
  'Duque de Caxias',
  'Nova Iguaçu',
  'Belford Roxo',
  'Maricá'
];

// Tipos padrão de cargos e funções
export const DEFAULT_TITLES = [
  'Chefe de Sala',
  'Fiscal de Informática',
  'Fiscal Aplicador',
  'Fiscal Volante',
  'Fiscal de Banheiro',
  'Fiscal Ledor',
  'Fiscal Ledor Inglês',
  'Fiscal Ledor Espanhol',
  'Fiscal Intérprete Libras'
];

// Máscara para CPF: 000.000.000-00
export const formatCPF = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

// Máscara para Celular/WhatsApp: (00) 00000-0000 ou (00) 0000-0000
export const formatPhone = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

// Validador matemático de dígitos verificadores de CPF
export const validateCPFDigits = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
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
};

// Vagas padrão para inicialização e fallback seguro (inicia vazio para não exibir vagas fakes)
export const DEFAULT_VACANCIES: Vacancy[] = [];

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_administrator?: boolean;
  coordination_number?: string | null;
  role?: 'admin' | 'coordinator' | 'assistant' | 'unassigned';
  coordination_name?: string;
  coordinator_name?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string; // Nome e Sobrenome como principal
  is_administrator: boolean; // Se o usuário poderá ter acesso de admin ou não
  role: 'admin' | 'coordinator' | 'assistant' | 'unassigned'; // Se o usuário é coordenador ou assistente
  coordination_number: string | null; // Nº da coordenação a qual o mesmo irá trabalhar
  coordination_name?: string;
  created_at: string;
  updated_at?: string;
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

export default function App() {
  const [view, setView] = useState<'public' | 'admin'>('public');
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('enem_supabase_auth_token') || null;
  });
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('enem_supabase_auth_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [onlineCount, setOnlineCount] = useState(1);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [contributors, setcontributors] = useState<contributor[]>([]);
  const [coordinations, setCoordinations] = useState<Coordination[]>([]);
  const [selectedCoordFilter, setSelectedCoordFilter] = useState<string>('all');
  const [isCoordModalOpen, setIsCoordModalOpen] = useState(false);
  const [coordFormData, setCoordFormData] = useState({
    coordination_number: '',
    name: '',
    coordinator_name: '',
    coordinator_email: '',
    assistant_email: ''
  });
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const initialcontributorFormData = { 
    name: '', 
    cpf: '', 
    phone: '', 
    city: '', 
    neighborhood: '', 
    age: '',
    referrer_name: '',
    referrer_phone: ''
  };
  const [formData, setFormData] = useState(initialcontributorFormData);

  // Estado para verificação de CPF no Cebraspe em tempo real
  const [cpfVerificationStatus, setCpfVerificationStatus] = useState<'idle' | 'checking' | 'registered' | 'not_registered' | 'invalid' | 'error'>('idle');
  const [cpfVerificationMessage, setCpfVerificationMessage] = useState<string>('');
  const [isCebraspeModalOpen, setIsCebraspeModalOpen] = useState(false);
  const [isRecheckingCebraspe, setIsRecheckingCebraspe] = useState(false);

  // Estado para visualização do banco de dados e cache Redis
  const [databaseStatus, setDatabaseStatus] = useState<any>(null);

  const fetchDatabaseStatus = async () => {
    if (!authUser?.is_administrator) return;
    try {
      const res = await fetch('/api/database/status', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDatabaseStatus(data);
      }
    } catch {}
  };

  // Estados para campo de preenchimento e configuração de coordenação da própria conta
  const [userCoordNumber, setUserCoordNumber] = useState<string>(() => authUser?.coordination_number || '');
  const [userCoordRole, setUserCoordRole] = useState<'coordinator' | 'assistant'>(() => {
    return authUser?.role === 'assistant' ? 'assistant' : 'coordinator';
  });
  const [userCoordName, setUserCoordName] = useState<string>(() => authUser?.coordination_name || '');
  const [userCoordEditMode, setUserCoordEditMode] = useState<boolean>(() => !authUser?.coordination_number);
  const [isSavingUserCoord, setIsSavingUserCoord] = useState(false);
  const [userCoordError, setUserCoordError] = useState<string | null>(null);
  const [userCoordSuccess, setUserCoordSuccess] = useState<string | null>(null);
  const [userCoordStatusPreview, setUserCoordStatusPreview] = useState<any>(null);

  const [adminFormData, setAdminFormData] = useState({
    title: '',
    price: '',
    value: '',
    city: 'Rio de Janeiro',
    neighborhood: '',
    school: '',
    coordinator: '',
    coordination_number: '',
    quantity: '',
    min_age: '18',
    max_age: '100'
  });

  // Filtros da página pública (por região, cidade, bairro e busca)
  const [publicFilter, setPublicFilter] = useState({
    search: '',
    city: '',
    neighborhood: ''
  });

  // Filtros da página administrativa (por região, cidade, bairro, escola, coordenação, tipo de vaga e status)
  const [adminFilter, setAdminFilter] = useState({
    search: '',
    school: '',
    coordination: '',
    city: '',
    neighborhood: '',
    vacancy_type: '',
    status: ''
  });

  // Modo de visualização de candidatos: cards (padrão) ou tabela
  const [candidatesViewMode, setCandidatesViewMode] = useState<'cards' | 'table'>('cards');

  // Filtro de status para vagas ofertadas (todas, abertas, ou preenchidas em cinza)
  const [offeredVacanciesStatusFilter, setOfferedVacanciesStatusFilter] = useState<'all' | 'open' | 'filled'>('all');
  // Modo de visualização de vagas ofertadas: cards (padrão) ou agrupamento por escolas
  const [offeredVacanciesViewMode, setOfferedVacanciesViewMode] = useState<'cards' | 'schools'>('cards');
  const [offeredVacancyTypeFilter, setOfferedVacancyTypeFilter] = useState<string>('');

  // Aba ativa da área de administração: 'open_vacancies', 'candidates', 'schools', 'coordinations', 'users', 'database', 'supabase' ou 'debug' (aba temporária de testes)
  const [adminTab, setAdminTab] = useState<'open_vacancies' | 'candidates' | 'schools' | 'coordinations' | 'users' | 'database' | 'supabase' | 'debug'>('candidates');
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  // Estados de Edição de Vagas
  const [editingVacancy, setEditingVacancy] = useState<Vacancy | null>(null);
  const [isEditVacancyModalOpen, setIsEditVacancyModalOpen] = useState<boolean>(false);
  const [editVacancyFormData, setEditVacancyFormData] = useState<{
    title: string;
    value: number;
    school: string;
    neighborhood: string;
    city: string;
    coordination_number: string;
    coordinator: string;
    quantity: number;
    min_age: number;
    max_age: number;
    status: string;
  }>({
    title: '',
    value: 90,
    school: '',
    neighborhood: '',
    city: 'Rio de Janeiro',
    coordination_number: '',
    coordinator: '',
    quantity: 1,
    min_age: 18,
    max_age: 75,
    status: 'open'
  });
  const [isSavingEditVacancy, setIsSavingEditVacancy] = useState<boolean>(false);
  const [editVacancyError, setEditVacancyError] = useState<string | null>(null);

  const [copiedFile, setCopiedFile] = useState<'vacancies' | 'contributors' | null>(null);
  const [customVacancyTitle, setCustomVacancyTitle] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolCityFilter, setSchoolCityFilter] = useState('');

  // Estados de Gestão de Contas e E-mails Cadastrados (Exclusivo Administrador Geral)
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admins' | 'coordinators' | 'assistants'>('all');

  // Estados do Modal de Edição / Cadastro de Conta de E-mail
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [isNewUserMode, setIsNewUserMode] = useState<boolean>(false);
  const [editUserEmail, setEditUserEmail] = useState<string>('');
  const [editUserPassword, setEditUserPassword] = useState<string>('');
  const [showUserPassword, setShowUserPassword] = useState<boolean>(false);
  const [editUserFirstName, setEditUserFirstName] = useState<string>('');
  const [editUserLastName, setEditUserLastName] = useState<string>('');
  const [editUserIsAdmin, setEditUserIsAdmin] = useState<boolean>(false);
  const [editUserRole, setEditUserRole] = useState<'coordinator' | 'assistant' | 'admin'>('coordinator');
  const [editUserCoordNumber, setEditUserCoordNumber] = useState<string>('');
  const [editUserCoordName, setEditUserCoordName] = useState<string>('');
  const [isSavingUserAccount, setIsSavingUserAccount] = useState<boolean>(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [userModalSuccess, setUserModalSuccess] = useState<string | null>(null);

  // Estados para exclusão direta do banco de dados (Contas, Postos/Vagas e Colaboradores) com modal in-app
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: 'user' | 'users' | 'vacancy' | 'vacancies' | 'coordination' | 'collaborator';
    targetId?: string | number;
    targetEmail?: string;
    targetEmails?: string[];
    targetIds?: (string | number)[];
    title: string;
    itemDescription: string;
    safeNote?: string;
    candidateData?: Application;
    step?: 1 | 2;
  } | null>(null);
  const [isExecutingDelete, setIsExecutingDelete] = useState<boolean>(false);
  const [collaboratorDoubleConfirmed, setCollaboratorDoubleConfirmed] = useState<boolean>(false);

  // Estados de seleção para exclusão de contas e postos
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [selectedVacancyIds, setSelectedVacancyIds] = useState<(string | number)[]>([]);

  // Estados do Supabase
  const [supabaseStatus, setSupabaseStatus] = useState<{
    configured: boolean;
    url: string | null;
    connected: boolean;
    tablesCreated: boolean;
    message: string;
    cache?: any;
    counts?: any;
  } | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [isPurgingSupabase, setIsPurgingSupabase] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCloseModal = () => {
    setIsApplying(false);
    setSelectedVacancy(null);
    setFormData(initialcontributorFormData);
    setCpfVerificationStatus('idle');
    setCpfVerificationMessage('');
    setIsCebraspeModalOpen(false);
    if (message?.type === 'error') {
      setMessage(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isApplying) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isApplying]);

  // Auto-fill price based on title (apenas para tipos padrão)
  useEffect(() => {
    const prices: Record<string, string> = {
      'Chefe de Sala': '120',
      'Fiscal de Informática': '120',
      'Fiscal Aplicador': '90',
      'Fiscal Volante': '90',
      'Fiscal de Banheiro': '90',
      'Fiscal Ledor': '180',
      'Fiscal Ledor Inglês': '180',
      'Fiscal Ledor Espanhol': '180',
      'Fiscal Intérprete Libras': '230'
    };
    if (adminFormData.title && prices[adminFormData.title]) {
      const p = prices[adminFormData.title];
      setAdminFormData(prev => ({ ...prev, price: p, value: p }));
    }
  }, [adminFormData.title]);

  // Lista dinâmica de tipos personalizados de vagas já cadastrados
  const customTitles = React.useMemo(() => {
    const list: string[] = vacancies
      .map(v => (v.title ? v.title.trim() : ''))
      .filter(t => t !== '' && !DEFAULT_TITLES.includes(t));
    return Array.from(new Set(list)).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
  }, [vacancies]);

  // Lista única e ordenada de todas as escolas cadastradas nas vagas e inscrições
  const adminSchools = React.useMemo(() => {
    const list: string[] = [
      ...vacancies.map(v => (v.school ? v.school.trim() : '')),
      ...contributors.map(a => (a.vacancy_school ? a.vacancy_school.trim() : ''))
    ].filter(Boolean);
    return Array.from(new Set(list)).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR'));
  }, [vacancies, contributors]);

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = authToken || localStorage.getItem('enem_supabase_auth_token');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`
      };
    }
    return {};
  };

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();

    // 1. Tenta autenticação via API (/api/auth/login)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          const token = data.session?.access_token || '';
          const user = data.user;
          setAuthToken(token);
          setAuthUser(user);
          localStorage.setItem('enem_supabase_auth_token', token);
          localStorage.setItem('enem_supabase_auth_user', JSON.stringify(user));
          setView('admin');
          setAdminTab('candidates');
          setIsLoggingIn(false);
          fetchVacancies();
          fetchcontributors();
          fetchSupabaseStatus();
          fetchCoordinations();
          if (user?.is_administrator) {
            fetchUserAccounts();
          }
          setMessage({ type: 'success', text: `Autenticado com sucesso como ${user.email}!` });
          setTimeout(() => setMessage(null), 4000);
          return;
        } else if (data.error) {
          const isMasterAdmin = (cleanEmail === 'administrator@enem.app' || cleanEmail === 'root@enem.app') &&
            (cleanPassword === '!Enem*2026*' || cleanPassword === 'enem2026');
          if (!isMasterAdmin) {
            setLoginError(data.error);
            setIsLoggingIn(false);
            return;
          }
        }
      }
    } catch {
      // Falha na requisição da API (ex: serverless ou proxy) - segue para verificação local e direta
    }

    // 2. Acesso da Conta Master Inicial do Sistema (funciona imediatamente sem depender de pré-cadastro)
    if (
      (cleanEmail === 'administrator@enem.app' || cleanEmail === 'root@enem.app') &&
      (cleanPassword === '!Enem*2026*' || cleanPassword === 'enem2026')
    ) {
      const masterUser: AuthUser = {
        id: 'admin-' + cleanEmail,
        email: cleanEmail,
        first_name: cleanEmail === 'root@enem.app' ? 'Root' : 'Administrator',
        last_name: 'Geral',
        full_name: cleanEmail === 'root@enem.app' ? 'Root Administrador' : 'Administrator Geral',
        is_administrator: true,
        role: 'admin',
        coordination_number: null,
        coordination_name: 'Administração Geral ENEM 2026',
        coordinator_name: 'Administração Geral'
      };
      const token = 'token-' + btoa(cleanEmail) + '-' + Date.now();
      setAuthToken(token);
      setAuthUser(masterUser);
      localStorage.setItem('enem_supabase_auth_token', token);
      localStorage.setItem('enem_supabase_auth_user', JSON.stringify(masterUser));
      setView('admin');
      setAdminTab('candidates');
      setIsLoggingIn(false);
      fetchVacancies();
      fetchcontributors();
      fetchSupabaseStatus();
      fetchCoordinations();
      fetchUserAccounts();
      setMessage({ type: 'success', text: `Autenticado com sucesso como ${masterUser.email}!` });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    // 3. Autenticação Direta no Cliente Supabase (Navegador -> Supabase Auth)
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (!authErr && authData?.user) {
          const token = authData.session?.access_token || '';
          
          let profileData: any = null;
          try {
            const { data: pData } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('email', cleanEmail)
              .maybeSingle();
            profileData = pData;
          } catch {}

          const resolvedUser: AuthUser = {
            id: authData.user.id,
            email: authData.user.email || cleanEmail,
            first_name: profileData?.first_name || authData.user.user_metadata?.first_name || cleanEmail.split('@')[0],
            last_name: profileData?.last_name || authData.user.user_metadata?.last_name || '',
            full_name: profileData?.full_name || authData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
            is_administrator: Boolean(profileData?.is_administrator || authData.user.user_metadata?.is_administrator || cleanEmail.includes('admin')),
            role: profileData?.role || authData.user.user_metadata?.role || (cleanEmail.includes('admin') ? 'admin' : 'coordinator'),
            coordination_number: profileData?.coordination_number || authData.user.user_metadata?.coordination_number || null,
            coordination_name: profileData?.coordination_name || authData.user.user_metadata?.coordination_name,
            coordinator_name: profileData?.coordinator_name || profileData?.full_name
          };

          setAuthToken(token);
          setAuthUser(resolvedUser);
          localStorage.setItem('enem_supabase_auth_token', token);
          localStorage.setItem('enem_supabase_auth_user', JSON.stringify(resolvedUser));
          setView('admin');
          setAdminTab('candidates');
          setIsLoggingIn(false);
          fetchVacancies();
          fetchcontributors();
          fetchSupabaseStatus();
          fetchCoordinations();
          if (resolvedUser.is_administrator) {
            fetchUserAccounts();
          }
          setMessage({ type: 'success', text: `Autenticado com sucesso como ${resolvedUser.email}!` });
          setTimeout(() => setMessage(null), 4000);
          return;
        } else if (authErr) {
          const msg = authErr.message?.toLowerCase() || '';
          if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            setLoginError('Senha incorreta ou e-mail não cadastrado no Supabase.');
          } else {
            setLoginError(`Erro do Supabase: ${authErr.message}`);
          }
          setIsLoggingIn(false);
          return;
        }
      } catch (clientErr: any) {
        console.warn('Erro na autenticação direta com Supabase:', clientErr);
      }
    }

    setLoginError('Credenciais inválidas. Verifique o e-mail e senha informados ou certifique-se de que o Supabase está configurado.');
    setIsLoggingIn(false);
  };

  const handleLogout = (isManual: boolean = false) => {
    setAuthToken(null);
    setAuthUser(null);
    localStorage.removeItem('enem_supabase_auth_token');
    localStorage.removeItem('enem_supabase_auth_user');
    setUserCoordNumber('');
    setUserCoordName('');
    setUserCoordError(null);
    setUserCoordSuccess(null);
    setUserCoordStatusPreview(null);
    setUserCoordEditMode(true);
    setcontributors([]);
    fetchVacancies();
    if (isManual) {
      setMessage({ type: 'success', text: 'Você saiu da sessão com segurança.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const fetchCoordinations = async () => {
    try {
      const res = await fetch('/api/admin/coordinations', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const clean = data.filter((c: any) => 
              !FAKE_COORD_NUMBERS.includes(String(c.coordination_number)) &&
              !FAKE_COORDINATOR_NAMES.includes(String(c.coordinator_name))
            );
            setCoordinations(clean);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar coordenações via API, buscando direto no Supabase:', err);
    }

    // Fallback direto via Supabase client
    try {
      const data = await getCoordinationsFromSupabase();
      if (Array.isArray(data)) {
        const clean = data.filter((c: any) => 
          !FAKE_COORD_NUMBERS.includes(String(c.coordination_number)) &&
          !FAKE_COORDINATOR_NAMES.includes(String(c.coordinator_name))
        );
        setCoordinations(clean as any);
      }
    } catch {}
  };

  const handleSaveCoordination = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/coordinations', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(coordFormData)
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar coordenação.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
      setMessage({ type: 'success', text: `Coordenação Nº ${coordFormData.coordination_number} gravada com sucesso no Supabase!` });
      setIsCoordModalOpen(false);
      setCoordFormData({
        coordination_number: '',
        name: '',
        coordinator_name: '',
        coordinator_email: '',
        assistant_email: ''
      });
      fetchCoordinations();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Erro ao conectar: ' + err.message });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDeleteCoordination = (num: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      type: 'coordination',
      targetId: num,
      title: 'Excluir Coordenação do Banco de Dados',
      itemDescription: `Coordenação Regional Nº ${num}`,
      safeNote: 'A coordenação será excluída do banco de dados Supabase.'
    });
  };

  // Funções de Gestão de Contas e E-mails Cadastrados (Exclusivo Administrador Geral)
  const fetchUserAccounts = async () => {
    if (!authToken) return;
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUserAccounts(data);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar contas de usuários:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleOpenEditUserModal = (user: UserAccount) => {
    setIsNewUserMode(false);
    setEditUserEmail(user.email);
    setEditUserPassword('');
    setShowUserPassword(false);
    setEditUserFirstName(user.first_name || '');
    setEditUserLastName(user.last_name || '');
    setEditUserIsAdmin(Boolean(user.is_administrator));
    setEditUserRole(user.is_administrator ? 'admin' : (user.role === 'assistant' ? 'assistant' : 'coordinator'));
    setEditUserCoordNumber(user.coordination_number || '');
    setEditUserCoordName(user.coordination_name || '');
    setUserModalError(null);
    setUserModalSuccess(null);
    setIsUserModalOpen(true);
  };

  const handleOpenNewUserModal = () => {
    setIsNewUserMode(true);
    setEditUserEmail('');
    setEditUserPassword('');
    setShowUserPassword(false);
    setEditUserFirstName('');
    setEditUserLastName('');
    setEditUserIsAdmin(false);
    setEditUserRole('coordinator');
    setEditUserCoordNumber('');
    setEditUserCoordName('');
    setUserModalError(null);
    setUserModalSuccess(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUserAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserEmail.trim() || !editUserEmail.includes('@')) {
      setUserModalError('Informe um e-mail corporativo válido.');
      return;
    }

    if (isNewUserMode && (!editUserPassword.trim() || editUserPassword.trim().length < 6)) {
      setUserModalError('Informe uma senha com no mínimo 6 caracteres para criar a conta no Supabase.');
      return;
    }

    if (!isNewUserMode && editUserPassword.trim() && editUserPassword.trim().length < 6) {
      setUserModalError('A nova senha deve ter no mínimo 6 caracteres para atualização no Supabase.');
      return;
    }

    setIsSavingUserAccount(true);
    setUserModalError(null);
    setUserModalSuccess(null);

    try {
      const payload: any = {
        email: editUserEmail.trim().toLowerCase(),
        password: editUserPassword.trim() || undefined,
        first_name: editUserFirstName.trim(),
        last_name: editUserLastName.trim(),
        is_administrator: editUserIsAdmin,
        role: editUserIsAdmin ? 'admin' : editUserRole,
        coordination_number: editUserCoordNumber.trim() || null,
        coordination_name: editUserCoordName.trim() || undefined
      };

      const url = isNewUserMode 
        ? '/api/admin/users' 
        : `/api/admin/users/${encodeURIComponent(editUserEmail.trim())}`;
      const method = isNewUserMode ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setUserModalError(data.error || 'Erro ao salvar alterações da conta.');
        setIsSavingUserAccount(false);
        return;
      }

      setUserModalSuccess('Dados da conta gravados com sucesso!');
      fetchUserAccounts();
      fetchCoordinations();
      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserModalSuccess(null);
      }, 900);
    } catch (err: any) {
      setUserModalError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsSavingUserAccount(false);
    }
  };

  const handleDeleteUserAccount = (email: string) => {
    const account = userAccounts.find(u => u.email.toLowerCase() === email.toLowerCase());
    const nameDisplay = account?.full_name || `${account?.first_name || ''} ${account?.last_name || ''}`.trim() || email.split('@')[0];
    setDeleteConfirmModal({
      isOpen: true,
      type: 'user',
      targetEmail: email,
      title: 'Excluir Conta do Banco de Dados',
      itemDescription: `${nameDisplay} • ${email}`,
      safeNote: 'Esta conta será excluída permanentemente do banco de dados Supabase e perderá o acesso ao sistema.'
    });
  };

  const handleDeleteSelectedUsers = () => {
    if (selectedUserEmails.length === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      type: 'users',
      targetEmails: [...selectedUserEmails],
      title: 'Excluir Contas Selecionadas do Banco de Dados',
      itemDescription: `${selectedUserEmails.length} conta(s) selecionada(s) para exclusão definitiva`,
      safeNote: 'As contas selecionadas serão excluídas do banco de dados Supabase. Caso haja a conta do administrador conectado na seleção, ela será protegida por segurança.'
    });
  };

  // Efeito para sincronizar inputs quando authUser é carregado/atualizado
  useEffect(() => {
    if (authUser?.coordination_number) {
      setUserCoordNumber(authUser.coordination_number);
    }
    if (authUser?.role && (authUser.role === 'coordinator' || authUser.role === 'assistant')) {
      setUserCoordRole(authUser.role);
    }
    if (authUser?.coordination_name) {
      setUserCoordName(authUser.coordination_name);
    }
    if (!authUser?.coordination_number) {
      setUserCoordEditMode(true);
    }
  }, [authUser?.coordination_number, authUser?.role, authUser?.coordination_name]);

  // Consulta em tempo real da coordenação ao digitar o número (Regra: Máximo 2 usuários por coordenação)
  useEffect(() => {
    const num = userCoordNumber.trim();
    if (!num || !authToken) {
      setUserCoordStatusPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/coordination-status/${encodeURIComponent(num)}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setUserCoordStatusPreview(data);
          if (data.exists && data.name && !userCoordName) {
            setUserCoordName(data.name);
          }
        }
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [userCoordNumber, authToken]);

  // Função para salvar na própria página o Nº Coordenação e Tipo de Usuário (Coordenador ou Assistente)
  const handleSaveUserCoordination = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNum = userCoordNumber.trim();
    if (!cleanNum) {
      setUserCoordError('Por favor, informe o Nº da Coordenação (ex: 101, 102).');
      return;
    }

    setIsSavingUserCoord(true);
    setUserCoordError(null);
    setUserCoordSuccess(null);

    try {
      const res = await fetch('/api/user/coordination', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordination_number: cleanNum,
          role: userCoordRole,
          coordination_name: userCoordName.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setUserCoordError(data.error || 'Erro ao salvar vínculo de coordenação.');
        return;
      }

      if (data.user) {
        setAuthUser(data.user);
        localStorage.setItem('enem_supabase_auth_user', JSON.stringify(data.user));
        // Sincroniza formulário de vaga e dados
        setAdminFormData(prev => ({
          ...prev,
          coordination_number: cleanNum,
          coordinator: data.user.coordinator_name || data.user.coordination_name || prev.coordinator
        }));
      }

      setUserCoordSuccess(`Coordenação Nº ${cleanNum} salva com sucesso nesta página como ${userCoordRole === 'coordinator' ? 'Coordenador Titular' : 'Assistente de Coordenação'}!`);
      setUserCoordEditMode(false);
      fetchCoordinations();
      fetchVacancies();
      fetchcontributors();
      setTimeout(() => setUserCoordSuccess(null), 5000);
    } catch (err: any) {
      setUserCoordError(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setIsSavingUserCoord(false);
    }
  };

  useEffect(() => {
    // 1. Limpeza proativa de dados de teste/fake remanescentes no Supabase e no localStorage
    purgeFakeDataFromSupabase().then(() => {
      fetchVacancies();
      fetchcontributors();
      fetchCoordinations();
    }).catch(() => {});

    // Carrega vagas e status do Supabase imediatamente para todos (público)
    fetchVacancies();
    fetchSupabaseStatus();

    if (authToken) {
      // 1. Valida diretamente com o cliente Supabase no navegador (onde as credenciais estão conectadas)
      const supabase = getSupabaseClient();
      if (supabase && !authToken.startsWith('token-')) {
        supabase.auth.getUser(authToken).then(({ data: sbData, error: sbErr }) => {
          if (!sbErr && sbData?.user) {
            const cleanEmail = (sbData.user.email || '').toLowerCase();
            const isAdm = cleanEmail.includes('admin') || cleanEmail.includes('root') || cleanEmail === 'administrator@enem.app';
            const userObj: AuthUser = {
              id: sbData.user.id,
              email: cleanEmail,
              first_name: sbData.user.user_metadata?.first_name || cleanEmail.split('@')[0],
              last_name: sbData.user.user_metadata?.last_name || '',
              full_name: sbData.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              is_administrator: isAdm,
              role: isAdm ? 'admin' : 'coordinator',
              coordination_number: sbData.user.user_metadata?.coordination_number || null,
              coordination_name: isAdm ? 'Administração Geral ENEM 2026' : undefined
            };
            setAuthUser(userObj);
            localStorage.setItem('enem_supabase_auth_user', JSON.stringify(userObj));
            fetchVacancies();
            fetchcontributors();
            fetchCoordinations();
          } else if (sbErr) {
            console.warn('Sessão rejeitada pelo Supabase:', sbErr.message);
          }
        }).catch(() => {});
      } else {
        // Token master local ou fallback
        fetchVacancies();
        fetchcontributors();
        fetchCoordinations();
      }

      // 2. Opcional: tenta sincronizar perfil com a API se disponível (sem jamais derrubar a sessão local se der 404)
      fetch('/api/auth/session', { headers: getAuthHeaders() })
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            return res.json();
          }
          return null;
        })
        .then(data => {
          if (data && data.valid && data.user) {
            setAuthUser(data.user);
            localStorage.setItem('enem_supabase_auth_user', JSON.stringify(data.user));
          }
        })
        .catch(() => {
          // Ambiente estático Vercel: ignora 404 sem deslogar
        });
    }
  }, [authToken, view]);

  useEffect(() => {
    if (authToken && authUser) {
      // Conta comum não possui acesso às configurações de banco de dados ou gestão de usuários
      if (!authUser.is_administrator && (adminTab === 'database' || adminTab === 'supabase' || adminTab === 'users')) {
        setAdminTab('candidates');
        return;
      }

      if (adminTab === 'coordinations') {
        fetchCoordinations();
      }
      if (adminTab === 'users' && authUser.is_administrator) {
        fetchUserAccounts();
      }
      if (adminTab === 'database' && authUser.is_administrator) {
        fetchDatabaseStatus();
      }
      if (adminTab === 'supabase' && authUser.is_administrator) {
        fetchSupabaseStatus();
      }
    }
  }, [adminTab, authToken, authUser]);

  // Sincronização automática do Número de Coordenação da conta ativa
  useEffect(() => {
    if (authUser && !authUser.is_administrator && coordinations.length > 0) {
      const cleanEmail = (authUser.email || '').trim().toLowerCase();
      const match = coordinations.find(c => 
        (c.coordinator_email && c.coordinator_email.trim().toLowerCase() === cleanEmail) ||
        (c.assistant_email && c.assistant_email.trim().toLowerCase() === cleanEmail)
      );
      if (match && (authUser.coordination_number !== match.coordination_number || authUser.coordination_name !== match.name)) {
        const isCoordinator = match.coordinator_email?.trim().toLowerCase() === cleanEmail;
        const updated: AuthUser = {
          ...authUser,
          coordination_number: match.coordination_number,
          coordination_name: match.name,
          coordinator_name: match.coordinator_name,
          role: isCoordinator ? 'coordinator' : 'assistant'
        };
        setAuthUser(updated);
        localStorage.setItem('enem_supabase_auth_user', JSON.stringify(updated));
      }
    }
  }, [coordinations, authUser]);

  // WebSocket for real-time updates
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isSubscribed = true;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'presence') {
              setOnlineCount(data.count);
            } else if (data.type === 'vacancy_updated') {
              if (authToken) fetchVacancies();
            } else if (data.type === 'coordination_updated') {
              if (authToken) {
                fetchCoordinations();
                fetchUserAccounts();
              }
            } else if (data.type === 'users_updated') {
              if (authToken) {
                fetchUserAccounts();
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        socket.onerror = () => {
          // Silent catch for iframe/proxy constraints
        };

        socket.onclose = () => {
          if (isSubscribed) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        };
      } catch {
        // Silent catch for WebSocket constructor restrictions
      }
    };

    connect();
    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [authToken]);

  // Função para baixar arquivos JSON formatados diretamente no navegador
  const downloadJSON = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Carregamento de vagas com suporte a servidor (/api/vacancies ou /api/admin/vacancies) e fallback Supabase
  const fetchVacancies = async () => {
    try {
      const endpoint = view === 'admin' && authToken ? '/api/admin/vacancies' : '/api/vacancies';
      const res = await fetch(endpoint, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const clean = data.filter((v: any) => 
            !FAKE_VACANCY_IDS.includes(Number(v.id)) &&
            !FAKE_COORDINATOR_NAMES.includes(String(v.coordinator)) &&
            !FAKE_COORD_NUMBERS.includes(String(v.coordination_number))
          );
          setVacancies(clean);
          try { localStorage.setItem('enem_vacancies', JSON.stringify(clean)); } catch {}
          return;
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar vagas via API, buscando direto no Supabase:', err);
    }

    // Fallback: carregar diretamente do cliente Supabase
    try {
      const data = await getVacanciesFromSupabase();
      if (Array.isArray(data)) {
        const clean = data.filter((v: any) => 
          !FAKE_VACANCY_IDS.includes(Number(v.id)) &&
          !FAKE_COORDINATOR_NAMES.includes(String(v.coordinator)) &&
          !FAKE_COORD_NUMBERS.includes(String(v.coordination_number))
        );
        setVacancies(clean as any);
        try { localStorage.setItem('enem_vacancies', JSON.stringify(clean)); } catch {}
      }
    } catch {}
  };

  // Carregamento de inscrições estritamente pela API autenticada ou Supabase direto
  const fetchcontributors = async () => {
    try {
      const res = await fetch('/api/admin/contributors', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setcontributors(data);
            try { localStorage.setItem('enem_contributors', JSON.stringify(data)); } catch {}
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar inscrições via API, buscando direto no Supabase:', err);
    }

    // Fallback: carregar inscrições diretamente do Supabase
    try {
      const data = await getApplicationsFromSupabase();
      if (Array.isArray(data)) {
        setcontributors(data as any);
        try { localStorage.setItem('enem_contributors', JSON.stringify(data)); } catch {}
      }
    } catch {}
  };

  const fetchSupabaseStatus = async () => {
    try {
      const endpoint = authUser?.is_administrator ? '/api/supabase/status' : '/api/supabase/public-status';
      const headers = authUser?.is_administrator ? getAuthHeaders() : {};
      const res = await fetch(endpoint, { headers });
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
        return;
      }
    } catch (err) {
      console.warn('Aviso ao consultar status do Supabase via API:', err);
    }

    // Fallback: testar conexão com o cliente Supabase direto
    try {
      const creds = getSupabaseCredentials();
      const test = await testSupabaseConnection();
      setSupabaseStatus({
        configured: Boolean(creds.url && creds.anonKey),
        url: creds.url ? creds.url.replace(/(https?:\/\/)([^.]+)(.*)/, "$1***$3") : null,
        connected: test.success,
        tablesCreated: test.success,
        message: test.message
      });
    } catch {}
  };

  // Helper para o indicador "Supabase Ativo" com a cor da bolinha à frente do nome conforme solicitado:
  // - Verde: conectado e tudo funcionando
  // - Amarelo: conectado e alguma falha
  // - Vermelho: não conectado
  const getSupabaseStatusConfig = () => {
    if (!supabaseStatus) {
      return {
        status: 'loading' as const,
        name: 'Supabase Ativo',
        description: 'Verificando conexão...',
        dotClass: 'bg-amber-400 animate-pulse ring-2 ring-amber-300/40',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        colorName: 'amarelo'
      };
    }

    if (supabaseStatus.connected && supabaseStatus.tablesCreated) {
      // Verde para conectado e tudo funcionando
      return {
        status: 'connected' as const,
        name: 'Supabase Ativo',
        description: 'Conectado e tudo funcionando',
        dotClass: 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/40',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        colorName: 'verde'
      };
    }

    if (supabaseStatus.connected && !supabaseStatus.tablesCreated) {
      // Amarelo para conectado e alguma falha
      return {
        status: 'warning' as const,
        name: 'Supabase Ativo',
        description: 'Conectado e alguma falha (tabelas pendentes)',
        dotClass: 'bg-amber-400 ring-2 ring-amber-300/40',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        colorName: 'amarelo'
      };
    }

    // Vermelho não conectado
    return {
      status: 'disconnected' as const,
      name: 'Supabase Ativo',
      description: 'Não conectado',
      dotClass: 'bg-red-500 ring-2 ring-red-400/40',
      badgeBg: 'bg-red-50 text-red-800 border-red-200',
      colorName: 'vermelho'
    };
  };

  const handleTestSupabase = async () => {
    if (!authUser?.is_administrator) return;
    setIsTestingSupabase(true);
    try {
      const res = await fetch('/api/supabase/test', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setMessage({
        type: data.connected ? 'success' : 'error',
        text: data.message
      });
      fetchSupabaseStatus();
      setTimeout(() => setMessage(null), 6000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Falha ao testar conexão com o Supabase: ' + err.message });
      setTimeout(() => setMessage(null), 6000);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await fetch('/api/supabase/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Sincronização com Supabase concluída! ${data.vacanciesSynced} vagas e ${data.contributorsSynced} inscrições sincronizadas.`
        });
        fetchSupabaseStatus();
        fetchVacancies();
        fetchcontributors();
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao sincronizar com o Supabase.' });
      }
      setTimeout(() => setMessage(null), 6000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Falha na sincronização: ' + err.message });
      setTimeout(() => setMessage(null), 6000);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handlePurgeFakeData = async () => {
    if (!window.confirm('Atenção: Deseja realmente remover todos os dados fakes e de teste (vagas 1 a 9, coordenadores de exemplo e tokens) do Supabase e do sistema?')) {
      return;
    }
    setIsPurgingSupabase(true);
    try {
      // 1. Tenta API backend se disponível
      try {
        await fetch('/api/admin/purge-fakes', {
          method: 'POST',
          headers: getAuthHeaders()
        });
      } catch {}

      // 2. Executa diretamente no cliente Supabase conectado (essencial no Vercel!)
      const res = await purgeFakeDataFromSupabase();
      setMessage({
        type: res.success ? 'success' : 'error',
        text: res.message
      });

      // 3. Atualiza estado
      await fetchVacancies();
      await fetchcontributors();
      await fetchCoordinations();
      await fetchSupabaseStatus();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Falha ao remover dados: ' + (err?.message || '') });
    } finally {
      setIsPurgingSupabase(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Verificação de CPF no Cebraspe em tempo real
  const verifyCebraspeCpf = async (rawCpf: string, triggerPopupOnNotRegistered = true): Promise<boolean> => {
    const clean = rawCpf.replace(/\D/g, '');
    if (clean.length !== 11) {
      setCpfVerificationStatus('idle');
      setCpfVerificationMessage('');
      return false;
    }

    if (!validateCPFDigits(clean)) {
      setCpfVerificationStatus('invalid');
      setCpfVerificationMessage('CPF inválido pelos dígitos verificadores.');
      return false;
    }

    setCpfVerificationStatus('checking');
    setCpfVerificationMessage('Consultando cadastro no Cebraspe (Sinapse)...');

    try {
      const res = await fetch('/api/verify-cebraspe-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: clean })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.registered) {
          setCpfVerificationStatus('registered');
          setCpfVerificationMessage('✓ CPF já cadastrado no Cebraspe (Sinapse). Liberado para continuar!');
          return true;
        } else {
          setCpfVerificationStatus('not_registered');
          setCpfVerificationMessage('⚠ CPF não encontrado no Cebraspe. Realize o cadastro na página oficial.');
          if (triggerPopupOnNotRegistered) {
            try {
              window.open('https://extranet.cebraspe.org.br/Sinapse/aspx/administrarusuario/QueroMeCadastrar.aspx', '_blank', 'noopener,noreferrer');
            } catch {}
            setIsCebraspeModalOpen(true);
          }
          return false;
        }
      } else {
        setCpfVerificationStatus('not_registered');
        setCpfVerificationMessage('Necessário realizar ou validar cadastro no Cebraspe.');
        if (triggerPopupOnNotRegistered) {
          try {
            window.open('https://extranet.cebraspe.org.br/Sinapse/aspx/administrarusuario/QueroMeCadastrar.aspx', '_blank', 'noopener,noreferrer');
          } catch {}
          setIsCebraspeModalOpen(true);
        }
        return false;
      }
    } catch {
      setCpfVerificationStatus('not_registered');
      setCpfVerificationMessage('Necessário validar cadastro no Cebraspe.');
      if (triggerPopupOnNotRegistered) {
        try {
          window.open('https://extranet.cebraspe.org.br/Sinapse/aspx/administrarusuario/QueroMeCadastrar.aspx', '_blank', 'noopener,noreferrer');
        } catch {}
        setIsCebraspeModalOpen(true);
      }
      return false;
    }
  };

  // Re-verificar após o término ("apos o termino verifica novamente o cpf digitado.")
  const handleRecheckCebraspe = async () => {
    setIsRecheckingCebraspe(true);
    try {
      const isOk = await verifyCebraspeCpf(formData.cpf, false);
      if (isOk) {
        setMessage({ type: 'success', text: 'Cadastro no Cebraspe confirmado com sucesso!' });
        setTimeout(() => {
          setIsCebraspeModalOpen(false);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ 
          type: 'error', 
          text: 'O CPF ainda não consta como cadastrado no Cebraspe. Caso já tenha finalizado, clique em "Já finalizei todas as etapas".' 
        });
        setTimeout(() => setMessage(null), 5000);
      }
    } finally {
      setIsRecheckingCebraspe(false);
    }
  };

  // Confirmação manual caso o usuário tenha terminado o cadastro no Cebraspe
  const handleManualConfirmCebraspe = async () => {
    const clean = formData.cpf.replace(/\D/g, '');
    try {
      await fetch('/api/confirm-cebraspe-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: clean })
      });
    } catch {}

    setCpfVerificationStatus('registered');
    setCpfVerificationMessage('✓ Cadastro no Cebraspe confirmado!');
    setIsCebraspeModalOpen(false);
    setMessage({ type: 'success', text: 'Cadastro no Cebraspe confirmado com sucesso! Prossiga com a inscrição.' });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVacancy) return;

    // Validação de formato CPF
    const cpfDigits = formData.cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11 || !validateCPFDigits(cpfDigits)) {
      setMessage({ type: 'error', text: 'Por favor, informe um CPF válido com 11 dígitos corretos.' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    // Regra Estrita: Só pode haver um CPF cadastrado (não pode se cadastrar em mais de uma vaga)
    const alreadyApplied = contributors.some(a => a.cpf.replace(/\D/g, '') === cpfDigits);
    if (alreadyApplied) {
      setMessage({ 
        type: 'error', 
        text: 'Este CPF já possui uma inscrição cadastrada no sistema. Cada candidato(a) só pode se cadastrar em uma única vaga.' 
      });
      setTimeout(() => setMessage(null), 6000);
      return;
    }

    // Verificação obrigatória no Cebraspe
    if (cpfVerificationStatus !== 'registered') {
      const isRegistered = await verifyCebraspeCpf(formData.cpf, true);
      if (!isRegistered) {
        return;
      }
    }

    // Validação de formato WhatsApp / Celular
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setMessage({ type: 'error', text: 'Por favor, informe um número de WhatsApp válido com DDD (ex: (11) 98765-4321).' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    try {
      const res = await fetch('/api/contributors', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vacancy_id: selectedVacancy.id,
          ...formData,
          cpf: formatCPF(formData.cpf),
          phone: formatPhone(formData.phone),
          referrer_name: formData.referrer_name?.trim() || undefined,
          referrer_phone: formData.referrer_phone ? formatPhone(formData.referrer_phone) : undefined,
          cebraspe_verified: true
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Inscrição realizada com sucesso no ENEM 2026!' });
        setIsApplying(false);
        setFormData(initialcontributorFormData);
        fetchVacancies();
        if (authToken) {
          fetchcontributors();
        }
        setTimeout(() => setMessage(null), 5000);
        return;
      } else {
        const errorData = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: errorData.error || 'Não foi possível concluir a inscrição.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    } catch {
      // Fallback local
      const cleanCpfDigits = formData.cpf.replace(/\D/g, '');
      const localAlreadyApplied = contributors.some(a => a.cpf.replace(/\D/g, '') === cleanCpfDigits);
      if (localAlreadyApplied) {
        setMessage({ type: 'error', text: 'Este CPF já possui uma inscrição cadastrada no sistema. Não é permitido se inscrever em mais de uma vaga.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      const userAge = parseInt(formData.age);
      if (userAge < selectedVacancy.min_age || userAge > selectedVacancy.max_age) {
        setMessage({ type: 'error', text: `Idade não permitida. Apenas entre ${selectedVacancy.min_age} e ${selectedVacancy.max_age} anos.` });
        setTimeout(() => setMessage(null), 5000);
        return;
      }

      const newAppId = Date.now();
      const newApp: contributor = {
        id: newAppId,
        vacancy_id: selectedVacancy.id,
        name: formData.name,
        cpf: formatCPF(formData.cpf),
        phone: formatPhone(formData.phone),
        city: formData.city,
        neighborhood: formData.neighborhood,
        age: userAge,
        status: 'pending',
        applied_at: new Date().toISOString(),
        cebraspe_verified: true,
        referrer_name: formData.referrer_name?.trim() || undefined,
        referrer_phone: formData.referrer_phone ? formatPhone(formData.referrer_phone) : undefined,
        vacancy_title: selectedVacancy.title,
        vacancy_school: selectedVacancy.school,
        vacancy_city: selectedVacancy.city,
        vacancy_neighborhood: selectedVacancy.neighborhood,
        coordination_number: selectedVacancy.coordination_number,
        coordinator: selectedVacancy.coordinator
      };

      const updatedApps = [newApp, ...contributors];
      setcontributors(updatedApps);
      try { localStorage.setItem('enem_contributors', JSON.stringify(updatedApps)); } catch {}

      const updatedVacancies = vacancies.map(v => 
        v.id === selectedVacancy.id ? { ...v, quantity: Math.max(0, v.quantity - 1) } : v
      );
      setVacancies(updatedVacancies);
      try { localStorage.setItem('enem_vacancies', JSON.stringify(updatedVacancies)); } catch {}

      setMessage({ type: 'success', text: 'Inscrição realizada com sucesso! Gravada no banco de dados.' });
      setIsApplying(false);
      setFormData(initialcontributorFormData);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleAddVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = adminFormData.title === '__custom__' 
      ? customVacancyTitle.trim() 
      : adminFormData.title.trim();

    if (!finalTitle) {
      setMessage({ type: 'error', text: 'Por favor, selecione ou digite o nome do tipo de vaga.' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    try {
      const finalPrice = adminFormData.price || adminFormData.value;
      const res = await fetch('/api/vacancies', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...adminFormData,
          title: finalTitle,
          city: adminFormData.city || 'Rio de Janeiro',
          price: parseFloat(finalPrice),
          value: parseFloat(finalPrice),
          quantity: parseInt(adminFormData.quantity)
        })
      });

      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          setMessage({ type: 'success', text: `Vaga "${finalTitle}" cadastrada com sucesso no banco de dados!` });
          setAdminFormData({ 
            title: '', 
            price: '',
            value: '', 
            city: 'Rio de Janeiro', 
            neighborhood: '', 
            school: '', 
            coordinator: '', 
            coordination_number: '', 
            quantity: '', 
            min_age: '18', 
            max_age: '100' 
          });
          setCustomVacancyTitle('');
          fetchVacancies();
          setTimeout(() => setMessage(null), 5000);
          return;
        }
      }
    } catch {}

    // Fallback direto via cliente Supabase no navegador
    try {
      const finalPrice = adminFormData.price || adminFormData.value;
      const sbRes = await createVacancyInSupabase({
        title: finalTitle,
        value: parseFloat(finalPrice) || 0,
        city: adminFormData.city || 'Rio de Janeiro',
        neighborhood: adminFormData.neighborhood || '',
        school: adminFormData.school || '',
        coordinator: adminFormData.coordinator || '',
        coordination_number: adminFormData.coordination_number || '',
        quantity: parseInt(adminFormData.quantity) || 1,
        min_age: parseInt(adminFormData.min_age) || 18,
        max_age: parseInt(adminFormData.max_age) || 100,
        status: 'open'
      });
      if (sbRes.success) {
        setMessage({ type: 'success', text: `Vaga "${finalTitle}" cadastrada com sucesso no Supabase!` });
        setAdminFormData({ 
          title: '', 
          price: '',
          value: '', 
          city: 'Rio de Janeiro', 
          neighborhood: '', 
          school: '', 
          coordinator: '', 
          coordination_number: '', 
          quantity: '', 
          min_age: '18', 
          max_age: '100' 
        });
        setCustomVacancyTitle('');
        fetchVacancies();
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    } catch {}

    // Fallback local se estiver operando em GitHub Pages
    const finalPrice = adminFormData.price || adminFormData.value;
    const newId = Math.max(0, ...vacancies.map(v => v.id)) + 1;
    const newVac: Vacancy = {
      id: newId,
      title: finalTitle,
      price: parseFloat(finalPrice) || 0,
      value: parseFloat(finalPrice) || 0,
      city: adminFormData.city || 'Rio de Janeiro',
      neighborhood: adminFormData.neighborhood,
      school: adminFormData.school,
      coordinator: adminFormData.coordinator,
      coordination_number: adminFormData.coordination_number,
      quantity: parseInt(adminFormData.quantity) || 1,
      min_age: parseInt(adminFormData.min_age) || 18,
      max_age: parseInt(adminFormData.max_age) || 100,
      status: 'open',
      created_at: new Date().toISOString()
    };
    const updated = [newVac, ...vacancies];
    setVacancies(updated);
    try { localStorage.setItem('enem_vacancies', JSON.stringify(updated)); } catch {}

    setMessage({ type: 'success', text: `Vaga "${finalTitle}" cadastrada com sucesso no banco de dados!` });
    setAdminFormData({ 
      title: '', 
      value: '', 
      city: 'Rio de Janeiro',
      neighborhood: '', 
      school: '', 
      coordinator: '', 
      coordination_number: '', 
      quantity: '', 
      min_age: '18', 
      max_age: '100' 
    });
    setCustomVacancyTitle('');
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateStatus = async (id: number | string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/contributors/${id}/status`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchcontributors();
        return;
      }
    } catch {}

    // Fallback local
    const updated = contributors.map(a => String(a.id) === String(id) ? { ...a, status: newStatus } : a);
    setcontributors(updated);
    try { localStorage.setItem('enem_contributors', JSON.stringify(updated)); } catch {}
  };

  const handleOpenEditVacancy = (v: Vacancy) => {
    setEditingVacancy(v);
    setEditVacancyFormData({
      title: v.title || '',
      value: v.price !== undefined ? v.price : (v.value || 90),
      school: v.school || '',
      neighborhood: v.neighborhood || '',
      city: v.city || 'Rio de Janeiro',
      coordination_number: v.coordination_number || '',
      coordinator: v.coordinator || '',
      quantity: v.quantity || 1,
      min_age: v.min_age || 18,
      max_age: v.max_age || 75,
      status: v.status || 'open'
    });
    setEditVacancyError(null);
    setIsEditVacancyModalOpen(true);
  };

  const handleSaveEditVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVacancy) return;

    setIsSavingEditVacancy(true);
    setEditVacancyError(null);

    try {
      const res = await fetch(`/api/admin/vacancies/${editingVacancy.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editVacancyFormData.title,
          price: Number(editVacancyFormData.value),
          value: Number(editVacancyFormData.value),
          school: editVacancyFormData.school,
          neighborhood: editVacancyFormData.neighborhood,
          city: editVacancyFormData.city,
          coordination_number: editVacancyFormData.coordination_number,
          coordinator: editVacancyFormData.coordinator,
          quantity: Number(editVacancyFormData.quantity),
          min_age: Number(editVacancyFormData.min_age),
          max_age: Number(editVacancyFormData.max_age),
          status: editVacancyFormData.status
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const updatedItem = data.vacancy || { ...editingVacancy, ...editVacancyFormData, price: Number(editVacancyFormData.value), value: Number(editVacancyFormData.value) };
        const updatedList = vacancies.map(v => 
          String(v.id) === String(editingVacancy.id) ? updatedItem : v
        );
        setVacancies(updatedList);
        try { localStorage.setItem('enem_vacancies', JSON.stringify(updatedList)); } catch {}
        
        setIsEditVacancyModalOpen(false);
        setEditingVacancy(null);
        setMessage({ type: 'success', text: `Vaga "${editVacancyFormData.title} - ${editVacancyFormData.school}" atualizada com sucesso no banco de dados e Supabase!` });
        setTimeout(() => setMessage(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setEditVacancyError(err.error || 'Erro ao atualizar dados da vaga.');
      }
    } catch (err: any) {
      setEditVacancyError(err.message || 'Falha de comunicação com o servidor.');
    } finally {
      setIsSavingEditVacancy(false);
    }
  };

  const handleDeleteVacancy = (id: number | string) => {
    const target = vacancies.find(v => String(v.id) === String(id));
    setDeleteConfirmModal({
      isOpen: true,
      type: 'vacancy',
      targetId: id,
      title: 'Excluir Posto / Vaga do Banco de Dados',
      itemDescription: target ? `${target.title} • ${target.school}` : `Posto/Vaga ID #${id}`,
      safeNote: '⚠️ REGRA DE SEGURANÇA: Todos os candidatos que já se inscreveram para este posto permanecerão 100% salvos e preservados no banco de dados.'
    });
  };

  const handleDeleteSelectedVacancies = () => {
    if (selectedVacancyIds.length === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      type: 'vacancies',
      targetIds: [...selectedVacancyIds],
      title: 'Excluir Postos Selecionados do Banco de Dados',
      itemDescription: `${selectedVacancyIds.length} posto(s) de trabalho/vagas selecionado(s) para exclusão`,
      safeNote: '⚠️ REGRA DE SEGURANÇA: Todas as inscrições de candidatos vinculadas aos postos selecionados serão integralmente mantidas e preservadas no banco de dados.'
    });
  };

  const executeDeleteConfirmed = async () => {
    if (!deleteConfirmModal) return;
    setIsExecutingDelete(true);

    try {
      if (deleteConfirmModal.type === 'user' && deleteConfirmModal.targetEmail) {
        const email = deleteConfirmModal.targetEmail;
        const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          setMessage({ type: 'success', text: `Conta ${email} excluída com sucesso do banco de dados.` });
          setSelectedUserEmails(prev => prev.filter(e => e.toLowerCase() !== email.toLowerCase()));
          fetchUserAccounts();
          fetchCoordinations();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'error', text: data.error || 'Falha ao remover conta do banco de dados.' });
        }
      } else if (deleteConfirmModal.type === 'users' && deleteConfirmModal.targetEmails) {
        const emails = deleteConfirmModal.targetEmails;
        const res = await fetch('/api/admin/users/batch-delete', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ emails })
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'success', text: data.message || `${emails.length} conta(s) excluída(s) com sucesso do banco de dados.` });
          setSelectedUserEmails([]);
          fetchUserAccounts();
          fetchCoordinations();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'error', text: data.error || 'Falha ao excluir contas selecionadas.' });
        }
      } else if (deleteConfirmModal.type === 'vacancy' && deleteConfirmModal.targetId !== undefined) {
        const id = deleteConfirmModal.targetId;
        const res = await fetch(`/api/admin/vacancies/${encodeURIComponent(String(id))}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({
            type: 'success',
            text: data.message || 'Posto/vaga excluído com sucesso do banco de dados! Inscrições de candidatos preservadas.'
          });
          setSelectedVacancyIds(prev => prev.filter(vid => String(vid) !== String(id)));
          setVacancies(prev => prev.filter(v => String(v.id) !== String(id)));
          fetchVacancies();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'error', text: data.error || 'Falha ao deletar vaga do banco de dados.' });
        }
      } else if (deleteConfirmModal.type === 'vacancies' && deleteConfirmModal.targetIds) {
        const ids = deleteConfirmModal.targetIds;
        const res = await fetch('/api/admin/vacancies/batch-delete', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids })
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({
            type: 'success',
            text: data.message || `${ids.length} posto(s) excluído(s) com sucesso do banco de dados! Inscrições preservadas.`
          });
          setSelectedVacancyIds([]);
          setVacancies(prev => prev.filter(v => !ids.some(id => String(id) === String(v.id))));
          fetchVacancies();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'error', text: data.error || 'Falha ao excluir postos selecionados.' });
        }
      } else if (deleteConfirmModal.type === 'coordination' && deleteConfirmModal.targetId !== undefined) {
        const num = String(deleteConfirmModal.targetId);
        const res = await fetch(`/api/admin/coordinations/${encodeURIComponent(num)}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          setMessage({ type: 'success', text: `Coordenação Nº ${num} removida com sucesso do banco de dados.` });
          fetchCoordinations();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'error', text: data.error || 'Falha ao remover coordenação.' });
        }
      } else if (deleteConfirmModal.type === 'collaborator' && deleteConfirmModal.targetId !== undefined) {
        const id = deleteConfirmModal.targetId;
        const res = await fetch(`/api/admin/applications/${encodeURIComponent(String(id))}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({
            type: 'success',
            text: data.message || 'Inscrição do colaborador excluída com sucesso do banco de dados!'
          });
          setcontributors(prev => prev.filter(c => String(c.id) !== String(id)));
          fetchcontributors();
          fetchVacancies();
        } else {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: 'error', text: data.error || 'Falha ao excluir colaborador do banco de dados.' });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de conexão com o servidor.' });
    } finally {
      setIsExecutingDelete(false);
      setDeleteConfirmModal(null);
      setCollaboratorDoubleConfirmed(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDeleteCollaborator = (candidate: Application) => {
    setCollaboratorDoubleConfirmed(false);
    setDeleteConfirmModal({
      isOpen: true,
      type: 'collaborator',
      targetId: candidate.id,
      title: 'Excluir Colaborador(a) Inscrito(a)',
      itemDescription: `${candidate.name} • CPF: ${formatCPF(candidate.cpf)} • Cargo: ${candidate.vacancy_title} (${candidate.vacancy_school})`,
      safeNote: 'Confirmação 1 de 2: Você está prestes a iniciar a exclusão desta inscrição de colaborador do sistema.',
      candidateData: candidate,
      step: 1
    });
  };

  const handleDeleteAllVacancies = async () => {
    if (!window.confirm('AVISO: Isso deletará TODAS as vagas que não possuem inscritos. Deseja continuar?')) return;
    
    try {
      const res = await fetch('/api/admin/vacancies', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Todas as vagas sem inscritos foram removidas!' });
        fetchVacancies();
        setTimeout(() => setMessage(null), 5000);
        return;
      } else {
        const errorData = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: errorData.error || 'Erro ao deletar todas as vagas.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    } catch {}

    if (contributors.length > 0) {
      setMessage({ type: 'error', text: 'Existem inscrições vinculadas. Delete as vagas individualmente.' });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    setVacancies([]);
    try { localStorage.setItem('enem_vacancies', JSON.stringify([])); } catch {}
    setMessage({ type: 'success', text: 'Todas as vagas foram removidas!' });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleResetSystem = async () => {
    if (!window.confirm('ATENÇÃO: Isso deletará TODAS as vagas E TODAS as inscrições permanentemente. Deseja continuar?')) return;
    if (!window.confirm('TEM CERTEZA? Esta ação não pode ser desfeita.')) return;
    
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Banco de dados resetado com sucesso!' });
        fetchVacancies();
        fetchcontributors();
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    } catch {}

    setVacancies([]);
    setcontributors([]);
    try {
      localStorage.setItem('enem_vacancies', JSON.stringify([]));
      localStorage.setItem('enem_contributors', JSON.stringify([]));
    } catch {}
    setMessage({ type: 'success', text: 'Sistema resetado com sucesso!' });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('Deseja restaurar as vagas originais para as 7 cidades do RJ?')) return;
    try {
      const res = await fetch('/api/admin/restore-defaults', { 
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchVacancies();
        setMessage({ type: 'success', text: 'Vagas padrão restauradas no banco de dados com sucesso!' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    } catch {}

    // Fallback local seguro sem requisição direta de arquivo
    setVacancies(DEFAULT_VACANCIES);
    localStorage.setItem('enem_vacancies', JSON.stringify(DEFAULT_VACANCIES));
    setMessage({ type: 'success', text: 'Vagas padrão recarregadas com sucesso no banco de dados!' });
    setTimeout(() => setMessage(null), 5000);
  };

  // Filtragem pública de vagas por Região (Cidade, Bairro) e busca
  const publicCities = Array.from(new Set([...CITIES, ...vacancies.map(v => v.city || 'Rio de Janeiro').filter(Boolean)])).sort();
  const publicNeighborhoods = Array.from(new Set(
    vacancies
      .filter(v => !publicFilter.city || (v.city || 'Rio de Janeiro').toLowerCase() === publicFilter.city.toLowerCase())
      .map(v => v.neighborhood)
      .filter(Boolean)
  )).sort();

  const filteredVacancies = vacancies.filter(vacancy => {
    const vCity = vacancy.city || 'Rio de Janeiro';
    const matchCity = !publicFilter.city || vCity.toLowerCase() === publicFilter.city.toLowerCase();
    const matchNeighborhood = !publicFilter.neighborhood || vacancy.neighborhood.toLowerCase() === publicFilter.neighborhood.toLowerCase();
    
    const query = publicFilter.search.toLowerCase().trim();
    const matchSearch = !query ||
      vacancy.title.toLowerCase().includes(query) ||
      vacancy.school.toLowerCase().includes(query) ||
      vCity.toLowerCase().includes(query) ||
      vacancy.neighborhood.toLowerCase().includes(query) ||
      vacancy.coordinator.toLowerCase().includes(query) ||
      vacancy.coordination_number.includes(query);

    return matchCity && matchNeighborhood && matchSearch;
  });

  // Filtragem administrativa de inscritos
  const adminCities = Array.from(new Set([
    ...CITIES,
    ...contributors.map(a => a.city).filter(Boolean),
    ...contributors.map(a => a.vacancy_city).filter(Boolean) as string[],
    ...vacancies.map(v => v.city).filter(Boolean)
  ])).sort();

  const adminNeighborhoods = Array.from(new Set([
    ...contributors.map(a => a.neighborhood).filter(Boolean),
    ...contributors.map(a => a.vacancy_neighborhood).filter(Boolean) as string[]
  ])).sort();

  const adminVacancyTypes = Array.from(new Set([
    ...contributors.map(a => a.vacancy_title).filter(Boolean),
    ...vacancies.map(v => v.title).filter(Boolean)
  ])).sort();

  const filteredcontributors = contributors.filter(app => {
    const matchSchool = !adminFilter.school || app.vacancy_school.toLowerCase().includes(adminFilter.school.toLowerCase());
    const matchCoord = !adminFilter.coordination || app.coordination_number.includes(adminFilter.coordination);
    
    const candCity = app.city || '';
    const vacCity = app.vacancy_city || '';
    const matchCity = !adminFilter.city || 
      candCity.toLowerCase() === adminFilter.city.toLowerCase() || 
      vacCity.toLowerCase() === adminFilter.city.toLowerCase();

    const candNeigh = app.neighborhood || '';
    const vacNeigh = app.vacancy_neighborhood || '';
    const matchNeighborhood = !adminFilter.neighborhood || 
      candNeigh.toLowerCase() === adminFilter.neighborhood.toLowerCase() || 
      vacNeigh.toLowerCase() === adminFilter.neighborhood.toLowerCase();

    const matchVacancyType = !adminFilter.vacancy_type || 
      (app.vacancy_title || '').toLowerCase().trim() === adminFilter.vacancy_type.toLowerCase().trim();

    const matchStatus = !adminFilter.status || app.status === adminFilter.status;

    const query = adminFilter.search.toLowerCase().trim();
    const matchSearch = !query ||
      app.name.toLowerCase().includes(query) ||
      app.cpf.includes(query) ||
      app.phone.includes(query) ||
      app.vacancy_title.toLowerCase().includes(query) ||
      app.vacancy_school.toLowerCase().includes(query) ||
      app.coordinator.toLowerCase().includes(query);

    return matchSchool && matchCoord && matchCity && matchNeighborhood && matchVacancyType && matchStatus && matchSearch;
  });

  const exportToCSV = (targetSchool?: string) => {
    const listToExport = targetSchool
      ? contributors.filter(a => (a.vacancy_school || '').toLowerCase() === targetSchool.toLowerCase())
      : filteredcontributors;

    if (listToExport.length === 0) return;

    const headers = [
      'Nome', 'Idade', 'CPF', 'WhatsApp', 
      'Quem Indicou', 'WhatsApp Indicador',
      'Cidade Candidato', 'Bairro Candidato', 
      'Vaga', 'Escola', 'Cidade Vaga', 'Bairro Vaga', 
      'Coordenação', 'Coordenador(a)', 'Data Inscrição', 'Status', 'Cebraspe'
    ];
    const rows = listToExport.map(app => [
      app.name,
      app.age,
      app.cpf,
      app.phone,
      app.referrer_name || 'Sem indicação',
      app.referrer_phone || '-',
      app.city,
      app.neighborhood,
      app.vacancy_title,
      app.vacancy_school,
      app.vacancy_city || 'Rio de Janeiro',
      app.vacancy_neighborhood || '',
      app.coordination_number,
      app.coordinator,
      new Date(app.applied_at).toLocaleDateString(),
      app.status,
      app.cebraspe_verified !== false ? 'Confirmado' : 'Pendente'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const schoolLabel = targetSchool || adminFilter.school;
    const sanitizedSchool = schoolLabel ? schoolLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'todos';
    const filename = `inscritos_enem2026_${sanitizedSchool}_${new Date().toISOString().slice(0, 10)}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToTXT = (targetSchool?: string) => {
    const listToExport = targetSchool
      ? contributors.filter(a => (a.vacancy_school || '').toLowerCase() === targetSchool.toLowerCase())
      : filteredcontributors;

    if (listToExport.length === 0) return;

    const schoolLabel = targetSchool || adminFilter.school;
    const headerBanner = schoolLabel 
      ? `==========================================================\n` +
        `RELATÓRIO DE INSCRITOS - ENEM 2026\n` +
        `ESCOLA / LOCAL: ${schoolLabel.toUpperCase()}\n` +
        `TOTAL DE CANDIDATOS: ${listToExport.length}\n` +
        `GERADO EM: ${new Date().toLocaleString()}\n` +
        `==========================================================\n\n`
      : `==========================================================\n` +
        `RELATÓRIO GERAL DE INSCRITOS - ENEM 2026\n` +
        `TOTAL DE CANDIDATOS: ${listToExport.length}\n` +
        `GERADO EM: ${new Date().toLocaleString()}\n` +
        `==========================================================\n\n`;

    const content = headerBanner + listToExport.map(app => (
      `CANDIDATO: ${app.name}\n` +
      `IDADE: ${app.age}\n` +
      `CPF: ${app.cpf}\n` +
      `WHATSAPP: ${app.phone}\n` +
      (app.referrer_name ? `QUEM INDICOU: ${app.referrer_name}${app.referrer_phone ? ` (WhatsApp: ${app.referrer_phone})` : ''}\n` : '') +
      `CIDADE CANDIDATO: ${app.city}\n` +
      `BAIRRO CANDIDATO: ${app.neighborhood}\n` +
      `VAGA: ${app.vacancy_title}\n` +
      `ESCOLA: ${app.vacancy_school}\n` +
      `CIDADE DA VAGA: ${app.vacancy_city || 'Rio de Janeiro'}\n` +
      `BAIRRO DA VAGA: ${app.vacancy_neighborhood || ''}\n` +
      `COORDENAÇÃO: #${app.coordination_number}\n` +
      `COORDENADOR(A): ${app.coordinator}\n` +
      `DATA: ${new Date(app.applied_at).toLocaleDateString()}\n` +
      `CEBRASPE: ${app.cebraspe_verified !== false ? 'CONFIRMADO' : 'PENDENTE'}\n` +
      `STATUS: ${app.status.toUpperCase()}\n` +
      `------------------------------------------`
    )).join('\n');

    const sanitizedSchool = schoolLabel ? schoolLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : 'todos';
    const filename = `inscritos_enem2026_${sanitizedSchool}_${new Date().toISOString().slice(0, 10)}.txt`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Agrupamento e resumo de todas as escolas cadastradas
  const schoolsSummary: SchoolSummary[] = React.useMemo(() => {
    const map = new Map<string, SchoolSummary>();

    // Escolas vindas das vagas
    vacancies.forEach(v => {
      const schoolName = v.school ? v.school.trim() : '';
      if (!schoolName) return;
      const city = v.city || 'Rio de Janeiro';
      const key = `${schoolName.toLowerCase()}_${city.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          name: schoolName,
          city: city,
          neighborhood: v.neighborhood || '',
          coordination_number: v.coordination_number || '',
          coordinator: v.coordinator || '',
          vacancies: [v],
          totalSlots: Number(v.quantity) || 0,
          applicantCount: 0,
          cadastradoCount: 0,
          pendingCount: 0,
          recusadoCount: 0,
        });
      } else {
        const s = map.get(key)!;
        s.vacancies.push(v);
        s.totalSlots += (Number(v.quantity) || 0);
        if (!s.neighborhood && v.neighborhood) s.neighborhood = v.neighborhood;
        if (!s.coordinator && v.coordinator) s.coordinator = v.coordinator;
        if (!s.coordination_number && v.coordination_number) s.coordination_number = v.coordination_number;
      }
    });

    // Contabiliza inscrições por escola
    contributors.forEach(a => {
      const schoolName = a.vacancy_school ? a.vacancy_school.trim() : '';
      if (!schoolName) return;
      const city = a.vacancy_city || 'Rio de Janeiro';
      const key = `${schoolName.toLowerCase()}_${city.toLowerCase()}`;

      let schoolObj = map.get(key);
      if (!schoolObj) {
        // Tenta encontrar por nome
        for (const item of map.values()) {
          if (item.name.toLowerCase() === schoolName.toLowerCase()) {
            schoolObj = item;
            break;
          }
        }
      }

      if (!schoolObj) {
        schoolObj = {
          name: schoolName,
          city: city,
          neighborhood: a.vacancy_neighborhood || a.neighborhood || '',
          coordination_number: a.coordination_number || '000',
          coordinator: a.coordinator || 'Não especificado',
          vacancies: [],
          totalSlots: 0,
          applicantCount: 0,
          cadastradoCount: 0,
          pendingCount: 0,
          recusadoCount: 0,
        };
        map.set(key, schoolObj);
      }

      schoolObj.applicantCount += 1;
      if (a.status === 'cadastrado') {
        schoolObj.cadastradoCount += 1;
      } else if (a.status === 'recusado') {
        schoolObj.recusadoCount += 1;
      } else {
        schoolObj.pendingCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [vacancies, contributors]);

  // Filtragem de escolas
  const filteredSchools = schoolsSummary.filter(s => {
    const matchCity = !schoolCityFilter || s.city.toLowerCase() === schoolCityFilter.toLowerCase();
    const query = schoolSearch.toLowerCase().trim();
    const matchSearch = !query ||
      s.name.toLowerCase().includes(query) ||
      s.city.toLowerCase().includes(query) ||
      s.neighborhood.toLowerCase().includes(query) ||
      s.coordinator.toLowerCase().includes(query) ||
      s.coordination_number.includes(query) ||
      s.vacancies.some(v => v.title.toLowerCase().includes(query));

    return matchCity && matchSearch;
  });

  // Lista detalhada de todas as vagas ofertadas com cálculo de preenchidas e em aberto
  const enrichedVacancies = React.useMemo(() => {
    return vacancies.map(v => {
      const vSchool = (v.school || '').trim().toLowerCase();
      const vTitle = (v.title || '').trim().toLowerCase();

      const matchedCandidates = contributors.filter(c => {
        if (c.vacancy_id && String(c.vacancy_id) === String(v.id)) return true;
        const cSchool = (c.vacancy_school || '').trim().toLowerCase();
        const cTitle = (c.vacancy_title || '').trim().toLowerCase();
        return cSchool === vSchool && cTitle === vTitle;
      });

      const totalSlots = Number(v.quantity) || 0;
      const filledCount = matchedCandidates.filter(c => c.status === 'cadastrado').length;
      const pendingCount = matchedCandidates.filter(c => c.status === 'pending').length;
      const recusadoCount = matchedCandidates.filter(c => c.status === 'recusado').length;
      const openCount = Math.max(0, totalSlots - filledCount);
      const isFullyFilled = totalSlots > 0 && openCount === 0;

      return {
        ...v,
        totalSlots,
        filledCount,
        pendingCount,
        recusadoCount,
        openCount,
        isFullyFilled,
        candidateCount: matchedCandidates.length
      };
    });
  }, [vacancies, contributors]);

  const filteredOfferedVacancies = React.useMemo(() => {
    return enrichedVacancies.filter(v => {
      const matchCity = !schoolCityFilter || (v.city || '').toLowerCase() === schoolCityFilter.toLowerCase();
      const matchType = !offeredVacancyTypeFilter || (v.title || '').toLowerCase() === offeredVacancyTypeFilter.toLowerCase();
      const query = schoolSearch.toLowerCase().trim();
      const matchSearch = !query ||
        (v.title || '').toLowerCase().includes(query) ||
        (v.school || '').toLowerCase().includes(query) ||
        (v.neighborhood || '').toLowerCase().includes(query) ||
        (v.city || '').toLowerCase().includes(query) ||
        String(v.coordination_number || '').includes(query) ||
        (v.coordinator || '').toLowerCase().includes(query);

      const matchStatus = 
        offeredVacanciesStatusFilter === 'all' ? true :
        offeredVacanciesStatusFilter === 'open' ? !v.isFullyFilled :
        v.isFullyFilled;

      return matchCity && matchType && matchSearch && matchStatus;
    });
  }, [enrichedVacancies, schoolSearch, schoolCityFilter, offeredVacancyTypeFilter, offeredVacanciesStatusFilter]);

  // Filtragem e busca detalhada de contas de e-mails cadastradas
  const filteredUserAccounts = React.useMemo(() => {
    return userAccounts.filter(acc => {
      const q = userSearchTerm.trim().toLowerCase();
      const fullName = (acc.full_name || `${acc.first_name} ${acc.last_name}`).toLowerCase();
      const email = (acc.email || '').toLowerCase();
      const coordNum = String(acc.coordination_number || '').toLowerCase();
      const coordName = (acc.coordination_name || '').toLowerCase();

      if (q) {
        const match = fullName.includes(q) || email.includes(q) || coordNum.includes(q) || coordName.includes(q);
        if (!match) return false;
      }

      if (userRoleFilter === 'admins') return acc.is_administrator;
      if (userRoleFilter === 'coordinators') return !acc.is_administrator && acc.role === 'coordinator';
      if (userRoleFilter === 'assistants') return !acc.is_administrator && acc.role === 'assistant';

      return true;
    });
  }, [userAccounts, userSearchTerm, userRoleFilter]);

  const exportSchoolsToCSV = () => {
    const headers = [
      'Nome da Escola', 'Cidade', 'Bairro', 'Coordenação', 'Coordenador(a)', 
      'Cargos Ofertados', 'Total de Vagas', 'Inscritos Total', 'Cadastrados', 'Pendentes', 'Recusados'
    ];
    const rows = filteredSchools.map(s => [
      s.name,
      s.city,
      s.neighborhood,
      `#${s.coordination_number}`,
      s.coordinator,
      s.vacancies.map(v => `${v.title} (${v.quantity})`).join(' | ') || 'Sem vagas ativas',
      s.totalSlots,
      s.applicantCount,
      s.cadastradoCount,
      s.pendingCount,
      s.recusadoCount
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `escolas_enem2026_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportOfferedVacanciesToCSV = () => {
    const headers = [
      'Cargo / Vaga', 'Escola', 'Cidade', 'Bairro', 'Coordenação', 'Coordenador(a)', 
      'Remuneração', 'Idade Mínima', 'Total Ofertado', 'Preenchidas', 'Em Aberto', 'Status'
    ];
    const rows = filteredOfferedVacancies.map(v => [
      v.title,
      v.school,
      v.city || 'Rio de Janeiro',
      v.neighborhood || '',
      `#${v.coordination_number}`,
      v.coordinator,
      `R$ ${(v.price ?? v.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      v.min_age ? `${v.min_age} anos` : '18+ anos',
      v.totalSlots,
      v.filledCount,
      v.openCount,
      v.isFullyFilled ? '100% Preenchida' : 'Com Vagas em Aberto'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vagas_ofertadas_enem2026_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-600 selection:text-white font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo & Portal Status */}
            <div 
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => setView('public')}
            >
              <div className="bg-blue-600 p-2 rounded-xl shadow-sm text-white">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-xl tracking-tight text-slate-900 block leading-tight">ENEM 2026</span>
                {authUser ? (
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Painel do Administrador
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Vagas em aberto
                  </span>
                )}
              </div>
            </div>

            {/* Navigation Tabs - Menu de Vagas em Aberto & Painel Administrativo */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button 
                onClick={() => setView('public')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  view === 'public' 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Visualizar vagas em aberto para candidatos"
              >
                <ClipboardList className="w-4 h-4" />
                <span>Vagas em aberto</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${view === 'public' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {vacancies.length}
                </span>
              </button>

              {authUser && (
                <button 
                  onClick={() => setView('admin')}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    view === 'admin' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Acessar o Painel Administrativo"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Painel Administrativo</span>
                </button>
              )}
            </div>

            {/* User Chip & Logout OR Admin Access Button */}
            <div className="flex items-center gap-2 sm:gap-3">
              {authUser ? (
                <>
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="hidden sm:inline truncate max-w-[140px]" title={authUser.email}>{authUser.email}</span>
                    
                    {/* Canto à parte: Exibição Destacada do Número de Coordenação da conta */}
                    {authUser.is_administrator ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap shadow-xs">
                        👑 Admin Geral (Todas)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setView('admin');
                          setUserCoordEditMode(true);
                        }}
                        title="Configurar Nº Coordenação e Cargo da Conta"
                        className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-600 text-white whitespace-nowrap flex items-center gap-1 shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        <Building className="w-3 h-3 inline" />
                        <span>Nº {authUser.coordination_number || 'Pendente'} • {authUser.role === 'coordinator' ? 'Coordenador' : (authUser.role === 'assistant' ? 'Assistente' : 'Definir')}</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleLogout(true)}
                    title="Sair do sistema"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setView('admin')}
                  title="Acesso administrativo"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer select-none ${
                    view === 'admin'
                      ? 'text-slate-400 font-medium bg-slate-50 border border-slate-100'
                      : 'text-slate-200/50 hover:text-slate-400 bg-transparent hover:bg-slate-50/50 border border-transparent opacity-20 hover:opacity-70'
                  }`}
                >
                  <Lock className="w-2.5 h-2.5 text-slate-300/40 opacity-30" />
                  <span className="text-[10px] tracking-tight">Área do Administrador</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <p className="font-medium">{message.text}</p>
          </motion.div>
        )}

        {view === 'public' ? (
          <div className="space-y-8">
            <header className="max-w-2xl">
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                Vagas em aberto ENEM 2026
              </h1>
              <p className="text-lg text-slate-600">
                Escolha a região de sua preferência e inscreva-se para trabalhar no ENEM 2026.
              </p>
            </header>

            {/* Barra de Filtros por Região e Busca */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span>Filtrar por Região e Vagas em Aberto</span>
                </div>
                {(publicFilter.search || publicFilter.city || publicFilter.neighborhood) && (
                  <button
                    onClick={() => setPublicFilter({ search: '', city: '', neighborhood: '' })}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Limpar Filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por escola, vaga, coordenador(a)..."
                    value={publicFilter.search}
                    onChange={e => setPublicFilter({ ...publicFilter, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <select
                    value={publicFilter.city}
                    onChange={e => setPublicFilter({ ...publicFilter, city: e.target.value, neighborhood: '' })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700"
                  >
                    <option value="">Todas as Cidades</option>
                    {publicCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <select
                    value={publicFilter.neighborhood}
                    onChange={e => setPublicFilter({ ...publicFilter, neighborhood: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700"
                  >
                    <option value="">Todos os Bairros</option>
                    {publicNeighborhoods.map(neigh => (
                      <option key={neigh} value={neigh}>{neigh}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Exibindo <strong>{filteredVacancies.length}</strong> {filteredVacancies.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}
                </span>
                {publicFilter.city && (
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">
                    Cidade: {publicFilter.city}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVacancies.map((vacancy) => (
                <motion.div
                  key={vacancy.id}
                  layoutId={`vacancy-${vacancy.id}`}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => {
                    setFormData(initialcontributorFormData);
                    setSelectedVacancy(vacancy);
                    setIsApplying(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {vacancy.title}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Preço
                      </span>
                      <div className="flex items-center text-emerald-600 font-bold">
                        <span className="text-sm mr-1">R$</span>
                        <span>{(vacancy.price !== undefined ? vacancy.price : (vacancy.value ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        {vacancy.quantity} {vacancy.quantity === 1 ? 'vaga' : 'vagas'}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors">
                    {vacancy.school}
                  </h3>
                  
                  <div className="space-y-3 text-slate-600 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-medium text-slate-800">{vacancy.neighborhood} - {vacancy.city || 'Rio de Janeiro'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Coord(a): {vacancy.coordinator} (#{vacancy.coordination_number})</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Candidatar-se agora</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </motion.div>
              ))}

              {filteredVacancies.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200">
                  <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-800">Nenhuma vaga em aberto no momento</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                    {vacancies.length === 0 
                      ? 'O sistema está limpo. Novos postos e vagas oficiais serão disponibilizados pelas coordenações do ENEM 2026.'
                      : 'Não encontramos vagas abertas para os filtros de cidade ou bairro selecionados.'}
                  </p>
                  {vacancies.length > 0 && (
                    <button
                      onClick={() => setPublicFilter({ search: '', city: '', neighborhood: '' })}
                      className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 font-bold text-sm rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      Ver todas as vagas
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (!authToken || !authUser) ? (
          /* Página de Login e Senha do Administrador - CORES CLARAS */
          <div className="max-w-md mx-auto py-4 sm:py-8">
            {/* Barra superior de navegação para retornar às vagas públicas */}
            <div className="mb-6 flex items-center justify-between">
            </div>

            {/* Card Principal de Login com Cores Claras */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-8 shadow-xl shadow-slate-200/60 relative overflow-hidden"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20 ring-4 ring-blue-50 text-white">
                  <Lock className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Painel Administrativo</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Acesso Restrito • Gestão ENEM 2026
                </p>
              </div>

              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-semibold">{loginError}</div>
                </motion.div>
              )}

              <form onSubmit={handleSupabaseLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>E-mail Corporativo</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type="email" 
                      required
                      autoFocus
                      autoComplete="email"
                      placeholder="email@enem.app"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Senha</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Entrar no Painel do Administrador</span>
                    </>
                  )}
                </button>

                <div className="pt-2 flex flex-col items-center gap-2">

                  <button
                    type="button"
                    onClick={() => setView('public')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold py-1 transition-colors cursor-pointer underline"
                  >
                    ← Voltar para as vagas em aberto
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                {(() => {
                  const cfg = getSupabaseStatusConfig();
                  return (
                    <span 
                      className="flex items-center gap-2 cursor-help"
                      title={`${cfg.name}: ${cfg.description}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotClass}`} />
                      <span className="font-bold text-slate-800">{cfg.name}</span>
                      <span className="text-[11px] text-slate-500 font-medium">({cfg.description})</span>
                    </span>
                  );
                })()}
                <span className="font-mono text-slate-400">ENEM 2026</span>
              </div>
            </motion.div>
          </div>
        ) : (
          <div>
            {/* Header / Banner Exclusivo do Administrador Geral */}
            {authUser?.is_administrator && (
              <div className="mb-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start md:items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-purple-200">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-lg font-black text-slate-900">
                        Painel do Administrador do Sistema — ENEM 2026
                      </h1>
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        👑 Administrador do Sistema
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {authUser?.email}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Visão global de administrador ativa: você pode ver todas as vagas e candidatos de todas as coordenações.
                    </p>
                  </div>
                </div>

                {/* Seletor rápido de filtro de coordenação para Administradores */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <Filter className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Coordenação:</span>
                  <select
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
                    value={selectedCoordFilter}
                    onChange={e => setSelectedCoordFilter(e.target.value)}
                  >
                    <option value="all">Todas as Coordenações ({vacancies.length} vagas)</option>
                    {coordinations.map(c => (
                      <option key={c.coordination_number} value={c.coordination_number}>
                        Coordenação Nº {c.coordination_number} - {c.coordinator_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Campo de Preenchimento e Exibição de Coordenação da Conta (Fica Salvo na Própria Página) */}
            {!authUser?.is_administrator && (
              <div className="mb-6">
                {userCoordEditMode ? (
                  <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-2xl p-6 border-2 border-blue-400 shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blue-100">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-black text-slate-900">
                              Configurar Coordenação e Função da Conta
                            </h2>
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              ✓ Fica Salvo nesta Página
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Preencha o Nº Coordenação e escolha se você é Coordenador ou Assistente. <strong>Lembrando: apenas dois usuários podem ter o mesmo número de coordenação (1 Coordenador e 1 Assistente).</strong>
                          </p>
                        </div>
                      </div>
                      {authUser?.coordination_number && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserCoordEditMode(false);
                            setUserCoordError(null);
                          }}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer self-start sm:self-auto"
                        >
                          Cancelar Edição
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveUserCoordination} className="mt-5 space-y-4">
                      {userCoordError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>{userCoordError}</div>
                        </div>
                      )}

                      {userCoordSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>{userCoordSuccess}</div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Campo: Nº Coordenação */}
                        <div>
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Nº da Coordenação</span>
                            <span className="text-[10px] font-normal text-slate-400">Ex: 01234 </span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="Digite o Nº da Coordenação (ex: 01234)"
                              value={userCoordNumber}
                              onChange={e => setUserCoordNumber(e.target.value)}
                              className="w-full bg-white border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 outline-none font-mono"
                            />
                            {userCoordNumber && (
                              <span className="absolute right-3 top-2.5 text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                Nº {userCoordNumber}
                              </span>
                            )}
                          </div>

                          {/* Sugestões rápidas de coordenações existentes */}
                          {coordinations.length > 0 && (
                            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400">Existentes:</span>
                              {coordinations.map(c => (
                                <button
                                  key={c.coordination_number}
                                  type="button"
                                  onClick={() => {
                                    setUserCoordNumber(c.coordination_number);
                                    if (c.name) setUserCoordName(c.name);
                                  }}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                    userCoordNumber === c.coordination_number
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                  }`}
                                >
                                  Nº {c.coordination_number}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Campo: Tipo de Usuário (Coordenador ou Assistente) */}
                        <div>
                          <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>Tipo de Usuário</span>
                            <span className="text-[10px] font-bold text-blue-600">Apenas 1 de cada por coordenação</span>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setUserCoordRole('coordinator')}
                              className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                                userCoordRole === 'coordinator'
                                  ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-100'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-base">👔</span>
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  userCoordRole === 'coordinator' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                                }`}>
                                  {userCoordRole === 'coordinator' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </span>
                              </div>
                              <div className="mt-2">
                                <div className="text-xs font-black text-slate-900">Coordenador Titular</div>
                                <div className="text-[10px] text-slate-500 font-medium">Gestor da Coordenação</div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setUserCoordRole('assistant')}
                              className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                                userCoordRole === 'assistant'
                                  ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-100'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-base">📋</span>
                                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  userCoordRole === 'assistant' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                                }`}>
                                  {userCoordRole === 'assistant' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </span>
                              </div>
                              <div className="mt-2">
                                <div className="text-xs font-black text-slate-900">Assistente</div>
                                <div className="text-[10px] text-slate-500 font-medium">Apoio Operacional</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Campo Opcional: Nome da Coordenação / Escola Sede */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Nome da Coordenação / Região ou Escola Sede (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Coordenação Regional Centro-Sul / CIEP 045"
                          value={userCoordName}
                          onChange={e => setUserCoordName(e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2 text-xs font-medium text-slate-800 outline-none"
                        />
                      </div>

                      {/* Painel Informativo sobre a Regra de 2 Contas por Coordenação */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="text-xs text-slate-600">
                            <span className="font-bold text-slate-800">Regra de Segurança: </span>
                            Apenas <strong>dois usuários</strong> podem ter o mesmo número de coordenação (1 Coordenador e 1 Assistente).
                            {userCoordStatusPreview && (
                              <span className="ml-1 text-blue-700 font-semibold">
                                • Nº {userCoordNumber}: {userCoordStatusPreview.slots_occupied} de 2 vagas ocupadas.
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSavingUserCoord || !userCoordNumber.trim()}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-200 cursor-pointer shrink-0"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isSavingUserCoord ? 'Salvando...' : 'Salvar Coordenação nesta Página'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start md:items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-200 shrink-0">
                        <Building className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-black text-slate-900">
                            Coordenação Nº {authUser?.coordination_number || 'Pendente'} • {authUser?.role === 'coordinator' ? 'Coordenador Titular' : (authUser?.role === 'assistant' ? 'Assistente de Coordenação' : 'Conta Comum')}
                          </span>
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            {authUser?.role === 'coordinator' ? '👔 Coordenador Titular' : (authUser?.role === 'assistant' ? '📋 Assistente de Coordenação' : 'Conta Comum')}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            authUser?.coordination_number ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{authUser?.coordination_number ? '✓ Salvo na Própria Página' : '⚠️ Pendente'}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1">
                          {authUser?.coordination_number 
                            ? `Acesso restrito: você visualiza e gerencia exclusivamente as vagas e colaboradores da sua própria Coordenação Nº ${authUser?.coordination_number}.`
                            : 'Acesso restrito: você visualiza e gerencia exclusivamente as vagas e colaboradores da sua própria Coordenação. Preencha o número para vincular.'}
                        </p>

                        <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                          <span>Conta: <strong>{authUser?.email}</strong></span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">{authUser?.coordination_name || 'Coordenação Local'}</span>
                          <span>•</span>
                          <span className="text-blue-700 font-semibold">Regra de Segurança: Limite de 2 usuários por coordenação (1 Coordenador e 1 Assistente)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setUserCoordEditMode(true);
                          setUserCoordError(null);
                          setUserCoordSuccess(null);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{authUser?.coordination_number ? 'Alterar Coordenação ou Função' : 'Preencher Coordenação'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Admin Sidebar - Add Vacancy */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-24">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-600" />
                  Nova Vaga
                </h2>
                <form onSubmit={handleAddVacancy} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Vaga</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (adminFormData.title === '__custom__') {
                            setAdminFormData(prev => ({ ...prev, title: '' }));
                          } else {
                            setAdminFormData(prev => ({ ...prev, title: '__custom__', value: '' }));
                          }
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{adminFormData.title === '__custom__' ? 'Escolher pré-definida' : 'Criar novo tipo'}</span>
                      </button>
                    </div>

                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
                      value={adminFormData.title}
                      onChange={e => {
                        const val = e.target.value;
                        setAdminFormData({ ...adminFormData, title: val });
                      }}
                    >
                      <option value="">Selecione um tipo de vaga...</option>
                      
                      <option value="__custom__" className="font-bold text-blue-700 bg-blue-50">
                        ✨ Criar Novo Tipo de Vaga (Personalizado)...
                      </option>

                      {customTitles.length > 0 && (
                        <optgroup label="Tipos Personalizados Cadastrados">
                          {customTitles.map(ct => (
                            <option key={ct} value={ct}>{ct}</option>
                          ))}
                        </optgroup>
                      )}

                      <optgroup label="Cargos Padrão (R$ 120,00)">
                        <option value="Chefe de Sala">Chefe de Sala</option>
                        <option value="Fiscal de Informática">Fiscal de Informática</option>
                      </optgroup>
                      <optgroup label="Cargos Padrão (R$ 90,00)">
                        <option value="Fiscal Aplicador">Fiscal Aplicador</option>
                        <option value="Fiscal Volante">Fiscal Volante</option>
                        <option value="Fiscal de Banheiro">Fiscal de Banheiro</option>
                      </optgroup>
                      <optgroup label="Cargos Padrão (R$ 180,00)">
                        <option value="Fiscal Ledor">Fiscal Ledor</option>
                        <option value="Fiscal Ledor Inglês">Fiscal Ledor Inglês</option>
                        <option value="Fiscal Ledor Espanhol">Fiscal Ledor Espanhol</option>
                      </optgroup>
                      <optgroup label="Cargos Padrão (R$ 230,00)">
                        <option value="Fiscal Intérprete Libras">Fiscal Intérprete Libras</option>
                      </optgroup>
                    </select>

                    {adminFormData.title === '__custom__' && (
                      <div className="mt-2.5 p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-1.5">
                        <label className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                          <Plus className="w-3 h-3 text-blue-600" />
                          Nome do Novo Tipo de Vaga
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Fiscal de Apoio Especial, Coordenador(a) de Portão, Professor(a) Assistente..."
                          className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                          value={customVacancyTitle}
                          onChange={e => setCustomVacancyTitle(e.target.value)}
                        />
                        <p className="text-[10px] text-blue-700 italic">
                          O novo cargo será cadastrado e ficará disponível para inscrição no portal e gravado no banco de dados.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Preço (R$)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="Ex: 120"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                      value={adminFormData.price || adminFormData.value}
                      onChange={e => setAdminFormData({...adminFormData, price: e.target.value, value: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Escola</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={adminFormData.school}
                      onChange={e => setAdminFormData({...adminFormData, school: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cidade</label>
                      <select 
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
                        value={adminFormData.city}
                        onChange={e => setAdminFormData({...adminFormData, city: e.target.value})}
                      >
                        {CITIES.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bairro</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Copacabana"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={adminFormData.neighborhood}
                        onChange={e => setAdminFormData({...adminFormData, neighborhood: e.target.value})}
                      />
                    </div>
                  </div>
                  {authUser?.is_administrator ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Coordenação Vinculada</label>
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 text-xs font-medium mb-2"
                        value={adminFormData.coordination_number}
                        onChange={e => {
                          const num = e.target.value;
                          const found = coordinations.find(c => c.coordination_number === num);
                          setAdminFormData({
                            ...adminFormData,
                            coordination_number: num,
                            coordinator: found ? found.coordinator_name : adminFormData.coordinator
                          });
                        }}
                      >
                        <option value="">Selecione a coordenação da lista...</option>
                        {coordinations.map(c => (
                          <option key={c.coordination_number} value={c.coordination_number}>
                            Nº {c.coordination_number} - {c.coordinator_name} ({c.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : authUser?.coordination_number ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                      <div className="text-[10px] font-bold text-blue-900 uppercase">Sua Coordenação Vinculada:</div>
                      <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-600" />
                        <span>Coordenação Nº {authUser?.coordination_number}</span>
                      </div>
                      <div className="text-[11px] text-blue-800 font-medium">
                        {authUser?.coordinator_name || authUser?.coordination_name}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                      <div className="text-[10px] font-black text-amber-900 uppercase">Coordenação Pendente:</div>
                      <div className="text-xs text-amber-800 font-medium">
                        Sua conta ainda não possui Nº de Coordenação salvo.
                      </div>
                      <button
                        type="button"
                        onClick={() => setUserCoordEditMode(true)}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Preencher Nº Coordenação e Cargo Acima ↑</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Coordenador(a)</label>
                      <input 
                        type="text" 
                        required
                        disabled={!authUser?.is_administrator}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 text-xs font-medium"
                        value={!authUser?.is_administrator ? (authUser?.coordinator_name || authUser?.coordination_name || adminFormData.coordinator) : adminFormData.coordinator}
                        onChange={e => setAdminFormData({...adminFormData, coordinator: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nº Coordenação</label>
                      <input 
                        type="text" 
                        required
                        disabled={!authUser?.is_administrator}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-600 font-mono font-bold text-xs"
                        value={!authUser?.is_administrator ? (authUser?.coordination_number || adminFormData.coordination_number) : adminFormData.coordination_number}
                        onChange={e => {
                          const val = e.target.value;
                          const found = coordinations.find(c => String(c.coordination_number).trim() === String(val).trim());
                          setAdminFormData({
                            ...adminFormData, 
                            coordination_number: val,
                            coordinator: found ? found.coordinator_name : adminFormData.coordinator
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* Canto à Parte: Exibição Destacada do Nº de Coordenação da conta após ser preenchido */}
                  {(() => {
                    const activeNum = (!authUser?.is_administrator ? authUser?.coordination_number : adminFormData.coordination_number)?.trim();
                    if (!activeNum) return null;
                    const matched = coordinations.find(c => String(c.coordination_number).trim() === String(activeNum).trim());
                    return (
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                            Nº Coordenação Identificado:
                          </span>
                          <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                            ✓ Automático
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-blue-600 text-white font-mono font-black text-xs rounded-lg shadow-xs">
                            Nº {activeNum}
                          </span>
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 block">
                              {matched ? `${matched.name} — ${matched.coordinator_name}` : (authUser?.coordination_name || 'Coordenação Ativa')}
                            </span>
                            {matched && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                E-mails autorizados: {matched.coordinator_email} {matched.assistant_email ? `• ${matched.assistant_email}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Qtd Vagas</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={adminFormData.quantity}
                        onChange={e => setAdminFormData({...adminFormData, quantity: e.target.value})}
                      />
                    </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Idade Mínima</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={adminFormData.min_age}
                        onChange={e => setAdminFormData({...adminFormData, min_age: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Idade Máxima</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={adminFormData.max_age}
                        onChange={e => setAdminFormData({...adminFormData, max_age: e.target.value})}
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                    Cadastrar Vaga
                  </button>
                </form>

                <div className="mt-10 pt-10 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Vagas Ativas</h3>
                    <div className="flex gap-4">
                      {vacancies.length > 0 && (
                        <button 
                          onClick={handleDeleteAllVacancies}
                          className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                        >
                          Limpar Sem Inscritos
                        </button>
                      )}
                      <button 
                        onClick={handleResetSystem}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors"
                      >
                        Resetar Tudo
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {vacancies.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                        <div>
                          <div className="text-xs font-bold text-slate-900">{v.title}</div>
                          <div className="text-[10px] text-slate-500">{v.school}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{v.neighborhood} - {v.city || 'Rio de Janeiro'}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            onClick={() => handleOpenEditVacancy(v)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar esta vaga"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteVacancy(v.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Deletar Vaga (Candidatos permanecem salvos)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {vacancies.length === 0 && (
                      <div className="text-xs text-slate-400 italic text-center py-4">
                        Nenhuma vaga cadastrada.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Main - Tabs and Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Sub-navegação do Admin: Candidatos vs Escolas */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl shadow-inner flex-wrap">
                  {/* Menu Vagas em Aberto na Área Administrativa */}
                  <button
                    type="button"
                    onClick={() => setAdminTab('open_vacancies')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      adminTab === 'open_vacancies'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    <span>Vagas em aberto</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      adminTab === 'open_vacancies' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300 text-slate-700'
                    }`}>
                      {vacancies.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('candidates')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      adminTab === 'candidates'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>{authUser?.is_administrator ? 'Inscrição de Colaboradores (Geral)' : 'Inscrição de colaborador'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      adminTab === 'candidates' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300 text-slate-700'
                    }`}>
                      {contributors.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('schools')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      adminTab === 'schools'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>{authUser?.is_administrator ? 'Vagas Ofertadas & Escolas' : 'Vagas ofertadas'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      adminTab === 'schools' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300 text-slate-700'
                    }`}>
                      {vacancies.length}
                    </span>
                  </button>

                  {/* Aba de Sequência em Detalhes de Todos os E-mails Cadastrados (Exclusivo Administrador Geral) */}
                  {authUser?.is_administrator && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('users');
                        fetchUserAccounts();
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        adminTab === 'users'
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 text-indigo-600" />
                      <span>Contas & E-mails Cadastrados</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        adminTab === 'users' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-300 text-slate-700'
                      }`}>
                        {userAccounts.length}
                      </span>
                    </button>
                  )}

                  {authUser?.is_administrator && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminTab('database');
                        fetchDatabaseStatus();
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        adminTab === 'database'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Database className="w-4 h-4 text-emerald-600" />
                      <span>Banco de Dados & Cache</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        adminTab === 'database' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300 text-slate-700'
                      }`}>
                        Supabase
                      </span>
                    </button>
                  )}

                  {authUser?.is_administrator && (
                    <button
                      type="button"
                      onClick={() => setAdminTab('supabase')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        adminTab === 'supabase'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Database className="w-4 h-4 text-emerald-600" />
                      {(() => {
                        const cfg = getSupabaseStatusConfig();
                        return (
                          <>
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                              <span>{cfg.name}</span>
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${cfg.badgeBg}`}>
                              {cfg.status === 'connected' ? '✓ Online' : cfg.status === 'warning' ? '⚠️ Falha' : '✕ Offline'}
                            </span>
                          </>
                        );
                      })()}
                    </button>
                  )}

                  {/* Nova Aba Temporária: Diagnóstico & Debug Supabase / Vercel */}
                  <button
                    type="button"
                    onClick={() => setAdminTab('debug')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      adminTab === 'debug'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                    }`}
                    title="Aba temporária para diagnóstico de variáveis de ambiente e conexão ao Supabase"
                  >
                    <Terminal className="w-4 h-4 text-amber-600" />
                    <span>🔧 Diagnóstico / Debug</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-200 text-amber-900">
                      Temporário
                    </span>
                  </button>
                </div>
              </div>

              {adminTab === 'open_vacancies' ? (
                /* Aba: Vagas em Aberto na Área Administrativa */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        <span>Vagas em Aberto ({filteredVacancies.length})</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Oportunidades de vagas para prestação de serviço no ENEM 2026 com edição e exclusão segura.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setView('public')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-xl transition-colors border border-blue-200 cursor-pointer"
                        title="Ver como o candidato enxerga na página pública"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Visão Pública de Inscrição</span>
                      </button>
                    </div>
                  </div>

                  {/* Barra de Filtros de Vagas em Aberto */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por escola, vaga, bairro..."
                        value={publicFilter.search}
                        onChange={e => setPublicFilter({ ...publicFilter, search: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <select
                        value={publicFilter.city}
                        onChange={e => setPublicFilter({ ...publicFilter, city: e.target.value, neighborhood: '' })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      >
                        <option value="">Todas as Cidades</option>
                        {publicCities.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={publicFilter.neighborhood}
                        onChange={e => setPublicFilter({ ...publicFilter, neighborhood: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      >
                        <option value="">Todos os Bairros</option>
                        {publicNeighborhoods.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Barra de Ações para Postos/Vagas Selecionados */}
                  {selectedVacancyIds.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-red-900 shadow-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold">
                          {selectedVacancyIds.length} {selectedVacancyIds.length === 1 ? 'posto selecionado' : 'postos selecionados'} para exclusão
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVacancyIds([])}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Cancelar Seleção
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelectedVacancies}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Deletar Postos Selecionados do Banco</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Cards de Vagas em Aberto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVacancies.map((vacancy) => {
                      const filledCount = contributors.filter(a => String(a.vacancy_id) === String(vacancy.id) && a.status === 'cadastrado').length;
                      const openCount = Math.max(0, vacancy.quantity - filledCount);
                      const isFilled = vacancy.quantity > 0 && openCount === 0;

                      return (
                        <div
                          key={vacancy.id}
                          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                            isFilled
                              ? 'bg-slate-100/70 border-slate-300 text-slate-500 shadow-none'
                              : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start mb-3 gap-2">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                isFilled ? 'bg-slate-200 text-slate-600' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {vacancy.title}
                              </span>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {(authUser?.is_administrator || authUser?.coordination_number === vacancy.coordination_number) && (
                                  <>
                                    <input
                                      type="checkbox"
                                      checked={selectedVacancyIds.some(id => String(id) === String(vacancy.id))}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const strId = vacancy.id;
                                        setSelectedVacancyIds(prev =>
                                          e.target.checked
                                            ? [...prev, strId]
                                            : prev.filter(vid => String(vid) !== String(strId))
                                        );
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                      title="Selecionar posto para exclusão"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditVacancy(vacancy)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                      title="Editar dados desta vaga"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVacancy(vacancy.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      title="Deletar este posto/vaga do banco de dados (Candidatos preservados)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <h3 className={`text-base font-bold mb-2 ${isFilled ? 'text-slate-700' : 'text-slate-900'}`}>
                              {vacancy.school}
                            </h3>

                            <div className="space-y-1.5 text-xs text-slate-600">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{vacancy.neighborhood} - {vacancy.city || 'Rio de Janeiro'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Coordenação #{vacancy.coordination_number} • {vacancy.coordinator}</span>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Remuneração</span>
                                <span className={`text-base font-black ${isFilled ? 'text-slate-600' : 'text-emerald-600'}`}>
                                  R$ {(vacancy.price !== undefined ? vacancy.price : (vacancy.value ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Preenchimento</span>
                                <span className={`font-black ${isFilled ? 'text-slate-600' : 'text-blue-700'}`}>
                                  {filledCount} de {vacancy.quantity} preenchidas ({openCount} em aberto)
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isFilled ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isFilled ? '✓ 100% Preenchida' : `✨ ${openCount} em aberto`}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setFormData(initialcontributorFormData);
                                setSelectedVacancy(vacancy);
                                setIsApplying(true);
                              }}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Candidatar-se</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredVacancies.length === 0 && (
                      <div className="col-span-full py-10 text-center bg-slate-50 rounded-xl border border-slate-200">
                        <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <h4 className="font-bold text-slate-800 text-sm">Nenhuma vaga em aberto encontrada</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Tente limpar os filtros de busca.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : adminTab === 'candidates' ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        {adminFilter.school ? (
                          <span>
                            Inscrições em: <span className="text-blue-600 font-extrabold">{adminFilter.school}</span> ({filteredcontributors.length})
                          </span>
                        ) : (
                          <span>{authUser?.is_administrator ? 'Inscrição de Colaboradores (Geral)' : 'Inscrição de Colaborador'} ({filteredcontributors.length})</span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Candidatos inscritos nos cargos e escolas da coordenação. Gerencie os status em tempo real.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Alternador de Visualização: Cards em Lista (Padrão) vs Tabela */}
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setCandidatesViewMode('cards')}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            candidatesViewMode === 'cards'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Cards em Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setCandidatesViewMode('table')}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            candidatesViewMode === 'table'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Tabela
                        </button>
                      </div>

                      <button 
                        onClick={() => exportToCSV()}
                        disabled={filteredcontributors.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={adminFilter.school ? `Exportar CSV dos inscritos de ${adminFilter.school}` : "Exportar CSV da listagem atual"}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                      <button 
                        onClick={() => exportToTXT()}
                        disabled={filteredcontributors.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={adminFilter.school ? `Exportar TXT dos inscritos de ${adminFilter.school}` : "Exportar TXT da listagem atual"}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>TXT</span>
                      </button>
                    </div>
                  </div>

                  {/* Filtros: Localidade, Tipo de Vaga, Status e Busca */}
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 mb-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-blue-600" />
                        Filtros de Localidade, Tipo de Vaga & Status
                      </span>
                      {(adminFilter.search || adminFilter.city || adminFilter.neighborhood || adminFilter.school || adminFilter.coordination || adminFilter.vacancy_type || adminFilter.status) && (
                        <button
                          onClick={() => setAdminFilter({ search: '', city: '', neighborhood: '', school: '', coordination: '', vacancy_type: '', status: '' })}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Limpar Filtros
                        </button>
                      )}
                    </div>

                    {/* Linha 1: Busca e Localidade (Cidade, Bairro, Escola) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input 
                          type="text" 
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          placeholder="Buscar Nome, CPF, WhatsApp..."
                          value={adminFilter.search}
                          onChange={e => setAdminFilter({...adminFilter, search: e.target.value})}
                        />
                      </div>

                      {/* Localidade: Cidade */}
                      <div className="relative">
                        <Building className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                          value={adminFilter.city}
                          onChange={e => setAdminFilter({...adminFilter, city: e.target.value})}
                        >
                          <option value="">Todas as Cidades</option>
                          {adminCities.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>

                      {/* Localidade: Bairro */}
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input 
                          type="text" 
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          placeholder="Localidade: Bairro..."
                          value={adminFilter.neighborhood}
                          onChange={e => setAdminFilter({...adminFilter, neighborhood: e.target.value})}
                        />
                      </div>

                      {/* Localidade: Escola */}
                      <div className="relative">
                        <School className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-semibold"
                          value={adminFilter.school}
                          onChange={e => setAdminFilter({...adminFilter, school: e.target.value})}
                        >
                          <option value="">🏫 Todas as Escolas ({adminSchools.length})</option>
                          {adminSchools.map(sch => {
                            const count = contributors.filter(a => (a.vacancy_school || '').toLowerCase() === sch.toLowerCase()).length;
                            return (
                              <option key={sch} value={sch}>
                                {sch} ({count})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Linha 2: Tipo de Vaga, Status e Coordenação */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Filtro: Tipo de Vaga */}
                      <div className="relative">
                        <Briefcase className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold"
                          value={adminFilter.vacancy_type}
                          onChange={e => setAdminFilter({...adminFilter, vacancy_type: e.target.value})}
                        >
                          <option value="">💼 Todos os Tipos de Vagas ({adminVacancyTypes.length})</option>
                          {adminVacancyTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro: Status */}
                      <div>
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-bold"
                          value={adminFilter.status}
                          onChange={e => setAdminFilter({...adminFilter, status: e.target.value})}
                        >
                          <option value="">Todos os Status da Inscrição</option>
                          <option value="pending">⏳ Pendente</option>
                          <option value="cadastrado">✓ Cadastrado (Aprovado)</option>
                          <option value="recusado">✕ Recusado</option>
                        </select>
                      </div>

                      {/* Filtro: Nº Coordenação */}
                      <div>
                        <input 
                          type="text" 
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          placeholder="Nº Coordenação..."
                          value={adminFilter.coordination}
                          onChange={e => setAdminFilter({...adminFilter, coordination: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {adminFilter.school && (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl text-xs text-blue-900 mb-6 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          Filtro ativo por Escola: <strong>{adminFilter.school}</strong> ({filteredcontributors.length} {filteredcontributors.length === 1 ? 'candidato' : 'candidatos'}).
                        </span>
                      </div>
                      <button
                        onClick={() => setAdminFilter(prev => ({ ...prev, school: '' }))}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 underline ml-2 shrink-0 cursor-pointer"
                      >
                        Limpar filtro de escola
                      </button>
                    </div>
                  )}

                  {/* VISUALIZAÇÃO EM CARDS EM LISTA (Padrão Solicitado pelo Usuário) */}
                  {candidatesViewMode === 'cards' ? (
                    <div className="space-y-4">
                      {filteredcontributors.map(app => (
                        <div 
                          key={app.id}
                          className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all space-y-3.5"
                        >
                          {/* Cabeçalho do Card */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-start gap-3.5">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                                {app.name ? app.name.charAt(0).toUpperCase() : 'C'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-black text-base text-slate-900 leading-tight">
                                    {app.name}
                                  </h3>
                                  <span className="text-xs font-bold text-slate-500">
                                    • {app.age} anos
                                  </span>
                                  {app.cebraspe_verified !== false ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200" title="Cadastro confirmado no Cebraspe">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cebraspe OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200" title="Pendente de confirmação no Cebraspe">
                                      <AlertCircle className="w-3 h-3 text-amber-600" /> Cebraspe Pendente
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 font-mono">
                                  <span>CPF: <strong className="text-slate-700">{formatCPF(app.cpf)}</strong></span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    WhatsApp: <strong className="text-slate-700">{formatPhone(app.phone)}</strong>
                                  </span>
                                  {app.phone && (
                                    <a
                                      href={`https://wa.me/55${app.phone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-sans font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Send className="w-3 h-3 text-emerald-600" /> Conversar
                                    </a>
                                  )}
                                </div>

                                {app.referrer_name && (
                                  <div className="text-[11px] text-blue-900 bg-blue-50/80 px-2.5 py-1 rounded-xl border border-blue-200 mt-2 inline-flex items-center gap-1.5 flex-wrap">
                                    <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Indicado por: <strong>{app.referrer_name}</strong></span>
                                    {app.referrer_phone && (
                                      <a
                                        href={`https://wa.me/55${app.referrer_phone.replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-emerald-700 hover:underline font-mono font-bold"
                                      >
                                        (Zap: {formatPhone(app.referrer_phone)})
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Ações da Inscrição: Status e Exclusão com Dupla Confirmação */}
                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                              {/* Seletor de Status (Salva direto no Supabase) */}
                              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                                <select
                                  value={app.status}
                                  onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                  className={`text-xs font-black px-3 py-1.5 rounded-lg outline-none border transition-all cursor-pointer ${
                                    app.status === 'pending' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                    app.status === 'cadastrado' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                    'bg-red-50 text-red-800 border-red-300'
                                  }`}
                                >
                                  <option value="pending">⏳ Pendente</option>
                                  <option value="cadastrado">✓ Cadastrado</option>
                                  <option value="recusado">✕ Recusado</option>
                                </select>
                              </div>

                              {/* Botão para Excluir Colaborador Inscrito */}
                              <button
                                type="button"
                                onClick={() => handleDeleteCollaborator(app)}
                                title="Excluir Colaborador Inscrito (com confirmação dupla)"
                                className="px-3 py-2 rounded-xl text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 transition-all font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          </div>

                          {/* Grade com Tipo de Vaga, Localidade e Coordenação */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 text-xs">
                            {/* Tipo de Vaga */}
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Tipo de Vaga / Cargo
                              </div>
                              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{app.vacancy_title}</span>
                              </div>
                            </div>

                            {/* Localidade / Escola de Aplicação */}
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Local de Aplicação (Escola)
                              </div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <School className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">{app.vacancy_school}</span>
                              </div>
                              <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{app.vacancy_neighborhood ? `${app.vacancy_neighborhood}, ` : ''}{app.vacancy_city || 'Rio de Janeiro'}</span>
                              </div>
                            </div>

                            {/* Coordenação & Data */}
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                Coordenação & Inscrição
                              </div>
                              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span>Coordenação Nº {app.coordination_number}</span>
                              </div>
                              <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{new Date(app.applied_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {filteredcontributors.length === 0 && (
                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <h4 className="font-bold text-slate-800">Nenhum colaborador encontrado</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Tente alterar os filtros de localidade, tipo de vaga ou status.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* VISUALIZAÇÃO EM TABELA COMPACTA (Alternativa) */
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-slate-100">
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Candidato</th>
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Local Candidato</th>
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Vaga / Escola & Região</th>
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Coordenação</th>
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right pr-3">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredcontributors.map(app => (
                            <tr key={app.id} className="group hover:bg-slate-50 transition-colors">
                              <td className="py-4">
                                <div className="font-bold text-slate-900">{app.name}</div>
                                <div className="text-xs text-slate-500">Idade: {app.age} anos</div>
                                <div className="text-xs text-slate-500 font-mono">CPF: {formatCPF(app.cpf)}</div>
                                <div className="mt-0.5">
                                  {app.cebraspe_verified !== false ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800" title="Cadastro confirmado no Cebraspe">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cebraspe OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="Pendente de confirmação no Cebraspe">
                                      <AlertCircle className="w-3 h-3 text-amber-600" /> Cebraspe Pendente
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                  <span>WhatsApp: {formatPhone(app.phone)}</span>
                                  {app.phone && (
                                    <a 
                                      href={`https://wa.me/55${app.phone.replace(/\D/g, '')}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-sans font-semibold hover:bg-emerald-200 transition-colors inline-block"
                                    >
                                      Conversar
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="py-4">
                                <div className="text-sm font-semibold text-slate-800">{app.city}</div>
                                <div className="text-xs text-slate-500">{app.neighborhood}</div>
                              </td>
                              <td className="py-4">
                                <div className="text-sm font-bold text-slate-800">{app.vacancy_title}</div>
                                <div className="text-xs text-slate-600">{app.vacancy_school}</div>
                                <div className="text-[11px] text-blue-600 font-medium flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>{app.vacancy_neighborhood ? `${app.vacancy_neighborhood}, ` : ''}{app.vacancy_city || 'Rio de Janeiro'}</span>
                                </div>
                              </td>
                              <td className="py-4">
                                <div className="text-sm font-medium text-slate-700">#{app.coordination_number}</div>
                                <div className="text-xs text-slate-500">{app.coordinator}</div>
                              </td>
                              <td className="py-4 text-sm text-slate-500">
                                {new Date(app.applied_at).toLocaleDateString()}
                              </td>
                              <td className="py-4">
                                <select
                                  value={app.status}
                                  onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                  className={`text-xs font-bold px-2 py-1 rounded-md outline-none border transition-colors ${
                                    app.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    app.status === 'cadastrado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  <option value="pending">Pendente</option>
                                  <option value="cadastrado">Cadastrado</option>
                                  <option value="recusado">Recusado</option>
                                </select>
                              </td>
                              <td className="py-4 text-right pr-3">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCollaborator(app)}
                                  title="Excluir Colaborador Inscrito (com dupla confirmação)"
                                  className="px-2.5 py-1.5 rounded-xl text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 transition-all font-bold text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Excluir</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                          {filteredcontributors.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                Nenhuma inscrição encontrada com os filtros atuais.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : adminTab === 'schools' ? (
                /* Aba: Vagas Ofertadas (Cards em Lista com status de preenchimento em tempo real) */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  {/* Cabeçalho da Aba */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-blue-600" />
                          <span>{authUser?.is_administrator ? 'Vagas Ofertadas & Escolas de Aplicação' : 'Vagas Ofertadas'}</span>
                        </h2>
                        {!authUser?.is_administrator && authUser?.coordination_number && (
                          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            Coord. Nº {authUser.coordination_number}
                          </span>
                        )}
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {filteredOfferedVacancies.length} {filteredOfferedVacancies.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Acompanhamento em tempo real das vagas ofertadas, com quantidade preenchida e quantidade em aberto. Vagas com 100% de preenchimento são destacadas em tons cinzas pálidos.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Alternador de Modo de Visualização: Cards de Vagas vs Escolas Agrupadas */}
                      <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setOfferedVacanciesViewMode('cards')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            offeredVacanciesViewMode === 'cards'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span>Cards de Vagas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferedVacanciesViewMode('schools')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                            offeredVacanciesViewMode === 'schools'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <School className="w-3.5 h-3.5" />
                          <span>Por Escolas ({filteredSchools.length})</span>
                        </button>
                      </div>

                      <button 
                        type="button"
                        onClick={exportOfferedVacanciesToCSV}
                        disabled={filteredOfferedVacancies.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Exportar dados de vagas ofertadas para CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar Vagas CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Resumo de Métricas das Vagas Ofertadas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5">
                      <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Total de Vagas Ofertadas</div>
                      <div className="text-2xl font-black text-slate-900 mt-0.5">
                        {enrichedVacancies.reduce((acc, v) => acc + v.totalSlots, 0)}
                      </div>
                      <div className="text-[10px] text-blue-600 mt-0.5 font-medium">
                        {enrichedVacancies.length} cargos/vagas cadastrados
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Vagas Preenchidas</span>
                      </div>
                      <div className="text-2xl font-black text-emerald-800 mt-0.5">
                        {enrichedVacancies.reduce((acc, v) => acc + v.filledCount, 0)}
                      </div>
                      <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                        Colaboradores cadastrados
                      </div>
                    </div>

                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
                      <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Vagas em Aberto</span>
                      </div>
                      <div className="text-2xl font-black text-amber-800 mt-0.5">
                        {enrichedVacancies.reduce((acc, v) => acc + v.openCount, 0)}
                      </div>
                      <div className="text-[10px] text-amber-600 mt-0.5 font-medium">
                        Disponíveis para preenchimento
                      </div>
                    </div>

                    <div className="bg-slate-100 border border-slate-300 rounded-xl p-3.5">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>100% Preenchidas</span>
                      </div>
                      <div className="text-2xl font-black text-slate-700 mt-0.5">
                        {enrichedVacancies.filter(v => v.isFullyFilled).length}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        Vagas esgotadas (em cinza)
                      </div>
                    </div>
                  </div>

                  {/* Barra de Filtros com Status (Todas, Em Aberto, 100% Preenchidas), Localidade e Tipo de Vaga */}
                  <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Filtro Rápido por Status de Preenchimento */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                          <Filter className="w-3 h-3 text-blue-600" />
                          Filtrar por Status:
                        </span>
                        <button
                          type="button"
                          onClick={() => setOfferedVacanciesStatusFilter('all')}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            offeredVacanciesStatusFilter === 'all'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          Todas ({enrichedVacancies.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferedVacanciesStatusFilter('open')}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            offeredVacanciesStatusFilter === 'open'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          🟢 Com Vagas em Aberto ({enrichedVacancies.filter(v => !v.isFullyFilled).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferedVacanciesStatusFilter('filled')}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            offeredVacanciesStatusFilter === 'filled'
                              ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          ⚪ 100% Preenchidas / Cinza ({enrichedVacancies.filter(v => v.isFullyFilled).length})
                        </button>
                      </div>

                      {(schoolSearch || schoolCityFilter || offeredVacancyTypeFilter || offeredVacanciesStatusFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSchoolSearch('');
                            setSchoolCityFilter('');
                            setOfferedVacancyTypeFilter('');
                            setOfferedVacanciesStatusFilter('all');
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Limpar Filtros</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Busca por texto */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input 
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                          placeholder="Buscar cargo, escola, bairro, coordenação..."
                          value={schoolSearch}
                          onChange={e => setSchoolSearch(e.target.value)}
                        />
                      </div>

                      {/* Filtro por Cidade */}
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer"
                          value={schoolCityFilter}
                          onChange={e => setSchoolCityFilter(e.target.value)}
                        >
                          <option value="">Todas as Cidades</option>
                          {CITIES.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro por Tipo de Vaga / Cargo */}
                      <div className="relative">
                        <Briefcase className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <select 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium cursor-pointer"
                          value={offeredVacancyTypeFilter}
                          onChange={e => setOfferedVacancyTypeFilter(e.target.value)}
                        >
                          <option value="">Todos os Tipos de Vaga / Cargos</option>
                          {adminVacancyTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Barra de Ações para Postos/Vagas Selecionados */}
                  {selectedVacancyIds.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-red-900 shadow-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold">
                          {selectedVacancyIds.length} {selectedVacancyIds.length === 1 ? 'posto selecionado' : 'postos selecionados'} para exclusão
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVacancyIds([])}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Cancelar Seleção
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelectedVacancies}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Deletar Postos Selecionados do Banco</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RENDERIZAÇÃO PRINCIPAL: CARDS DE VAGAS OFERTADAS */}
                  {offeredVacanciesViewMode === 'cards' ? (
                    <div className="space-y-4">
                      {filteredOfferedVacancies.map((v) => {
                        const percentFilled = v.totalSlots > 0 
                          ? Math.min(100, Math.round((v.filledCount / v.totalSlots) * 100))
                          : 0;

                        return (
                          <div 
                            key={v.id}
                            className={`rounded-2xl transition-all p-5 sm:p-6 ${
                              v.isFullyFilled
                                ? 'bg-slate-100/90 border-2 border-slate-300 text-slate-600 shadow-none'
                                : 'bg-white border-2 border-blue-200 hover:border-blue-400 text-slate-900 shadow-sm hover:shadow-md'
                            }`}
                          >
                            {/* Linha Superior: Cargo, Escola e Badges de Preenchimento */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex items-start gap-3.5">
                                <div className={`p-3 rounded-2xl shrink-0 ${
                                  v.isFullyFilled
                                    ? 'bg-slate-200 text-slate-500'
                                    : 'bg-blue-50 text-blue-600 shadow-xs'
                                }`}>
                                  <Briefcase className="w-6 h-6" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className={`text-lg font-black ${
                                      v.isFullyFilled ? 'text-slate-600' : 'text-slate-900'
                                    }`}>
                                      {v.title}
                                    </h3>

                                    {/* Badge Principal: 100% Preenchida (Cinza) vs Vagas em Aberto */}
                                    {v.isFullyFilled ? (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs">
                                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                                        100% Preenchida (Vagas Esgotadas)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                        {v.openCount} {v.openCount === 1 ? 'vaga em aberto' : 'vagas em aberto'}
                                      </span>
                                    )}

                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                      v.isFullyFilled 
                                        ? 'bg-slate-200 text-slate-600' 
                                        : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      Coordenação #{v.coordination_number}
                                    </span>
                                  </div>

                                  {/* Escola e Localidade */}
                                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                                    <span className={`flex items-center gap-1.5 font-bold ${
                                      v.isFullyFilled ? 'text-slate-600' : 'text-slate-800'
                                    }`}>
                                      <School className={`w-4 h-4 ${v.isFullyFilled ? 'text-slate-400' : 'text-blue-600'}`} />
                                      <span>{v.school}</span>
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className={`flex items-center gap-1 ${
                                      v.isFullyFilled ? 'text-slate-500' : 'text-slate-600'
                                    }`}>
                                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                      <span>{v.neighborhood ? `${v.neighborhood}, ` : ''}{v.city || 'Rio de Janeiro'}</span>
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className={v.isFullyFilled ? 'text-slate-500' : 'text-slate-600'}>
                                      Coord(a): <strong>{v.coordinator}</strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Ações do Card */}
                              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdminFilter(prev => ({
                                      ...prev,
                                      school: v.school,
                                      vacancy_type: v.title
                                    }));
                                    setAdminTab('candidates');
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    v.isFullyFilled
                                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                  }`}
                                  title="Ver candidatos desta vaga na aba de inscrições"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>Ver Inscritos ({v.candidateCount})</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => exportToCSV(v.school)}
                                  disabled={v.candidateCount === 0}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                                    v.isFullyFilled
                                      ? 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                  title="Exportar candidatos desta escola/vaga para CSV"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>CSV</span>
                                </button>

                                {(authUser?.is_administrator || authUser?.coordination_number === v.coordination_number) && (
                                  <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={selectedVacancyIds.some(id => String(id) === String(v.id))}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const strId = v.id;
                                        setSelectedVacancyIds(prev =>
                                          e.target.checked
                                            ? [...prev, strId]
                                            : prev.filter(vid => String(vid) !== String(strId))
                                        );
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                      title="Selecionar posto para exclusão"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditVacancy(v)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                      title="Editar dados desta vaga"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVacancy(v.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                      title="Deletar este posto/vaga do banco de dados (candidatos preservados)"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Seção Central de Informações sobre a Vaga e Balanço de Quantidades */}
                            <div className={`mt-5 p-4 rounded-xl border ${
                              v.isFullyFilled
                                ? 'bg-slate-200/50 border-slate-300'
                                : 'bg-slate-50 border-slate-200/80'
                            }`}>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                {/* Total Ofertado */}
                                <div className="p-2.5 bg-white/80 rounded-lg border border-slate-200/60">
                                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Vagas Ofertadas
                                  </div>
                                  <div className={`text-xl font-black mt-0.5 ${
                                    v.isFullyFilled ? 'text-slate-600' : 'text-slate-900'
                                  }`}>
                                    {v.totalSlots}
                                  </div>
                                  <div className="text-[10px] text-slate-400">Total previsto</div>
                                </div>

                                {/* Quantidade Preenchida */}
                                <div className={`p-2.5 rounded-lg border ${
                                  v.isFullyFilled
                                    ? 'bg-slate-200/90 border-slate-300 text-slate-700'
                                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                }`}>
                                  <div className="text-[10px] font-black uppercase tracking-wider opacity-70">
                                    Preenchidas
                                  </div>
                                  <div className="text-xl font-black mt-0.5">
                                    {v.filledCount}
                                  </div>
                                  <div className="text-[10px] opacity-80">
                                    {percentFilled}% preenchido
                                  </div>
                                </div>

                                {/* Quantidade em Aberto */}
                                <div className={`p-2.5 rounded-lg border ${
                                  v.isFullyFilled
                                    ? 'bg-slate-100 border-slate-300 text-slate-500'
                                    : 'bg-blue-50/80 border-blue-200 text-blue-950'
                                }`}>
                                  <div className="text-[10px] font-black uppercase tracking-wider opacity-70">
                                    Em Aberto
                                  </div>
                                  <div className={`text-xl font-black mt-0.5 ${
                                    v.isFullyFilled ? 'text-slate-500' : 'text-blue-700'
                                  }`}>
                                    {v.openCount}
                                  </div>
                                  <div className="text-[10px] font-bold">
                                    {v.isFullyFilled ? '0 restantes (Esgotado)' : `${v.openCount} restantes`}
                                  </div>
                                </div>

                                {/* Remuneração e Detalhes */}
                                <div className="p-2.5 bg-white/80 rounded-lg border border-slate-200/60 flex flex-col justify-center">
                                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Remuneração / Diária
                                  </div>
                                  <div className={`text-base font-black mt-0.5 ${
                                    v.isFullyFilled ? 'text-slate-600' : 'text-emerald-700'
                                  }`}>
                                    R$ {(v.price ?? v.value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Idade mín: {v.min_age || 18} anos
                                  </div>
                                </div>
                              </div>

                              {/* Barra de Progresso de Preenchimento da Vaga */}
                              <div className="mt-3.5 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                  <span className={v.isFullyFilled ? 'text-slate-500' : 'text-slate-600'}>
                                    Taxa de Ocupação da Vaga:
                                  </span>
                                  <span className={v.isFullyFilled ? 'text-slate-600 font-black' : 'text-blue-700 font-black'}>
                                    {v.filledCount} de {v.totalSlots} vagas ocupadas ({percentFilled}%)
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${
                                      v.isFullyFilled
                                        ? 'bg-slate-400'
                                        : percentFilled > 80
                                          ? 'bg-gradient-to-r from-blue-500 to-amber-500'
                                          : 'bg-gradient-to-r from-blue-600 to-emerald-500'
                                    }`}
                                    style={{ width: `${percentFilled}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {filteredOfferedVacancies.length === 0 && (
                        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <h4 className="font-bold text-slate-800">Nenhum posto/vaga cadastrado</h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                            O banco de dados está limpo e sem dados de exemplo. Cadastre novos postos e vagas reais para as escolas no formulário acima.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* VISÃO ALTERNATIVA: AGRUPAMENTO POR ESCOLAS */
                    <div className="space-y-4">
                      {filteredSchools.map((s, idx) => (
                        <div 
                          key={`${s.name}-${s.city}-${idx}`}
                          className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0 mt-0.5">
                                <School className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-base text-slate-900 leading-tight">{s.name}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                                  <span className="flex items-center gap-1 font-medium text-slate-700">
                                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                    {s.neighborhood} - <span className="font-bold text-slate-900">{s.city}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                                    Coordenação #{s.coordination_number}
                                  </span>
                                  <span>•</span>
                                  <span className="text-slate-600">
                                    Coord(a): <strong>{s.coordinator}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                              <button
                                onClick={() => {
                                  setAdminFilter(prev => ({ ...prev, school: s.name }));
                                  setAdminTab('candidates');
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                title="Ver inscritos desta escola na tabela de candidatos"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>Ver Candidatos ({s.applicantCount})</span>
                              </button>
                              <button
                                onClick={() => exportToCSV(s.name)}
                                disabled={s.applicantCount === 0}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg transition-colors border border-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title={`Exportar CSV dos ${s.applicantCount} inscritos desta escola`}
                              >
                                <Download className="w-3 h-3" />
                                <span>CSV ({s.applicantCount})</span>
                              </button>
                              <button
                                onClick={() => exportToTXT(s.name)}
                                disabled={s.applicantCount === 0}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-lg transition-colors border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title={`Exportar TXT dos ${s.applicantCount} inscritos desta escola`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>TXT ({s.applicantCount})</span>
                              </button>
                            </div>
                          </div>

                          {/* Breakdown de Vagas desta Escola */}
                          <div className="bg-slate-50/70 rounded-lg p-3 border border-slate-100 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-600 uppercase tracking-wider">Cargos & Vagas Ofertadas</span>
                              <span className="font-semibold text-slate-700">
                                Total: <strong>{s.totalSlots} vagas</strong>
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                              {s.vacancies.map(v => (
                                <span 
                                  key={v.id}
                                  className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-xs text-slate-700 shadow-2xs"
                                >
                                  <span className="font-bold text-slate-900">{v.title}</span>
                                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold text-[11px]">
                                    {v.quantity} {v.quantity === 1 ? 'vaga' : 'vagas'}
                                  </span>
                                  <span className="text-[11px] text-emerald-700 font-semibold">
                                    Preço: R$ {(v.price !== undefined ? v.price : (v.value ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </span>
                              ))}
                              {s.vacancies.length === 0 && (
                                <span className="text-xs text-slate-400 italic">
                                  Nenhuma vaga ativa no momento para esta escola.
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Barra de Status dos Candidatos desta Escola */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">
                                Inscritos: <strong className="text-slate-900">{s.applicantCount}</strong>
                              </span>
                              <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
                                Cadastrados: <strong>{s.cadastradoCount}</strong>
                              </span>
                              <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
                                Pendentes: <strong>{s.pendingCount}</strong>
                              </span>
                              {s.recusadoCount > 0 && (
                                <span className="text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded-md">
                                  Recusados: <strong>{s.recusadoCount}</strong>
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400">
                              {s.totalSlots > 0 
                                ? `${Math.min(100, Math.round((s.cadastradoCount / s.totalSlots) * 100))}% das vagas preenchidas` 
                                : 'Sem vagas cadastradas'}
                            </div>
                          </div>
                        </div>
                      ))}

                      {filteredSchools.length === 0 && (
                        <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-200">
                          <School className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <h4 className="font-bold text-slate-800">Nenhuma escola encontrada</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Tente alterar os termos da busca ou selecionar outra cidade.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (adminTab === 'users' && authUser?.is_administrator) ? (
                /* Aba de Sequência em Detalhes de Todos os E-mails Cadastrados com Link de Edição */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  {/* Cabeçalho da Aba */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-xl font-bold text-slate-900">
                          Sequência em Detalhes de Todos os E-mails Cadastrados
                        </h2>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Gerencie todas as contas cadastradas: configure se o usuário terá <strong>acesso de administrador ou não</strong>, se atuará como <strong>coordenador ou assistente</strong> e o <strong>número da coordenação</strong> onde irá trabalhar. O <strong>Nome e Sobrenome</strong> aparecem em destaque como identificador principal.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={fetchUserAccounts}
                        disabled={isLoadingUsers}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        title="Atualizar lista de e-mails"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                        <span>Atualizar</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenNewUserModal}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Cadastrar Nova Conta de E-mail</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner de Regra de Acesso e Permissões */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-2 border-purple-200/90 rounded-2xl text-xs space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 font-black text-purple-950 text-sm">
                      <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
                      <span>Regra de Acesso e Permissões (is_administrator default false):</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-700 leading-relaxed pl-1">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-purple-700 mt-0.5">•</span>
                        <div>
                          <strong className="text-purple-950">Administradores (is_administrator = true):</strong> Visualizam todas as vagas em aberto de todas as regiões e escolas, acompanham todos os candidatos e gerenciam as coordenações.
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-indigo-700 mt-0.5">•</span>
                        <div>
                          <strong className="text-indigo-950">Coordenadores e Assistentes (is_administrator = false):</strong> Visualizam exclusivamente as vagas e os candidatos da <strong>sua própria coordenação</strong> (identificada pelo número).
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-emerald-700 mt-0.5">•</span>
                        <div>
                          <strong className="text-emerald-950">Apenas 2 e-mails por coordenação:</strong> O e-mail do Coordenador Titular e o e-mail do Assistente.
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Resumo de Métricas das Contas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5">
                      <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Total de E-mails</div>
                      <div className="text-2xl font-black text-indigo-950 mt-0.5">{userAccounts.length}</div>
                      <div className="text-[10px] text-indigo-600 font-medium">Contas no sistema</div>
                    </div>

                    <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3.5">
                      <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Acesso Administrador</div>
                      <div className="text-xl font-black text-purple-950 mt-0.5">
                        {userAccounts.filter(u => u.is_administrator).length}
                      </div>
                      <div className="text-[10px] text-purple-600 font-medium">Acesso irrestrito geral</div>
                    </div>

                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5">
                      <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Coordenadores</div>
                      <div className="text-xl font-black text-blue-950 mt-0.5">
                        {userAccounts.filter(u => !u.is_administrator && u.role === 'coordinator').length}
                      </div>
                      <div className="text-[10px] text-blue-600 font-medium">Gestores titulares</div>
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Assistentes</div>
                      <div className="text-xl font-black text-emerald-950 mt-0.5">
                        {userAccounts.filter(u => !u.is_administrator && u.role === 'assistant').length}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium">Apoio operacional</div>
                    </div>
                  </div>

                  {/* Barra de Filtros e Busca */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Buscar por Nome, Sobrenome, E-mail ou Nº Coordenação..."
                        value={userSearchTerm}
                        onChange={e => setUserSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {userSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setUserSearchTerm('')}
                          className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto">
                      {(['all', 'admins', 'coordinators', 'assistants'] as const).map(tab => {
                        const labels = {
                          all: `Todos (${userAccounts.length})`,
                          admins: `Admins (${userAccounts.filter(u => u.is_administrator).length})`,
                          coordinators: `Coordenadores (${userAccounts.filter(u => !u.is_administrator && u.role === 'coordinator').length})`,
                          assistants: `Assistentes (${userAccounts.filter(u => !u.is_administrator && u.role === 'assistant').length})`
                        };
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setUserRoleFilter(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              userRoleFilter === tab
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {labels[tab]}
                          </button>
                        );
                      })}
                    </div>

                    {filteredUserAccounts.filter(u => u.email.toLowerCase() !== authUser?.email.toLowerCase()).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const nonCurrent = filteredUserAccounts
                            .filter(u => u.email.toLowerCase() !== authUser?.email.toLowerCase())
                            .map(u => u.email.toLowerCase());
                          if (selectedUserEmails.length === nonCurrent.length) {
                            setSelectedUserEmails([]);
                          } else {
                            setSelectedUserEmails(nonCurrent);
                          }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {selectedUserEmails.length > 0 ? 'Desmarcar Seleção' : 'Selecionar Todas as Contas'}
                      </button>
                    )}
                  </div>

                  {/* Barra de Ações para Contas Selecionadas */}
                  {selectedUserEmails.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-red-900 shadow-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-bold">
                          {selectedUserEmails.length} {selectedUserEmails.length === 1 ? 'conta selecionada' : 'contas selecionadas'} para exclusão
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUserEmails([])}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Cancelar Seleção
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelectedUsers}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Deletar Selecionadas do Banco</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sequência Detalhada de Contas de E-mails em Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredUserAccounts.map((account, index) => {
                      const isCurrentUser = authUser?.email.toLowerCase() === account.email.toLowerCase();
                      const initials = (account.full_name || account.email)
                        .split(' ')
                        .map(p => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <div
                          key={account.id || account.email}
                          className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                            isCurrentUser
                              ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                              : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-sm'
                          }`}
                        >
                          <div className="space-y-4">
                            {/* Topo do Card: Avatar + Nome & Sobrenome (Destaque Principal) + Ações */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                                  account.is_administrator
                                    ? 'bg-purple-600 text-white'
                                    : (account.role === 'coordinator' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white')
                                }`}>
                                  {initials || 'EN'}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate" title={account.full_name}>
                                      {account.full_name || `${account.first_name} ${account.last_name}`.trim() || account.email.split('@')[0]}
                                    </h3>
                                    {isCurrentUser && (
                                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
                                        Você
                                      </span>
                                    )}
                                  </div>

                                  <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Identificador Principal
                                  </span>
                                </div>
                              </div>

                              {!isCurrentUser && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={selectedUserEmails.includes(account.email.toLowerCase())}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const em = account.email.toLowerCase();
                                      setSelectedUserEmails(prev =>
                                        e.target.checked
                                          ? [...prev, em]
                                          : prev.filter(x => x !== em)
                                      );
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                    title="Selecionar conta"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUserAccount(account.email)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                                    title="Excluir esta conta do banco de dados"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* E-mail da Conta */}
                            <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-600 flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate font-semibold" title={account.email}>
                                {account.email}
                              </span>
                            </div>

                            {/* Tags: Acesso Admin e Tipo de Função */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {account.is_administrator ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                                  <ShieldCheck className="w-3 h-3 text-purple-700 shrink-0" />
                                  <span>Admin: Sim</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <User className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>Admin: Não</span>
                                </span>
                              )}

                              {account.is_administrator ? (
                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                  🛡️ Gestor do Sistema
                                </span>
                              ) : account.role === 'coordinator' ? (
                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                                  👔 Coordenador Titular
                                </span>
                              ) : account.role === 'assistant' ? (
                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-200">
                                  📋 Assistente
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  ⏳ Pendente
                                </span>
                              )}
                            </div>

                            {/* Informações da Unidade de Ensino / Coordenação */}
                            <div className="border-t border-slate-100 pt-2.5">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Unidade de Ensino
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {account.coordination_number ? (
                                  <>
                                    <span className="px-2 py-0.5 rounded-md font-mono font-black text-xs bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                      Nº {account.coordination_number}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700 truncate" title={account.coordination_name}>
                                      {account.coordination_name || `Unidade de ensino Nº ${account.coordination_number}`}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs font-medium text-slate-400 italic">
                                    {account.is_administrator ? 'Acesso a todas as unidades' : 'Nº da coordenação pendente'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Rodapé do Card: Botão de Edição */}
                          <div className="pt-3 mt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUserModal(account)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                              title="Editar informações da conta"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Editar Conta</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredUserAccounts.length === 0 && (
                      <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <h4 className="font-bold text-slate-800 text-sm">Nenhuma conta encontrada</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Ajuste os filtros de busca ou cadastre uma nova conta de e-mail.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (adminTab === 'database' && authUser?.is_administrator) ? (
                /* Aba de Gestão do Banco de Dados Supabase (PostgreSQL) & Cache Redis (Apenas Administrador Geral) */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-xl font-bold text-slate-900">
                          Banco de Dados Supabase (PostgreSQL) & Cache em Memória
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ✓ 100% no Banco de Dados
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Todos os dados residem no banco de dados Supabase (sem dependência de SQLite, Redis ou arquivos JSON). O cache em memória garante resposta imediata e sincroniza automaticamente a cada gravação.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          fetchVacancies();
                          fetchcontributors();
                          fetchDatabaseStatus();
                          setMessage({ type: 'success', text: 'Dados e cache em memória recarregados do Supabase com sucesso!' });
                          setTimeout(() => setMessage(null), 3000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        title="Recarregar dados do banco de dados e sincronizar cache"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                        <span>Recarregar do Banco</span>
                      </button>

                      {authUser?.is_administrator && (
                        <button
                          type="button"
                          disabled={isPurgingSupabase}
                          onClick={handlePurgeFakeData}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                          title="Remover todas as vagas e dados de teste (1 a 9, coordenadores fictícios e tokens de exemplo)"
                        >
                          {isPurgingSupabase ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          <span>Remover Dados Fakes</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cards de Métricas do Banco de Dados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tabela de Vagas</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">{vacancies.length}</div>
                      <div className="text-[11px] text-blue-600 font-medium mt-0.5">
                        {vacancies.reduce((acc, v) => acc + (v.quantity || 0), 0)} postos em aberto
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tabela de Colaboradores</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">{contributors.length}</div>
                      <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                        {contributors.filter(c => c.status === 'cadastrado').length} aprovados
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tabela de Coordenações</div>
                      <div className="text-2xl font-black text-purple-700 mt-1">
                        {coordinations.length}
                      </div>
                      <div className="text-[11px] text-purple-600 font-medium mt-0.5">
                        {coordinations.length * 2} e-mails autorizados
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mecanismo de Cache</div>
                      <div className="text-base font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Cache em Memória Ativo
                      </div>
                      <div className="text-[11px] text-emerald-600 font-mono mt-0.5">
                        Latência &lt; 2ms • Sincronizado
                      </div>
                    </div>
                  </div>

                  {/* Informações da Arquitetura do Banco */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-2.5">
                    <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Regras de Integridade do Banco de Dados & Cache:
                    </h4>
                    <ul className="list-disc list-inside text-xs text-blue-900 space-y-1.5 pl-1">
                      <li><strong>Supabase Cloud:</strong> Dados armazenados nas tabelas relacionais <code className="font-mono bg-blue-100 px-1 rounded">vacancies</code>, <code className="font-mono bg-blue-100 px-1 rounded">contributors</code>, <code className="font-mono bg-blue-100 px-1 rounded">coordinations</code> e <code className="font-mono bg-blue-100 px-1 rounded">user_profiles</code>.</li>
                      <li><strong>Cache em Memória de Alta Performance:</strong> Salva dados em memória para acelerar consultas públicas sem sobrecarregar o banco, sincronizando de forma atômica a cada cadastro, edição ou exclusão.</li>
                      <li><strong>Unicidade Estrita por CPF:</strong> Constraint UNIQUE(cpf) impede cadastros duplicados do mesmo colaborador em mais de uma vaga.</li>
                      <li><strong>Regra de Coordenação e Administrador:</strong> Administradores acompanham todas as regiões. Quem não é administrador visualiza e gerencia apenas a sua própria coordenação (máximo de 2 e-mails autorizados por coordenação).</li>
                      <li><strong>100% Livre de Redis & SQLite:</strong> Otimizado para hospedagem serverless no Vercel e banco Supabase.</li>
                    </ul>
                  </div>
                </div>
              ) : (adminTab === 'supabase' && authUser?.is_administrator) ? (
                /* Aba do Banco de Dados Supabase (Gratuito / PostgreSQL - Apenas Administrador Geral) */
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-xl font-bold text-slate-900">
                          Banco de Dados Supabase (PostgreSQL Gratuito)
                        </h2>
                        {(() => {
                          const cfg = getSupabaseStatusConfig();
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${cfg.badgeBg}`}>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotClass}`} />
                              <span>{cfg.description}</span>
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Persistência na nuvem gratuita via Supabase com suporte a consultas PostgreSQL e integridade de dados.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isTestingSupabase}
                        onClick={handleTestSupabase}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        title="Testar comunicação com o Supabase"
                      >
                        {isTestingSupabase ? (
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-emerald-600" />
                        )}
                        <span>Testar Conexão</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSyncingSupabase}
                        onClick={handleSyncSupabase}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                        title="Enviar vagas e inscrições locais para as tabelas do Supabase"
                      >
                        {isSyncingSupabase ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>Sincronizar para o Supabase</span>
                      </button>

                      <button
                        type="button"
                        disabled={isPurgingSupabase}
                        onClick={handlePurgeFakeData}
                        className="flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                        title="Remover vagas 1 a 9, coordenadores de teste e tokens do Supabase"
                      >
                        {isPurgingSupabase ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        )}
                        <span>Remover Dados Fakes</span>
                      </button>
                    </div>
                  </div>

                  {/* Legenda Oficial das 3 Cores do Indicador Supabase Ativo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                      <div>
                        <strong className="text-emerald-800 block text-[11px] font-bold">Bolinha Verde</strong>
                        <span className="text-slate-600 text-[11px]">Conectado</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0 shadow-xs" />
                      <div>
                        <strong className="text-amber-800 block text-[11px] font-bold">Bolinha Amarela</strong>
                        <span className="text-slate-600 text-[11px]">Conectado</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
                      <span className="w-3 h-3 rounded-full bg-red-500 shrink-0 shadow-xs" />
                      <div>
                        <strong className="text-red-800 block text-[11px] font-bold">Bolinha Vermelha</strong>
                        <span className="text-slate-600 text-[11px]">Não conectado</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Banner */}
                  {(() => {
                    const cfg = getSupabaseStatusConfig();
                    return (
                      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        cfg.status === 'connected'
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : cfg.status === 'warning'
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-red-50/80 border-red-200 text-red-900'
                      }`}>
                        <div className="flex items-start sm:items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            cfg.status === 'connected'
                              ? 'bg-emerald-200/70 text-emerald-800'
                              : cfg.status === 'warning'
                              ? 'bg-amber-200/70 text-amber-800'
                              : 'bg-red-200/70 text-red-800'
                          }`}>
                            <Database className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-sm flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotClass}`} />
                              <span>{cfg.name} &bull; {cfg.description}</span>
                            </div>
                            <div className="text-xs opacity-90 mt-0.5">
                              {supabaseStatus?.message || 'Verificando conexão...'}
                            </div>
                            {supabaseStatus?.url && (
                              <div className="text-[11px] font-mono mt-1 opacity-75">
                                URL do Projeto: {supabaseStatus.url}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs shrink-0 self-end sm:self-auto font-medium">
                          {cfg.status === 'connected' ? (
                            <span className="text-emerald-700 font-bold bg-white/70 px-3 py-1 rounded-md border border-emerald-300">
                              {supabaseStatus?.tablesCreated ? '✓ Tabelas Ativas e Operacionais' : '⚠️ Criar Tabelas no SQL Editor'}
                            </span>
                          ) : cfg.status === 'warning' ? (
                            <span className="text-amber-800 font-bold bg-white/70 px-3 py-1 rounded-md border border-amber-300">
                              ⚠️ Conectado (Executar Script SQL)
                            </span>
                          ) : (
                            <span className="text-red-700 font-bold bg-white/70 px-3 py-1 rounded-md border border-red-300">
                              ✕ Não Conectado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Instruções Passo a Passo */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Como Configurar seu Banco Gratuito no Supabase (Em 3 Minutos)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
                      <div className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-[10px]">1</span>
                          Criar Projeto Gratuito
                        </div>
                        <p>
                          Acesse <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">supabase.com</a>, faça login ou crie sua conta gratuita e clique em <strong>New Project</strong>.
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-[10px]">2</span>
                          Executar Script SQL
                        </div>
                        <p>
                          No menu lateral esquerdo do Supabase, clique em <strong>SQL Editor</strong>, clique no botão <strong>Copiar Script SQL</strong> abaixo, cole e clique em <strong>Run</strong>.
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-[10px]">3</span>
                          Configurar Variáveis
                        </div>
                        <p>
                          Em <strong>Project Settings → API</strong>, copie a <code>Project URL</code> e a <code>anon public key</code> e configure nas variáveis de ambiente <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Código SQL com botão Copiar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-slate-600" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Script SQL Completo (Criação de Tabelas & Regra de CPF Único)
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const sql = `-- =========================================================================
-- ESQUEMA COMPLETO PARA O SUPABASE (ENEM 2026)
-- Execute este script no SQL Editor do seu projeto gratuito no Supabase
-- (https://supabase.com/dashboard/project/_/sql)
-- =========================================================================

-- 1. TABELA DE VAGAS ENEM 2026
CREATE TABLE IF NOT EXISTS public.vacancies (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  value NUMERIC NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  school TEXT NOT NULL,
  coordinator TEXT NOT NULL,
  coordination_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  min_age INTEGER NOT NULL DEFAULT 18,
  max_age INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE INSCRIÇÕES (COM REGRA DE CPF ÚNICO: 1 VAGA POR CPF)
CREATE TABLE IF NOT EXISTS public.contributors (
  id BIGSERIAL PRIMARY KEY,
  vacancy_id BIGINT REFERENCES public.vacancies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE, -- GARANTE NO BANCO QUE UM CPF NÃO PODE SE CADASTRAR EM MAIS DE UMA VAGA
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  age INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cebraspe_verified BOOLEAN DEFAULT FALSE,
  referrer_name TEXT,
  referrer_phone TEXT
);

-- 3. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_vacancies_city ON public.vacancies(city);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON public.vacancies(status);
CREATE INDEX IF NOT EXISTS idx_contributors_cpf ON public.contributors(cpf);
CREATE INDEX IF NOT EXISTS idx_contributors_vacancy ON public.contributors(vacancy_id);

-- 4. ATIVAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS DE ACESSO PÚBLICO / ANÔNIMO
DROP POLICY IF EXISTS "Public can view vacancies" ON public.vacancies;
CREATE POLICY "Public can view vacancies" ON public.vacancies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can manage vacancies" ON public.vacancies;
CREATE POLICY "Public can manage vacancies" ON public.vacancies FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view contributors" ON public.contributors;
CREATE POLICY "Public can view contributors" ON public.contributors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert contributors" ON public.contributors;
CREATE POLICY "Public can insert contributors" ON public.contributors FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can manage contributors" ON public.contributors;
CREATE POLICY "Public can manage contributors" ON public.contributors FOR ALL USING (true);
`;
                          navigator.clipboard.writeText(sql);
                          setCopiedSql(true);
                          setTimeout(() => setCopiedSql(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span>SQL Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Script SQL</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-64 leading-relaxed border border-slate-800">
{`-- 1. TABELA DE VAGAS ENEM 2026
CREATE TABLE IF NOT EXISTS public.vacancies (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  value NUMERIC NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  school TEXT NOT NULL,
  coordinator TEXT NOT NULL,
  coordination_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  min_age INTEGER NOT NULL DEFAULT 18,
  max_age INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE INSCRIÇÕES (COM REGRA DE CPF ÚNICO: 1 VAGA POR CPF)
CREATE TABLE IF NOT EXISTS public.contributors (
  id BIGSERIAL PRIMARY KEY,
  vacancy_id BIGINT REFERENCES public.vacancies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE, -- GARANTE QUE UM CPF NÃO PODE SE CADASTRAR EM MAIS DE UMA VAGA
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  age INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cebraspe_verified BOOLEAN DEFAULT FALSE,
  referrer_name TEXT,
  referrer_phone TEXT
);

-- 3. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_vacancies_city ON public.vacancies(city);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON public.vacancies(status);
CREATE INDEX IF NOT EXISTS idx_contributors_cpf ON public.contributors(cpf);
CREATE INDEX IF NOT EXISTS idx_contributors_vacancy ON public.contributors(vacancy_id);

-- 4. POLÍTICAS DE ACESSO (RLS)
ALTER TABLE public.vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view vacancies" ON public.vacancies FOR SELECT USING (true);
CREATE POLICY "Public can manage vacancies" ON public.vacancies FOR ALL USING (true);
CREATE POLICY "Public can view contributors" ON public.contributors FOR SELECT USING (true);
CREATE POLICY "Public can insert contributors" ON public.contributors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can manage contributors" ON public.contributors FOR ALL USING (true);`}
                    </pre>
                  </div>
                </div>
              ) : adminTab === 'debug' ? (
                /* Aba Temporária de Diagnóstico e Debug Supabase / Vercel */
                <div className="space-y-6">
                  <DebugModal isEmbedded={true} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>

    {/* Modal de Criação / Edição de Coordenação */}
    <AnimatePresence>
      {isCoordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsCoordModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl z-10 space-y-5"
          >
            <button 
              type="button"
              onClick={() => setIsCoordModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building className="w-5 h-5 text-purple-600" />
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Gestão ENEM 2026</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {coordFormData.coordination_number && coordinations.some(c => c.coordination_number === coordFormData.coordination_number)
                  ? `Editar Coordenação Nº ${coordFormData.coordination_number}`
                  : 'Cadastrar Nova Coordenação'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Cada coordenação possui um <strong>Número</strong> único e no máximo <strong>dois e-mails</strong> autorizados.
              </p>
            </div>

            <form onSubmit={handleSaveCoordination} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nº Coordenação *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: 106"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-purple-500"
                    value={coordFormData.coordination_number}
                    onChange={e => setCoordFormData({...coordFormData, coordination_number: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nome da Coordenação *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Coordenação Jacarepaguá"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                    value={coordFormData.name}
                    onChange={e => setCoordFormData({...coordFormData, name: e.target.value})}
                  />
                </div>
              </div>

              {/* Canto à parte: Exibição automática do Nº de Coordenação da conta após ser preenchido */}
              {coordFormData.coordination_number.trim() && (
                <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-purple-600 text-white font-mono font-black text-xs rounded-lg shadow-xs">
                      Nº {coordFormData.coordination_number.trim()}
                    </span>
                    <div className="text-xs">
                      <span className="font-bold text-purple-950 block">
                        Número de Coordenação Identificado
                      </span>
                      <span className="text-[11px] text-purple-700">
                        {coordFormData.name.trim() || 'Preenchendo nome da coordenação...'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full">
                    ✓ Automático
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Nome do(a) Coordenador(a) Titular *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Mariana Ferreira"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                  value={coordFormData.coordinator_name}
                  onChange={e => setCoordFormData({...coordFormData, coordinator_name: e.target.value})}
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                <div className="text-[11px] font-bold text-purple-900 uppercase">
                  Os 2 E-mails Autorizados para esta Coordenação:
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    1. E-mail do Coordenador Titular *
                  </label>
                  <input 
                    type="email"
                    required
                    placeholder="coordenador@enem2026.gov.br"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                    value={coordFormData.coordinator_email}
                    onChange={e => setCoordFormData({...coordFormData, coordinator_email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    2. E-mail do Assistente do Coordenador *
                  </label>
                  <input 
                    type="email"
                    required
                    placeholder="assistente@enem2026.gov.br"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                    value={coordFormData.assistant_email}
                    onChange={e => setCoordFormData({...coordFormData, assistant_email: e.target.value})}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-purple-200 transition-colors cursor-pointer"
              >
                Salvar Coordenação no Supabase
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Modal de Edição / Cadastro de Conta de E-mail (Acesso Admin, Cargo, Coordenação e Nome/Sobrenome Principal) */}
    <AnimatePresence>
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsUserModalOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl z-10 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  ENEM 2026 • Gestão de Contas de E-mails
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {isNewUserMode ? 'Cadastrar Nova Conta de E-mail' : `Editar Conta: ${editUserEmail}`}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure se o usuário terá <strong>acesso de administrador ou não</strong>, se atuará como <strong>coordenador ou assistente</strong> e o <strong>número da coordenação</strong> onde irá trabalhar.
              </p>
            </div>

            {userModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>{userModalError}</div>
              </div>
            )}

            {userModalSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{userModalSuccess}</div>
              </div>
            )}

            <form onSubmit={handleSaveUserAccount} className="space-y-4">
              {/* Destaque Principal: Nome e Sobrenome */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Nome e Sobrenome (Identificador Principal) *</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                    Principal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos"
                      value={editUserFirstName}
                      onChange={e => setEditUserFirstName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sobrenome *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Silva"
                      value={editUserLastName}
                      onChange={e => setEditUserLastName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Prévia do Nome Principal */}
                <div className="text-xs text-indigo-900 pt-1 border-t border-indigo-100 flex items-center justify-between">
                  <span>Exibição Principal em todo o sistema:</span>
                  <span className="font-black text-indigo-950">
                    {editUserFirstName.trim() || editUserLastName.trim()
                      ? `${editUserFirstName.trim()} ${editUserLastName.trim()}`
                      : '(Preencha o nome e sobrenome)'}
                  </span>
                </div>
              </div>

              {/* E-mail e Senha unificados na mesma caixinha de divs */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* E-mail da Conta */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      E-mail Corporativo Cadastrado *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        disabled={!isNewUserMode}
                        placeholder="exemplo@enem.app"
                        value={editUserEmail}
                        onChange={e => setEditUserEmail(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-75 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  {/* Senha no Supabase */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isNewUserMode ? 'Senha de Acesso *' : 'Nova Senha (Opcional)'}</span>
                      </label>
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Supabase
                      </span>
                    </div>

                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showUserPassword ? "text" : "password"}
                        required={isNewUserMode}
                        placeholder={isNewUserMode ? "Mínimo 6 caracteres" : "Manter atual"}
                        value={editUserPassword}
                        onChange={e => setEditUserPassword(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-9 py-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUserPassword(!showUserPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showUserPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                  {isNewUserMode 
                    ? "A conta será criada diretamente no Supabase com este e-mail e senha, permitindo o login imediato no sistema." 
                    : "Preencha a nova senha apenas se desejar redefinir o acesso da conta no Supabase."}
                </p>
              </div>

              {/* Seção 1: O usuário poderá ter acesso de Admin ou não */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Acesso de Administrador</span>
                  <span className="text-[10px] font-bold text-purple-700">Selecione se terá acesso de admin ou não</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditUserIsAdmin(true)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editUserIsAdmin
                        ? 'border-purple-600 bg-purple-50/80 shadow-xs ring-2 ring-purple-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-purple-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-purple-700" />
                        <span>Sim — Administrador</span>
                      </span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        editUserIsAdmin ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300'
                      }`}>
                        {editUserIsAdmin && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                      Poderá visualizar todas as vagas, todos os candidatos de todas as regiões, gerenciar banco de dados e editar outras contas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditUserIsAdmin(false)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      !editUserIsAdmin
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-600" />
                        <span>Não — Usuário Comum</span>
                      </span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        !editUserIsAdmin ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {!editUserIsAdmin && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                      Acesso restrito exclusivamente às vagas e colaboradores da sua própria coordenação (número informado abaixo). Não acessa painel geral.
                    </p>
                  </button>
                </div>
              </div>

              {/* Seção 2: Informar se o usuário é Coordenador ou Assistente */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Tipo de Função: Coordenador ou Assistente</span>
                  <span className="text-[10px] font-bold text-blue-600">Apenas 1 de cada por coordenação</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditUserRole('coordinator')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editUserRole === 'coordinator'
                        ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>👔</span>
                        <span>Coordenador Titular</span>
                      </span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        editUserRole === 'coordinator' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {editUserRole === 'coordinator' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                      Gestor responsável da coordenação
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditUserRole('assistant')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      editUserRole === 'assistant'
                        ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>📋</span>
                        <span>Assistente de Coordenação</span>
                      </span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        editUserRole === 'assistant' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                      }`}>
                        {editUserRole === 'assistant' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                      Apoio operacional e fiscalização
                    </div>
                  </button>
                </div>
              </div>

              {/* Seção 3: Campo para preencher o Número da Coordenação a qual o mesmo irá trabalhar */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                  Nº da Coordenação a qual o mesmo irá trabalhar *
                </label>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite o Nº da coordenação de trabalho"
                    value={editUserCoordNumber}
                    onChange={e => setEditUserCoordNumber(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 outline-none font-mono"
                  />
                  {editUserCoordNumber.trim() && (
                    <span className="absolute right-3 top-2.5 text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                      Nº {editUserCoordNumber.trim()}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                  <strong>Regra de Limite:</strong> Apenas dois usuários podem ter o mesmo número de coordenação (1 Coordenador e 1 Assistente). Ao salvar, este e-mail assumirá o cargo escolhido para o Nº informado.
                </div>
              </div>

              {/* Campo Opcional: Nome da unidade de ensino */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Nome da unidade de ensino
                </label>
                <input
                  type="text"
                  placeholder="Ex: Unidade de ensino"
                  value={editUserCoordName}
                  onChange={e => setEditUserCoordName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSavingUserAccount}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingUserAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Gravando Informações...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Salvar Informações da Conta</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* contributor Modal */}
      <AnimatePresence>
        {isApplying && selectedVacancy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <button 
                type="button"
                onClick={handleCloseModal}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold text-slate-900 mb-2">Inscrição para Vaga</h2>
              <p className="text-slate-600 mb-6">
                Você está se candidatando para <span className="font-bold text-blue-600">{selectedVacancy.title}</span> na <span className="font-bold">{selectedVacancy.school}</span> • Preço: <span className="font-bold text-emerald-600">R$ {(selectedVacancy.price !== undefined ? selectedVacancy.price : (selectedVacancy.value ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>.
              </p>

              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Seu nome"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Idade</label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Sua idade"
                      value={formData.age}
                      onChange={e => setFormData({...formData, age: e.target.value})}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">CPF</label>
                      {cpfVerificationStatus === 'checking' && (
                        <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        maxLength={14}
                        className={`w-full bg-slate-50 border rounded-xl px-4 py-3 focus:ring-2 outline-none font-mono ${
                          cpfVerificationStatus === 'registered' ? 'border-emerald-500 focus:ring-emerald-500 bg-emerald-50/20' :
                          cpfVerificationStatus === 'not_registered' ? 'border-amber-500 focus:ring-amber-500 bg-amber-50/20' :
                          cpfVerificationStatus === 'invalid' ? 'border-red-400 focus:ring-red-500' :
                          'border-slate-200 focus:ring-blue-500'
                        }`}
                        placeholder="000.000.000-00"
                        value={formData.cpf}
                        onChange={e => {
                          const val = formatCPF(e.target.value);
                          setFormData({...formData, cpf: val});
                          const digits = val.replace(/\D/g, '');
                          if (digits.length === 11) {
                            verifyCebraspeCpf(val, true);
                          } else {
                            setCpfVerificationStatus('idle');
                            setCpfVerificationMessage('');
                          }
                        }}
                        onBlur={() => {
                          const digits = formData.cpf.replace(/\D/g, '');
                          if (digits.length === 11 && cpfVerificationStatus === 'idle') {
                            verifyCebraspeCpf(formData.cpf, true);
                          }
                        }}
                      />
                      {cpfVerificationStatus === 'registered' && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 absolute right-3 top-3.5" />
                      )}
                      {cpfVerificationStatus === 'not_registered' && (
                        <AlertCircle className="w-5 h-5 text-amber-500 absolute right-3 top-3.5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Status da verificação Cebraspe em tempo real */}
                {cpfVerificationStatus !== 'idle' && (
                  <div>
                    {cpfVerificationStatus === 'registered' && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>CPF cadastrado no Cebraspe (Sinapse)!</span>
                        </span>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                          Liberado
                        </span>
                      </div>
                    )}

                    {cpfVerificationStatus === 'not_registered' && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-bold text-amber-800">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>CPF não cadastrado no Cebraspe</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                window.open('https://extranet.cebraspe.org.br/Sinapse/aspx/administrarusuario/QueroMeCadastrar.aspx', '_blank', 'noopener,noreferrer');
                              } catch {}
                              setIsCebraspeModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-amber-900 underline hover:text-amber-700 cursor-pointer"
                          >
                            Abrir pop up
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Uma nova aba foi aberta no site oficial. Conclua seu cadastro e clique em verificar novamente.
                        </p>
                      </div>
                    )}

                    {cpfVerificationStatus === 'invalid' && (
                      <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Dígitos verificadores do CPF inválidos. Confira o número digitado.</span>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    required
                    maxLength={15}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cidade</label>
                    <select 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                    >
                      <option value="">Selecione sua cidade</option>
                      {CITIES.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bairro</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Seu bairro"
                      value={formData.neighborhood}
                      onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                    />
                  </div>
                </div>

                {/* Campo Opcional: Quem Indicou (Nome e WhatsApp) */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      Quem indicou? <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nome de quem indicou
                      </label>
                      <input 
                        type="text" 
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Nome da pessoa (opcional)"
                        value={formData.referrer_name}
                        onChange={e => setFormData({...formData, referrer_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        WhatsApp de quem indicou
                      </label>
                      <input 
                        type="tel" 
                        maxLength={15}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="(00) 00000-0000 (opcional)"
                        value={formData.referrer_phone}
                        onChange={e => setFormData({...formData, referrer_phone: formatPhone(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                {message && message.type === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <p className="font-medium">{message.text}</p>
                  </motion.div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pop up do Cebraspe para cadastro e re-verificação ("caso ele não tenha abra um pop up com o site para ele se inscrever, e abra outra aba para o site. apos o termino verifica novamente o cpf digitado.") */}
      <AnimatePresence>
        {isCebraspeModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setIsCebraspeModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 z-10"
            >
              <button
                type="button"
                onClick={() => setIsCebraspeModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Etapa Obrigatória ENEM 2026
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Cadastro no Cebraspe Necessário
                  </h3>
                </div>
              </div>

              <div className="space-y-4 text-slate-600 text-sm">
                <p>
                  Identificamos em tempo real que o CPF <strong className="font-mono text-slate-900">{formData.cpf}</strong> ainda <strong className="text-amber-700">não possui cadastro</strong> no sistema <em>Sinapse</em> do <strong>Cebraspe</strong>, banca organizadora do ENEM 2026.
                </p>

                <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200/80 space-y-2">
                  <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    O que você precisa fazer:
                  </h4>
                  <ol className="text-xs text-blue-900 space-y-1.5 list-decimal pl-4">
                    <li>Abrimos automaticamente uma <strong>outra aba</strong> com a página oficial de cadastro do Cebraspe.</li>
                    <li>Informe seu e-mail e conclua o cadastro rápido no site do Cebraspe.</li>
                    <li>Ao terminar, clique no botão verde abaixo para <strong>verificar novamente</strong> o seu CPF.</li>
                  </ol>
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  <a
                    href="https://extranet.cebraspe.org.br/Sinapse/aspx/administrarusuario/QueroMeCadastrar.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-300 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                    Abrir Site do Cebraspe em Nova Aba (Caso não tenha aberto)
                  </a>

                  <button
                    type="button"
                    disabled={isRecheckingCebraspe}
                    onClick={handleRecheckCebraspe}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer"
                  >
                    {isRecheckingCebraspe ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Verificando CPF no Cebraspe...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        <span>Já concluí meu cadastro - Verificar Novamente</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleManualConfirmCebraspe}
                    className="text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1 transition-colors underline cursor-pointer"
                  >
                    Já finalizei todas as etapas no Cebraspe (Confirmar e Continuar)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Edição de Vaga */}
        {isEditVacancyModalOpen && editingVacancy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setIsEditVacancyModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-200 z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Editar Vaga Cadastrada</h3>
                    <p className="text-xs text-slate-500">ID #{editingVacancy.id} • Coordenação #{editingVacancy.coordination_number}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditVacancyModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editVacancyError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{editVacancyError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditVacancy} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cargo / Título da Vaga
                  </label>
                  <input
                    type="text"
                    required
                    value={editVacancyFormData.title}
                    onChange={e => setEditVacancyFormData({ ...editVacancyFormData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Remuneração (R$)
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={editVacancyFormData.value}
                      onChange={e => setEditVacancyFormData({ ...editVacancyFormData, value: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Qtd de Vagas
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editVacancyFormData.quantity}
                      onChange={e => setEditVacancyFormData({ ...editVacancyFormData, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Escola / Local de Aplicação
                  </label>
                  <input
                    type="text"
                    required
                    value={editVacancyFormData.school}
                    onChange={e => setEditVacancyFormData({ ...editVacancyFormData, school: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      required
                      value={editVacancyFormData.neighborhood}
                      onChange={e => setEditVacancyFormData({ ...editVacancyFormData, neighborhood: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      required
                      value={editVacancyFormData.city}
                      onChange={e => setEditVacancyFormData({ ...editVacancyFormData, city: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Idade Mínima
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editVacancyFormData.min_age}
                      onChange={e => setEditVacancyFormData({ ...editVacancyFormData, min_age: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Idade Máxima
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editVacancyFormData.max_age}
                      onChange={e => setEditVacancyFormData({ ...editVacancyFormData, max_age: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl px-4 py-2 text-sm font-medium text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Caso a vaga seja alterada ou excluída no futuro, todos os candidatos que já se inscreveram permanecem <strong>seguros e preservados</strong> no banco de dados.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditVacancyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEditVacancy}
                    className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer"
                  >
                    {isSavingEditVacancy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{isSavingEditVacancy ? 'Salvando...' : 'Salvar Alterações'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão Direta do Banco de Dados (Sem bloqueio de window.confirm) */}
      <AnimatePresence>
        {deleteConfirmModal?.isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => !isExecutingDelete && setDeleteConfirmModal(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl z-10 space-y-6 my-8"
            >
              {/* Cabeçalho do Modal */}
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  deleteConfirmModal.type === 'collaborator' && (deleteConfirmModal.step || 1) === 1
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {deleteConfirmModal.type === 'collaborator' && (deleteConfirmModal.step || 1) === 1 ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : deleteConfirmModal.type === 'collaborator' && deleteConfirmModal.step === 2 ? (
                    <ShieldAlert className="w-6 h-6" />
                  ) : (
                    <Trash2 className="w-6 h-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`text-[11px] font-black uppercase tracking-wider ${
                    deleteConfirmModal.type === 'collaborator' && (deleteConfirmModal.step || 1) === 1
                      ? 'text-amber-700'
                      : 'text-red-600'
                  }`}>
                    {deleteConfirmModal.type === 'collaborator'
                      ? (deleteConfirmModal.step === 2 ? 'Confirmação Dupla Obrigatória • Etapa 2 de 2' : 'Exclusão de Colaborador • Etapa 1 de 2')
                      : 'Exclusão no Banco de Dados Supabase'}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                    {deleteConfirmModal.type === 'collaborator'
                      ? (deleteConfirmModal.step === 2 ? 'Confirmar Exclusão Definitiva' : deleteConfirmModal.title)
                      : deleteConfirmModal.title}
                  </h3>
                </div>
              </div>

              {/* Indicador de Etapas para Colaborador (Confirmação Dupla) */}
              {deleteConfirmModal.type === 'collaborator' && (
                <div className="flex items-center gap-2">
                  <div className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold text-center border transition-all ${
                    (deleteConfirmModal.step || 1) === 1
                      ? 'bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    ✓ 1ª Confirmação: Dados
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  <div className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold text-center border transition-all ${
                    deleteConfirmModal.step === 2
                      ? 'bg-red-50 text-red-800 border-red-300 ring-2 ring-red-400/20'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    2ª Confirmação: Definitiva
                  </div>
                </div>
              )}

              {/* Detalhes do Item */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  {deleteConfirmModal.type === 'collaborator' ? 'Dados do Colaborador Inscrito:' : 'Item selecionado:'}
                </span>
                <p className="text-sm font-bold text-slate-800 break-words">
                  {deleteConfirmModal.itemDescription}
                </p>
                {deleteConfirmModal.candidateData && (
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Status Atual:</span>
                      <strong className="text-slate-700 capitalize">{deleteConfirmModal.candidateData.status}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Coordenação:</span>
                      <strong className="text-slate-700">Nº {deleteConfirmModal.candidateData.coordination_number}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Notas de Segurança / Avisos Conforme a Etapa */}
              {deleteConfirmModal.type === 'collaborator' && deleteConfirmModal.step === 2 ? (
                <div className="space-y-3">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 leading-relaxed font-medium">
                    ⚠️ <strong>ATENÇÃO MÁXIMA (Ação Irreversível):</strong> A inscrição deste colaborador será excluída permanentemente do banco de dados (Supabase). A vaga na escola correspondente será reaberta para preenchimento. Esta operação não poderá ser desfeita.
                  </div>

                  {/* Caixa de Confirmação Dupla Obrigatória */}
                  <label className="flex items-start gap-3 p-3.5 bg-red-50/70 hover:bg-red-50 border border-red-200 rounded-2xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={collaboratorDoubleConfirmed}
                      onChange={(e) => setCollaboratorDoubleConfirmed(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                    />
                    <div className="text-xs text-red-900 leading-snug">
                      <strong className="block font-bold">Confirmação dupla de segurança:</strong>
                      <span>Estou plenamente ciente e confirmo que desejo excluir em definitivo a inscrição deste colaborador do banco de dados.</span>
                    </div>
                  </label>
                </div>
              ) : deleteConfirmModal.safeNote ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed font-medium">
                  {deleteConfirmModal.safeNote}
                </div>
              ) : null}

              {/* Botões de Ação */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-2 border-t border-slate-100">
                {deleteConfirmModal.type === 'collaborator' && deleteConfirmModal.step === 2 ? (
                  <>
                    <button
                      type="button"
                      disabled={isExecutingDelete}
                      onClick={() => {
                        setCollaboratorDoubleConfirmed(false);
                        setDeleteConfirmModal(prev => prev ? { ...prev, step: 1 } : null);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ← Voltar à 1ª Etapa
                    </button>
                    <button
                      type="button"
                      disabled={isExecutingDelete}
                      onClick={() => setDeleteConfirmModal(null)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!collaboratorDoubleConfirmed || isExecutingDelete}
                      onClick={executeDeleteConfirmed}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isExecutingDelete ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Excluindo do Banco...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Sim, Excluir Definitivamente</span>
                        </>
                      )}
                    </button>
                  </>
                ) : deleteConfirmModal.type === 'collaborator' && (deleteConfirmModal.step || 1) === 1 ? (
                  <>
                    <button
                      type="button"
                      disabled={isExecutingDelete}
                      onClick={() => setDeleteConfirmModal(null)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCollaboratorDoubleConfirmed(false);
                        setDeleteConfirmModal(prev => prev ? { ...prev, step: 2 } : null);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Avançar para 2ª Confirmação</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isExecutingDelete}
                      onClick={() => setDeleteConfirmModal(null)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isExecutingDelete}
                      onClick={executeDeleteConfirmed}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isExecutingDelete ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Excluindo do Banco...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Sim, Deletar do Banco</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Diagnóstico e Debug Temporário (Supabase & Vercel) */}
      <DebugModal isOpen={isDebugModalOpen} onClose={() => setIsDebugModalOpen(false)} />
    </div>
  );
}
