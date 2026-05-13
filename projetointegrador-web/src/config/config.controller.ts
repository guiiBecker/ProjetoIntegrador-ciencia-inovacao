import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/config')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // ===================== TURNOS =====================

  @Get('turnos')
  async listTurnos(): Promise<unknown[]> {
    return this.configService.listTurnos();
  }

  // ===================== DIAS =====================

  @Get('dias')
  async listDias(): Promise<unknown[]> {
    return this.configService.listDias();
  }

  // ===================== PERIODOS =====================

  @Get('periodos')
  async listPeriodos(): Promise<unknown[]> {
    return this.configService.listPeriodos();
  }

  @Post('periodos')
  async createPeriodo(
    @Body() body: { numero: number; hora_inicio: string; hora_fim: string; tipo: string; turno_id: number },
  ): Promise<unknown> {
    if (!body.numero || !body.hora_inicio || !body.hora_fim || !body.turno_id) {
      throw new HttpException('Campos obrigatorios: numero, hora_inicio, hora_fim, turno_id', HttpStatus.BAD_REQUEST);
    }
    return this.configService.createPeriodo(body);
  }

  @Delete('periodos/:id')
  async deletePeriodo(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deletePeriodo(id);
    if (!ok) throw new HttpException('Periodo nao encontrado', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  @Post('periodos/regenerar-slots')
  async regenerateTimeSlots(): Promise<{ success: boolean; count: number }> {
    const count = await this.configService.regenerateTimeSlots();
    return { success: true, count };
  }

  // ===================== PROFESSORES =====================

  @Get('professores')
  async listProfessores(): Promise<unknown[]> {
    return this.configService.listProfessores();
  }

  @Post('professores')
  async createProfessor(
    @Body() body: { nome: string; email?: string; carga_horaria_max?: number },
  ): Promise<unknown> {
    if (!body.nome) {
      throw new HttpException('Nome e obrigatorio', HttpStatus.BAD_REQUEST);
    }
    return this.configService.createProfessor(body);
  }

  @Delete('professores/:id')
  async deleteProfessor(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteProfessor(id);
    if (!ok) throw new HttpException('Professor nao encontrado', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== DISCIPLINAS =====================

  @Get('disciplinas')
  async listDisciplinas(): Promise<unknown[]> {
    return this.configService.listDisciplinas();
  }

  @Post('disciplinas')
  async createDisciplina(
    @Body() body: { nome: string; sigla?: string; peso?: number },
  ): Promise<unknown> {
    if (!body.nome) {
      throw new HttpException('Nome e obrigatorio', HttpStatus.BAD_REQUEST);
    }
    return this.configService.createDisciplina(body);
  }

  @Delete('disciplinas/:id')
  async deleteDisciplina(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteDisciplina(id);
    if (!ok) throw new HttpException('Disciplina nao encontrada', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== TURMAS =====================

  @Get('turmas')
  async listTurmas(): Promise<unknown[]> {
    return this.configService.listTurmas();
  }

  @Post('turmas')
  async createTurma(
    @Body() body: { nome: string; serie: string; ano_letivo: number; turno_id: number },
  ): Promise<unknown> {
    if (!body.nome || !body.serie || !body.ano_letivo || !body.turno_id) {
      throw new HttpException('Campos obrigatorios: nome, serie, ano_letivo, turno_id', HttpStatus.BAD_REQUEST);
    }
    return this.configService.createTurma(body);
  }

  @Delete('turmas/:id')
  async deleteTurma(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteTurma(id);
    if (!ok) throw new HttpException('Turma nao encontrada', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== TURMA_DISCIPLINA =====================

  @Get('turma-disciplinas')
  async listTurmaDisciplinas(): Promise<unknown[]> {
    return this.configService.listTurmaDisciplinas();
  }

  @Post('turma-disciplinas')
  async createTurmaDisciplina(
    @Body() body: { turma_id: number; disciplina_id: number; professor_id: number; aulas_semana: number; tamanho_bloco?: number },
  ): Promise<unknown> {
    if (!body.turma_id || !body.disciplina_id || !body.professor_id || !body.aulas_semana) {
      throw new HttpException('Campos obrigatorios: turma_id, disciplina_id, professor_id, aulas_semana', HttpStatus.BAD_REQUEST);
    }
    return this.configService.createTurmaDisciplina(body);
  }

  @Delete('turma-disciplinas/:id')
  async deleteTurmaDisciplina(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteTurmaDisciplina(id);
    if (!ok) throw new HttpException('Atribuicao nao encontrada', HttpStatus.NOT_FOUND);
    return { success: true };
  }
}
