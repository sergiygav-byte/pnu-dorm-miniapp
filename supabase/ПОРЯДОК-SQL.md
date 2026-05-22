# Який SQL файл запускати?

Відкрийте **Supabase → SQL Editor** і виконайте файли **з папки цього проєкту** (`supabase/`).

## Варіант А — база вже була (найчастіше у вас)

| Порядок | Файл | Коли |
|---------|------|------|
| 1 | `migration_v2.sql` | Якщо ще не запускали (опитування, push-підписники) |
| 2 | `migration_v3.sql` | Коментарі, кімната, журнал бота |
| 3 | `migration_v4.sql` | Вимкнення push, відвідувачі Mini App |
| 4 | `migration_v5.sql` | **Завжди зараз** — тест push, статистика, санітарка |

Якщо v4 вже був — лише **migration_v5.sql**.

## Варіант Б — повністю нова база

| Порядок | Файл |
|---------|------|
| 1 | `schema.sql` |
| 2 | `migration_v2.sql` |
| 3 | `migration_v3.sql` |
| 4 | `migration_v4.sql` |
| 5 | `migration_v5.sql` |

## Після запуску

- Table Editor → є `complaint_comments`
- `leaders` → колонка `room`
- `app_settings` → змінити `admin_password`

Повна інструкція: **`ПОЧАТОК.md`** у корені проєкту.
