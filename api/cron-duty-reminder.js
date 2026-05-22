/**
 * Щоденне нагадування про санітарку на завтра (Europe/Kyiv).
 * Vercel Cron + CRON_SECRET у Environment Variables.
 */

import { sendPushMessages, supabaseRpc } from './lib/push-helpers.js';

function formatDutyLine(d) {
  return `• Поверх ${d.floor}, ${d.wing} крило, кімн. ${d.room}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST' });
  }

  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const headerSecret = req.headers['x-cron-secret'] || bearer;

  if (cronSecret && headerSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized cron' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.BOT_TOKEN) {
    return res.status(500).json({ error: 'Missing env: SUPABASE_*, BOT_TOKEN' });
  }

  try {
    const shouldSend = await supabaseRpc('should_send_duty_reminder_today');
    if (!shouldSend) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        hint: 'Нагадування вимкнено, push off, або вже надіслано на цю дату',
      });
    }

    const duties = await supabaseRpc('get_duty_sanitary_tomorrow_kyiv');
    const list = Array.isArray(duties) ? duties : [];
    if (!list.length) {
      return res.status(200).json({ ok: true, skipped: true, hint: 'Немає чергувань на завтра' });
    }

    const tomorrow = list[0]?.date || 'завтра';
    const lines = list.map(formatDutyLine).join('\n');
    const message = `Завтра (${tomorrow}) санітарне чергування:\n\n${lines}\n\nПеревірте розклад у додатку → вкладка «Інфо».`;

    const result = await sendPushMessages({
      title: '🧹 Нагадування: санітарка',
      message,
      targetTgId: null,
      forceBroadcast: true,
    });

    if (result.sent > 0 || result.total === 0) {
      await supabaseRpc('mark_duty_reminder_sent_today');
    }

    return res.status(200).json({
      ok: true,
      duties: list.length,
      ...result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
