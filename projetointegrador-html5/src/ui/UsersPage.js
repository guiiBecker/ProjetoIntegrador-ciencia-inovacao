import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', password: '', role: 'user' });

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiJson('/api/auth/users');
      setUsers(data);
    } catch (err) {
      setMsg(err.message || 'Erro ao carregar usuarios');
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const showMsg = (text) => {
    setMsg(text);
    window.setTimeout(() => setMsg(''), 3500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await apiJson('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setUsers((prev) => [data.user, ...prev]);
      setForm({ nome: '', email: '', password: '', role: 'user' });
      showMsg('Usuario criado com sucesso');
    } catch (err) {
      showMsg(err.message || 'Erro ao criar usuario');
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Tem certeza que deseja deletar "${userName}"?`)) {
      return;
    }
    try {
      await apiJson(`/api/auth/users/${userId}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showMsg('Usuario deletado com sucesso');
    } catch (err) {
      showMsg(err.message || 'Erro ao deletar usuario');
    }
  };

  return (
    <div className="page-card">
      <Toast message={msg} />
      <div className="section-header">
        <div>
          <h3>Usuarios do sistema</h3>
          <p className="config-hint">Crie perfis de administrador e de consulta para controlar o acesso ao sistema.</p>
        </div>
      </div>

      <form className="config-form" onSubmit={handleSubmit} style={{ marginBottom: '1.25rem' }}>
        <input
          type="text"
          placeholder="Nome"
          value={form.nome}
          onChange={(event) => setForm({ ...form, nome: event.target.value })}
          required
        />
        <input
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          <option value="user">Usuario</option>
          <option value="admin">Administrador</option>
        </select>
        <Button type="submit">Criar usuario</Button>
      </form>

      <DataTable headers={['Nome', 'E-mail', 'Perfil', 'Status', 'Ação']} rows={users} emptyText="Nenhum usuario cadastrado">
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.nome}</td>
            <td>{user.email}</td>
            <td><Badge variant={user.role === 'admin' ? 'selected' : 'extra'}>{user.role}</Badge></td>
            <td>{user.ativo ? 'Ativo' : 'Inativo'}</td>
            <td>
              <button
                type="button"
                onClick={() => handleDelete(user.id, user.nome)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#ff4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Deletar
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}