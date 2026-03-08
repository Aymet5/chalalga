import crypto from 'node:crypto';
import { config } from './config.js';

type CreatePaymentInput = {
  orderId: number;
  amountRub: number;
  description: string;
};

type YooKassaPaymentResponse = {
  id: string;
  status: string;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
};

export async function createPayment(input: CreatePaymentInput): Promise<{ paymentId: string; confirmationUrl: string }> {
  const auth = Buffer.from(`${config.yookassaShopId}:${config.yookassaSecretKey}`).toString('base64');
  const idempotenceKey = crypto.randomUUID();

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      'Idempotence-Key': idempotenceKey
    },
    body: JSON.stringify({
      amount: {
        value: input.amountRub.toFixed(2),
        currency: 'RUB'
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: `${config.baseUrl}/payment/success?order=${input.orderId}`
      },
      description: input.description,
      metadata: {
        orderId: String(input.orderId)
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YooKassa create payment failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as YooKassaPaymentResponse;
  if (!payload.confirmation?.confirmation_url) {
    throw new Error('YooKassa did not return confirmation URL');
  }

  return { paymentId: payload.id, confirmationUrl: payload.confirmation.confirmation_url };
}
