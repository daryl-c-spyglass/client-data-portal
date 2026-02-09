import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.string().default("5000"),

  DATABASE_URL: isProduction
    ? z.string().min(1, "DATABASE_URL is required in production")
    : z.string().optional(),
  SESSION_SECRET: isProduction
    ? z.string().min(1, "SESSION_SECRET is required in production")
    : z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),

  REPLIERS_API_KEY: z.string().optional(),

  MLSGRID_API_URL: z.string().optional(),
  MLS_GRID_BBO: z.string().optional(),
  MLS_GRID_VOW: z.string().optional(),
  MLSGRID_API_TOKEN: z.string().optional(),

  FUB_API_KEY: z.string().optional(),
  REZEN_API_KEY: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  VITE_MAPBOX_TOKEN: z.string().optional(),

  ALLOWED_EMAIL_DOMAIN: z.string().default("spyglassrealty.com"),
  ALLOWED_EMAILS: z.string().optional(),
  HOMEREVIEW_API_URL: z.string().optional(),

  REPLIT_DOMAINS: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | null = null;

export function validateConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`
    );
    console.error("Environment validation failed:");
    console.error(missing.join("\n"));

    if (isProduction) {
      process.exit(1);
    }

    console.warn("Continuing in development mode with partial config");
  }

  _config = result.success ? result.data : (envSchema.safeParse({
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "development",
  }).data as AppConfig);

  const optional: Record<string, boolean> = {
    "Google OAuth": !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    "Repliers API": !!process.env.REPLIERS_API_KEY,
    "MLS Grid": !!(process.env.MLSGRID_API_URL && (process.env.MLS_GRID_BBO || process.env.MLS_GRID_VOW)),
    "Follow Up Boss": !!process.env.FUB_API_KEY,
    "OpenAI": !!process.env.OPENAI_API_KEY,
    "Mapbox": !!process.env.MAPBOX_ACCESS_TOKEN,
  };

  console.log("Environment validated");
  console.log("Feature status:");
  for (const [name, enabled] of Object.entries(optional)) {
    console.log(`   ${enabled ? "+" : "-"} ${name}`);
  }

  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) {
    _config = validateConfig();
  }
  return _config;
}
