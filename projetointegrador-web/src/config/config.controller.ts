import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { parsePaginationQuery } from '../common/pagination';

@Controller('api/config')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // ===================== TURNOS =====================

  @Get('turnos')
  async listTurnos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listTurnos(parsePaginationQuery(page, limit));
  }

  // ===================== DIAS =====================

  @Get('dias')
  async listDias(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listDias(parsePaginationQuery(page, limit));
  }

  // ===================== PERIODOS =====================

  @Get('periodos')
  async listPeriodos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listPeriodos(parsePaginationQuery(page, limit));
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

  @Put('periodos/:id')
  async updatePeriodo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { numero: number; hora_inicio: string; hora_fim: string; tipo: string; turno_id: number },
  ): Promise<unknown> {
    if (!body.numero || !body.hora_inicio || !body.hora_fim || !body.turno_id) {
      throw new HttpException('Campos obrigatorios: numero, hora_inicio, hora_fim, turno_id', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.configService.updatePeriodo(id, body);
    if (!updated) throw new HttpException('Periodo nao encontrado', HttpStatus.NOT_FOUND);
    return updated;
  }

  @Delete('periodos/:id')
  async deletePeriodo(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deletePeriodo(id);
    if (!ok) throw new HttpException('Periodo nao encontrado', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  @Post('periodos/gerar')
  async generateTurnoPeriodos(
    @Body()
    body: {
      turno_id: number;
      hora_inicio: string;
      duracao_aula: number;
      quantidade_aulas: number;
      intervalo_apos_aula?: number | null;
      duracao_intervalo?: number | null;
      dia_ids?: number[] | null;
    },
  ): Promise<{ success: boolean; periodos: number; slots: number }> {
    if (!body.turno_id || !body.hora_inicio || !body.duracao_aula || !body.quantidade_aulas) {
      throw new HttpException(
        'Campos obrigatorios: turno_id, hora_inicio, duracao_aula, quantidade_aulas',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (body.duracao_aula <= 0 || body.quantidade_aulas <= 0) {
      throw new HttpException(
        'duracao_aula e quantidade_aulas devem ser positivos',
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.configService.generateTurnoPeriodos(body);
    return { success: true, ...result };
  }

  @Post('periodos/regenerar-slots')
  async regenerateTimeSlots(): Promise<{ success: boolean; count: number }> {
    const count = await this.configService.regenerateTimeSlots();
    return { success: true, count };
  }

  // ===================== PROFESSORES =====================

  @Get('professores')
  async listProfessores(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listProfessores(parsePaginationQuery(page, limit));
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

  @Put('professores/:id')
  async updateProfessor(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nome: string; email?: string; carga_horaria_max?: number },
  ): Promise<unknown> {
    if (!body.nome) {
      throw new HttpException('Nome e obrigatorio', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.configService.updateProfessor(id, body);
    if (!updated) throw new HttpException('Professor nao encontrado', HttpStatus.NOT_FOUND);
    return updated;
  }

  @Delete('professores/:id')
  async deleteProfessor(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteProfessor(id);
    if (!ok) throw new HttpException('Professor nao encontrado', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== DISCIPLINAS =====================

  @Get('disciplinas')
  async listDisciplinas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listDisciplinas(parsePaginationQuery(page, limit));
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

  @Put('disciplinas/:id')
  async updateDisciplina(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nome: string; sigla?: string; peso?: number },
  ): Promise<unknown> {
    if (!body.nome) {
      throw new HttpException('Nome e obrigatorio', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.configService.updateDisciplina(id, body);
    if (!updated) throw new HttpException('Disciplina nao encontrada', HttpStatus.NOT_FOUND);
    return updated;
  }

  @Delete('disciplinas/:id')
  async deleteDisciplina(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteDisciplina(id);
    if (!ok) throw new HttpException('Disciplina nao encontrada', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== TURMAS =====================

  @Get('turmas')
  async listTurmas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listTurmas(parsePaginationQuery(page, limit));
  }

  @Post('turmas')
  async createTurma(
    @Body() body: { nome: string; serie: string; ano_letivo: number; turno_id: number; segmento?: string },
  ): Promise<unknown> {
    if (!body.nome || !body.serie || !body.ano_letivo || !body.turno_id) {
      throw new HttpException('Campos obrigatorios: nome, serie, ano_letivo, turno_id', HttpStatus.BAD_REQUEST);
    }
    return this.configService.createTurma(body);
  }

  @Put('turmas/:id')
  async updateTurma(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nome: string; serie: string; ano_letivo: number; turno_id: number; segmento?: string },
  ): Promise<unknown> {
    if (!body.nome || !body.serie || !body.ano_letivo || !body.turno_id) {
      throw new HttpException('Campos obrigatorios: nome, serie, ano_letivo, turno_id', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.configService.updateTurma(id, body);
    if (!updated) throw new HttpException('Turma nao encontrada', HttpStatus.NOT_FOUND);
    return updated;
  }

  @Delete('turmas/:id')
  async deleteTurma(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteTurma(id);
    if (!ok) throw new HttpException('Turma nao encontrada', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== TURMA_DISCIPLINA =====================

  @Get('turma-disciplinas')
  async listTurmaDisciplinas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.configService.listTurmaDisciplinas(parsePaginationQuery(page, limit));
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

  @Put('turma-disciplinas/:id')
  async updateTurmaDisciplina(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { turma_id: number; disciplina_id: number; professor_id: number; aulas_semana: number; tamanho_bloco?: number },
  ): Promise<unknown> {
    if (!body.turma_id || !body.disciplina_id || !body.professor_id || !body.aulas_semana) {
      throw new HttpException('Campos obrigatorios: turma_id, disciplina_id, professor_id, aulas_semana', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.configService.updateTurmaDisciplina(id, body);
    if (!updated) throw new HttpException('Atribuicao nao encontrada', HttpStatus.NOT_FOUND);
    return updated;
  }

  @Delete('turma-disciplinas/:id')
  async deleteTurmaDisciplina(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    const ok = await this.configService.deleteTurmaDisciplina(id);
    if (!ok) throw new HttpException('Atribuicao nao encontrada', HttpStatus.NOT_FOUND);
    return { success: true };
  }

  // ===================== RESTRICOES SOFT =====================

  @Get('soft-constraints')
  async listSoftConstraints(): Promise<unknown> {
    return this.configService.listSoftConstraints();
  }

  @Put('soft-constraints')
  async updateSoftConstraints(
    @Body() body: { items: Array<{ codigo: string; peso: number }> },
  ): Promise<unknown> {
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      throw new HttpException('Campo items (lista) e obrigatorio', HttpStatus.BAD_REQUEST);
    }
    for (const it of body.items) {
      if (!it.codigo || typeof it.peso !== 'number' || !Number.isFinite(it.peso) || it.peso < 0) {
        throw new HttpException(
          'Cada item precisa de codigo e peso numerico >= 0',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    return this.configService.updateSoftConstraints(body.items);
  }

  @Put('soft-constraints/:codigo')
  async updateSoftConstraint(
    @Param('codigo') codigo: string,
    @Body() body: { peso: number },
  ): Promise<unknown> {
    if (typeof body.peso !== 'number' || !Number.isFinite(body.peso) || body.peso < 0) {
      throw new HttpException('peso deve ser um numero >= 0', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.configService.updateSoftConstraint(codigo, body.peso);
    if (!updated) throw new HttpException('Restricao nao encontrada', HttpStatus.NOT_FOUND);
    return updated;
  }
}
