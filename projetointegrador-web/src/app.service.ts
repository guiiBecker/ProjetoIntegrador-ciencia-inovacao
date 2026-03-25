import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRootMessage(): { message: string } {
    return { message: 'Backend rodando com sucesso!' };
  }

  getHealth(): { status: string; timestamp: Date } {
    return {
      status: 'OK',
      timestamp: new Date(),
    };
  }
}