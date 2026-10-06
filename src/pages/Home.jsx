import { Link } from 'react-router-dom';

const APPS = [
  {
    to: '/projectflow',
    title: 'ProjectFlow',
    desc: 'ניהול מחזור חיים של פרויקט רכש ו-IT – ממכרז ועד אספקה',
  },
];

export default function Home() {
  return (
    <main className="page">
      <h1>ביתנא</h1>
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
