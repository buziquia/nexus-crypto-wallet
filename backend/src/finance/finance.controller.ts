import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('finance')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @UseGuards(AuthGuard)
  @Post('swap')
  async swap(@Request() req, @Body() body: { amount: number; token: string }) {
    // Passamos o ID do usuário, o valor e o token (BTC ou ETH) selecionado na tela
    return this.financeService.executeSwap(req.user.sub, body.amount, body.token);
  }
}