window.APP_CONFIG = {
    // 🔑 کلیدهای خودت رو اینجا بذار
    OPENROUTER_API_KEYS: [
        "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",
        "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",
        "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"
    ],
    
    // 🧠 مدل‌های متنی (فقط برای داستان و توضیحات)
    TEXT_MODELS: [
        "deepseek/deepseek-chat",       // فوق‌العاده باهوش و منطقی برای متن
        "qwen/qwen-2.5-72b-instruct",   // جایگزین عالی برای متن
        "openrouter/free"               // مدل پشتیبان
    ],

    // 👁️ مدل‌های تصویری (فقط برای ویدیو و عکس)
    VISION_MODELS: [
        "qwen/qwen2.5-vl-72b-instruct:free",              // قوی‌ترین مدل تصویری رایگان
        "meta-llama/llama-3.2-11b-vision-instruct:free", // مدل تصویری پشتیبان
        "openrouter/free"
    ]
};