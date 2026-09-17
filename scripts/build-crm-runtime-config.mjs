import { mkdir, writeFile } from 'node:fs/promises';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required to build /crm');
}

await mkdir(new URL('../public/crm/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../public/crm/runtime-config.js', import.meta.url),
  `window.ARROKO_CRM_CONFIG = ${JSON.stringify({ supabaseUrl, supabaseAnonKey })};\n`,
  'utf8',
);

console.log('CRM runtime configuration generated from deployment environment.');
