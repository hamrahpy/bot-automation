function baseUrl(env) {
  return `https://tapi.bale.ai/bot${env.BALE_BOT_TOKEN}`;
}

export async function sendPhoto(env, chatId, photoBytes, caption) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", new Blob([photoBytes], { type: "image/jpeg" }), "product.jpg");

  const res = await fetch(`${baseUrl(env)}/sendPhoto`, { method: "POST", body: form });
  return res.json();
}
