import { spawn } from 'node:child_process';
import { access, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));

function run(command, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? accept() :
      reject(new Error(`${command} terminó ${signal ? `por ${signal}` : `con código ${code}`}.`)));
    for (const signal of ['SIGINT', 'SIGTERM']) {
      const forward = () => child.kill(signal);
      process.once(signal, forward);
      child.once('exit', () => process.removeListener(signal, forward));
    }
  });
}

async function git(directory, args) {
  const chunks = [];
  await new Promise((accept, reject) => {
    const child = spawn('git', ['-c', 'core.hooksPath=/dev/null', '-C', directory, ...args], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout.on('data', (data) => chunks.push(data));
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? accept() : reject(new Error(`Git terminó con código ${code}.`)));
  });
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function exists(path) {
  try { await access(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function prepareSystem() {
  const config = JSON.parse(await readFile(join(root, 'system.json'), 'utf8'));
  if (typeof config.repository !== 'string' || !config.repository ||
      /[\s\x00-\x1f]/.test(config.repository) ||
      !/^(?:https?:\/\/|ssh:\/\/|[\w.-]+@[\w.-]+:|\/)/.test(config.repository) ||
      /^https?:\/\/[^/]*@/.test(config.repository) ||
      typeof config.ref !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/.test(config.ref) ||
      config.ref.includes('..') || config.ref.includes('//') || /[/.]$/.test(config.ref)) {
    throw new Error('Configura repository y ref en system.json, o usa --system /ruta/al/proyecto-astro.');
  }
  const system = join(root, '.cache/system');
  await mkdir(dirname(system), { recursive: true });
  const fresh = !await exists(system);
  if (fresh) {
    await git(root, ['clone', '--no-checkout', '--no-tags', '--', config.repository, system]);
  }
  if (!(await lstat(join(system, '.git'))).isDirectory() ||
      await realpath(await git(system, ['rev-parse', '--show-toplevel'])) !== await realpath(system) ||
      await git(system, ['remote', 'get-url', 'origin']) !== config.repository) {
    throw new Error('La copia en .cache/system no coincide con system.json. Consérvala aparte antes de continuar.');
  }
  if (!fresh && await git(system, ['status', '--porcelain'])) throw new Error('Hay cambios locales en .cache/system; consérvalos antes de continuar.');
  await git(system, ['fetch', '--no-tags', 'origin', config.ref]);
  const commit = await git(system, ['rev-parse', '--verify', 'FETCH_HEAD^{commit}']);
  await git(system, ['checkout', '--detach', commit]);
  await writeFile(join(root, '.cache/system-version.json'), JSON.stringify({ ...config, commit }, null, 2) + '\n');
  // Install the lockfile of the selected system version on every managed build.
  await run('npm', ['ci'], { cwd: system });
  return system;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (!['sync', 'check', 'dev', 'build', 'preview'].includes(command) ||
      (args.length && (args.length !== 2 || args[0] !== '--system'))) {
    throw new Error('Uso: node library.mjs sync|check|dev|build|preview [--system /ruta/al/proyecto-astro]');
  }
  const supplied = args[1] && resolve(process.cwd(), args[1]);
  // Preview serves the existing output and never changes its source version.
  const system = supplied ?? (command === 'preview' ? join(root, '.cache/system') : await prepareSystem());
  await access(join(system, 'package.json'));
  const env = { ...process.env, DOCUMENTS_MANIFEST: join(root, 'documents.yaml') };
  if (supplied && !await exists(join(system, 'node_modules'))) await run('npm', ['ci'], { cwd: system, env });
  if (['sync', 'dev', 'build'].includes(command)) {
    await run('npm', ['run', 'documents:sync'], { cwd: system, env });
  }
  if (command === 'check') await run('npm', ['run', 'documents:check'], { cwd: system, env });
  if (['dev', 'build', 'preview'].includes(command)) await run('npm', ['run', command], { cwd: system, env });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
