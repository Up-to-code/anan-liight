export class AdaptiveThrottle {
  private delayMs: number;

  public constructor(private readonly minDelayMs = 50, private readonly maxDelayMs = 2000) {
    this.delayMs = minDelayMs;
  }

  public async waitTurn(): Promise<void> {
    if (this.delayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  public onSuccess(latencyMs: number): void {
    if (latencyMs < 400 && this.delayMs > this.minDelayMs) {
      this.delayMs = Math.max(this.minDelayMs, Math.floor(this.delayMs * 0.9));
    }
  }

  public onBackpressure(): void {
    this.delayMs = Math.min(this.maxDelayMs, Math.floor(this.delayMs * 1.8) + 50);
  }

  public snapshot(): { delayMs: number } {
    return { delayMs: this.delayMs };
  }
}
