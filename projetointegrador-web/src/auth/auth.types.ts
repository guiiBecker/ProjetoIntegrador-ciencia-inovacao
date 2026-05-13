export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: number;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateUserInput {
  nome: string;
  email: string;
  password: string;
  role: UserRole;
}