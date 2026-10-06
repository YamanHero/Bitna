import { Routes, Route, Link } from 'react-router-dom';
import AuthGate from './lib/AuthGate.jsx';
import Home from './pages/Home.jsx';
import ProjectFlow from './projectflow/ProjectFlow.jsx';

function NotFound() {
  return (
    <main className="page">
      <h1>הדף לא נמצא</h1>
      <p>
        <Link to="/">חזרה לדף הבית</Link>
      </p>
    </main>
  );
}

export default function App() {
  return (
    <AuthGate>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/projectflow/*" element={<ProjectFlow />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </AuthGate>
  );
}
