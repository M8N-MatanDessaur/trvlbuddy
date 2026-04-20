alter table public.profiles
  add column if not exists theme text not null default 'light';

-- Sanity guard so a bogus theme id never lands in the row.
alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in (
    'light',
    'dark',
    'mono-light',
    'mono-dark',
    'forest',
    'ocean',
    'midnight',
    'sunset',
    'lavender',
    'sand'
  ));
