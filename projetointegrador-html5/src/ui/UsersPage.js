import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../api';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Toast from '../components/Toast';
import DataTable from '../components/DataTable';
import './UsersPage.css';

export default function UsersPage() {
  const [pageLimit, setPageLimit] = useState(() => DEFAULT_PAGE_LIMIT);
  const [usersPage, setUsersPage] = useState({ items: [], page: 1, limit: DEFAULT_PAGE_LIMIT, total: 0, totalPages: 0 });
  const [msg, setMsg] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
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

  const filteredUsers = users.filter(user =>
    user.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
    user.email.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="users-page">
      <Toast message={msg} />
      <div className="users-header">
        <div>
          <h3>Usuarios do sistema</h3>
          <p className="config-hint">Crie perfis de administrador e de consulta para controlar o acesso ao sistema.</p>
        </div>
      </div>

      <div className="users-container">
        {/* COLUNA ESQUERDA - FORM */}
        <div className="users-form-column">
          <form className="users-form" onSubmit={handleSubmit}>
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
            
            <div className="role-section">
              <label>Tipo de Perfil</label>
              <div className="role-switch-container">
                <span className={`role-label ${form.role === 'user' ? 'active' : ''}`}>Usuário</span>
                <button
                  type="button"
                  className={`role-switch ${form.role === 'admin' ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, role: form.role === 'user' ? 'admin' : 'user' })}
                >
                  <span className="switch-circle"></span>
                </button>
                <span className={`role-label ${form.role === 'admin' ? 'active' : ''}`}>Admin</span>
              </div>
            </div>

            <Button type="submit">Criar usuario</Button>
          </form>
        </div>

        {/* COLUNA DIREITA - LISTA */}
        <div className="users-list-column">
          <div className="users-search">
            <input
              type="text"
              placeholder="Pesquisar por nome ou email..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="data-table-wrapper">
            <DataTable headers={['Nome', 'E-mail', 'Perfil', 'Status', 'Ação']} rows={filteredUsers} emptyText="Nenhum usuario encontrado">
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.nome}</td>
                <td>{user.email}</td>
                <td><Badge variant={user.role === 'admin' ? 'selected' : 'extra'}>{user.role}</Badge></td>
                <td>{user.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleDelete(user.id, user.nome)}
                    className="btn-delete"
                  >
                    Deletar
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>          </div>        </div>
      </div>
    </div>
  );
}