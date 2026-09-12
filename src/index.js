import { ADMIN_IDS, HELP_TEXT } from "./config.js";
import { normalizeDigits } from "./utils.js";
import { getTemplate, setTemplate, getIgRules, saveIgRules } from "./storage.js";
import { broadcastProduct } from "./broadcast.js";
import * as telegram from "./telegram.js";
import * as instagram from "./instagram.js";

export default {
  async fetch(request, env) {
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
      await handleTelegramUpdate(env, update);
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

  // --- انتشار محصول (عکس + کپشن قیمت,وزن) ---
  if (photo && photo.length > 0) {
    const parsed = parsePriceWeight(caption);
    if (!parsed) {
      await telegram.sendMessage(
        env,
        chatId,
        "کپشن باید به این شکل باشد:\nقیمت,وزن\nمثال: 250000,1.5"
      );
      return;
    }

    const [price, weight] = parsed;
    const fileId = photo[photo.length - 1].file_id; // بزرگترین سایز عکس
    await telegram.sendMessage(env, chatId, "⏳ در حال انتشار در همه پلتفرم‌ها...");
    const results = await broadcastProduct(env, fileId, price, weight);
    await telegram.sendMessage(env, chatId, `نتیجه انتشار:\n${JSON.stringify(results).slice(0, 3000)}`);
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
