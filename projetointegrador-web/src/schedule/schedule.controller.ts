import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  HttpException,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';

@Controller('api/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  async createRequest(): Promise<{ id: number; status: string }> {
    return this.scheduleService.createRequest();
  }

  @Get()
  async listRequests(): Promise<unknown[]> {
    return this.scheduleService.listRequests();
  }

  @Get(':id')
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

  @Post(':id/confirm')
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
