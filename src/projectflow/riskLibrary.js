// ספריית סיכונים מומלצת לפרויקטי רכש ומערכות מידע, לפי תחומי הסיכון המקובלים בניהול פרויקטים.
// לכל סיכון: הסתברות וחומרה התחלתיות (1 נמוכה עד 3 גבוהה), צעד מונע ושלבים שבהם הוא רלוונטי במיוחד.
// הערכים הם נקודת פתיחה. יש להתאים אותם לפרויקט.

export const CATEGORIES = [
  { id: 'scope', label: 'דרישות והיקף', color: '#2456e6' },
  { id: 'legal', label: 'הליך ומשפט', color: '#7c3aed' },
  { id: 'budget', label: 'תקציב', color: '#d97706' },
  { id: 'schedule', label: 'לוחות זמנים', color: '#dc2626' },
  { id: 'vendor', label: 'ספק', color: '#0d9488' },
  { id: 'tech', label: 'טכנולוגיה ואבטחה', color: '#0369a1' },
  { id: 'people', label: 'ארגון ואנשים', color: '#be185d' },
  { id: 'ops', label: 'הטמעה ותפעול', color: '#16a34a' },
];

const S = {
  needs: 'needs', budget: 'budget', docs: 'tender_docs', pub: 'publication', clar: 'clarifications',
  bids: 'bids', eval: 'evaluation', appr: 'approval', contract: 'contract', delivery: 'delivery',
  accept: 'acceptance', close: 'closure',
};

