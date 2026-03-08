import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  yookassaShopId: required('YOOKASSA_SHOP_ID'),
  yookassaSecretKey: required('YOOKASSA_SECRET_KEY'),
  baseUrl: required('BASE_URL'),
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? './data/prayers.db',
  adminLogin: process.env.ADMIN_LOGIN ?? 'admin',
  adminPassword: required('ADMIN_PASSWORD'),
  sessionSecret: required('SESSION_SECRET')
};
