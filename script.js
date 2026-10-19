// بررسی وجود فایل config
if (typeof window.APP_CONFIG === 'undefined') {
    alert("خطای مهم: فایل config.js لود نشده است!");
}

const cfg = window.APP_CONFIG || { OPENROUTER_API_KEYS: [], TEXT_MODELS: ['openrouter/free'], VISION_MODELS: ['openrouter/free'] };
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const FRAME_COUNT = 4; 
const FRAME_WIDTH = 400;
const OMDB_API_KEY = 'b44a4ca6';

const $ = id => document.getElementById(id);

// المان‌ها
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = { text: $('panel-text'), video: $('panel-video') };
const storyInput = $('story');
const dropzone = $('dropzone');
const fileInput = $('file-input');
const videoInfo = $('video-info');
const videoPreview = $('video-preview');
const instaLinkInput = $('insta-link');
const captionInput = $('caption');
const btnText = $('btn-text');
const btnVideo = $('btn-video');
const loader = $('loader');
const loaderText = $('loader-text');
const progressBar = $('progress-bar');
const progressText = $('progress-text');
const modalOverlay = $('result-modal');
const modalBody = $('modal-body');

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
    instaLinkInput.value = ''; 
    videoPreview.src = URL.createObjectURL(file);
    dropzone.style.display = 'none';
    videoInfo.style.display = 'block';
    videoInfo.querySelector('.filename').textContent = file.name;
    videoInfo.querySelector('.filesize').textContent = fmtSize(file.size);
}

async function extractFrames(source, count = FRAME_COUNT) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        
        if (typeof source === 'string') {
            video.src = source;
            video.crossOrigin = "anonymous"; 
        } else {
            video.src = URL.createObjectURL(source);
        }

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
                frames.push(canvas.toDataURL('image/jpeg', 0.6)); 
            }
            resolve(frames);
        };
        video.onerror = () => reject(new Error('خطا در خواندن ویدیو. لینک نامعتبر است یا پروکسی مشکل دارد.'));
    });
}

async function getInstagramVideoUrl(instaUrl) {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(instaUrl)}`;
    try {
        const res = await fetch(proxyUrl);
        const html = await res.text();
        const match = html.match(/<meta property="og:video" content="([^"]+)"/) || html.match(/"video_url":"([^"]+)"/);
        if (match && match[1]) return match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
    } catch (e) { throw new Error("عدم دسترسی به اینستاگرام"); }
    throw new Error("ویدیو در این لینک پیدا نشد.");
}

// ساخت Prompt بسیار هوشمند برای متن
function buildPrompt(text, isVideo) {
    if (isVideo) {
        return `تو یک کارشناس ارشد سینما هستی. من ${FRAME_COUNT} تصویر از یک ویدیو را به تو می‌دهم.
اطلاعات متنی: "${text || 'ندارد'}"
چهره بازیگران، لباس‌ها و فضاسازی را تحلیل کن و نام دقیق فیلم را بگو.
اگر مطمئن نیستی، ۲ گزینه جایگزین بده.
خروجی فقط JSON خالص:
{
  "title_fa": "نام فارسی", "title_en": "نام انگلیسی", "year": "سال", "type": "نوع",
  "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح بصری",
  "alternatives": [ { "title_fa": "نام", "reason": "دلیل" } ]
}`;
    } else {
        return `تو یک کارشناس دقیق و منطقی سینما هستی که حافظه‌ای عالی از تمام فیلم‌ها و سریال‌های جهان داری.
کاربر داستان یک فیلم یا سریال را تعریف کرده است: "${text}"

دستورالعمل بسیار مهم:
1. ابتدا عناصر کلیدی داستان را در ذهن خود جدا کن (مثلاً: بازی‌های مرگبار، جایزه نقدی، کشته شدن بازنده‌ها).
2. به دنبال معروف‌ترین و محبوب‌ترین اثری بگرد که دقیقاً با این عناصر مطابقت دارد. (مثلاً برای بازی‌های مرگبار، اول سریال Squid Game را در نظر بگیر).
3. **به هیچ وجه گمراه نشو!** اگر داستان شبیه به یک اثر معروف جهانی است، آن را پیشنهاد بده. سراغ فیلم‌های گمنام یا بی‌ربط (مثل مرد عنکبوتی) نرو.
4. اگر داستان مربوط به کشوری خاص بود (مثلاً کره‌ای)، حتماً آن را در اولویت قرار بده.

