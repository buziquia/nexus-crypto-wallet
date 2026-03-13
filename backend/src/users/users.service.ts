import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { ExchangeService } from './exchange.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private exchange: ExchangeService,
  ) {}

  async create(email: string, pass: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const hashed = await bcrypt.hash(pass, 10);

  return this.prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashed,
      wallet: {
        create: {
          balance: 0,
          btcBalance: 0,
          ethBalance: 0,
        },
      },
    },
  });
}

async findByEmail(email: string) {
  return this.prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

  async getWallet(userId: string) {
    return this.prisma.wallet.findUnique({ where: { userId } });
  }

  async deposit(userId: string, amount: number) {
    const wallet = await this.getWallet(userId);

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    const previousBalance = Number(wallet.balance);
    const newBalance = previousBalance + amount;

    return this.prisma.$transaction(async (tx: any) => {
      await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          token: 'BRL',
          amount,
          previousBalance,
          newBalance,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          tokenTo: 'BRL',
          amount,
        },
      });

      return { success: true };
    });
  }

  async getProfileWithBalances(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    return {
      email: wallet.user.email,
      balances: {
        BRL: Number(wallet.balance),
        BTC: Number(wallet.btcBalance),
        ETH: Number(wallet.ethBalance),
      },
    };
  }

  async getHistory(userId: string, page = 1, limit = 10) {
    const wallet = await this.getWallet(userId);

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.ledgerEntry.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      data: items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getTransactions(userId: string, page = 1, limit = 10) {
    const wallet = await this.getWallet(userId);

    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.transaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      data: items.map((tx) => ({
        id: tx.id,
        type: tx.type,
        tokenFrom: tx.tokenFrom,
        tokenTo: tx.tokenTo,
        amount: tx.amount ? Number(tx.amount) : null,
        fee: tx.fee ? Number(tx.fee) : null,
        createdAt: tx.createdAt,
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async quoteSwap(tokenOut: string, amount: number) {
  const normalizedToken = tokenOut.trim().toUpperCase();
  const normalizedAmount = Number(amount);

  if (!normalizedAmount || normalizedAmount <= 0) {
    throw new BadRequestException('Valor inválido');
  }

  if (normalizedToken !== 'BTC' && normalizedToken !== 'ETH') {
    throw new BadRequestException('Token inválido');
  }

  const price = await this.exchange.getPrice(normalizedToken);
  const tax = this.exchange.calculateTax(normalizedAmount);
  const net = normalizedAmount - tax;
  const amountOut = net / price;

  return {
    tokenOut: normalizedToken,
    amountBRL: normalizedAmount,
    tax,
    conversionRate: price,
    estimatedAmountOut: amountOut,
  };
}

async executeSwap(userId: string, amountBRL: number, tokenOut: string) {
  const normalizedToken = tokenOut.trim().toUpperCase();
  const normalizedAmount = Number(amountBRL);

  if (!normalizedAmount || normalizedAmount <= 0) {
    throw new BadRequestException('Valor inválido');
  }

  if (normalizedToken !== 'BTC' && normalizedToken !== 'ETH') {
    throw new BadRequestException('Token inválido');
  }

  const price = await this.exchange.getPrice(normalizedToken);
  const tax = this.exchange.calculateTax(normalizedAmount);
  const net = normalizedAmount - tax;
  const amountOut = net / price;

  return this.prisma.$transaction(async (tx: any) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet || Number(wallet.balance) < normalizedAmount) {
      throw new BadRequestException('Saldo insuficiente');
    }

    const previousBrlBalance = Number(wallet.balance);
    const newBrlBalance = previousBrlBalance - normalizedAmount;

    const previousCryptoBalance =
      normalizedToken === 'BTC'
        ? Number(wallet.btcBalance)
        : Number(wallet.ethBalance);

    const newCryptoBalance = previousCryptoBalance + amountOut;

    await tx.wallet.update({
      where: { userId },
      data: {
        balance: newBrlBalance,
        btcBalance: normalizedToken === 'BTC' ? newCryptoBalance : undefined,
        ethBalance: normalizedToken === 'ETH' ? newCryptoBalance : undefined,
      },
    });

    await tx.ledgerEntry.createMany({
      data: [
        {
          walletId: wallet.id,
          type: 'SWAP_OUT',
          token: 'BRL',
          amount: -normalizedAmount,
          previousBalance: previousBrlBalance,
          newBalance: newBrlBalance,
        },
        {
          walletId: wallet.id,
          type: 'SWAP_FEE',
          token: 'BRL',
          amount: -tax,
          previousBalance: previousBrlBalance - tax,
          newBalance: newBrlBalance,
        },
        {
          walletId: wallet.id,
          type: 'SWAP_IN',
          token: normalizedToken,
          amount: amountOut,
          previousBalance: previousCryptoBalance,
          newBalance: newCryptoBalance,
        },
      ],
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: 'SWAP',
        tokenFrom: 'BRL',
        tokenTo: normalizedToken,
        amount: normalizedAmount,
        fee: tax,
      },
    });

    return {
      message: 'Swap realizado com sucesso',
      received: amountOut,
      tokenOut: normalizedToken,
      taxPaid: tax,
    };
  });
}

  async withdraw(userId: string, amount: number, token: string = 'BRL') {
    const normalizedToken = token.toUpperCase();

    return this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new Error('Carteira não encontrada');
      }

      if (normalizedToken !== 'BRL') {
        throw new BadRequestException(
          'Saque suportado apenas para BRL por enquanto',
        );
      }

      if (Number(wallet.balance) < amount) {
        throw new BadRequestException('Saldo insuficiente');
      }

      const previousBalance = Number(wallet.balance);
      const newBalance = previousBalance - amount;

      await tx.wallet.update({
        where: { userId },
        data: { balance: newBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          token: normalizedToken,
          amount: -amount,
          previousBalance,
          newBalance,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          tokenFrom: normalizedToken,
          amount,
        },
      });

      return { success: true };
    });
  }

  async handleDepositWebhook(data: {
    userId: string;
    token: string;
    amount: number;
    idempotencyKey: string;
  }) {
    const normalizedToken = data.token.toUpperCase();

    if (!['BRL', 'BTC', 'ETH'].includes(normalizedToken)) {
      throw new BadRequestException('Token inválido');
    }

    const processed = await this.prisma.processedWebhook.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
    });

    if (processed) {
      return { message: 'Depósito já processado anteriormente' };
    }

    return this.prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: data.userId },
      });

      if (!wallet) {
        throw new Error('Usuário/carteira não encontrados');
      }

      let previousBalance = 0;
      let newBalance = 0;

      if (normalizedToken === 'BRL') {
        previousBalance = Number(wallet.balance);
        newBalance = previousBalance + data.amount;

        await tx.wallet.update({
          where: { userId: data.userId },
          data: {
            balance: { increment: data.amount },
          },
        });
      }

      if (normalizedToken === 'BTC') {
        previousBalance = Number(wallet.btcBalance);
        newBalance = previousBalance + data.amount;

        await tx.wallet.update({
          where: { userId: data.userId },
          data: {
            btcBalance: { increment: data.amount },
          },
        });
      }

      if (normalizedToken === 'ETH') {
        previousBalance = Number(wallet.ethBalance);
        newBalance = previousBalance + data.amount;

        await tx.wallet.update({
          where: { userId: data.userId },
          data: {
            ethBalance: { increment: data.amount },
          },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          token: normalizedToken,
          amount: data.amount,
          previousBalance,
          newBalance,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEPOSIT',
          tokenTo: normalizedToken,
          amount: data.amount,
        },
      });

      await tx.processedWebhook.create({
        data: {
          idempotencyKey: data.idempotencyKey,
        },
      });

      return { success: true };
    });
  }
}