/**
 * Нагадування про санітарку вранці в день чергування (Europe/Kyiv).
 */

import { sendPushMessages, supabaseRpc } from './lib/push-helpers.js';

function formatDutyLine(d) {
  const t = d.duty_time || '22:00';
  return `• Поверх ${d.floor}, ${d.wing} крило, кімн. ${d.room} — о ${t}`;
}

function formatUkrDate(isoDate) {
  try {
    const [y, m, day] = isoDate.split('-').map(Number);
    const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
    return `${day} ${months[m - 1]}`;
  } catch (_) {
    return isoDate;
  }
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
        hint: 'Сповіщення вимкнені, нагадування вимкнені, або вже надіслано на сьогодні',
      });
    }

    const duties = await supabaseRpc('get_duty_sanitary_today_kyiv');
    const list = Array.isArray(duties) ? duties : [];
    if (!list.length) {
      return res.status(200).json({ ok: true, skipped: true, hint: 'Немає чергувань на сьогодні' });
    }

    const todayIso = list[0]?.date || new Date().toISOString().slice(0, 10);
    const todayLabel = formatUkrDate(todayIso);
    const lines = list.map(formatDutyLine).join('\n');
    const message = `Сьогодні, <b>${todayLabel}</b>, санітарне чергування:\n\n${lines}\n\nДеталі у додатку → вкладка «Інфо» / чергування.`;

    const result = await sendPushMessages({
      title: '🧹 Нагадування: санітарка сьогодні',
      message,
      targetTgId: null,
      forceBroadcast: true,
    });

    if (result.sent > 0 || result.total === 0) {
      await supabaseRpc('mark_duty_reminders_sent_today');
    }

    return res.status(200).json({
      ok: true,
      duties: list.length,
      date: todayIso,
      ...result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
