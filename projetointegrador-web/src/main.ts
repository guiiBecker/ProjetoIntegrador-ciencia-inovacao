import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = Number(process.env.PORT) || 5000;
  await app.listen(port);

  console.log(`Servidor NestJS rodando na porta ${port}`);
}

bootstrap();