import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** GET /api - health check sederhana. */
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
