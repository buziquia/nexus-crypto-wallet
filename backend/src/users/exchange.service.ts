import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ExchangeService {
  async getPrice(token: string): Promise<number> {
    const normalizedToken = token.trim().toUpperCase();

    let coinId = '';

    if (normalizedToken === 'BTC') {
      coinId = 'bitcoin';
    } else if (normalizedToken === 'ETH') {
      coinId = 'ethereum';
    } else {
      throw new BadRequestException('Token inválido para cotação');
    }

    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: coinId,
            vs_currencies: 'brl',
          },
          timeout: 10000,
        },
      );

      const price = response.data?.[coinId]?.brl;

      if (!price || typeof price !== 'number') {
        throw new BadRequestException('Não foi possível obter a cotação');
      }

      return price;
    } catch (error) {
      if (normalizedToken === 'BTC') {
        return 350000;
      }

      if (normalizedToken === 'ETH') {
        return 18000;
      }

      throw new BadRequestException('Erro ao buscar cotação');
    }
  }

  calculateTax(amount: number): number {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Valor inválido para cálculo da taxa');
    }

    return Number((amount * 0.015).toFixed(2));
  }
}