// منبع رسمی: https://rubika.ir/botapi/methods
// مراحل ارسال عکس در روبیکا (برخلاف تلگرام/بله) سه‌مرحله‌ای است:
//   ۱. requestSendFile   -> گرفتن یک آدرس آپلود موقت (upload_url)
//   ۲. آپلود مستقیم بایت‌های فایل به همان upload_url
//   ۳. sendFile           -> ارسال file_id به چت مقصد
//
// ⚠️ نکته مهم: نام دقیق فیلدها در پاسخ مرحله ۱ و ۲ در مستندات عمومی به‌طور
// کامل مشخص نبود؛ کد زیر رایج‌ترین حالت را پیاده کرده، اما در اولین اجرا
// حتماً خروجی لاگ‌ها (console.log) را در داشبورد Cloudflare (Logs) چک کنید
// و اگر نام فیلدها فرق داشت، دو خط علامت‌گذاری‌شده را اصلاح کنید.

function baseUrl(env) {
  return `https://botapi.rubika.ir/v3/${env.RUBIKA_BOT_TOKEN}`;
}

export async function sendPhoto(env, chatId, photoBytes, caption) {
  // مرحله ۱: درخواست آدرس آپلود
  const reqRes = await fetch(`${baseUrl(env)}/requestSendFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Image" }),
  });
  const reqData = await reqRes.json();
  console.log("rubika requestSendFile response:", JSON.stringify(reqData)); // برای دیباگ اولین بار
  const uploadUrl = reqData?.data?.upload_url || reqData?.upload_url;
  if (!uploadUrl) {
    return { ok: false, error: "upload_url not found", raw: reqData };
  }

  // مرحله ۲: آپلود فایل
  const form = new FormData();
  form.append("file", new Blob([photoBytes], { type: "image/jpeg" }), "product.jpg");
  const uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
  const uploadData = await uploadRes.json();
  console.log("rubika upload response:", JSON.stringify(uploadData)); // برای دیباگ اولین بار
  const fileId = uploadData?.data?.file_id || uploadData?.file_id;
  if (!fileId) {
    return { ok: false, error: "file_id not found", raw: uploadData };
  }

  // مرحله ۳: ارسال فایل به چت
  const sendRes = await fetch(`${baseUrl(env)}/sendFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, file_id: fileId, text: caption }),
  });
  return sendRes.json();
}
