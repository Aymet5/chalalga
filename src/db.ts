import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type OrderStatus = 'awaiting_details' | 'awaiting_payment' | 'paid' | 'canceled';
export type OrderSource = 'telegram' | 'website';

export type PrayerOrder = {
  id: number;
  user_id: number | null;
  username: string | null;
  full_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  source: OrderSource;
  date_iso: string;
  date_label: string;
  time: string;
  khural_title: string;
  purpose: string;
  names_to_pray: string;
  comment: string | null;
  amount_rub: number;
  status: OrderStatus;
  payment_id: string | null;
  payment_url: string | null;
  created_at: string;
  updated_at: string;
};

const dbDir = path.dirname(process.env.DB_PATH ?? './data/prayers.db');
fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(process.env.DB_PATH ?? './data/prayers.db');

db.exec(`
CREATE TABLE IF NOT EXISTS prayer_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  full_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  source TEXT NOT NULL DEFAULT 'telegram',
  date_iso TEXT NOT NULL,
  date_label TEXT NOT NULL,
  time TEXT NOT NULL,
  khural_title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  names_to_pray TEXT NOT NULL,
  comment TEXT,
  amount_rub INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_id TEXT,
  payment_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const cols = db.prepare('PRAGMA table_info(prayer_orders)').all() as Array<{ name: string }>;
const colSet = new Set(cols.map((c) => c.name));
if (!colSet.has('customer_name')) db.exec('ALTER TABLE prayer_orders ADD COLUMN customer_name TEXT;');
if (!colSet.has('customer_phone')) db.exec('ALTER TABLE prayer_orders ADD COLUMN customer_phone TEXT;');
if (!colSet.has('customer_email')) db.exec('ALTER TABLE prayer_orders ADD COLUMN customer_email TEXT;');
if (!colSet.has('source')) db.exec("ALTER TABLE prayer_orders ADD COLUMN source TEXT NOT NULL DEFAULT 'telegram';");

db.exec('CREATE INDEX IF NOT EXISTS idx_prayer_orders_user_id ON prayer_orders(user_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_prayer_orders_payment_id ON prayer_orders(payment_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_prayer_orders_status ON prayer_orders(status);');

export const createOrderStmt = db.prepare(`
  INSERT INTO prayer_orders (
    user_id, username, full_name, customer_name, customer_phone, customer_email, source,
    date_iso, date_label, time, khural_title, purpose,
    names_to_pray, comment, amount_rub, status
  ) VALUES (
    @user_id, @username, @full_name, @customer_name, @customer_phone, @customer_email, @source,
    @date_iso, @date_label, @time, @khural_title, @purpose,
    @names_to_pray, @comment, @amount_rub, @status
  )
`);

export function getOrderById(id: number): PrayerOrder | undefined {
  return db.prepare('SELECT * FROM prayer_orders WHERE id = ?').get(id) as PrayerOrder | undefined;
}

export function updateOrderPayment(id: number, paymentId: string, paymentUrl: string): void {
  db.prepare(`
    UPDATE prayer_orders
    SET payment_id = ?, payment_url = ?, status = 'awaiting_payment', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(paymentId, paymentUrl, id);
}

export function markOrderPaid(paymentId: string): PrayerOrder | undefined {
  const order = db.prepare('SELECT * FROM prayer_orders WHERE payment_id = ?').get(paymentId) as PrayerOrder | undefined;
  if (!order) return undefined;
  db.prepare("UPDATE prayer_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?").run(paymentId);
  return getOrderById(order.id);
}

export function listUserOrders(userId: number, limit = 10): PrayerOrder[] {
  return db
    .prepare('SELECT * FROM prayer_orders WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit) as PrayerOrder[];
}


export function listOrdersBySlot(dateISO: string, time: string): PrayerOrder[] {
  return db
    .prepare(
      `SELECT * FROM prayer_orders
       WHERE date_iso = ? AND time = ? AND status != 'canceled'
       ORDER BY created_at ASC, id ASC`
    )
    .all(dateISO, time) as PrayerOrder[];
}

export function listOrders(limit = 200): PrayerOrder[] {
  return db.prepare('SELECT * FROM prayer_orders ORDER BY id DESC LIMIT ?').all(limit) as PrayerOrder[];
}

export function getReport() {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'paid' THEN amount_rub ELSE 0 END) AS paid_sum,
         SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
         SUM(CASE WHEN source = 'telegram' THEN 1 ELSE 0 END) AS telegram_count,
         SUM(CASE WHEN source = 'website' THEN 1 ELSE 0 END) AS website_count
       FROM prayer_orders`
    )
    .get() as {
    total_orders: number;
    paid_sum: number | null;
    paid_count: number;
    telegram_count: number;
    website_count: number;
  };

  const byStatus = db
    .prepare('SELECT status, COUNT(*) as count FROM prayer_orders GROUP BY status ORDER BY count DESC')
    .all() as Array<{ status: string; count: number }>;

  return {
    ...totals,
    paid_sum: totals.paid_sum ?? 0,
    byStatus
  };
}
