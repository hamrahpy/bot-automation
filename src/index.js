import { ADMIN_IDS, HELP_TEXT } from "./config.js";
import { normalizeDigits } from "./utils.js";
import { getTemplate, setTemplate, getIgRules, saveIgRules } from "./storage.js";
import { broadcastProduct, broadcastRaw } from "./broadcast.js";
import * as telegram from "./telegram.js";
import * as instagram from "./instagram.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/" && method === "GET") {
      return new Response("OK");
    }

    if (path === "/setup/telegram" && method === "GET") {
      if (url.searchParams.get("key") !== env.SETUP_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const webhookUrl = `${url.origin}/webhook/telegram`;
      const result = await telegram.setWebhook(env, webhookUrl);
      return Response.json(result);
    }

    if (path === "/webhook/telegram" && method === "POST") {
      const update = await request.json();
      // فوراً به تلگرام جواب می‌دهیم تا آن را وادار به تلاش دوباره (و ارسال تکراری) نکنیم؛
      // پردازش واقعی (ارسال به هر سه پلتفرم) در پس‌زمینه ادامه پیدا می‌کند.
      ctx.waitUntil(
        handleTelegramUpdate(env, update).catch((err) => console.error("telegram update error:", err))
      );
      return new Response("OK");
    }

    if (path === "/webhook/instagram" && method === "GET") {
      const challenge = instagram.verifyChallenge(url.searchParams, env);
      if (challenge !== null) return new Response(challenge);
      return new Response("Forbidden", { status: 403 });
    }

    if (path === "/webhook/instagram" && method === "POST") {
      const body = await request.json();
      await instagram.handleWebhookEvent(env, body, getIgRules);
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleTelegramUpdate(env, update) {
  const message = update.message;
  if (!message) return; // سایر انواع آپدیت (مثل edited_message) را نادیده می‌گیریم

  // محافظ اضافه در برابر پردازش تکراری: اگر همین update_id قبلاً پردازش شده، دوباره کاری نکن
  const updateId = update.update_id;
  if (updateId !== undefined && updateId !== null) {
    const dedupeKey = `processed:${updateId}`;
    const already = await env.BOT_KV.get(dedupeKey);
    if (already) return;
    await env.BOT_KV.put(dedupeKey, "1", { expirationTtl: 86400 }); // ۲۴ ساعت کافی است
  }

  const fromId = message.from?.id;
  const chatId = message.chat?.id;

  if (!ADMIN_IDS.includes(fromId)) {
    // فقط ادمین‌های تعریف‌شده در config.js می‌توانند از بات استفاده کنند
    return;
  }

  const text = message.text || "";
  const caption = message.caption || "";
  const photo = message.photo;

  // --- دستورات متنی ---
  if (text.startsWith("/help") || text.startsWith("/start")) {
    await telegram.sendMessage(env, chatId, HELP_TEXT);
    return;
  }

  if (text.startsWith("/settemplate")) {
    const newTemplate = text.slice("/settemplate".length).trim();
    if (!newTemplate) {
      await telegram.sendMessage(env, chatId, "لطفاً متن پیام آماده را بعد از دستور بنویسید.");
      return;
    }
    await setTemplate(env, newTemplate);
    await telegram.sendMessage(env, chatId, "✅ پیام آماده بروزرسانی شد.");
    return;
  }

  if (text.startsWith("/template")) {
    const current = await getTemplate(env);
    await telegram.sendMessage(env, chatId, `پیام آماده فعلی:\n\n${current}`);
    return;
  }

  if (text.startsWith("/igrules")) {
    const rules = await getIgRules(env);
    const keys = Object.keys(rules);
    if (keys.length === 0) {
      await telegram.sendMessage(env, chatId, "هنوز هیچ قانونی برای اینستاگرام تعریف نشده.");
    } else {
      const lines = keys.map((k) => `• ${k} -> ${rules[k]}`);
      await telegram.sendMessage(env, chatId, "قوانین فعلی:\n" + lines.join("\n"));
    }
    return;
  }

  if (text.startsWith("/igadd")) {
    const payload = text.slice("/igadd".length).trim();
    if (!payload.includes("|")) {
      await telegram.sendMessage(env, chatId, "فرمت درست:\n/igadd کلمه|پاسخ");
      return;
    }
    const idx = payload.indexOf("|");
    const keyword = payload.slice(0, idx).trim();
    const reply = payload.slice(idx + 1).trim();
    const rules = await getIgRules(env);
    rules[keyword] = reply;
    await saveIgRules(env, rules);
    await telegram.sendMessage(env, chatId, `✅ قانون اضافه شد: «${keyword}»`);
    return;
  }

  if (text.startsWith("/igdel")) {
    const keyword = text.slice("/igdel".length).trim();
    const rules = await getIgRules(env);
    if (keyword in rules) {
      delete rules[keyword];
      await saveIgRules(env, rules);
      await telegram.sendMessage(env, chatId, `✅ قانون «${keyword}» حذف شد.`);
    } else {
      await telegram.sendMessage(env, chatId, "همچین کلمه‌ای در لیست پیدا نشد.");
    }
    return;
  }

  // --- انتشار محصول (عکس + کپشن) ---
  if (photo && photo.length > 0) {
    const fileId = photo[photo.length - 1].file_id; // بزرگترین سایز عکس
    const parsed = parsePriceWeight(caption);

    if (parsed) {
      // کپشن دقیقاً فرمت «قیمت,وزن» بود -> از پیام آماده (Template) استفاده می‌شود
      const [price, weight] = parsed;
      await telegram.sendMessage(env, chatId, "⏳ در حال انتشار (با پیام آماده) در همه پلتفرم‌ها...");
      const results = await broadcastProduct(env, fileId, price, weight);
      await telegram.sendMessage(env, chatId, `نتیجه انتشار:\n${JSON.stringify(results).slice(0, 3000)}`);
    } else {
      // هر کپشن دیگری (یا خالی) -> انتشار مستقیم و آزاد، بدون قالب
      await telegram.sendMessage(env, chatId, "⏳ در حال انتشار مستقیم (بدون پیام آماده) در همه پلتفرم‌ها...");
      const results = await broadcastRaw(env, fileId, caption);
      await telegram.sendMessage(env, chatId, `نتیجه انتشار:\n${JSON.stringify(results).slice(0, 3000)}`);
    }
    return;
  }

  // هیچ‌کدام از موارد بالا نبود
  await telegram.sendMessage(env, chatId, "دستور نامعتبر است. برای راهنما /help را بفرستید.");
}

function parsePriceWeight(caption) {
  const normalized = normalizeDigits(caption).trim();
  const parts = normalized.split(",").map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return parts;
}
