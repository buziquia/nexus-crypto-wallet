import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class FinanceService {
  constructor(private usersService: UsersService) {}

  async executeSwap(userId: string, amountBRL: number, targetToken: string) {
    return this.usersService.executeSwap(userId, amountBRL, targetToken);
  }
}