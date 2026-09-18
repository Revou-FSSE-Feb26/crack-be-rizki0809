import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** GET /api - health check sederhana, boleh diakses tanpa token. */
  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
