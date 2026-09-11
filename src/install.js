import { spawn } from 'node:child_process';

export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];

/** Detects the package manager that launched this CLI (`npx`, `pnpm dlx`, `yarn create`, `bunx`). */
export function detectPackageManager() {
  const agent = process.env.npm_config_user_agent ?? '';
  for (const manager of PACKAGE_MANAGERS) {
    if (agent.startsWith(`${manager}/`)) return manager;
  }
  return 'npm';
}

/** Runs `<manager> install` in `cwd`, streaming its output to the terminal. */
export function runInstall(manager, cwd) {
  if (!PACKAGE_MANAGERS.includes(manager)) {
    throw new Error(`Unsupported package manager "${manager}"`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(manager, ['install'], {
      cwd,
      stdio: 'inherit',
      // npm/pnpm/yarn are .cmd shims on Windows and cannot be spawned without a shell.
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${manager} install exited with code ${code}`));
    });
  });
}

/** Command that runs a package.json script with the given manager. */
export function runScriptCommand(manager, script) {
  switch (manager) {
    case 'yarn':
      return `yarn ${script}`;
    case 'pnpm':
      return `pnpm ${script}`;
    case 'bun':
      return `bun run ${script}`;
    default:
      return `npm ${script === 'start' || script === 'test' ? script : `run ${script}`}`;
  }
}
