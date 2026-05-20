import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import PaginationControls from '../components/PaginationControls';
import { normalizePaginatedResponse } from '../utils/pagination';

const DEFAULT_PAGE_LIMIT = 20;

export default function UsersPage() {
  const [pageLimit, setPageLimit] = useState(() => DEFAULT_PAGE_LIMIT);
  const [usersPage, setUsersPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', password: '', role: 'user' });

  const loadUsers = useCallback(async (page = 1) => {
    try {
      const data = await apiJson(`/api/auth/users?page=${page}&limit=${pageLimit}`);
      setUsersPage(normalizePaginatedResponse(data, pageLimit));
    } catch (err) {
      setMsg(err.message || 'Erro ao carregar usuarios');
    }
  }, [pageLimit]);

  useEffect(() => { loadUsers(1); }, [loadUsers]);

  const handleChangeLimit = (newLimit) => {
    setPageLimit(newLimit);
    setUsersPage((current) => ({ ...current, page: 1, limit: newLimit }));
  };

  const showMsg = (text) => {
    setMsg(text);
    window.setTimeout(() => setMsg(''), 3500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await apiJson('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setForm({ nome: '', email: '', password: '', role: 'user' });
      showMsg('Usuario criado com sucesso');
      loadUsers(usersPage.page);
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
      showMsg('Usuario deletado com sucesso');
      loadUsers(usersPage.page);
    } catch (err) {
      showMsg(err.message || 'Erro ao deletar usuario');
    }
  };

  const handlePrevious = () => {
    if (usersPage.page > 1) {
      loadUsers(usersPage.page - 1);
    }
  };

  const handleNext = () => {
    if (usersPage.page < usersPage.totalPages) {
      loadUsers(usersPage.page + 1);
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

      <DataTable headers={['Nome', 'E-mail', 'Perfil', 'Status', 'Ação']} rows={usersPage.items} emptyText="Nenhum usuario cadastrado">
        {usersPage.items.map((user) => (
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

      <PaginationControls
        label="Usuários"
        page={usersPage.page}
        totalPages={usersPage.totalPages}
        total={usersPage.total}
        limit={usersPage.limit}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onLimitChange={handleChangeLimit}
      />
    </div>
  );
}