-- Expand the allowed theme set to 12 named themes (clean 3x4 grid in the picker).
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
    'sand',
    'crimson',
    'mint'
  ));
