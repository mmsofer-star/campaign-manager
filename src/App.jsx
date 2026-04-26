-- רק מוסיף עמודת user_id לטבלה הקיימת
alter table donors add column if not exists user_id text default 'meni';

-- מעדכן את כל התורמים הקיימים להיות של מני
update donors set user_id = 'meni' where user_id is null or user_id = '';

-- טבלת משתמשים
create table if not exists users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  name text not null,
  created_at timestamp default now()
);

alter table users enable row level security;
create policy "allow all users" on users for all using (true) with check (true);
