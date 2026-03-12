import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [AuthModule, UsersModule, FinanceModule],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}