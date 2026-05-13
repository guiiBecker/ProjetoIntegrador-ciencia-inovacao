import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthService } from './auth.service';
import { LoginInput, CreateUserInput } from './auth.types';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';

@Controller('api/auth')
@UseGuards(AuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) res: any,
  ): Promise<{ user: unknown }> {
    if (!body?.email || !body?.password) {
      throw new HttpException('Email e senha sao obrigatorios', HttpStatus.BAD_REQUEST);
    }

    const result = await this.authService.authenticate(body);
    if (!result) {
      throw new HttpException('Credenciais invalidas', HttpStatus.UNAUTHORIZED);
    }

    res.cookie(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/',
    });

    return { user: result.user };
  }

  @Post('logout')
  @Public()
  logout(@Res({ passthrough: true }) res: any): { success: boolean } {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  @Get('me')
  async me(@Req() req: any): Promise<{ user: unknown }> {
    return { user: req.user };
  }

  @Get('users')
  @Roles('admin')
  async listUsers(): Promise<unknown[]> {
    return this.authService.listUsers();
  }

  @Post('users')
  @Roles('admin')
  async createUser(
    @Body() body: CreateUserInput,
  ): Promise<{ user: unknown }> {
    if (!body?.nome || !body?.email || !body?.password || !body?.role) {
      throw new HttpException('Campos obrigatorios: nome, email, password, role', HttpStatus.BAD_REQUEST);
    }

    if (!['admin', 'user'].includes(body.role)) {
      throw new HttpException('Role invalida', HttpStatus.BAD_REQUEST);
    }

    if (body.password.length < 6) {
      throw new HttpException('A senha precisa ter ao menos 6 caracteres', HttpStatus.BAD_REQUEST);
    }

    const user = await this.authService.createUser(body);
    return { user };
  }

  @Delete('users/:id')
  @Roles('admin')
  async deleteUser(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const userId = Number(id);
    if (!userId || userId <= 0) {
      throw new HttpException('ID invalido', HttpStatus.BAD_REQUEST);
    }

    try {
      const deleted = await this.authService.deleteUser(userId);
      if (!deleted) {
        throw new HttpException('Usuario nao encontrado', HttpStatus.NOT_FOUND);
      }
      return { success: true };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Erro ao deletar usuario',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}