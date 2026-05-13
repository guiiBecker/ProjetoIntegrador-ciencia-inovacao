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
  UseGuards,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('api/schedule')
@UseGuards(AuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('public')
  @Public()
  async listConfirmedRequests(): Promise<unknown[]> {
    return this.scheduleService.listConfirmedRequests();
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
  async listRequests(): Promise<unknown[]> {
    return this.scheduleService.listRequests();
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
    @Body() body: { timeSlotId: number },
  ): Promise<{ success: boolean; error?: string }> {
    if (!body.timeSlotId) {
      throw new HttpException(
        'timeSlotId is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.scheduleService.updateItem(id, itemId, body.timeSlotId);
    if (!result.success) {
      throw new HttpException(
        result.error || 'Erro ao atualizar item',
        HttpStatus.BAD_REQUEST,
      );
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
