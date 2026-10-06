# ביתנא (Baytuna / Bitna)

אפליקציית ווב ביתית (React + Vite). נפרסת ב-Vercel.

## הרצה מקומית

```bash
npm install
npm run dev
```

## נתיבים

| נתיב | תיאור |
| --- | --- |
| `/` | דף הבית |
| `/projectflow` | ProjectFlow – ניהול מחזור חיים של פרויקט רכש / IT, ממכרז ועד אספקה |

## מגדל בקרה (ProjectFlow)

הקוד נמצא ב-`src/projectflow/`. שלבי מחזור החיים מוגדרים ב-`stages.js` וניתנים להתאמה.
כרגע הנתונים נשמרים ב-localStorage של הדפדפן; המעבר ל-Supabase יתבצע בהמשך.
