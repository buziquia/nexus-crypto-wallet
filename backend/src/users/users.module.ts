import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { ExchangeService } from './exchange.service';

@Module({
providers:[UsersService,PrismaService,ExchangeService],
exports:[UsersService]
})
export class UsersModule {}