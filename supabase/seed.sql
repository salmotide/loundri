do $$
begin
  if not exists (select 1 from auth.users where email = 'OWNER_EMAIL') then
    raise exception 'Ganti OWNER_EMAIL dengan email akun Supabase yang sudah terdaftar.';
  end if;
end;
$$;

with
owner as (
  select id from auth.users where email = 'OWNER_EMAIL'
),
pelanggan_baru as (
  insert into public.pelanggan (user_id, nama, no_hp, alamat)
  select id, data.nama, data.no_hp, data.alamat
    from owner
    cross join (values
      ('Siti Rahmawati', '081234567890', 'Gatak, Sukoharjo'),
      ('Budi Santoso', '082233445566', 'Kartasura, Sukoharjo'),
      ('Dewi Lestari', '085611223344', 'Laweyan, Surakarta')
    ) as data(nama, no_hp, alamat)
  returning id, user_id, nama
),
layanan_baru as (
  insert into public.layanan (user_id, nama, harga)
  select id, data.nama, data.harga
    from owner
    cross join (values
      ('Cuci kiloan', 6000),
      ('Cuci dan setrika', 8000),
      ('Setrika saja', 4000)
    ) as data(nama, harga)
  returning id, user_id, nama
)
insert into public.pesanan
  (user_id, pelanggan_id, layanan_id, berat, status, tanggal_masuk, tanggal_selesai)
select p.user_id, p.id, l.id, data.berat, data.status, data.tanggal_masuk, data.tanggal_selesai
  from (values
    ('Siti Rahmawati', 'Cuci dan setrika', 3.5, 'Dicuci', date '2026-11-16', null::date),
    ('Budi Santoso', 'Cuci kiloan', 5.0, 'Dicuci', date '2026-11-15', null::date),
    ('Dewi Lestari', 'Setrika saja', 2.0, 'Selesai', date '2026-11-14', date '2026-11-16'),
    ('Siti Rahmawati', 'Cuci kiloan', 4.0, 'Diambil', date '2026-11-12', date '2026-11-13')
  ) as data(nama_pelanggan, nama_layanan, berat, status, tanggal_masuk, tanggal_selesai)
  join pelanggan_baru as p on p.nama = data.nama_pelanggan
  join layanan_baru as l on l.user_id = p.user_id and l.nama = data.nama_layanan;
