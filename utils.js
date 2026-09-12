const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(text) {
  if (!text) return text;
  let result = text;
  for (let i = 0; i < 10; i++) {
    result = result.split(PERSIAN_DIGITS[i]).join(String(i));
    result = result.split(ARABIC_DIGITS[i]).join(String(i));
  }
  result = result.split("،").join(",").split("٫").join(".");
  return result;
}
