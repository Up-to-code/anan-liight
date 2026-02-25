import type { RuntimeContainer } from "@modules/internal/runtime";

export type FeatureKey =
  | "FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED"
  | "FEATURE_LLIGHT_WORKFLOW_ENGINE_ENABLED"
  | "FEATURE_LLIGHT_WA_WEBHOOK_ENABLED"
  | "FEATURE_LLIGHT_OPENROUTER_CHAIN_ENABLED"
  | "FEATURE_LLIGHT_WA_PLATFORM_ENABLED"
  | "FEATURE_LLIGHT_WA_CAMPAIGNS_ENABLED"
  | "FEATURE_LLIGHT_WA_TEMPLATE_ENFORCEMENT_ENABLED"
  | "FEATURE_LLIGHT_DUAL_RUN_WRITE_ENABLED"
  | "FEATURE_LLIGHT_READ_CUTOVER_ENABLED"
  | "FEATURE_AUTH_COGNITO_ENABLED"
  | "FEATURE_AUTH_ANON_CHAT_ENABLED"
  | "FEATURE_TEXT_CONTRACT_ENFORCED"
  | "FEATURE_TEXT_CONTRACT_SHADOW";

/**
 * Reads runtime flag values from validated environment.
 * @param runtime Runtime container
 * @param key Feature key
 * @returns Enabled state
 */
export function isFeatureEnabled(runtime: RuntimeContainer, key: FeatureKey): boolean {
  return runtime.env[key];
}
