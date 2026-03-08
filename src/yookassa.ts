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
  paid?: boolean;
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
};

function getYooKassaAuthHeader(): string {
  return `Basic ${Buffer.from(`${config.yookassaShopId}:${config.yookassaSecretKey}`).toString('base64')}`;
}

export async function createPayment(input: CreatePaymentInput): Promise<{ paymentId: string; confirmationUrl: string }> {
  const idempotenceKey = crypto.randomUUID();

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getYooKassaAuthHeader(),
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

export async function getPayment(paymentId: string): Promise<YooKassaPaymentResponse> {
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: getYooKassaAuthHeader()
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YooKassa get payment failed: ${response.status} ${body}`);
  }

  return (await response.json()) as YooKassaPaymentResponse;
}
