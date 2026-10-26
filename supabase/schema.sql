-- MUXI Supabase foundation. Run in Supabase SQL Editor on a test project first.
create extension if not exists pgcrypto;
create type public.app_role as enum ('buyer', 'producer', 'admin');
create type public.beat_review_status as enum ('pending', 'approved', 'rejected');
create type public.order_status as enum ('payment_pending', 'reviewing', 'approved', 'declined');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'buyer',
  kpay_number text,
  kpay_name text,
  created_at timestamptz not null default now()
);

create table public.beats (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  genre text not null default 'Other',
  bpm integer,
  musical_key text,
  description text,
  preview_path text,
  wav_path text not null,
  stem_zip_path text,
  beat_price_mmk integer not null check (beat_price_mmk > 0),
  stem_price_mmk integer check (stem_price_mmk is null or stem_price_mmk > 0),
  review_status public.beat_review_status not null default 'pending',
  sold_out boolean not null default false,
  sold_to uuid references public.profiles(id),
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  producer_id uuid not null references public.profiles(id) on delete restrict,
  purchase_type text not null check (purchase_type in ('beat_wav', 'stem_zip')),
  amount_mmk integer not null check (amount_mmk > 0),
  payment_screenshot_path text,
  status public.order_status not null default 'payment_pending',
  producer_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index beats_marketplace_idx on public.beats(review_status, sold_out, created_at desc);
create index orders_producer_idx on public.orders(producer_id, status, created_at desc);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);

-- All new accounts are buyers by default.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)), 'buyer')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.beats enable row level security;
alter table public.orders enable row level security;

create policy "profiles_read_self" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_app_role() = 'admin');
create policy "profiles_update_self" on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy "beats_marketplace_read" on public.beats for select to anon, authenticated
using (review_status = 'approved' or producer_id = auth.uid() or public.current_app_role() = 'admin');
create policy "producer_create_own_pending_beat" on public.beats for insert to authenticated
with check (producer_id = auth.uid() and public.current_app_role() = 'producer' and review_status = 'pending' and sold_out = false);
create policy "producer_update_own_beat" on public.beats for update to authenticated
using (producer_id = auth.uid() and public.current_app_role() = 'producer')
with check (producer_id = auth.uid() and public.current_app_role() = 'producer');
create policy "admin_manage_beats" on public.beats for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "orders_read_parties" on public.orders for select to authenticated
using (buyer_id = auth.uid() or producer_id = auth.uid() or public.current_app_role() = 'admin');
create policy "buyer_create_order" on public.orders for insert to authenticated
with check (
  buyer_id = auth.uid() and status = 'payment_pending'
  and exists (
    select 1 from public.beats b where b.id = beat_id and b.producer_id = producer_id
    and b.review_status = 'approved' and b.sold_out = false
    and ((purchase_type = 'beat_wav' and amount_mmk = b.beat_price_mmk)
      or (purchase_type = 'stem_zip' and b.stem_zip_path is not null and amount_mmk = b.stem_price_mmk))
  )
);
create policy "admin_manage_orders" on public.orders for all to authenticated
using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

-- Only the producer assigned to the order can decide it. Approval and Sold Out are atomic.
create or replace function public.producer_decide_order(p_order_id uuid, p_approve boolean, p_note text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_beat public.beats;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if (v_order.producer_id <> auth.uid() and public.current_app_role() <> 'admin')
     or public.current_app_role() not in ('producer', 'admin') then raise exception 'Not authorized'; end if;
  if v_order.status not in ('payment_pending', 'reviewing') then raise exception 'Order is no longer awaiting review'; end if;
  select * into v_beat from public.beats where id = v_order.beat_id for update;
  if p_approve then
    if v_beat.sold_out then raise exception 'This beat has already been sold'; end if;
    update public.beats set sold_out = true, sold_to = v_order.buyer_id, sold_at = now(), updated_at = now() where id = v_order.beat_id;
    update public.orders set status = 'approved', producer_note = p_note, decided_at = now() where id = p_order_id returning * into v_order;
    update public.orders set status = 'declined', producer_note = 'Beat sold to another buyer before approval.', decided_at = now()
      where beat_id = v_order.beat_id and id <> p_order_id and status in ('payment_pending', 'reviewing');
  else
    update public.orders set status = 'declined', producer_note = p_note, decided_at = now() where id = p_order_id returning * into v_order;
  end if;
  return v_order;
end; $$;
revoke all on function public.producer_decide_order(uuid, boolean, text) from public;
grant execute on function public.producer_decide_order(uuid, boolean, text) to authenticated;

-- Prevent role self-promotion from the client.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.current_app_role() <> 'admin' then
    raise exception 'Only an admin can change account roles';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles
for each row execute function public.protect_profile_role();

-- Create private Storage buckets and secure Storage policies separately; see setup guide.


-- Producers cannot self-approve listings or mark a beat sold out.
create or replace function public.protect_beat_moderation_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null
     and public.current_app_role() <> 'admin'
     and (
       new.review_status is distinct from old.review_status
       or new.sold_out is distinct from old.sold_out
       or new.sold_to is distinct from old.sold_to
       or new.sold_at is distinct from old.sold_at
     ) then
    raise exception 'Only an admin or the secure sale function can change moderation/sale fields';
  end if;
  return new;
end; $$;
drop trigger if exists protect_beat_moderation_fields_trigger on public.beats;
create trigger protect_beat_moderation_fields_trigger
before update on public.beats
for each row execute function public.protect_beat_moderation_fields();

-- Storage setup: previews are public only because they are short, watermarked/demo audio.
-- Full WAVs, stems and payment proofs stay private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('beat-previews', 'beat-previews', true, 52428800, array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4']),
  ('beat-files', 'beat-files', false, 524288000, array['audio/wav','audio/x-wav','application/zip','application/octet-stream']),
  ('payment-proofs', 'payment-proofs', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Producers upload only into their own user-id folder.
drop policy if exists "producer_upload_preview_own_folder" on storage.objects;
create policy "producer_upload_preview_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'beat-previews'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_app_role() in ('producer', 'admin')
);

drop policy if exists "producer_upload_beat_file_own_folder" on storage.objects;
create policy "producer_upload_beat_file_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'beat-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_app_role() in ('producer', 'admin')
);

drop policy if exists "buyer_upload_payment_proof_own_folder" on storage.objects;
create policy "buyer_upload_payment_proof_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "producer_read_own_or_sold_beat_files" on storage.objects;
create policy "producer_read_own_or_sold_beat_files" on storage.objects
for select to authenticated
using (
  bucket_id = 'beat-files' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_app_role() = 'admin'
    or exists (
      select 1 from public.beats b
      join public.orders o on o.beat_id = b.id
      where (b.wav_path = name or b.stem_zip_path = name)
        and o.buyer_id = auth.uid() and o.status = 'approved'
    )
  )
);

drop policy if exists "parties_read_payment_proofs" on storage.objects;
create policy "parties_read_payment_proofs" on storage.objects
for select to authenticated
using (
  bucket_id = 'payment-proofs' and exists (
    select 1 from public.orders o
    where o.payment_screenshot_path = name
      and (o.buyer_id = auth.uid() or o.producer_id = auth.uid() or public.current_app_role() = 'admin')
  )
);

drop policy if exists "owners_delete_own_muxi_storage" on storage.objects;
create policy "owners_delete_own_muxi_storage" on storage.objects
for delete to authenticated
using (
  bucket_id in ('beat-previews','beat-files','payment-proofs')
  and (storage.foldername(name))[1] = auth.uid()::text
);
