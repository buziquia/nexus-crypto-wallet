import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() body: { email: string; pass: string }) {
    return this.authService.register(body.email, body.pass);
  }

  @Post('login')
  async login(@Body() body: { email: string; pass: string }) {
    return this.authService.login(body.email, body.pass);
  }

  @Post('refresh')
  async refresh(@Body() body: { userId: string; refreshToken: string }) {
    return this.authService.refreshToken(body.userId, body.refreshToken);
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.usersService.getProfileWithBalances(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Get('history')
  async getHistory(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.usersService.getHistory(
      req.user.sub,
      Number(page),
      Number(limit),
    );
  }

  @UseGuards(AuthGuard)
  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.usersService.getTransactions(
      req.user.sub,
      Number(page),
      Number(limit),
    );
  }

  @UseGuards(AuthGuard)
  @Post('deposit')
  async deposit(@Request() req: any, @Body() body: { amount: number }) {
    return this.usersService.deposit(req.user.sub, body.amount);
  }

  @UseGuards(AuthGuard)
  @Post('withdraw')
  async withdraw(
    @Request() req: any,
    @Body() body: { amount: number; token: string },
  ) {
    return this.usersService.withdraw(req.user.sub, body.amount, body.token);
  }

  @UseGuards(AuthGuard)
  @Get('swap/quote')
  async quote(@Query('amount') amount: string, @Query('token') token: string) {
    return this.usersService.quoteSwap(token, Number(amount));
  }

  @UseGuards(AuthGuard)
  @Post('swap/execute')
  async execute(
    @Request() req: any,
    @Body() body: { amount: number; token: string },
  ) {
    return this.usersService.executeSwap(req.user.sub, body.amount, body.token);
  }
}