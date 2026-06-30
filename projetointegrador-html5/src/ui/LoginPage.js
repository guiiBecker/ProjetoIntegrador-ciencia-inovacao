import { useState } from 'react';
import { apiJson } from '../api';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import logo from '../duck-schedule-logo.svg';
import './LoginPage.css';

export default function LoginPage({ onSuccess }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-shell">
        <div className="login-brand">
          <img src={logo} alt="Duck Schedule" className="login-logo" />
          <span className="login-brand-name">Duck Schedule</span>
        </div>
        <section className="login-card">
          <h2>Entrar</h2>
          <p>Use o e-mail e a senha do seu perfil para acessar o sistema.</p>

          {error && <div className="login-error">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                autoComplete="email"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
                autoComplete="current-password"
              />
            </label>

            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : 'Entrar'}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}