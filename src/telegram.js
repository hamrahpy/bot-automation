function baseUrl(env) {
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
}

export async function sendMessage(env, chatId, text) {
  const res = await fetch(`${baseUrl(env)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.json();
}

export async function sendPhotoByFileId(env, chatId, fileId, caption) {
  // چون خودِ تلگرام است، همان file_id قابل استفاده مجدد است (نیاز به دانلود/آپلود مجدد نیست)
  const res = await fetch(`${baseUrl(env)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: fileId, caption }),
  });
  return res.json();
}

export async function downloadFileBytes(env, fileId) {
  // برای فرستادن همین عکس به بله و روبیکا، باید بایت‌های خامش را بگیریم
  const infoRes = await fetch(`${baseUrl(env)}/getFile?file_id=${fileId}`);
  const info = await infoRes.json();
  const filePath = info.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const fileRes = await fetch(fileUrl);
  return await fileRes.arrayBuffer();
}

export async function setWebhook(env, webhookUrl) {
  // این تابع از داخل خودِ Worker (سرورهای کلودفلر) اجرا می‌شود، نه از کامپیوتر شما،
  // پس فیلترینگ ایران روی این درخواست تاثیری ندارد.
  const res = await fetch(`${baseUrl(env)}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
  return res.json();
}
