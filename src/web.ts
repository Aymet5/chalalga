import crypto from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { getReport, listOrders, listOrdersBySlot } from './db.js';
import { marchMainKhurals } from './schedule.js';

const sessions = new Map<string, { createdAt: number }>();

function isAdmin(req: Request): boolean {
  const sid = req.cookies?.admin_session as string | undefined;
  return Boolean(sid && sessions.has(sid));
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdmin(req)) {
    res.redirect('/admin/login');
    return;
  }
  next();
}

export function registerWeb(app: Express) {
  app.get('/', (_req, res) => {
    res.redirect('/admin/login');
  });

  app.get('/admin/login', (req, res) => {
    if (isAdmin(req)) {
      res.redirect('/admin');
      return;
    }
    res.render('admin-login', { error: null });
  });

  app.post('/admin/login', (req, res) => {
    const { login, password } = req.body as Record<string, string>;
    if (login === config.adminLogin && password === config.adminPassword) {
      const sid = crypto.createHmac('sha256', config.sessionSecret).update(`${Date.now()}-${Math.random()}`).digest('hex');
      sessions.set(sid, { createdAt: Date.now() });
      res.cookie('admin_session', sid, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 12 });
      res.redirect('/admin');
      return;
    }
    res.status(401).render('admin-login', { error: 'Неверный логин или пароль.' });
  });

  app.post('/admin/logout', (req, res) => {
    const sid = req.cookies?.admin_session as string | undefined;
    if (sid) sessions.delete(sid);
    res.clearCookie('admin_session');
    res.redirect('/admin/login');
  });

  app.get('/admin', requireAdmin, (req, res) => {
    const report = getReport();
    const orders = listOrders(500);
    const dateISO = (req.query.dateISO as string) || marchMainKhurals[0]?.dateISO;
    const time = (req.query.time as string) || '15:00';
    const slotOrders = dateISO ? listOrdersBySlot(dateISO, time) : [];

    res.render('admin-dashboard', {
      report,
      orders,
      schedule: marchMainKhurals,
      dateISO,
      time,
      slotOrders
    });
  });

  app.get('/admin/slot-print', requireAdmin, (req, res) => {
    const dateISO = (req.query.dateISO as string) || '';
    const time = (req.query.time as string) || '15:00';
    const slotOrders = dateISO ? listOrdersBySlot(dateISO, time) : [];
    const khural = marchMainKhurals.find((x) => x.dateISO === dateISO);

    res.render('slot-print', {
      dateISO,
      time,
      khural,
      slotOrders
    });
  });

  app.get('/admin/export.csv', requireAdmin, (_req, res) => {
    const orders = listOrders(5000);
    const header = [
      'id', 'source', 'status', 'date_label', 'time', 'khural_title', 'purpose', 'names_to_pray',
      'amount_rub', 'customer_name', 'customer_phone', 'customer_email', 'created_at'
    ];

    const rows = orders.map((o) => [
      o.id,
      o.source,
      o.status,
      o.date_label,
      o.time,
      o.khural_title,
      o.purpose,
      o.names_to_pray,
      o.amount_rub,
      o.customer_name ?? o.full_name ?? '',
      o.customer_phone ?? '',
      o.customer_email ?? '',
      o.created_at
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prayer-orders.csv"');
    res.send(`\uFEFF${csv}`);
  });
}
