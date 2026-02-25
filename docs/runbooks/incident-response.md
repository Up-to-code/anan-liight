# Incident Response

## Severity Triggers
1. p99 error rate > 0.5%
2. parity mismatch > 0.1%
3. dead-letter spike beyond baseline

## Actions
1. Capture trace id and affected tenant ids.
2. Check queue saturation and worker active count.
3. Inspect circuit breaker state for model chain.
4. Move traffic to fallback by feature flags if needed.
5. Replay dead letters after root-cause patch.
