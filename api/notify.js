/**
 * Розсилка push у Telegram усім, хто натиснув /start у боті.
 * Vercel env: BOT_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY, NOTIFY_SECRET
 */

async function supabaseRpc(method, body) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured on Vercel');

  const res = await fetch(`${url}/rest/v1/rpc/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  return res;
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
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const secret = req.headers['x-notify-secret'] || req.body?.secret;
  if (!secret || secret !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BOT_TOKEN missing' });
  }

  const { message, title, target_tg_id: targetTgId } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  const text = title
    ? `<b>${title}</b>\n\n${message}\n\n🏫 Відкрийте додаток через меню бота.`
    : `${message}\n\n🏫 Відкрийте додаток через меню бота.`;

  try {
    const chatIds = await getSubscriberChatIds(targetTgId || null);
    let sent = 0;
    for (const chatId of chatIds) {
      try {
        await telegramSend(token, chatId, text);
        sent++;
      } catch (e) {
        console.error('send failed', chatId, e);
      }
    }
    return res.status(200).json({ ok: true, sent, total: chatIds.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
