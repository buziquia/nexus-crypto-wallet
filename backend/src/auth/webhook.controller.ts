import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private usersService: UsersService) {}

  @Post('deposit')
  async handleDeposit(@Body() body: { userId: string; token: string; amount: number; idempotencyKey: string }) {
    return this.usersService.handleDepositWebhook(body);
  }
}