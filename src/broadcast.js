import { getTemplate } from "./storage.js";
import { sendPhotoByFileId, downloadFileBytes } from "./telegram.js";
import { sendPhoto as baleSendPhoto } from "./bale.js";
import { sendPhoto as rubikaSendPhoto } from "./rubika.js";
import { TELEGRAM_CHANNEL_ID, BALE_CHANNEL_ID, RUBIKA_CHANNEL_ID } from "./config.js";

async function sendToAllPlatforms(env, photoFileId, caption) {
  const results = {};

  // تلگرام: چون فایل از خود تلگرام آمده، همان file_id مستقیم قابل استفاده است
  results.telegram = await sendPhotoByFileId(env, TELEGRAM_CHANNEL_ID, photoFileId, caption);

  // برای بله و روبیکا باید بایت‌های خام عکس را داشته باشیم
  const photoBytes = await downloadFileBytes(env, photoFileId);

  results.bale = await baleSendPhoto(env, BALE_CHANNEL_ID, photoBytes, caption);
  results.rubika = await rubikaSendPhoto(env, RUBIKA_CHANNEL_ID, photoBytes, caption);

  return results;
}

// حالت اول: پیام آماده (Template) با جای‌گذاری قیمت و وزن
export async function broadcastProduct(env, photoFileId, price, weight) {
  const template = await getTemplate(env);
  const caption = template.replaceAll("{price}", price).replaceAll("{weight}", weight);
  return sendToAllPlatforms(env, photoFileId, caption);
}

// حالت دوم: انتشار مستقیم و آزاد — همان متنی که ادمین نوشته، بدون هیچ قالبی
export async function broadcastRaw(env, photoFileId, caption) {
  return sendToAllPlatforms(env, photoFileId, caption || "");
}
