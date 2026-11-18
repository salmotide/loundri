do $$
declare
  owner_id uuid;
begin
  select id
    into owner_id
    from auth.users
   where email = 'OWNER_EMAIL';

  if owner_id is null then
    raise exception 'Ganti OWNER_EMAIL dengan email akun Supabase yang sudah terdaftar.';
  end if;

  insert into public.pengaturan_publik (id, owner_user_id)
  values (true, owner_id)
  on conflict (id) do update
    set owner_user_id = excluded.owner_user_id;
end;
$$;

notify pgrst, 'reload schema';
