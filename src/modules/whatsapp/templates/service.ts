import { randomUUID } from "node:crypto";
import type { RuntimeContainer } from "@modules/internal/runtime";
import type { WaTemplate, WaTemplateCategory } from "@modules/whatsapp/types";
import { TABLE_NAMES } from "@shared/constants";

export async function createTemplateDraft(runtime: RuntimeContainer, input: {
  name: string;
  language: string;
  category: WaTemplateCategory;
  body: string;
  variables?: string[];
}): Promise<WaTemplate> {
  const now = Date.now();
  const template: WaTemplate = {
    templateId: randomUUID(),
    name: input.name,
    language: input.language,
    category: input.category,
    body: input.body,
    variables: input.variables ?? [],
    status: "draft",
    createdAt: now,
    updatedAt: now
  };

  await runtime.store.insert(TABLE_NAMES.WA_TEMPLATES, {
    id: randomUUID(),
    ...template,
    variablesJson: JSON.stringify(template.variables),
    version: 1
  });

  return template;
}

export async function submitTemplate(runtime: RuntimeContainer, templateId: string): Promise<{ ok: boolean }> {
  const now = Date.now();
  await runtime.store.insert(TABLE_NAMES.WA_TEMPLATE_VERSIONS, {
    id: randomUUID(),
    versionId: randomUUID(),
    templateId,
    status: "submitted",
    providerStatus: "pending",
    createdAt: now,
    updatedAt: now,
    version: 1
  });
  return { ok: true };
}

export async function syncTemplateStatus(runtime: RuntimeContainer, templateId: string, providerStatus: string): Promise<void> {
  const now = Date.now();
  await runtime.store.insert(TABLE_NAMES.WA_TEMPLATE_VERSIONS, {
    id: randomUUID(),
    versionId: randomUUID(),
    templateId,
    status: providerStatus === "approved" ? "approved" : "submitted",
    providerStatus,
    createdAt: now,
    updatedAt: now,
    version: 1
  });
}

export async function fetchTemplateCatalog(runtime: RuntimeContainer, locale?: string): Promise<WaTemplate[]> {
  const rows = await runtime.store.queryMany<WaTemplate & { variablesJson?: string }>(TABLE_NAMES.WA_TEMPLATES, locale ? [
    { field: "language", op: "eq", value: locale }
  ] : [], 200);

  return rows.map((row) => ({
    ...row,
    variables: row.variablesJson ? JSON.parse(row.variablesJson) as string[] : row.variables
  }));
}