خروجی فقط JSON خالص:
{
  "title_fa": "نام", "title_en": "Name", "year": "سال", "type": "نوع",
  "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح فارسی",
  "alternatives": [ { "title_fa": "نام", "reason": "دلیل" } ]
}`;
    }
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options; 
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
}

async function callOpenRouter(content, isVideoMode = false) {
    if (!cfg.OPENROUTER_API_KEYS || cfg.OPENROUTER_API_KEYS.length === 0) {
        throw new Error("هیچ کلید API تعریف نشده است!");
    }

    const modelsToTry = isVideoMode ? cfg.VISION_MODELS : cfg.TEXT_MODELS;
    let errorLogs = [];

    for (const model of modelsToTry) {
        for (let i = 0; i < cfg.OPENROUTER_API_KEYS.length; i++) {
            const apiKey = cfg.OPENROUTER_API_KEYS[i];
            if (!apiKey || apiKey.trim() === "") continue;

            try {
                const res = await fetchWithTimeout(API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': location.origin,
                        'X-Title': 'Film-Yab'
                    },
                    body: JSON.stringify({ model: model, messages: [{ role: 'user', content: content }], temperature: 0.0 }),
                    timeout: 8000 
                });

                if (!res.ok) {
                    let reason = `کد ${res.status}`;
                    if (res.status === 401) reason = "کلید نامعتبر";
                    if (res.status === 429) reason = "شلوغی";
                    errorLogs.push(`${model}: ${reason}`);
                    continue; 
                }

                const data = await res.json();
                if (data.choices && data.choices.length > 0) {
                    return data.choices[0].message.content;
                }
            } catch (err) {
                errorLogs.push(`${model}: تایم‌اوت`);
            }
        }
    }
    throw new Error(`مدل‌ها پاسخ ندادند. دلیل: ${errorLogs[0] || 'نامشخص'}`);
}

// جستجوی متنی
btnText.addEventListener('click', async () => {
    const text = storyInput.value.trim();
    if (text.length < 10) return alert('لطفاً توضیحات بیشتری بنویسید.');

    showLoader(true);
    startProgress();

    try {
        const prompt = buildPrompt(text, false);
        const rawResponse = await callOpenRouter([{ type: "text", text: prompt }], false);
        const parsedData = parseJson(rawResponse);
        
        finishProgress();
        setTimeout(async () => {
            showLoader(false);
            await showResult(parsedData);
        }, 400);

    } catch (err) {
        finishProgress();
        setTimeout(() => {
            showLoader(false);
            alert("خطای جستجو:\n" + err.message);
        }, 400);
    }
});

// جستجوی ویدیویی
btnVideo.addEventListener('click', async () => {
    const instaUrl = instaLinkInput.value.trim();
    
    if (!selectedFile && !instaUrl) {
        return alert('لطفاً یک فایل ویدیو انتخاب کنید یا لینک اینستاگرام را وارد کنید.');
    }
    
    showLoader(true);
    startProgress();
    
    try {
        let frames = [];
        
        if (instaUrl) {
            loaderText.textContent = 'در حال دریافت اطلاعات از اینستاگرام...';
            const videoUrl = await getInstagramVideoUrl(instaUrl);
            loaderText.textContent = 'در حال استخراج فریم‌ها از لینک...';
            frames = await extractFrames(videoUrl);
        } else if (selectedFile) {
            loaderText.textContent = 'در حال استخراج فریم‌ها از فایل...';
            frames = await extractFrames(selectedFile);
        }
        
        if (!frames || frames.length === 0) throw new Error("استخراج عکس ناموفق بود.");

        const caption = captionInput.value.trim() || '';
        const prompt = buildPrompt(caption, true);
        
        const content = [{ type: "text", text: prompt }];
        frames.forEach(frame => content.push({ type: "image_url", image_url: { url: frame } }));

        loaderText.textContent = 'در حال تحلیل تصاویر...';
        const rawResponse = await callOpenRouter(content, true);
        const parsedData = parseJson(rawResponse);
        
        finishProgress();
        setTimeout(async () => {
            showLoader(false);
            await showResult(parsedData);
        }, 400);

    } catch (err) {
        finishProgress();
        setTimeout(() => {
            showLoader(false);
            alert("خطای تحلیل:\n" + err.message);
        }, 400);
    }
});

function showLoader(show) {
    loader.style.display = show ? 'block' : 'none';
    if (show) {
        const msgs = ['در حال آماده‌سازی...', 'در حال تحلیل...', 'جستجو در آرشیو...'];
        let i = 0;
        loaderText.textContent = msgs[0];
        const int = setInterval(() => { i = (i + 1) % msgs.length; loaderText.textContent = msgs[i]; }, 3000);
        loader.dataset.interval = int;
    } else {
        clearInterval(loader.dataset.interval);
    }
}

let progressInterval;
let currentProgress = 0;

function startProgress() {
    clearInterval(progressInterval);
    currentProgress = 0;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    progressInterval = setInterval(() => {
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

// 🌟 مدیریت پاپ‌آپ
function closeModal() {
    modalOverlay.classList.remove('active');
    setTimeout(() => {
        modalBody.innerHTML = '';
    }, 300); // صبر تا پایان انیمیشن
}

// بستن پاپ‌آپ با کلیک بیرون از آن
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

function parseJson(raw) {
    try {
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch (e2) {}
        }
        throw new Error("فرمت JSON نامعتبر است.");
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
    } catch (e) {}
    return { poster: null, rating: null };
}

// نمایش نتیجه در پاپ‌آپ
async function showResult(data) {
    if (!data) return alert('داده‌ای یافت نشد.');
    
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

    // تزریق HTML به داخل پاپ‌آپ
    modalBody.innerHTML = `
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

    // باز کردن پاپ‌آپ با انیمیشن
    modalOverlay.classList.add('active');
}