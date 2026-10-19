/* ============================================================
   فیلم‌یاب — Movie Finder powered by OpenRouter
   کلید از config.js خوانده می‌شود و با هدر Authorization: Bearer
   ارسال می‌شود. ویدیو به ۶ فریم عکس تبدیل و ارسال می‌شود.
   ============================================================ */

/* ---------- Config ---------- */
const cfg = {
  key: (window.APP_CONFIG && window.APP_CONFIG.OPENROUTER_API_KEY) || '',
  models: (window.APP_CONFIG && window.APP_CONFIG.MODELS) || ['openrouter/free'],
};

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FRAME_COUNT = 6;   // تعداد فریم‌هایی که از ویدیو گرفته می‌شود
const FRAME_WIDTH = 512; // حداکثر عرض هر فریم

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const tabText = $('tabText'), tabVideo = $('tabVideo');
const panelText = $('panelText'), panelVideo = $('panelVideo');
const storyInput = $('storyInput'), yearHint = $('yearHint'), countryHint = $('countryHint');
const dropzone = $('dropzone'), videoInput = $('videoInput');
const dzIdle = $('dropzoneIdle'), dzPreview = $('dropzonePreview');
const videoPreview = $('videoPreview'), dzFileName = $('dzFileName'), dzFileSize = $('dzFileSize'), dzRemove = $('dzRemove');
const captionInput = $('captionInput');
const uploadProgress = $('uploadProgress'), progressFill = $('progressFill'), progressText = $('progressText');
const textSearchBtn = $('textSearchBtn'), videoSearchBtn = $('videoSearchBtn');
const resultArea = $('resultArea'), loader = $('loader'), loaderText = $('loaderText'), loaderSteps = $('loaderSteps');
const resultCard = $('resultCard'), errorCard = $('errorCard');

let videoFile = null;

/* ---------- Tabs ---------- */
function switchTab(which) {
  const isText = which === 'text';
  tabText.classList.toggle('active', isText);
  tabVideo.classList.toggle('active', !isText);
  tabText.setAttribute('aria-selected', isText);
  tabVideo.setAttribute('aria-selected', !isText);
  panelText.classList.toggle('active', isText);
  panelVideo.classList.toggle('active', !isText);
}
tabText.addEventListener('click', () => switchTab('text'));
tabVideo.addEventListener('click', () => switchTab('video'));

/* ---------- Video dropzone ---------- */
dropzone.addEventListener('click', e => {
  if (e.target === dzRemove) return;
  if (!videoFile) videoInput.click();
});
videoInput.addEventListener('change', () => videoInput.files[0] && setVideoFile(videoInput.files[0]));
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault(); dropzone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('video/')) setVideoFile(f);
});
dzRemove.addEventListener('click', e => {
  e.stopPropagation();
  clearVideoFile();
});

function fmtSize(bytes) {
  if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' گیگابایت';
  return Math.round(bytes / 1024 / 1024) + ' مگابایت';
}

function setVideoFile(f) {
  clearVideoFile();
  videoFile = f;
  videoPreview.src = URL.createObjectURL(f);
  dzFileName.textContent = f.name;
  dzFileSize.textContent = fmtSize(f.size);
  dzIdle.hidden = true;
  dzPreview.hidden = false;
  dropzone.classList.add('has-file');
  videoSearchBtn.disabled = false;
}

function clearVideoFile() {
  videoFile = null;
  videoPreview.removeAttribute('src');
  videoInput.value = '';
  dzIdle.hidden = false;
  dzPreview.hidden = true;
  dropzone.classList.remove('has-file');
  videoSearchBtn.disabled = true;
  hideProgress();
}

function showProgress(pct, label) {
  uploadProgress.hidden = false;
  progressFill.style.width = pct + '%';
  progressText.textContent = label;
}
function hideProgress() { uploadProgress.hidden = true; }