export const LIBRARY = [
  // דרישות והיקף
  { category: 'scope', title: 'דרישות לא מלאות או משתנות במהלך הפרויקט', p: 3, s: 3, stages: [S.needs, S.docs, S.delivery],
    mitigation: 'אפיון חתום, ניהול שינויים בבקשת שינוי בלבד, ובדיקת אפיון מול משתמשי קצה לפני הפרסום.' },
  { category: 'scope', title: 'הגורם הדורש לא זמין לאישורים והבהרות', p: 2, s: 2, stages: [S.needs, S.delivery, S.accept],
    mitigation: 'מינוי נציג קבוע עם סמכות להחליט, וקביעת מפגשים קבועים מראש.' },
  { category: 'scope', title: 'הצורך העסקי השתנה או נעלם לפני סיום', p: 1, s: 3, stages: [S.needs, S.budget],
    mitigation: 'אישור מחדש של הצורך מול הגורם הדורש בכל נקודת החלטה גדולה.' },

  // הליך ומשפט
  { category: 'legal', title: 'תנאי סף או קריטריונים עמומים שמובילים לעתירה או לערר', p: 2, s: 3, stages: [S.docs, S.pub, S.eval],
    mitigation: 'ניסוח תנאי סף שאפשר לבדוק במסמך, ובדיקה של היועץ המשפטי לפני הפרסום.' },
  { category: 'legal', title: 'מספר הצעות נמוך או הצעה יחידה', p: 2, s: 2, stages: [S.pub, S.bids],
    mitigation: 'פנייה יזומה לספקים בשוק, זמן סביר להגשה, ובדיקה מוקדמת של מדיניות לטיפול בהצעה יחידה.' },
  { category: 'legal', title: 'הארכות מועדים ושינויים במכרז שמעכבים את ההליך', p: 2, s: 2, stages: [S.clar, S.bids],
    mitigation: 'איסוף שאלות במועד אחד, תשובות מוכנות מראש, והחלטה מראש על מועד סופי.' },
  { category: 'legal', title: 'עיכוב באישורים נדרשים (ועדת מכרזים, חשב, יועץ משפטי)', p: 2, s: 3, stages: [S.budget, S.appr, S.contract],
    mitigation: 'מיפוי כל האישורים והזמן שלהם בתחילת הדרך, והגשת מסמך החלטה מוכן.' },
  { category: 'legal', title: 'חוזה שאינו מכסה אחריות, קניין רוחני, סודיות או יציאה מההתקשרות', p: 2, s: 3, stages: [S.docs, S.contract],
    mitigation: 'ייעוץ משפטי על החוזה, סעיפי יציאה והעברת ידע, וערבויות וביטוחים מתאימים.' },

  // תקציב
  { category: 'budget', title: 'חריגה מהתקציב בגלל הערכה ראשונית נמוכה', p: 2, s: 3, stages: [S.needs, S.budget, S.eval],
    mitigation: 'הערכה בטווח, רזרבה מאושרת, ובדיקת מחירי שוק לפני אישור התקציב.' },
  { category: 'budget', title: 'עלויות נלוות שלא נלקחו בחשבון (רישוי, תשתית, תחזוקה, הדרכה)', p: 3, s: 2, stages: [S.budget, S.docs, S.delivery],
    mitigation: 'חישוב עלות בעלות כוללת לתקופה, כולל תחזוקה שנתית.' },
  { category: 'budget', title: 'מקור תקציבי שאינו מובטח או מוגבל לשנה תקציבית', p: 2, s: 3, stages: [S.budget, S.contract, S.delivery],
    mitigation: 'אישור כתוב של מקור התקציב, ופריסת תשלומים לפי שנת התקציב.' },
  { category: 'budget', title: 'תשלום לפני קבלה או שלא לפי אבני דרך', p: 1, s: 3, stages: [S.contract, S.accept],
    mitigation: 'תשלום רק לפי אבני דרך, אחרי קבלה חתומה ובדיקת חשבונית.' },

  // לוחות זמנים
  { category: 'schedule', title: 'עיכוב בהליך המכרז שמזיז את כל הלוח', p: 3, s: 2, stages: [S.docs, S.pub, S.eval, S.appr],
    mitigation: 'תכנון לוח מהסוף אל ההתחלה עם מרווח, ומעקב שבועי אחרי מועדי השלבים.' },
  { category: 'schedule', title: 'תלות בגורם חיצוני שמעכב (תשתית, ספק אחר, אישור רגולטורי)', p: 2, s: 3, stages: [S.delivery, S.accept],
    mitigation: 'מיפוי תלויות ואחראי לכל אחת, והסכמה כתובה על מועדים.' },
  { category: 'schedule', title: 'יעד הפעלה קשיח (בחירות, תקציב, שינוי חקיקה) שאין בו גמישות', p: 2, s: 3, stages: [S.needs, S.budget, S.delivery],
    mitigation: 'הגדרת גרסה מינימלית שחייבת לעלות במועד, ותכנון המשך בשלב מאוחר יותר.' },

  // ספק
  { category: 'vendor', title: 'ספק שלא עומד בהתחייבויות או בלוחות הזמנים', p: 2, s: 3, stages: [S.eval, S.contract, S.delivery],
    mitigation: 'בדיקת המלצות, אבני דרך בחוזה עם קנסות, ופגישת סטטוס שבועית.' },
  { category: 'vendor', title: 'תלות בספק יחיד (נעילה) ויציאה יקרה', p: 2, s: 2, stages: [S.docs, S.eval, S.contract],
    mitigation: 'דרישה לפורמטים פתוחים, התחייבות להעברת ידע ותיעוד, וזכות גישה לקוד או לנתונים.' },
  { category: 'vendor', title: 'החלפת אנשי מפתח אצל הספק', p: 2, s: 2, stages: [S.contract, S.delivery],
    mitigation: 'סעיף בחוזה על החלפה באישור המזמין ועל מסירת ידע.' },
  { category: 'vendor', title: 'איכות תוצרים נמוכה שמתגלה רק בקבלה', p: 2, s: 3, stages: [S.delivery, S.accept],
    mitigation: 'בדיקות ביניים במהלך הביצוע, קריטריוני קבלה כתובים מראש, ותסריטי בדיקה משותפים.' },

  // טכנולוגיה ואבטחה
  { category: 'tech', title: 'אי-התאמה לתשתיות ולמערכות קיימות', p: 2, s: 3, stages: [S.needs, S.docs, S.delivery],
    mitigation: 'בדיקה מוקדמת עם גורמי התשתית, ובדיקת התאמה (אב טיפוס) לפני התחייבות מלאה.' },
  { category: 'tech', title: 'פגיעה באבטחת מידע או בהגנת הפרטיות', p: 2, s: 3, stages: [S.docs, S.delivery, S.accept],
    mitigation: 'דרישות אבטחה במכרז, סקר סיכונים ובדיקת חדירות לפני הפעלה, והגבלת הרשאות לפי תפקיד.' },
  { category: 'tech', title: 'ביצועים או עומסים שאינם עומדים בשיא השימוש', p: 2, s: 3, stages: [S.docs, S.accept],
    mitigation: 'דרישת ביצועים מספרית, ובדיקות עומס לפני הפעלה.' },
  { category: 'tech', title: 'נתונים ישנים שאינם עוברים תקין (הסבה)', p: 2, s: 2, stages: [S.delivery, S.accept],
    mitigation: 'ניקוי נתונים מוקדם, הסבת ניסיון והשוואה לפני המעבר.' },

  // ארגון ואנשים
  { category: 'people', title: 'חסרים אנשי מקצוע בארגון לליווי הפרויקט', p: 3, s: 2, stages: [S.needs, S.delivery],
    mitigation: 'הקצאת שעות מוגדרות מראש, ומינוי מחליף לכל תפקיד מפתח.' },
  { category: 'people', title: 'התנגדות של משתמשים או של גורמים בארגון', p: 2, s: 2, stages: [S.needs, S.delivery, S.close],
    mitigation: 'שיתוף משתמשים כבר באפיון, מפגשי הסבר, ונציגי משתמשים בבדיקות הקבלה.' },
  { category: 'people', title: 'החלפת בעלי תפקידים (מנהל פרויקט, גורם דורש, מנכ"ל)', p: 1, s: 3, stages: [S.contract, S.delivery],
    mitigation: 'תיעוד החלטות ומסמכי העברה, וקבלת אישור הנהלה לשינוי.' },

  // הטמעה ותפעול
  { category: 'ops', title: 'הדרכה והטמעה חלשות, כך שהמערכת לא נכנסת לשימוש', p: 3, s: 2, stages: [S.delivery, S.accept, S.close],
    mitigation: 'תכנית הדרכה ותמיכה מוגדרת, חומרי הדרכה וצוות עזרה בשבועות הראשונים.' },
  { category: 'ops', title: 'אין גורם שמתחזק את המערכת אחרי הפרויקט', p: 2, s: 3, stages: [S.contract, S.accept, S.close],
    mitigation: 'חוזה תחזוקה, העברת תיעוד וידע, ואחראי קבוע אצל המזמין.' },
  { category: 'ops', title: 'חזרה לנוהל הישן בלי מעבר מלא (תקלות בהפעלה)', p: 2, s: 2, stages: [S.accept, S.close],
    mitigation: 'תכנית מעבר עם נוהל גיבוי, והפעלה הדרגתית בהיקף קטן לפני ההפעלה המלאה.' },
].map((r, i) => ({ ...r, id: `lib-${i + 1}` }));
