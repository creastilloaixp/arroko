import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const candidates = ['.env.local', '.env', '../../.env.local', '../../.env'];
const values = {};
for (const candidate of candidates) {
  const path = resolve(candidate);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || values[match[1]]) continue;
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const url = values.VITE_SUPABASE_URL || values.SUPABASE_URL;
const anon = values.VITE_SUPABASE_ANON_KEY || values.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('No encontré VITE_SUPABASE_URL/SUPABASE_URL y la anon key en los archivos locales permitidos.');
  process.exit(1);
}

const vars = {
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: anon,
  VITE_ARROKO_EXPERIENCE_URL: `${url.replace(/\/$/, '')}/functions/v1/arroko-public-experience`,
};
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const [name, value] of Object.entries(vars)) {
  for (const target of ['production']) {
    const result = spawnSync(command, ['vercel', 'env', 'add', name, target, '--value', value, '--force', '--yes'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
    });
    if (result.status !== 0) {
      const diagnostic = `${result.stdout || ''}\n${result.stderr || ''}`.replaceAll(value, '[hidden]');
      console.error(`No se pudo configurar ${name} (${target}).\n${diagnostic}`);
      process.exit(result.status || 1);
    }
  }
  console.log(`${name}: configurada en Vercel Production (valor oculto).`);
}
