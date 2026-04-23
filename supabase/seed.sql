insert into public.locations (name, city, qr_code)
values
  ('מאפיית הצפון', 'חיפה', 'LOC-1001-XYZ'),
  ('מפעל הגליל', 'עכו', 'LOC-2001-XYZ'),
  ('יקב הכרם', 'צפת', 'LOC-3001-XYZ')
on conflict (qr_code) do nothing;

-- אחרי יצירת משתמשים ב-Authentication > Users, יש לעדכן את ה-UUID האמיתי של כל משתמש:
-- insert into public.profiles (user_id, email, full_name, role)
-- values
--   ('UUID-OF-MASHGIACH', 'mashgiach@example.com', 'יוסף כהן', 'mashgiach'),
--   ('UUID-OF-ADMIN', 'admin@example.com', 'רחל לוי', 'admin');

-- insert into public.mashgiach_locations (mashgiach_user_id, location_id)
-- select 'UUID-OF-MASHGIACH', id
-- from public.locations
-- where qr_code in ('LOC-1001-XYZ', 'LOC-2001-XYZ');
