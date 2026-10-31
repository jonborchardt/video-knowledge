// Killing a child and everything it started (node, tsx, chrome-headless-shell): Windows needs taskkill's tree flag,
// elsewhere the child is its own process group (spawned detached) and the group is signalled.
import { spawnSync } from 'node:child_process';

export function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

export const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
