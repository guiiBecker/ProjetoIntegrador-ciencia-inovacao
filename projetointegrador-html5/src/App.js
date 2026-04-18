import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import NavBar from './components/NavBar';
import ConfigPage from './ui/ConfigPage';
import ProfessoresPage from './ui/ProfessoresPage';
import ProfessorFormPage from './ui/ProfessorFormPage';
import GradePage from './ui/GradePage';

const NAV_ITEMS = [
  { key: 'config', label: 'Configuracao' },
  { key: 'professores', label: 'Professores' },
  { key: 'grade', label: 'Gerar Grade' },
];

function App() {
  const [page, setPage] = useState('config');
  const [formToken, setFormToken] = useState(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('form/')) {
        setFormToken(hash.replace('form/', ''));
        setPage('form');
      } else if (hash === 'professores') {
        setPage('professores');
      } else if (hash === 'grade') {
        setPage('grade');
      } else {
        setPage('config');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleNavChange = (key) => {
    setPage(key);
    window.location.hash = key;
  };

  if (page === 'form' && formToken) {
    return <ProfessorFormPage token={formToken} />;
  }

  return (
    <div className="app">
      <Header title="Grade Horaria Escolar" subtitle="Sistema de geracao automatica de horarios" />
      <NavBar items={NAV_ITEMS} active={page} onChange={handleNavChange} />
      <main className="app-main-content">
        {page === 'config' && <ConfigPage />}
        {page === 'professores' && <ProfessoresPage />}
        {page === 'grade' && <GradePage />}
      </main>
    </div>
  );
}

export default App;
