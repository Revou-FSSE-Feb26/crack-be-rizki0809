import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Dipakai untuk mengecek apakah API hidup. */
  getHealth() {
    return {
      status: 'ok',
      service: 'Hadish Cake API',
      timestamp: new Date().toISOString(),
    };
  }
}
