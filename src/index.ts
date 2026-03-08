import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { bot } from './bot.js';
import { config } from './config.js';
import { markOrderPaid } from './db.js';
import { registerWeb } from './web.js';
import { getPayment } from './yookassa.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.sessionSecret));
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));
app.use('/assets', express.static(path.join(process.cwd(), 'src', 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, botEnabled: Boolean(bot) });
});

app.get('/payment/success', (req, res) => {
  const order = req.query.order;
  res.render('payment-success', { order });
});

registerWeb(app);

app.post('/yookassa/webhook', async (req, res) => {
  const event = req.body?.event;
  const paymentId = req.body?.object?.id;

  if (event === 'payment.succeeded' && paymentId) {
    let payment;

    try {
      payment = await getPayment(paymentId);
    } catch (error) {
      console.error('Failed to verify YooKassa payment status:', error);
      return res.status(502).json({ ok: false });
    }

    if (payment.id !== paymentId || payment.status !== 'succeeded' || payment.paid !== true) {
      return res.status(200).json({ ok: true });
    }

    const order = markOrderPaid(paymentId);

    if (order?.user_id && bot) {
      try {
        await bot.telegram.sendMessage(
          order.user_id,
          `✅ Подношение по заявке #${order.id} получено.\n` +
            `${order.date_label} ${order.time}, «${order.khural_title}».\n` +
            `Имена: ${order.names_to_pray}`
        );
      } catch (error) {
        console.error('Failed to notify user:', error);
      }
    }
  }

  res.status(200).json({ ok: true });
});

async function bootstrap() {
  if (bot) {
    await bot.launch();
    console.log('Telegram bot is running (long polling)');
  } else {
    console.log('BOT_TOKEN not provided: web-mode only.');
  }

  app.listen(config.port, () => {
    console.log(`HTTP server started on :${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

if (bot) {
  const runningBot = bot;
  process.once('SIGINT', () => runningBot.stop('SIGINT'));
  process.once('SIGTERM', () => runningBot.stop('SIGTERM'));
}
