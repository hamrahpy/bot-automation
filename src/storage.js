import { DEFAULT_TEMPLATE, KV_KEY_TEMPLATE, KV_KEY_IG_RULES } from "./config.js";

export async function getTemplate(env) {
  const value = await env.BOT_KV.get(KV_KEY_TEMPLATE);
  return value || DEFAULT_TEMPLATE;
}

export async function setTemplate(env, text) {
  await env.BOT_KV.put(KV_KEY_TEMPLATE, text);
}

export async function getIgRules(env) {
  const raw = await env.BOT_KV.get(KV_KEY_IG_RULES);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveIgRules(env, rules) {
  await env.BOT_KV.put(KV_KEY_IG_RULES, JSON.stringify(rules));
}
