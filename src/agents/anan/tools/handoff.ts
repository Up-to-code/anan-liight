export interface HandoffDraft {
  userId: string;
  reason: string;
  summary: string;
  recommendedNextStep: string;
}

export async function createHandoffDraft(input: HandoffDraft): Promise<{ status: "queued"; draft: HandoffDraft }> {
  return { status: "queued", draft: input };
}
