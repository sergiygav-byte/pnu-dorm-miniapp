-- Крок 2: виконати в Supabase → SQL Editor → Run
-- База для додатку "Гуртожиток №1 ПНУ"

-- Цілі збору коштів
create table if not exists goals (
  id text primary key,
  title text not null,
  description text default '',
  target_amount numeric not null default 0,
  created_at timestamptz default now()
);

-- Платежі студентів
create table if not exists payments (
  id text primary key,
  room text not null,
  name text not null,
  amount numeric not null default 0,
  paid_date text default '-',
  status text not null default 'Не здано',
  created_at timestamptz default now()
);

-- Витрати (фото — окремо в expense_photos)
create table if not exists expenses (
  id text primary key,
  title text not null,
  amount numeric not null default 0,
  description text default '',
  expense_date date,
  created_at timestamptz default now()
);

create table if not exists expense_photos (
  id bigserial primary key,
  expense_id text references expenses(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  sort_order int default 0
);

-- Події
create table if not exists events (
  id text primary key,
  title text not null,
  description text default '',
  event_date date,
  event_time text default '',
  location text default '',
  created_at timestamptz default now()
);

-- Чергування (прибирання)
create table if not exists duty (
  id text primary key,
  floor text not null,
  wing text default '',
  room text not null,
  duty_date date,
  created_at timestamptz default now()
);

-- Керівництво / контакти
create table if not exists leaders (
  id text primary key,
  role text not null,
  name text not null,
  phone text default '',
  telegram text default '',
  created_at timestamptz default now()
);

-- Скарги / заявки
create table if not exists complaints (
  id text primary key,
  floor text not null,
  room text not null,
  subject text not null,
  description text default '',
  status text not null default 'В обробці ⏳',
  complaint_date date,
  created_at timestamptz default now()
);

create table if not exists complaint_photos (
  id bigserial primary key,
  complaint_id text references complaints(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  sort_order int default 0
);

-- Сторінки "Інфо" та "Правила" (один рядок на тип)
create table if not exists site_content (
  key text primary key,
  html_content text not null,
  updated_at timestamptz default now()
);

-- Для простого старту: усі можуть читати, писати — через anon (пізніше посилимо RLS + адмін)
alter table goals enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table expense_photos enable row level security;
alter table events enable row level security;
alter table duty enable row level security;
alter table leaders enable row level security;
alter table complaints enable row level security;
alter table complaint_photos enable row level security;
alter table site_content enable row level security;

create policy "public read goals" on goals for select using (true);
create policy "public write goals" on goals for all using (true) with check (true);

create policy "public read payments" on payments for select using (true);
create policy "public write payments" on payments for all using (true) with check (true);

create policy "public read expenses" on expenses for select using (true);
create policy "public write expenses" on expenses for all using (true) with check (true);

create policy "public read expense_photos" on expense_photos for select using (true);
create policy "public write expense_photos" on expense_photos for all using (true) with check (true);

create policy "public read events" on events for select using (true);
create policy "public write events" on events for all using (true) with check (true);

create policy "public read duty" on duty for select using (true);
create policy "public write duty" on duty for all using (true) with check (true);

create policy "public read leaders" on leaders for select using (true);
create policy "public write leaders" on leaders for all using (true) with check (true);

create policy "public read complaints" on complaints for select using (true);
create policy "public write complaints" on complaints for all using (true) with check (true);

create policy "public read complaint_photos" on complaint_photos for select using (true);
create policy "public write complaint_photos" on complaint_photos for all using (true) with check (true);

create policy "public read site_content" on site_content for select using (true);
create policy "public write site_content" on site_content for all using (true) with check (true);

-- Storage bucket для фото (створити також у Dashboard → Storage → New bucket "photos", public)
-- insert into storage.buckets (id, name, public) values ('photos', 'photos', true);
