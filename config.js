window.APP_CONFIG = {
    // 🔑 لیست کلیدهای API شما (به ترتیب اولویت)
    OPENROUTER_API_KEYS: [
        "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", // DeepSeek (کلید ۱)
        "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", // Qwen (کلید ۲)
        "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"  // MiniMax (کلید ۳)
    ],
    
    // 🧠 لیست مدل‌ها (به ترتیب اولویت)
    // مدل‌های تصویری اول هستند چون برای ویدیو لازمن
    MODELS: [
        "qwen/qwen2.5-vl-72b-instruct:free",              // قوی‌ترین مدل تصویری رایگان
        "meta-llama/llama-3.2-11b-vision-instruct:free", // مدل تصویری پشتیبان
        "deepseek/deepseek-r1:free",                     // مدل DeepSeek برای متن
        "minimax/minimax-01",                            // مدل MiniMax برای متن
        "openrouter/free"                                // مدل آخر (پشتیبان نهایی)
    ]
};
