import { runSync } from "../../scripts/sync-convex-env";

function withAnanLiightTarget(args: string[]): string[] {
  const hasTarget = args.some((arg, idx) => {
    const next = args[idx + 1];
    return arg === "--target" && Boolean(next);
  });
  if (hasTarget) return args;
  return [...args, "--target", "anan-liight"];
}

runSync(withAnanLiightTarget(process.argv.slice(2)));
