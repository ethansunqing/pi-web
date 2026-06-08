import { homedir } from "os";
import { isAbsolute, resolve } from "path";

/** Normalize a user-supplied working directory path. */
export function normalizeCwd(cwd: string): string {
  if (cwd === "~") return homedir();
  if (cwd.startsWith("~/")) return resolve(homedir(), cwd.slice(2));
  return isAbsolute(cwd) ? cwd : resolve(cwd);
}
