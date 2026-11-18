create table if not exists public.pengaturan_publik (
  id boolean primary key default true check (id),
  owner_user_id uuid not null references auth.users (id) on delete cascade
);

alter table public.pengaturan_publik enable row level security;
revoke all on public.pengaturan_publik from public, anon, authenticated;

-- The view is the sole anonymous read path; it intentionally omits contact details.
create or replace view public.pesanan_publik
with (security_barrier = true, security_invoker = false)
as
select
  p.id,
  c.nama as pelanggan_nama,
  l.nama as layanan_nama,
  p.berat,
  p.status,
  p.total,
  p.tanggal_masuk
from public.pesanan as p
join public.pelanggan as c
  on c.id = p.pelanggan_id and c.user_id = p.user_id
join public.layanan as l
  on l.id = p.layanan_id and l.user_id = p.user_id
join public.pengaturan_publik as setting
  on setting.owner_user_id = p.user_id;

revoke all on public.pesanan_publik from public, anon, authenticated;
grant select on public.pesanan_publik to anon, authenticated;

notify pgrst, 'reload schema';