/* ---------- Frame extraction (video → images) ---------- */
function extractFrames(file, count) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;

    const finish = frames => { URL.revokeObjectURL(url); resolve(frames); };

    v.onerror = () => finish([]);

    v.onloadedmetadata = () => {
      const dur = v.duration || 0;
      if (!dur || !isFinite(dur)) return finish([]);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const times = [];
      for (let i = 1; i <= count; i++) {
        times.push(Math.min(dur * i / (count + 1), Math.max(0, dur - 0.1)));
      }
      let idx = 0;
      const frames = [];

      const grabNext = () => {
        if (idx >= times.length) return finish(frames);
        try { v.currentTime = times[idx]; } catch (_) { idx++; grabNext(); }
      };

      v.onseeked = () => {
        const w = v.videoWidth || 640, h = v.videoHeight || 360;
        const scale = Math.min(1, FRAME_WIDTH / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        try { ctx.drawImage(v, 0, 0, canvas.width, canvas.height); } catch (_) {}
        frames.push(canvas.toDataURL('image/jpeg', 0.7));
        idx++;
        showProgress(Math.round(idx / count * 100), `استخراج فریم ${fa(idx)} از ${fa(count)}...`);
        grabNext();
      };

      grabNext();
    };
  });
}

/* ---------- Prompt ---------- */
function buildPrompt(userStory, year, country, sourceLabel) {
  return `تو یک کارشناس حرفه‌ای سینما و سریال هستی («فیلم‌یاب»). یک کاربر ایرانی بخشی از یک ${sourceLabel} را به تو گفته و می‌خواهد بداند آن فیلم یا سریال چه بوده است.

توصیف کاربر:
"""
${userStory}
"""
${year ? `نشانه‌ی سال (شاید نادرست باشد): ${year}\n` : ''}${country ? `نشانه‌ی کشور (شاید نادرست باشد): ${country}\n` : ''}
وظیفه:
۱. توصیف را با دقت تحلیل کن: ژانر، فضا، جزئیات صحنه، لباس، لهجه، بازیگران احتمالی، دهه‌ی ساخت و هر سرنخ دیگری.
۲. بر اساس دانش سینمایی خودت، فیلم یا سریال مورد نظر را پیدا کن. هم فیلم‌ها و سریال‌های ایرانی و هم خارجی در نظر بگیر. اسم فیلم ممکن است خیلی معروف یا کاملاً کمتر شناخته‌شده باشد.
۳. اگر مطمئنی همان فیلم را یافته‌ای، آن را در فیلد «title» بده. اگر مطمئن نیستی، بهترین حدس‌ها را به ترتیب احتمال در «alternatives» بده و «title» را روی محتمل‌ترین حدس بگذار و «confidence» را کم بده.
۴. در فیلد «scene» توضیح بده چرا این حدس با توصیف کاربر می‌خواند و آن صحنه در فیلم چه جایگاهی دارد.
۵. اگر توصیف خیلی مبهم است، به‌جای حدس بی‌پایه، در «scene» بگو دقیقاً چه جزئیاتی (نام بازیگر، دیالوگ، رنگ لباس، برنده‌ی جایزه و...) کاربر را یادش می‌آید تا جستجو دقیق‌تر شود.

فقط و فقط JSON معتبر با این ساختار برگردان (بدون هیچ متن اضافه، بدون markdown):
{
  "found": true یا false,
  "title": "نام فارسی فیلم یا سریال",
  "english_title": "عنوان اصلی لاتین (اگر فیلم خارجی است؛ برای فیلم ایرانی رشته‌ی خالی)",
  "year": "سال ساخت به عدد رشته‌ای",
  "country": "کشور سازنده",
  "type": "فیلم سینمایی" یا "سریال",
  "confidence": عددی بین ۰ تا ۱۰۰,
  "scene": "توضیح تطبیق این حدس با توصیف کاربر، یا درخواست جزئیات بیشتر",
  "alternatives": [ {"title": "نام", "year": "سال", "reason": "چرا محتمل است"} ]
}`;
}

