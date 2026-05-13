import { Injectable, OnModuleInit, UnauthorizedException, ConflictException } from '@nestjs/common';
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { Pool } from 'pg';
import { DB_POOL } from '../database/database.module';
import { Inject } from '@nestjs/common';
import { AuthUser, CreateUserInput, LoginInput } from './auth.types';
import { DEFAULT_SESSION_TTL_MS, PBKDF2_DIGEST, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH } from './auth.constants';

interface AppUserRow {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  role: 'admin' | 'user';
  ativo: boolean;
}

interface SessionPayload {
  sub: number;
  email: string;
  role: 'admin' | 'user';
  exp: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly secret = process.env.AUTH_SECRET || 'dev-auth-secret-change-me';

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialAdmin();
  }

  private toPublicUser(user: AppUserRow): AuthUser {
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      ativo: user.ativo,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeName(name: string): string {
    return name.trim();
  }

  private hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
    const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST).toString('hex');
    return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expectedHash = parts[3];
    const derived = pbkdf2Sync(password, salt, iterations, expectedHash.length / 2, PBKDF2_DIGEST).toString('hex');

    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const derivedBuffer = Buffer.from(derived, 'hex');
    if (expectedBuffer.length !== derivedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, derivedBuffer);
  }

  private signSession(user: AuthUser): string {
    const payload: SessionPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + DEFAULT_SESSION_TTL_MS,
    };
    const payloadText = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(payloadText).digest('base64url');
    return `${payloadText}.${signature}`;
  }

  private verifySession(token: string): SessionPayload | null {
    const [payloadText, signature] = token.split('.');
    if (!payloadText || !signature) return null;

    const expectedSignature = createHmac('sha256', this.secret).update(payloadText).digest('base64url');
    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== receivedBuffer.length) return null;
    if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return null;

    try {
      const payload = JSON.parse(Buffer.from(payloadText, 'base64url').toString('utf8')) as SessionPayload;
      if (!payload.exp || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async getUserById(userId: number): Promise<AuthUser | null> {
    const result = await this.pool.query<AppUserRow>(
      'SELECT id, nome, email, senha_hash, role, ativo FROM app_user WHERE id = $1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    return this.toPublicUser(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<AppUserRow | null> {
    const result = await this.pool.query<AppUserRow>(
      'SELECT id, nome, email, senha_hash, role, ativo FROM app_user WHERE lower(email) = lower($1)',
      [this.normalizeEmail(email)],
    );
    return result.rows[0] || null;
  }

  async authenticate(input: LoginInput): Promise<{ user: AuthUser; token: string } | null> {
    const user = await this.getUserByEmail(input.email);
    if (!user || !user.ativo) return null;
    if (!this.verifyPassword(input.password, user.senha_hash)) return null;

    const publicUser = this.toPublicUser(user);
    return {
      user: publicUser,
      token: this.signSession(publicUser),
    };
  }

  async validateSession(token: string): Promise<AuthUser | null> {
    const payload = this.verifySession(token);
    if (!payload) return null;

    const user = await this.getUserById(payload.sub);
    if (!user || !user.ativo) return null;
    return user;
  }

  async listUsers(): Promise<AuthUser[]> {
    const result = await this.pool.query<AppUserRow>(
      'SELECT id, nome, email, senha_hash, role, ativo FROM app_user ORDER BY criado_em DESC',
    );
    return result.rows.map((row) => this.toPublicUser(row));
  }

  async createUser(input: CreateUserInput): Promise<AuthUser | null> {
    const existing = await this.getUserByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email ja cadastrado');
    }

    const result = await this.pool.query<AppUserRow>(
      `INSERT INTO app_user (nome, email, senha_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, senha_hash, role, ativo`,
      [this.normalizeName(input.nome), this.normalizeEmail(input.email), this.hashPassword(input.password), input.role],
    );
    return this.toPublicUser(result.rows[0]);
  }

  async deleteUser(userId: number): Promise<boolean> {
    // Get user to check role
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Usuario nao encontrado');
    }

    // If deleting an admin, check that there's at least 2 admins
    if (user.role === 'admin') {
      const adminCount = await this.pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM app_user WHERE role = 'admin'",
      );
      if (Number(adminCount.rows[0]?.count || 0) <= 1) {
        throw new Error('Nao e possivel deletar o ultimo administrador do sistema');
      }
    }

    const result = await this.pool.query('DELETE FROM app_user WHERE id = $1', [userId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async ensureInitialAdmin(): Promise<void> {
    try {
      const countResult = await this.pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM app_user');
      if (Number(countResult.rows[0]?.count || 0) > 0) return;

      const nome = process.env.INITIAL_ADMIN_NAME || 'Administrador';
      const email = process.env.INITIAL_ADMIN_EMAIL || 'admin@example.com';
      const password = process.env.INITIAL_ADMIN_PASSWORD || 'admin123';

      await this.pool.query(
        `INSERT INTO app_user (nome, email, senha_hash, role)
         VALUES ($1, $2, $3, 'admin')`,
        [this.normalizeName(nome), this.normalizeEmail(email), this.hashPassword(password)],
      );
    } catch (error: any) {
      // Table doesn't exist yet - will be created on next restart after schema migration
      if (error.code === '42P01') {
        console.log('[AUTH] app_user table not found - schema will be applied on next restart');
        return;
      }
      throw error;
    }
  }

  buildCookieValue(user: AuthUser): string {
    return this.signSession(user);
  }
}