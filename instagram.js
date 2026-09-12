export function verifyChallenge(searchParams, env) {
  // متا هنگام ثبت وب‌هوک یک درخواست GET با hub.challenge می‌فرستد که باید عینا برگردانده شود
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.IG_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

export async function handleWebhookEvent(env, body, getIgRules) {
  const rules = await getIgRules(env);
  if (!rules || Object.keys(rules).length === 0) return;

  const entries = body.entry || [];
  for (const entry of entries) {
    for (const event of entry.messaging || []) {
      const text = event.message?.text;
      const senderId = event.sender?.id;
      if (!text || !senderId) continue;

      const lower = text.toLowerCase();
      for (const [keyword, reply] of Object.entries(rules)) {
        if (lower.includes(keyword.toLowerCase())) {
          await sendReply(env, senderId, reply);
          break;
        }
      }
    }
  }
}

async function sendReply(env, recipientId, text) {
  const url = `https://graph.facebook.com/v21.0/me/messages?access_token=${env.IG_ACCESS_TOKEN}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
}
