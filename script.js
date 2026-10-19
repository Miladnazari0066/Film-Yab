// بررسی وجود فایل config
if (typeof window.APP_CONFIG === 'undefined') {
    alert("خطای مهم: فایل config.js لود نشده است یا کلید API در آن وجود ندارد!");
}

const cfg = window.APP_CONFIG || { OPENROUTER_API_KEYS: [], MODELS: ['openrouter/free'] };
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const FRAME_COUNT = 8; 
const FRAME_WIDTH = 512;

// 🔑 کلید API شما برای OMDb
const OMDB_API_KEY = 'b44a4ca6';

const $ = id => document.getElementById(id);

// المان‌ها
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = { text: $('panel-text'), video: $('panel-video') };
const storyInput = $('story');
const yearInput = $('year');
const countryInput = $('country');
const dropzone = $('dropzone');
const fileInput = $('file-input');
const videoInfo = $('video-info');
const videoPreview = $('video-preview');
const captionInput = $('caption');
const btnText = $('btn-text');
const btnVideo = $('btn-video');
const loader = $('loader');
const loaderText = $('loader-text');
const resultBox = $('result-box');
const progressBar = $('progress-bar');
const progressText = $('progress-text');

// مدیریت تب‌ها
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        Object.keys(panels).forEach(key => {
            panels[key].classList.toggle('active', key === target);
        });
    });
});

let selectedFile = null;

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--secondary-glow)'; });
dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-color)');
dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-color)';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) setVideoFile(file);
    else alert('لطفاً یک فایل ویدیویی معتبر انتخاب کنید.');
});

fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) setVideoFile(file);
});

function fmtSize(bytes) {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? mb.toFixed(1) + ' MB' : (bytes / 1024).toFixed(0) + ' KB';
}

function setVideoFile(file) {
    selectedFile = file;
    videoPreview.src = URL.createObjectURL(file);
    dropzone.style.display = 'none';
    videoInfo.style.display = 'block';
    videoInfo.querySelector('.filename').textContent = file.name;
    videoInfo.querySelector('.filesize').textContent = fmtSize(file.size);
}

async function extractFrames(file, count = FRAME_COUNT) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = async () => {
            const dur = video.duration;
            if (!isFinite(dur) || dur <= 0) return reject(new Error('مدت ویدیو نامعتبر است.'));
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const frames = [];
            video.width = video.videoWidth;
            video.height = video.videoHeight;
            const scale = Math.min(1, FRAME_WIDTH / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);

            for (let i = 0; i < count; i++) {
                const t = dur * (i + 0.5) / count;
                video.currentTime = t;
                await new Promise(r => video.onseeked = r);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.7));
            }
            resolve(frames);
        };
        video.onerror = () => reject(new Error('خطا در خواندن فایل ویدیویی.'));
    });
}

function buildPrompt(text, year, country, isVideo) {
    if (isVideo) {
        return `تو یک کارشناس ارشد سینما و متخصص تشخیص چهره و صحنه هستی. من ${FRAME_COUNT} تصویر از یک ویدیو را به تو می‌دهم.
اطلاعات متنی همراه ویدیو: "${text || 'ندارد'}"

وظیفه تو:
1. ابتدا چهره بازیگران، لباس‌ها، فضاسازی (مکان)، نورپردازی و اشیای مهم را در تصاویر به دقت تحلیل کن.
2. با توجه به این سرنخ‌های بصری، نام دقیق فیلم یا سریال را پیدا کن.
3. **فقط در صورتی که ۱۰۰٪ مطمئن هستی** نام فیلم را بگو. اگر مطمئن نیستی، حتماً ۲ یا ۳ گزینه جایگزین (alternatives) بده و دلیل بصری برای هر کدام بنویس.
4. نام فارسی اثر را با املای صحیح بنویس.

خروجی را **فقط** به صورت JSON خالص (بدون بک‌تیک) با این ساختار بده:
{
  "title_fa": "نام فارسی", "title_en": "نام انگلیسی", "year": "سال", "type": "نوع",
  "imdbID": "شناسه (اگر پیدا کردی)", "confidence": "درصد اطمینان", "explanation": "توضیح اینکه چه نشانه‌های بصری باعث شد این فیلم را انتخاب کنی",
  "alternatives": [ { "title_fa": "نام", "reason": "دلیل بصری" } ]
}`;
    } else {
        return `تو یک کارشناس سینما هستی. کاربر در حال توصیف یک فیلم یا سریال است.
اطلاعات کاربر: متن: "${text}" | سال: ${year || 'نامشخص'} | کشور: ${country || 'نامشخص'}
نام دقیق اثر (فارسی و انگلیسی)، سال، نوع (فیلم/سریال)، توضیح فارسی و آیدی IMDb را پیدا کن.
**توجه: نام فارسی فیلم را با املای کاملاً صحیح و رایج در ایران بنویس.**
خروجی را **فقط** به صورت JSON خالص با این ساختار بده:
{
  "title_fa": "نام", "title_en": "Name", "year": "سال", "type": "نوع",
  "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح فارسی",
  "alternatives": [ { "title_fa": "نام", "reason": "دلیل" } ]
}`;
    }
}

