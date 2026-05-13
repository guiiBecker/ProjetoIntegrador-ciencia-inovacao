import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FormService } from './form.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('api/form')
@UseGuards(AuthGuard, RolesGuard)
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Post('generate/:professorId')
  @Roles('admin')
  async generateLink(
    @Param('professorId', ParseIntPipe) professorId: number,
  ): Promise<{ token: string }> {
    const result = await this.formService.generateLink(professorId);
    if (!result) {
      throw new HttpException('Professor nao encontrado', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('links')
  @Roles('admin')
  async listLinks(): Promise<unknown[]> {
    return this.formService.listLinks();
  }

  @Get(':token')
  @Public()
  async getFormData(@Param('token') token: string): Promise<unknown> {
    const data = await this.formService.getFormData(token);
    if (!data) {
      throw new HttpException('Link invalido ou expirado', HttpStatus.NOT_FOUND);
    }
    return data;
  }

  @Post(':token/submit')
  @Public()
  async submitAvailability(
    @Param('token') token: string,
    @Body() body: { disponibilidade: Array<{ time_slot_id: number; disponivel: boolean; preferencia: number }> },
  ): Promise<{ success: boolean }> {
    if (!body.disponibilidade || !Array.isArray(body.disponibilidade)) {
      throw new HttpException('disponibilidade deve ser um array', HttpStatus.BAD_REQUEST);
    }
    const result = await this.formService.submitAvailability(token, body.disponibilidade);
    if (!result.success) {
      throw new HttpException(result.error || 'Erro ao salvar', HttpStatus.BAD_REQUEST);
    }
    return { success: true };
  }
}
