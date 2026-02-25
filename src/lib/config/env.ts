import { z } from "zod";

function envBoolean(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off", ""].includes(normalized)) return false;
    }
    return value;
  }, z.boolean()).default(defaultValue);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(4020),
  APP_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  SPACETIMEDB_HTTP_URL: z.string().url(),
  SPACETIMEDB_WS_URL: z.string().url(),
  SPACETIMEDB_DB_NAME: z.string().min(1),
  SPACETIMEDB_AUTH_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default(""),
  WHATSAPP_APP_SECRET: z.string().default(""),
  WHATSAPP_TEMPLATE_ONLY_OUTSIDE_24H: envBoolean(true),
  WHATSAPP_ADAPTIVE_QUEUE_ENABLED: envBoolean(true),
  WHATSAPP_MAX_BATCH_SEND: z.coerce.number().int().positive().default(100),
  COGNITO_ENABLED: envBoolean(false),
  COGNITO_REGION: z.string().default(""),
  COGNITO_USER_POOL_ID: z.string().default(""),
  COGNITO_CLIENT_ID: z.string().default(""),
  COGNITO_CLIENT_SECRET: z.string().optional(),
  COGNITO_DOMAIN: z.string().default(""),
  COGNITO_REDIRECT_URI: z.string().default(""),
  COGNITO_LOGOUT_REDIRECT_URI: z.string().default(""),
  COGNITO_SCOPES: z.string().default("openid email profile"),
  COGNITO_JWKS_CACHE_TTL_MS: z.coerce.number().int().positive().default(300000),
  SESSION_ENCRYPTION_KEY: z.string().default(""),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url(),
  OPENROUTER_MODEL_CHAIN: z.string().default("gpt-oss-120b,moonshotai/kimi-k2-thinking,openai/gpt-4o,anthropic/claude-sonnet-4.6"),
  OPENROUTER_MODEL_ALLOWLIST: z.string().default("gpt-oss-120b,moonshotai/kimi-k2-thinking,openai/gpt-4o,anthropic/claude-sonnet-4.6"),
  OPENROUTER_BLOCK_FREE_MODELS: envBoolean(true),
  OPENROUTER_PRIMARY_MODEL: z.string().min(1),
  OPENROUTER_FALLBACK_MODEL: z.string().min(1),
  OPENROUTER_F1_MODEL: z.string().min(1),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  OPENROUTER_MAX_TOKENS: z.coerce.number().int().positive().default(1200),
  OPENROUTER_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(8),
  CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().positive().default(60000),
  WORKER_POOL_CONCURRENCY: z.coerce.number().int().positive().default(40),
  QUEUE_MAX_SIZE: z.coerce.number().int().positive().default(2000),
  FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED: envBoolean(true),
  FEATURE_LLIGHT_WORKFLOW_ENGINE_ENABLED: envBoolean(true),
  FEATURE_LLIGHT_WA_WEBHOOK_ENABLED: envBoolean(true),
  FEATURE_LLIGHT_OPENROUTER_CHAIN_ENABLED: envBoolean(true),
  FEATURE_LLIGHT_BACKGROUND_JOBS_ENABLED: envBoolean(true),
  FEATURE_LLIGHT_WA_PLATFORM_ENABLED: envBoolean(false),
  FEATURE_LLIGHT_WA_CAMPAIGNS_ENABLED: envBoolean(false),
  FEATURE_LLIGHT_WA_TEMPLATE_ENFORCEMENT_ENABLED: envBoolean(false),
  FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED: envBoolean(false),
  FEATURE_LLIGHT_READ_CUTOVER_ENABLED: envBoolean(false),
  FEATURE_AUTH_COGNITO_ENABLED: envBoolean(false),
  FEATURE_AUTH_ANON_CHAT_ENABLED: envBoolean(true),
  FEATURE_TEXT_CONTRACT_ENFORCED: envBoolean(false),
  FEATURE_TEXT_CONTRACT_SHADOW: envBoolean(true),
  FEATURE_ADMIN_DESTRUCTIVE_ACTIONS: envBoolean(false)
}).superRefine((value, context) => {
  const isProduction = value.NODE_ENV === "production";
  const insecureVerifyTokens = new Set(["apptest", "test", "changeme", "default", "123456"]);

  if (value.FEATURE_LLIGHT_WA_PLATFORM_ENABLED) {
    const required = ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN"] as const;
    for (const field of required) {
      if (value[field].trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} is required when WhatsApp platform feature is enabled`,
          path: [field]
        });
      }
    }
  }

  if (isProduction && value.FEATURE_LLIGHT_WA_WEBHOOK_ENABLED) {
    const token = value.WHATSAPP_VERIFY_TOKEN.trim().toLowerCase();
    if (token.length < 16 || insecureVerifyTokens.has(token)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "WHATSAPP_VERIFY_TOKEN must be rotated to a strong value in production",
        path: ["WHATSAPP_VERIFY_TOKEN"]
      });
    }
  }

  const cognitoEnabled = value.COGNITO_ENABLED || value.FEATURE_AUTH_COGNITO_ENABLED;
  if (!cognitoEnabled) return;

  const requiredFields = [
    "COGNITO_REGION",
    "COGNITO_USER_POOL_ID",
    "COGNITO_CLIENT_ID",
    "COGNITO_DOMAIN",
    "COGNITO_REDIRECT_URI",
    "COGNITO_LOGOUT_REDIRECT_URI"
  ] as const;

  for (const field of requiredFields) {
    if (value[field].trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} is required when Cognito auth is enabled`,
        path: [field]
      });
    }
  }

  if (value.SESSION_ENCRYPTION_KEY.trim().length < 16) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "SESSION_ENCRYPTION_KEY must be at least 16 chars when Cognito auth is enabled",
      path: ["SESSION_ENCRYPTION_KEY"]
    });
  }

  if (value.OPENROUTER_BLOCK_FREE_MODELS) {
    const chain = value.OPENROUTER_MODEL_CHAIN.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    const hasFree = chain.some((model) => model.includes(":free") || model.includes("(free)") || model.includes(" free"));
    if (hasFree) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENROUTER_MODEL_CHAIN contains free models while OPENROUTER_BLOCK_FREE_MODELS=true",
        path: ["OPENROUTER_MODEL_CHAIN"]
      });
    }
  }
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parses and validates process environment once at startup.
 * @returns Validated environment object
 * @throws z.ZodError when required variables are invalid
 */
export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}
