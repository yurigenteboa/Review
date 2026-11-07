// Sobe um Postgres local (PGlite) com stubs do Supabase (auth, storage, papéis) e roda as migrações em ordem.
// Sobe um Postgres (PGlite) com stubs do Supabase e roda todas as migrações em ordem.
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import fs from 'fs'
import path from 'path'
export async function setup(migDir, { skip = [] } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } })
  await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema if not exists extensions; grant usage on schema extensions to anon, authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), provider text, identity_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema storage to anon, authenticated; grant all on storage.objects to anon, authenticated;
alter table storage.objects enable row level security;
`)
  const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql') && !skip.some(s => f.includes(s))).sort()
  for (const f of files) {
    try { await db.exec(fs.readFileSync(path.join(migDir, f), 'utf8')) }
    catch (e) { throw new Error(`${f}: ${e.message}`) }
  }
  return { db, files }
}
export function actor(db) {
  const run = async (uid, sql, params) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid ?? ''}',false); set role ${uid ? 'authenticated' : 'anon'};`)
    try { return await db.query(sql, params) } finally { await db.exec('reset role') }
  }
  return run
}
