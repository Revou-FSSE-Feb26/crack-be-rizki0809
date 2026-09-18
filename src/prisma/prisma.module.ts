import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global supaya modul lain tidak perlu meng-import PrismaModule satu per satu. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
