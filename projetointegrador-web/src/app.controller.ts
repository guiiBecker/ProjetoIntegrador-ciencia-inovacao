import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): { message: string } {
    return this.appService.getRootMessage();
  }

  @Get('api/health')
  getHealth(): { status: string; timestamp: Date } {
    return this.appService.getHealth();
  }

  @Get('api/db-health')
  async getDbHealth(): Promise<{ status: string; timestamp: string }> {
    return this.appService.getDbHealth();
  }
}