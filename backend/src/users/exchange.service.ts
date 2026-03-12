import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ExchangeService {
  TAX = 0.015;

  async getPrice(token: string) {
    let coin = '';

    if (token === 'BTC') coin = 'bitcoin';
    if (token === 'ETH') coin = 'ethereum';

    if (!coin) {
      throw new BadRequestException('Token inválido');
    }

    const res = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=brl`,
    );

    return res.data[coin].brl;
  }

  calculateTax(amount: number) {
    return amount * this.TAX;
  }
}