-- Muro público de resultados del juego de capitales.
-- Pega este archivo entero en Supabase → SQL Editor → New query y pulsa «Run».
-- Crea la tabla y deja que cualquiera LEA el muro y AÑADA resultados, pero nadie
-- puede modificar ni borrar los que ya hay (eso solo se puede desde el panel de Supabase).

create table if not exists public.resultados (
  id         bigint generated always as identity primary key,
  creado     timestamptz not null default now(),
  nombre     text        not null check (char_length(btrim(nombre)) between 2 and 20),
  puntos     integer     not null check (puntos >= 0),
  aciertos   integer     not null check (aciertos >= 0),
  preguntas  integer     not null check (preguntas between 1 and 197),
  dir        text        not null check (dir in ('pc', 'cp', 'mix')),           -- país→capital, capital→país, mezcla
  modo       text        not null check (modo in ('escribir', 'opciones')),     -- escribiendo o 4 opciones
  zona       text        not null check (zona ~ '^(todo|(AF|NC|CB|SA|AS|EU|OC)(\+(AF|NC|CB|SA|AS|EU|OC))*)$'),
  limite     smallint    not null default 0 check (limite in (0, 10, 20, 30)), -- segundos por pregunta (0 = sin límite)
  segundos   integer     not null check (segundos between 1 and 86400),
  check (aciertos <= preguntas),
  check (puntos <= preguntas * 290)  -- máximo posible: 100 + 100 de racha + 90 de tiempo por pregunta
);

create index if not exists resultados_ranking on public.resultados (dir, modo, preguntas, puntos desc);
create index if not exists resultados_recientes on public.resultados (creado desc);

alter table public.resultados enable row level security;

drop policy if exists "Cualquiera puede ver el muro" on public.resultados;
create policy "Cualquiera puede ver el muro"
  on public.resultados for select to anon, authenticated using (true);

drop policy if exists "Cualquiera puede publicar un resultado" on public.resultados;
create policy "Cualquiera puede publicar un resultado"
  on public.resultados for insert to anon, authenticated with check (true);

grant select, insert on public.resultados to anon, authenticated;
