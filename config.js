/* ============================================================
   تنظیمات پروژه — فیلم‌یاب (OpenRouter)
   ============================================================ */
window.APP_CONFIG = {
  // کلید OpenRouter (با sk-or-v1 شروع می‌شود)
  OPENROUTER_API_KEY: "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",

  // مدل‌ها به ترتیب اولویت — اگر اولی در دسترس نبود، بعدی امتحان می‌شود
  // (مدل اول چندرسانه‌ای است و عکس می‌فهمد؛ برای حالت ویدیو لازم است)
  MODELS: [
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "dots-studio/dots-3-note-preview:free",
    "openrouter/free"
  ]
};