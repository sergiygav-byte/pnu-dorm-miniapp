/**
 * Розсилка push у Telegram усім, хто натиснув /start у боті.
 * Vercel env: BOT_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY, NOTIFY_SECRET
 */

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Notify-Secret');
}

async function getSubscriberChatIds(targetTgId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  let queryUrl = `${url}/rest/v1/bot_subscribers?select=chat_id`;
  if (targetTgId) {
    queryUrl += `&telegram_user_id=eq.${encodeURIComponent(String(targetTgId))}`;
  } else {
    queryUrl += '&chat_id=gt.0';
  }
  const res = await fetch(queryUrl, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return (rows || []).map((r) => r.chat_id).filter(Boolean);
}

async function telegramSend(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Telegram API: ${errText}`);
  }
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'pnu-dorm-notify',
      hint: 'POST with X-Notify-Secret, title, message',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const secret = req.headers['x-notify-secret'] || req.body?.secret;
  if (!secret || secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'NOTIFY_SECRET mismatch with config.public.js' });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BOT_TOKEN missing on Vercel' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase env missing on Vercel' });
  }

  const { message, title } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  const targetTgId = req.body?.target_tg_id || null;

  const text = title
    ? `<b>${title}</b>\n\n${message}\n\n🏫 Відкрийте додаток через меню бота.`
    : `${message}\n\n🏫 Відкрийте додаток через меню бота.`;

  try {
    const chatIds = await getSubscriberChatIds(targetTgId);
    let sent = 0;
    const errors = [];

    for (const chatId of chatIds) {
      try {
        await telegramSend(token, chatId, text);
        sent++;
      } catch (e) {
        console.error('send failed', chatId, e);
        errors.push({ chatId, error: e.message });
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      total: chatIds.length,
      hint:
        chatIds.length === 0
          ? 'Немає підписників: мешканці мають натиснути /start у боті'
          : sent === 0
            ? 'Підписники є, але Telegram не прийняв повідомлення — перевірте BOT_TOKEN'
            : undefined,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
