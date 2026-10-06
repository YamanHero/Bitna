import { Link } from 'react-router-dom';
import { overallProgress, overdueStages, useProjects } from '../projectflow/storage.js';

function ProjectFlowSummary() {
  const { projects } = useProjects();
  const active = projects.filter((p) => overallProgress(p) < 100);
  const late = active.filter((p) => overdueStages(p).length > 0);
  if (projects.length === 0) return <p className="app-stat">עוד אין פרויקטים. אפשר להתחיל מהראשון.</p>;
  return (
    <p className="app-stat">
      {active.length} פרויקטים בביצוע
      {late.length > 0 && <span className="warn">{late.length} עם שלבים באיחור</span>}
    </p>
  );
}

export default function Home() {
  return (
    <main className="page">
      <div className="home-head">
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>ביתנא</h1>
      </div>
      <p className="muted">האפליקציות שלנו במקום אחד</p>
      <div className="cards">
        <Link to="/projectflow" className="card app-card">
          <h2>מגדל בקרה</h2>
          <p>מעקב אחרי פרויקט רכש ו-IT, ממכרז ועד אספקה: שלבים, סיכונים, החלטות, שינויים ותשלומים.</p>
          <ProjectFlowSummary />
        </Link>
      </div>
    </main>
  );
}
