-- ============================================================================
-- 07b · Notifications, push tokens and the offline sync queue.
--
-- One notifications table serves both audiences. `audience` says who the row
-- is for and `recipient_id` is the auth.users id — a staff member or a shop.
-- Reads are gated on that id, so nobody can see anyone else's notifications
-- regardless of audience.
-- ============================================================================

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null,
  audience       text not null check (audience in ('staff', 'customer')),
  type           text not null,
  title          text not null,
  body           text,
  reference_type text,
  reference_id   uuid,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

create table public.device_push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  token      text not null,
  platform   text not null default 'unknown' check (platform in ('ios', 'android', 'web', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_push_tokens_key unique (user_id, token)
);

create trigger device_push_tokens_set_updated_at
  before update on public.device_push_tokens
  for each row execute function public.set_updated_at();

/** Register (or refresh) this device's push token. Any signed-in user. */
create or replace function public.register_push_token(p_token text, p_platform text default 'unknown')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if coalesce(trim(p_token), '') = '' then
    raise exception 'Push token is required.';
  end if;

  insert into public.device_push_tokens (user_id, token, platform)
  values (auth.uid(), trim(p_token), coalesce(nullif(trim(p_platform), ''), 'unknown'))
  on conflict (user_id, token) do update
    set platform = excluded.platform, updated_at = now();
end;
$$;

/** Mark one notification, or all of them, as read. */
create or replace function public.mark_notifications_read(p_notification_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = now()
  where recipient_id = auth.uid()
    and read_at is null
    and (p_notification_id is null or id = p_notification_id);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Offline sync queue for the field app.
--
-- Every action carries a device id and a locally generated action id; the pair
-- is unique, so replaying a queue after a flaky connection can never create
-- the same order twice.
-- ---------------------------------------------------------------------------
create table public.mobile_sync_queue (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid,
  device_id           text not null,
  local_action_id     text not null,
  action_type         text not null check (action_type in ('BOOK_ORDER', 'CAPTURE_PAYMENT')),
  payload             jsonb not null,
  status              text not null check (status in ('synced', 'failed', 'conflict_requires_review')),
  server_reference_id uuid,
  conflict_reason     text,
  created_at          timestamptz not null default now(),
  constraint mobile_sync_queue_key unique (device_id, local_action_id)
);

create index mobile_sync_queue_user_idx on public.mobile_sync_queue (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- WhatsApp / messaging.
--
-- integration_settings holds the access token, so it is deliberately
-- unreadable by `authenticated`: no policy, no grant, service-role only. It is
-- also excluded from audit logging so a token can never end up in the log.
-- ---------------------------------------------------------------------------
create table public.integration_settings (
  id                       boolean primary key default true check (id),
  whatsapp_phone_number_id text,
  whatsapp_access_token    text,
  updated_at               timestamptz not null default now(),
  updated_by               uuid
);

insert into public.integration_settings (id) values (true);

create table public.message_log (
  id             uuid primary key default gen_random_uuid(),
  party_type     text not null check (party_type in ('customer', 'supplier')),
  party_id       uuid not null,
  channel        text not null check (channel in ('whatsapp_api', 'whatsapp_link', 'sms')),
  message_type   text not null check (message_type in ('invoice', 'receipt', 'reminder', 'other')),
  reference_type text,
  reference_id   uuid,
  to_phone       text not null,
  status         text not null check (status in ('sent', 'failed')),
  error          text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

create index message_log_created_idx on public.message_log (created_at desc);
create index message_log_reference_idx on public.message_log (reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notifications         enable row level security;
alter table public.device_push_tokens    enable row level security;
alter table public.mobile_sync_queue     enable row level security;
alter table public.integration_settings  enable row level security;
alter table public.message_log           enable row level security;

-- You see your own notifications, whoever you are.
create policy notifications_own on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));

create policy device_push_tokens_own on public.device_push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

create policy mobile_sync_queue_own on public.mobile_sync_queue
  for select to authenticated
  using (user_id = (select auth.uid()) or public.staff_has_role('owner', 'manager'));

create policy message_log_read on public.message_log
  for select to authenticated using (public.staff_has_role('owner', 'manager'));

-- integration_settings: no policy and no grant on purpose. Service role only.
revoke all on public.integration_settings from authenticated, anon;

grant select on public.notifications, public.device_push_tokens,
                public.mobile_sync_queue, public.message_log to authenticated;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.mark_notifications_read(uuid) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated, service_role;
grant execute on function public.mark_notifications_read(uuid) to authenticated, service_role;
