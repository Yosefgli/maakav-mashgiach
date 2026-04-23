# מערכת מעקב ביקורי משגיחים

אפליקציית `Next.js + Supabase` לניהול ביקורי משגיחים בשטח, עם התחברות, סריקת QR, לוגים, דשבורד משגיח ודשבורד מנהל.

## 1. התקנת הפרויקט

```bash
npm install
```

## 2. יצירת פרויקט Supabase

1. לפתוח פרויקט חדש ב-[Supabase](https://supabase.com).
2. להיכנס ל-`Project Settings > API`.
3. להעתיק:
   - `Project URL`
   - `anon public key`

## 3. הגדרת קובץ סביבה

ליצור קובץ `.env.local` בשורש הפרויקט:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

בלי הקובץ הזה האפליקציה תעלה במצב דמו.

## 4. הקמת בסיס הנתונים

1. ב-Supabase, לפתוח את `SQL Editor`.
2. להריץ את הקובץ [`supabase/schema.sql`](./supabase/schema.sql).
3. אחר כך להריץ את הקובץ [`supabase/seed.sql`](./supabase/seed.sql).

## 5. יצירת משתמשים

1. ב-Supabase לפתוח `Authentication > Users`.
2. ליצור לפחות שני משתמשים:
   - משגיח
   - מנהל
3. להעתיק את ה-UUID של כל משתמש.
4. לעדכן את פקודות ה-`insert` המודגמות ב-`seed.sql` ולהריץ אותן עם ה-UUID האמיתיים.

## 6. הרשאות מקומות

להריץ את פקודת ההרשאה מתוך `seed.sql` אחרי שהכנסת את UUID של המשגיח.

## 7. הרצה מקומית

```bash
npm run dev
```

ואז לפתוח את:

[http://localhost:3000](http://localhost:3000)

## 8. איך בודקים

- להתחבר כמשגיח ולוודא שרואים רק את הלוגים שלו.
- לסרוק או להזין `LOC-1001-XYZ` או `LOC-2001-XYZ` ולוודא שנרשמת כניסה מוצלחת.
- לסרוק `LOC-3001-XYZ` ולוודא שמתקבלת שגיאת הרשאה ונרשם לוג.
- לסרוק קוד לא קיים ולוודא שמתקבלת שגיאה ונרשם לוג.
- להתחבר כמנהל ולבדוק סינון לפי תאריכים, מקום, עיר ומשגיח.

## מבנה עיקרי

- `src/components/app-shell.tsx` - המסך הראשי, התחברות ושני הדשבורדים
- `src/components/qr-scanner-dialog.tsx` - סריקת QR והזנה ידנית
- `src/lib/data-service.ts` - חיבור ל-Supabase ומצב דמו
- `supabase/schema.sql` - סכימה, RLS, ופונקציית רישום ביקור