// 🚀 سیستم Fallback چند لایه
async function callOpenRouter(content) {
    if (!cfg.OPENROUTER_API_KEYS || cfg.OPENROUTER_API_KEYS.length === 0) {
        throw new Error("هیچ کلید API در config.js تعریف نشده است!");
    }

    for (const model of cfg.MODELS) {
        for (let i = 0; i < cfg.OPENROUTER_API_KEYS.length; i++) {
            const apiKey = cfg.OPENROUTER_API_KEYS[i];
            if (!apiKey || apiKey.trim() === "") continue;

            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': location.origin,
                        'X-Title': 'Film-Yab'
                    },
                    body: JSON.stringify({ model: model, messages: [{ role: 'user', content: content }], temperature: 0.2 })
                });

                if (!res.ok) {
                    console.warn(`مدل ${model} با کلید ${i + 1} خطا داد. کد: ${res.status}`);
                    continue; 
                }

                const data = await res.json();
                if (data.choices && data.choices.length > 0) {
                    return data.choices[0].message.content;
                }
            } catch (err) {
                console.warn(`خطای شبکه در مدل ${model} با کلید ${i + 1}:`, err);
            }
        }
    }
    throw new Error("متاسفانه تمام مدل‌ها و کلیدها تلاش شدند اما هیچ پاسخی دریافت نشد. لطفاً کمی بعد دوباره تلاش کنید.");
}

// جستجوی متنی
btnText.addEventListener('click', async () => {
    const text = storyInput.value.trim();
    if (text.length < 10) return showError('لطفاً توضیحات بیشتری بنویسید.');

    showLoader(true);
    startProgress(); // 👈 شروع نوار پیشرفت

    try {
        const prompt = buildPrompt(text, yearInput.value.trim(), countryInput.value.trim(), false);
        const rawResponse = await callOpenRouter([{ type: "text", text: prompt }]);
        const parsedData = parseJson(rawResponse);
        
        finishProgress(); // 👈 پر کردن نهایی نوار
        setTimeout(async () => {
            showLoader(false);
            await showResult(parsedData);
        }, 400); // ۴۰۰ میلی‌ثانیه صبر می‌کنیم تا کاربر پر شدن نوار رو ببینه

    } catch (err) {
        finishProgress();
        setTimeout(() => {
            showLoader(false);
            showError(err.message);
            alert("خطای جستجو: " + err.message);
        }, 400);
    }
});

// جستجوی ویدیویی
btnVideo.addEventListener('click', async () => {
    if (!selectedFile) return showError('لطفاً ابتدا یک ویدیو انتخاب کنید.');
    
    showLoader(true);
    startProgress(); // 👈 شروع نوار پیشرفت
    
    try {
        loaderText.textContent = 'در حال استخراج فریم‌ها...';
        const frames = await extractFrames(selectedFile);
        const caption = captionInput.value.trim() || '';
        const prompt = buildPrompt(caption, '', '', true);
        
        const content = [{ type: "text", text: prompt }];
        frames.forEach(frame => content.push({ type: "image_url", image_url: { url: frame } }));

        loaderText.textContent = 'در حال تحلیل تصاویر...';
        const rawResponse = await callOpenRouter(content);
        const parsedData = parseJson(rawResponse);
        
        finishProgress(); // 👈 پر کردن نهایی نوار
        setTimeout(async () => {
            showLoader(false);
            await showResult(parsedData);
        }, 400);

    } catch (err) {
        finishProgress();
        setTimeout(() => {
            showLoader(false);
            showError(err.message);
            alert("خطای تحلیل ویدیو: " + err.message);
        }, 400);
    }
});

// مدیریت لودر
function showLoader(show) {
    loader.style.display = show ? 'block' : 'none';
    if (show) {
        resultBox.style.display = 'none';
        const msgs = ['در حال آماده‌سازی...', 'در حال تحلیل...', 'جستجو در آرشیو سینما...'];
        let i = 0;
        loaderText.textContent = msgs[0];
        const int = setInterval(() => { i = (i + 1) % msgs.length; loaderText.textContent = msgs[i]; }, 3000);
        loader.dataset.interval = int;
    } else {
        clearInterval(loader.dataset.interval);
    }
}

// 🟢 توابع شبیه‌سازی نوار پیشرفت
let progressInterval;
let currentProgress = 0;

