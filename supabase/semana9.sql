-- supabase/semana9.sql — GeoCam Semana 9: sincronización offline-first
-- Ejecutar DESPUÉS de schema.sql (Semana 8), en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin errores.

-- ============================================================
-- T1. Reloj del servidor: cuándo llegó cada cambio a Supabase (cursor de bajada)
-- ============================================================
alter table public.photos
  add column if not exists server_updated_at timestamptz not null default now();

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists photos_touch_server_updated_at on public.photos;
create trigger photos_touch_server_updated_at
  before insert or update on public.photos
  for each row execute function public.touch_server_updated_at();

create index if not exists photos_user_server_updated_idx
  on public.photos (user_id, server_updated_at);

-- La política de UPDATE que pide la guía ("editar las mías") NO se crea aquí:
-- ya existe desde la Semana 8 con el nombre "actualizar las mías" (ver schema.sql).

-- ============================================================
-- C1. Borrado lógico: la fila queda como marca para que los demás teléfonos se enteren
-- ============================================================
alter table public.photos
  add column if not exists deleted_at timestamptz;

-- C2. Feed de la nube: orden por taken_at (cursor) solo entre las fotos no borradas
create index if not exists photos_user_taken_idx
  on public.photos (user_id, taken_at desc)
  where deleted_at is null;
