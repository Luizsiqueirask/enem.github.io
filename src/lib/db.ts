// Camada de compatibilidade e repositório central Supabase + Cache em Memória/Redis
// SQLite foi completamente descontinuado conforme solicitado. Todos os dados residem no Supabase e no Cache.

import type { Vacancy, Application, Coordination } from "./supabaseServer.ts";
import {
  getVacancies,
  getVacancyById,
  insertVacancy,
  decrementVacancySlot,
  deleteVacancy,
  resetVacancies,
  restoreDefaultVacancies,
  getApplications,
  getApplicationByCpf,
  insertApplication,
  updateApplicationStatus,
  resetApplications,
  getCoordinations,
  saveCoordination,
  deleteCoordination,
  resolveUserProfile,
  getDatabaseAndCacheStats,
  DEFAULT_VACANCIES,
  DEFAULT_COORDINATIONS
} from "./supabaseServer.ts";

export {
  getVacancies as getDbVacancies,
  getVacancyById as getDbVacancyById,
  insertVacancy as insertDbVacancy,
  decrementVacancySlot as decrementDbVacancySlot,
  deleteVacancy as deleteDbVacancy,
  resetVacancies as resetDbVacancies,
  restoreDefaultVacancies as restoreDefaultDbVacancies,
  getApplications as getDbContributors,
  getApplicationByCpf as getDbContributorByCpf,
  insertApplication as insertDbContributor,
  updateApplicationStatus as updateDbContributorStatus,
  resetApplications as resetDbContributors,
  getCoordinations,
  saveCoordination,
  deleteCoordination,
  resolveUserProfile,
  getDatabaseAndCacheStats as getDatabaseStats,
  DEFAULT_VACANCIES,
  DEFAULT_COORDINATIONS
};
