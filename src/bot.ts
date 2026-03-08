import { Markup, Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { config } from './config.js';
import { createOrderStmt, getOrderById, listOrdersBySlot, listUserOrders, updateOrderPayment } from './db.js';
import { dailyKhurals, formatScheduleMessage, marchMainKhurals } from './schedule.js';
import { createPayment } from './yookassa.js';

type DraftOrder = {
  dateISO: string;
  dateLabel: string;
  time: string;
  khuralTitle: string;
  purpose: string;
  namesToPray?: string;
  comment?: string;
};

const userDrafts = new Map<number, DraftOrder>();
const awaitingField = new Map<number, 'names' | 'comment' | 'amount'>();
const lamaView = new Map<number, { dateISO: string }>();

export const bot = config.botToken ? new Telegraf(config.botToken) : null;

function mainKeyboard() {
  return Markup.keyboard([
    ['🙏 Заказать молебень', '🗓 Расписание'],
    ['📦 Мои заявки', '🕯 Имена на хурал (ламы)']
  ]).resize();
}

function slotNamesMessage(dateISO: string, time: string): string {
  const orders = listOrdersBySlot(dateISO, time);
  const khural = marchMainKhurals.find((x) => x.dateISO === dateISO && x.time === time);

  const title = khural ? `${khural.dateLabel} ${time} — ${khural.title}` : `${dateISO} ${time}`;
  if (!orders.length) return `На слот ${title} имён пока нет.`;

  const lines = orders.map((o, i) => `${i + 1}) ${o.names_to_pray} (${o.status})`);
  return [`🕯 Имена на хурал: ${title}`, '', ...lines].join('\n');
}

if (bot) {
  bot.start(async (ctx) => {
    await ctx.reply('Сайн байна! Заказы молебнов принимаются через этого Telegram-бота. Выберите действие:', mainKeyboard());
  });

  bot.hears('🗓 Расписание', async (ctx) => {
    const daily = dailyKhurals.map((x) => `• ${x.time} — ${x.title}: ${x.purpose}`).join('\n');
    await ctx.reply(`${formatScheduleMessage()}\n\nПодробно по ежедневным:\n${daily}`, mainKeyboard());
  });

  bot.hears('📦 Мои заявки', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const orders = listUserOrders(userId, 10);
    if (!orders.length) {
      await ctx.reply('У вас пока нет заявок.', mainKeyboard());
      return;
    }
    const text = orders
      .map((o) => `#${o.id} | ${o.date_label} ${o.time} | ${o.khural_title}\nИмена: ${o.names_to_pray}\nСумма: ${o.amount_rub} ₽ | Статус: ${o.status}`)
      .join('\n\n');
    await ctx.reply(text, mainKeyboard());
  });

  bot.hears('🕯 Имена на хурал (ламы)', async (ctx) => {
    if (!ctx.from) return;
    lamaView.set(ctx.from.id, { dateISO: marchMainKhurals[0].dateISO });
    const rows = marchMainKhurals.map((k) => [Markup.button.callback(k.dateLabel, `lama-date:${k.dateISO}`)]);
    await ctx.reply('Выберите дату хурала:', Markup.inlineKeyboard(rows));
  });

  bot.action(/lama-date:(.+)/, async (ctx) => {
    if (!ctx.from) return;
    const dateISO = ctx.match[1];
    lamaView.set(ctx.from.id, { dateISO });

    const buttons = ['09:00', '14:00', '15:00', '16:00'].map((time) => Markup.button.callback(time, `lama-time:${time}`));
    await ctx.answerCbQuery();
    await ctx.reply('Выберите время хурала:', Markup.inlineKeyboard([buttons]));
  });

  bot.action(/lama-time:(.+)/, async (ctx) => {
    if (!ctx.from) return;
    const time = ctx.match[1];
    const dateISO = lamaView.get(ctx.from.id)?.dateISO;
    if (!dateISO) {
      await ctx.answerCbQuery('Сначала выберите дату');
      return;
    }
    await ctx.answerCbQuery();
    await ctx.reply(slotNamesMessage(dateISO, time), mainKeyboard());
  });

  bot.command('slot', async (ctx) => {
    const parts = ctx.message.text.split(' ').slice(1);
    const [dateISO, time = '15:00'] = parts;
    if (!dateISO) {
      await ctx.reply('Использование: /slot YYYY-MM-DD HH:MM');
      return;
    }
    await ctx.reply(slotNamesMessage(dateISO, time), mainKeyboard());
  });

  bot.hears('🙏 Заказать молебень', async (ctx) => {
    const rows = marchMainKhurals.map((khural) => [Markup.button.callback(khural.dateLabel, `date:${khural.dateISO}`)]);
    await ctx.reply('Выберите дату и основной хурал (15:00):', Markup.inlineKeyboard(rows));
  });

  bot.action(/date:(.+)/, async (ctx) => {
    const dateISO = ctx.match[1];
    const khural = marchMainKhurals.find((item) => item.dateISO === dateISO);
    if (!khural || !ctx.from) {
      await ctx.answerCbQuery('Дата не найдена');
      return;
    }

    userDrafts.set(ctx.from.id, {
      dateISO: khural.dateISO,
      dateLabel: khural.dateLabel,
      time: khural.time,
      khuralTitle: khural.title,
      purpose: khural.purpose
    });
    awaitingField.set(ctx.from.id, 'names');

    await ctx.answerCbQuery();
    await ctx.reply(`Вы выбрали: ${khural.dateLabel}, ${khural.time}, «${khural.title}».\nОтправьте имена, за кого читать молебень (через запятую).`);
  });

  bot.on('text', async (ctx: Context & { message: { text: string } }) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const field = awaitingField.get(userId);
    if (!field) return;

    const draft = userDrafts.get(userId);
    if (!draft) return;

    const text = ctx.message.text.trim();

    if (field === 'names') {
      draft.namesToPray = text;
      awaitingField.set(userId, 'comment');
      await ctx.reply('Добавьте комментарий (или отправьте "-" если без комментария).');
      return;
    }

    if (field === 'comment') {
      draft.comment = text === '-' ? undefined : text;
      awaitingField.set(userId, 'amount');
      await ctx.reply('Укажите сумму подношения в рублях (например: 300).');
      return;
    }

    if (field === 'amount') {
      const amount = Number.parseInt(text, 10);
      if (Number.isNaN(amount) || amount < 1) {
        await ctx.reply('Введите корректную сумму (целое число больше 0).');
        return;
      }

      const result = createOrderStmt.run({
        user_id: userId,
        username: ctx.from?.username ?? null,
        full_name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || null,
        customer_name: [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || null,
        customer_phone: null,
        customer_email: null,
        source: 'telegram',
        date_iso: draft.dateISO,
        date_label: draft.dateLabel,
        time: draft.time,
        khural_title: draft.khuralTitle,
        purpose: draft.purpose,
        names_to_pray: draft.namesToPray,
        comment: draft.comment ?? null,
        amount_rub: amount,
        status: 'awaiting_details'
      });

      const orderId = Number(result.lastInsertRowid);
      const order = getOrderById(orderId);
      if (!order) {
        await ctx.reply('Ошибка сохранения заявки, попробуйте снова.');
        userDrafts.delete(userId);
        awaitingField.delete(userId);
        return;
      }

      try {
        const payment = await createPayment({
          orderId,
          amountRub: order.amount_rub,
          description: `Молебень ${order.khural_title} (${order.date_label})`
        });

        updateOrderPayment(orderId, payment.paymentId, payment.confirmationUrl);

        await ctx.reply(
          `Заявка #${orderId} создана.\nМолебень: ${order.khural_title}, ${order.date_label} ${order.time}.\nСумма: ${order.amount_rub} ₽.\n\nОплатите подношение по ссылке:\n${payment.confirmationUrl}`,
          mainKeyboard()
        );
      } catch (error) {
        await ctx.reply(
          `Заявка #${orderId} сохранена, но не удалось создать платеж в ЮKassa.\nТехническая ошибка: ${(error as Error).message}`,
          mainKeyboard()
        );
      } finally {
        userDrafts.delete(userId);
        awaitingField.delete(userId);
      }
    }
  });
}