function startProgress() {
    clearInterval(progressInterval);
    currentProgress = 0;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    progressInterval = setInterval(() => {
        // تا ۹۰٪ میره جلو، هر چی نزدیک‌تر، آهسته‌تر
        if (currentProgress < 90) {
            currentProgress += Math.max(0.5, (90 - currentProgress) * 0.05);
            progressBar.style.width = `${currentProgress}%`;
            progressText.textContent = `${Math.round(currentProgress)}%`;
        }
    }, 150);
}

function finishProgress() {
    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressText.textContent = '100%';
}

function showError(msg) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 20px; border-radius: 16px; text-align: center; font-weight: bold;">${escapeHtml(msg)}</div>`;
}

function parseJson(raw) {
    try {
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) {}
        }
        throw new Error("هوش مصنوعی جواب داد، اما فرمت آن JSON نبود.");
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

async function fetchOMDbData(imdbID, titleEn, year) {
    if (!OMDB_API_KEY) return { poster: null, rating: null };
    try {
        let url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&plot=short`;
        if (imdbID && imdbID.startsWith('tt')) {
            url += `&i=${imdbID}`;
        } else {
            url += `&t=${encodeURIComponent(titleEn)}`;
            if (year && !isNaN(year)) url += `&y=${year}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.Response === 'True') {
            return {
                poster: data.Poster !== 'N/A' ? data.Poster : null,
                rating: data.imdbRating !== 'N/A' ? data.imdbRating : null
            };
        }
    } catch (e) {
        console.warn('خطا در دریافت اطلاعات OMDb:', e);
    }
    return { poster: null, rating: null };
}

async function showResult(data) {
    if (!data) return showError('داده‌ای برای نمایش وجود ندارد.');
    resultBox.style.display = 'block';
    
    let rawTitleFa = data.title_fa || 'نامشخص';
    rawTitleFa = rawTitleFa.replace(/پیکینگ باد/gi, 'بریکینگ بد').replace(/برکینگ باد/gi, 'بریکینگ بد');
    let rawConfidence = String(data.confidence || '0').replace(/[%٪]/g, '').trim();

    const titleFa = escapeHtml(rawTitleFa);
    const titleEn = escapeHtml(data.title_en || 'Unknown');
    const year = `<span dir="ltr" style="display: inline-block;">${escapeHtml(data.year || '---')}</span>`;
    const type = escapeHtml(data.type || 'نامشخص');
    const confidence = escapeHtml(rawConfidence);
    const explanation = escapeHtml(data.explanation || 'توضیحی یافت نشد.');
    const imdbID = data.imdbID || '';
    
    const omdbData = await fetchOMDbData(imdbID, data.title_en, data.year);
    
    let posterHtml = omdbData.poster 
        ? `<img src="${omdbData.poster}" class="poster" alt="${titleEn}" onerror="this.outerHTML='<div class=\\'poster\\'>${titleEn.charAt(0)}</div>'">`
        : `<div class="poster">${titleEn.charAt(0)}</div>`;

    let imdbRatingHtml = omdbData.rating 
        ? `<span class="badge" style="background: #f5c518; color: #000; font-weight: bold; border: none;">⭐ IMDb: ${omdbData.rating}/10</span>`
        : '';

    const imdbLink = imdbID ? `https://www.imdb.com/title/${imdbID}` : `https://www.imdb.com/find?q=${encodeURIComponent(titleEn)}`;
    const googleLink = `https://www.google.com/search?q=${encodeURIComponent(titleEn + ' ' + data.year + ' movie')}`;
    
    const isEnglish = /^[A-Za-z\s.,!?'-]+$/.test(explanation);
    const descDir = isEnglish ? 'ltr' : 'rtl';

    let altHtml = '';
    if (data.alternatives && data.alternatives.length > 0) {
        altHtml = `<div class="alternatives">
            <strong style="color: var(--text-muted); display: block; margin-bottom: 8px;">احتمالات دیگر:</strong>
            ${data.alternatives.map(alt => `<div style="color: #cbd5e1; margin-bottom: 5px;">• <b>${escapeHtml(alt.title_fa)}</b> - ${escapeHtml(alt.reason)}</div>`).join('')}
        </div>`;
    }

    resultBox.innerHTML = `
        <div class="result-card">
            ${posterHtml}
            <div class="info">
                <h2 class="title-fa">${titleFa}</h2>
                <div class="title-en">${titleEn} (${year})</div>
                <div class="badges">
                    <span class="badge">🎬 ${type}</span>
                    <span class="badge">📅 ${year}</span>
                    <span class="badge confidence">✓ اطمینان: ${confidence}٪</span>
                    ${imdbRatingHtml}
                </div>
                <div class="desc" dir="${descDir}">${explanation}</div>
                <div class="actions">
                    <a href="${imdbLink}" target="_blank" class="btn-action btn-imdb">IMDb</a>
                    <a href="${googleLink}" target="_blank" class="btn-action btn-google">گوگل</a>
                </div>
                ${altHtml}
            </div>
        </div>
    `;
}