/* ---------- OpenRouter call (با fallback بین مدل‌ها) ---------- */
async function callOpenRouter(contentParts) {
  if (!cfg.key) throw new Error('کلید API در config.js تنظیم نشده است.');

  const body = JSON.stringify({
    models: cfg.models,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.4,
    max_tokens: 1500,
  });

  let lastMsg = '';
  for (const model of cfg.models) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + cfg.key,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin,
          'X-Title': 'Film-Yab',
        },
        body: JSON.stringify({
          models: cfg.models,
          model: model,
          messages: [{ role: 'user', content: contentParts }],
          temperature: 0.4,
          max_tokens: 1500,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (text) return text;
        lastMsg = 'پاسخ خالی از سرور دریافت شد.';
        continue;
      }

      const errText = await res.text().catch(() => '');
      if (res.status === 401) throw new Error('کلید OpenRouter نامعتبر است. آن را دوباره از openrouter.ai/keys کپی و در config.js جایگذاری کن.');
      if (res.status === 402) throw new Error('اعتبار این کلید تمام شده است. مدل‌های رایگان در روز محدودیت دارند — فردا دوباره امتحان کن یا اعتبار اضافه کن.');
      if (res.status === 429) throw new Error('محدودیت تعداد درخواست (۴۲۹). چند لحظه صبر کن و دوباره امتحان کن.');
      lastMsg = `خطای سرور (${res.status}): ${errText.slice(0, 200)}`;
    } catch (e) {
      if (e.message && (e.message.includes('کلید') || e.message.includes('اعتبار') || e.message.includes('۴۲۹'))) throw e;
      lastMsg = e.message || 'خطای شبکه';
    }
  }
  throw new Error(lastMsg || 'هیچ‌کدام از مدل‌ها پاسخ ندادند.');
}

/* ---------- Searches ---------- */
async function runTextSearch() {
  const story = storyInput.value.trim();
  if (story.length < 10) {
    showError('توصیف کوتاه است', 'لطفاً کمی دقیق‌تر بنویس: چه دیدی؟ چه شنیدی؟ چه حسی داشت؟ حداقل چند جمله.');
    return;
  }
  const prompt = buildPrompt(story, yearHint.value.trim(), countryHint.value.trim(), 'فیلم یا سریال');
  showLoader(['تحلیل توصیف شما...', 'مرور ژانر و دهه‌ی ساخت...', 'جستجوی اسم فیلم...']);
  try {
    const text = await callOpenRouter([{ type: 'text', text: prompt }]);
    const data = parseJson(text);
    if (!data) throw new Error('پاسخ مدل قابل خواندن نبود. دوباره امتحان کن.');
    showResult(data);
  } catch (e) {
    showError('جستجو ناموفق بود', e.message);
  }
}

async function runVideoSearch() {
  if (!videoFile) return;
  showLoader(['خواندن ویدیو...', 'استخراج فریم‌های کلیدی...', 'تحلیل تصاویر...']);
  const frames = await extractFrames(videoFile, FRAME_COUNT);
  if (!frames.length) {
    showError('فریم استخراج نشد', 'از این ویدیو نتوانستم عکس بگیرم. فرمت MP4 یا MOV را امتحان کن یا ویدیوی کوتاه‌تری آپلود کن.');
    return;
  }
  const caption = captionInput.value.trim() || 'کاربر فقط ویدیو آپلود کرده و توضیحی نداده؛ از تصاویر هرچه می‌توانی بفهم.';
  const prompt = buildPrompt(caption, '', '', 'ویدیوی کوتاه (ریلز). فریم‌های استخراج‌شده از آن پیوست است');

  const parts = [{ type: 'text', text: prompt }];
  frames.forEach(d => parts.push({ type: 'image_url', image_url: { url: d } }));

  showLoader(['ارسال فریم‌ها به مدل...', 'مقایسه‌ی صحنه‌ها...', 'جستجوی اسم فیلم...']);
  try {
    const text = await callOpenRouter(parts);
    const data = parseJson(text);
    if (!data) throw new Error('پاسخ مدل قابل خواندن نبود. دوباره امتحان کن.');
    showResult(data);
  } catch (e) {
    showError('جستجو ناموفق بود', e.message);
  }
}

textSearchBtn.addEventListener('click', runTextSearch);
videoSearchBtn.addEventListener('click', () => {
  videoSearchBtn.disabled = true;
  runVideoSearch().finally(() => { videoSearchBtn.disabled = !videoFile; });
});

