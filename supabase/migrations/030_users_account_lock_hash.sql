alter table users add column if not exists account_lock_hash text default null;
