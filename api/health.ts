import { getSupabaseConfig, getDatabaseAndCacheStats } from "../src/lib/supabaseServer.ts";

export default async function handler(req: any, res: any) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const config = getSupabaseConfig();
    const stats = getDatabaseAndCacheStats();
    return res.status(200).json({
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
  } catch (err: any) {
    return res.status(200).json({
      status: "ok",
      storage: "fallback",
      message: err.message || "Health check responded"
    });
  }
}