/* ---------- Result rendering ---------- */
function showLoader(steps) {
  resultArea.hidden = false;
  errorCard.hidden = true;
  resultCard.hidden = true;
  loader.hidden = false;
  loaderText.textContent = 'در حال جستجو در حافظه‌ی سینما...';
  loaderSteps.innerHTML = '';
  steps.forEach((s, i) => {
    const el = document.createElement('span');
    el.textContent = s;
    el.style.animationDelay = (i * 1.6) + 's';
    loaderSteps.appendChild(el);
  });
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function rotateLoaderText() {
  const msgs = [
    'در حال جستجو در حافظه‌ی سینما...',
    'داره صحنه‌ها رو مقایسه می‌کنه...',
    'یه لحظه، دارم اسم فیلم رو یادم میاد...',
    'نزدیک شدیم! دارم جزئیات رو چک می‌کنم...',
  ];
  let i = 0;
  const t = setInterval(() => {
    if (loader.hidden || i >= msgs.length) { clearInterval(t); return; }
    loaderText.textContent = msgs[i++];
  }, 3500);
}
rotateLoaderText();

function showError(title, msg) {
  resultArea.hidden = false;
  loader.hidden = true;
  resultCard.hidden = true;
  errorCard.hidden = false;
  errorCard.innerHTML = `<h3>⚠️ ${escapeHtml(title)}</h3><p>${escapeHtml(msg)}</p>`;
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fa(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function parseJson(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(t); } catch (_) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }
  return null;
}

function showResult(data) {
  loader.hidden = true;
  errorCard.hidden = true;

  const title = data.title || 'نامشخص';
  const en = data.english_title ? `<span class="en" dir="ltr">${escapeHtml(data.english_title)}</span>` : '';
  const conf = Math.max(0, Math.min(100, Number(data.confidence) || 0));
  const alts = Array.isArray(data.alternatives) ? data.alternatives.slice(0, 4) : [];

  const query = encodeURIComponent((data.english_title || title) + ' ' + (data.year || ''));
  const imdbUrl = `https://www.imdb.com/find/?q=${query}`;
  const googleUrl = `https://www.google.com/search?q=${query}+فیلم`;

  resultCard.innerHTML = `
    <div class="result-top">
      <span class="found-badge">${data.found === false ? '❓ حدس احتمالی' : '✅ پیدا شد'}</span>
      ${conf ? `<span class="conf-label">اطمینان: ${fa(conf)}٪</span>` : ''}
    </div>
    <h2 class="result-title">${escapeHtml(title)} ${en}</h2>
    <div class="result-meta">
      ${data.year ? `<span class="chip">📅 ${escapeHtml(String(data.year))}</span>` : ''}
      ${data.country ? `<span class="chip">🌍 ${escapeHtml(data.country)}</span>` : ''}
      ${data.type ? `<span class="chip">${data.type === 'سریال' ? '📺 سریال' : '🎬 فیلم سینمایی'}</span>` : ''}
    </div>
    <div class="conf-bar"><div class="conf-fill" style="width:${conf}%"></div></div>
    ${data.scene ? `<p class="scene">${escapeHtml(data.scene)}</p>` : ''}
    ${alts.length ? `
      <div class="alts">
        <h4>احتمالات دیگر:</h4>
        ${alts.map(a => `
          <div class="alt-item">
            <strong>${escapeHtml(a.title || '')}</strong>
            ${a.year ? `<span class="alt-year">(${escapeHtml(String(a.year))})</span>` : ''}
            ${a.reason ? `<p>${escapeHtml(a.reason)}</p>` : ''}
          </div>`).join('')}
      </div>` : ''}
    <div class="result-links">
      <a href="${imdbUrl}" target="_blank" rel="noopener">جستجو در IMDb ↗</a>
      <a href="${googleUrl}" target="_blank" rel="noopener">جستجو در گوگل ↗</a>
    </div>`;
  resultCard.hidden = false;
  resultArea.hidden = false;
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}