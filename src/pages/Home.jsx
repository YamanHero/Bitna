import { Link } from 'react-router-dom';

const APPS = [
  {
    to: '/projectflow',
    title: 'ProjectFlow',
    desc: 'מעקב אחרי פרויקט רכש ו-IT, ממכרז ועד אספקה: שלבים, סיכונים, החלטות, שינויים ותשלומים.',
  },
];

export default function Home() {
  return (
    <main className="page">
      <div className="home-head">
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>ביתנא</h1>
      </div>
      <p className="muted">האפליקציות שלנו במקום אחד</p>
      <div className="cards">
        {APPS.map((a) => (
          <Link key={a.to} to={a.to} className="card app-card">
            <h2>{a.title}</h2>
            <p>{a.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
