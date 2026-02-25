export type ReplayAction = () => Promise<void>;

export class StepReplayRegistry {
  private readonly actions = new Map<string, ReplayAction>();

  public register(actionKey: string, action: ReplayAction): void {
    this.actions.set(actionKey, action);
  }

  public resolve(actionKey: string): ReplayAction | null {
    return this.actions.get(actionKey) ?? null;
  }
}
