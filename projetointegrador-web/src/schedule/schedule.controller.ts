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
import { ScheduleService } from './schedule.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { parsePaginationQuery } from '../common/pagination';

@Controller('api/schedule')
@UseGuards(AuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('public')
  @Public()
  async listConfirmedRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.scheduleService.listConfirmedRequests(parsePaginationQuery(page, limit));
  }

  @Get('public/:id')
  @Public()
  async getPublicRequest(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    const result = await this.scheduleService.getPublicRequest(id);
    if (!result) {
      throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Post()
  @Roles('admin')
  async createRequest(): Promise<{ id: number; status: string }> {
    return this.scheduleService.createRequest();
  }

  @Get()
  @Roles('admin')
  async listRequests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.scheduleService.listRequests(parsePaginationQuery(page, limit));
  }

  @Get(':id')
  @Roles('admin')
  async getRequest(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<unknown> {
    const result = await this.scheduleService.getRequest(id);
    if (!result) {
      throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Post(':id/select')
  @Roles('admin')
  async selectOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { optionId: number },
  ): Promise<{ success: boolean }> {
    if (!body.optionId) {
      throw new HttpException(
        'optionId is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const success = await this.scheduleService.selectOption(id, body.optionId);
    if (!success) {
      throw new HttpException(
        'Option not found for this request',
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true };
  }

  @Put(':id/items/:itemId')
  @Roles('admin')
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { timeSlotId?: number; diaId?: number; periodoNumero?: number },
  ): Promise<{ success: boolean; error?: string }> {
    const hasSlot = !!body.timeSlotId;
    const hasCoords = !!body.diaId && !!body.periodoNumero;
    if (!hasSlot && !hasCoords) {
      throw new HttpException(
        'timeSlotId or (diaId, periodoNumero) is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.scheduleService.updateItem(
      id,
      itemId,
      body.timeSlotId,
      body.diaId,
      body.periodoNumero,
    );
    if (!result.success) {
      throw new HttpException(
        result.error || 'Erro ao atualizar item',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { success: true };
  }

  @Post(':id/items/:itemA/swap/:itemB')
  async swapItems(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemA', ParseIntPipe) itemA: number,
    @Param('itemB', ParseIntPipe) itemB: number,
  ): Promise<{ success: boolean }> {
    const result = await this.scheduleService.swapItems(id, itemA, itemB);
    if (!result.success) {
      throw new HttpException(
        result.error || 'Erro ao trocar aulas',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { success: true };
  }

  @Delete(':id')
  @Roles('admin')
  async deleteRequest(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    const result = await this.scheduleService.deleteRequest(id);
    if (!result.success) {
      throw new HttpException(
        result.error || 'Erro ao deletar requisição',
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true };
  }

  @Post(':id/restore-items')
  @Roles('admin')
  async restoreOptionItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { optionId: number; items: { id: number; time_slot_id: number }[] },
  ): Promise<{ success: boolean }> {
    const result = await this.scheduleService.restoreOptionItems(id, body.optionId, body.items);
    if (!result.success) {
      throw new HttpException(result.error || 'Erro ao restaurar itens', HttpStatus.BAD_REQUEST);
    }
    return { success: true };
  }

  @Post(':id/confirm')
  @Roles('admin')
  async confirmSchedule(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    const result = await this.scheduleService.confirmSchedule(id);
    if (!result.success) {
      throw new HttpException(
        result.error || 'Erro ao confirmar',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { success: true };
  }
}
