/* ============================================================
   فیلم‌یاب — Movie Finder powered by Gemini
   کلید API فقط از config.js خوانده می‌شود؛ کاربر چیزی وارد نمی‌کند.
   ============================================================ */

/* ---------- Config ---------- */
const cfg = {
  key: (window.APP_CONFIG && window.APP_CONFIG.GEMINI_API_KEY) || '',
  model: (window.APP_CONFIG && window.APP_CONFIG.MODEL) || 'gemini-2.5-flash',
};

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const INLINE_LIMIT = 15 * 1024 * 1024; // 15MB → inline base64, above → Files API

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
}

/* ---------- Prompt (one brain for both modes) ---------- */
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

function parseGeminiJson(text) {
  let t = text.trim();
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
      <span class="found-badge">
        <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${data.found === false ? 'حدس بر اساس توصیف شما' : 'پیدا شد!'}
      </span>
    </div>
    <h2 class="result-title">${escapeHtml(title)}${en}</h2>
    <div class="meta-row">
      ${data.year ? `<span class="meta-chip">📅 سال <b>${escapeHtml(fa(data.year))}</b></span>` : ''}
      ${data.country ? `<span class="meta-chip">🌍 ${escapeHtml(data.country)}</span>` : ''}
      ${data.type ? `<span class="meta-chip">🎬 ${escapeHtml(data.type)}</span>` : ''}
    </div>
    <div class="confidence">
      <div class="confidence-label"><span>میزان اطمینان</span><span>${fa(conf)}٪</span></div>
      <div class="confidence-bar"><div class="confidence-fill" data-w="${conf}"></div></div>
    </div>
    ${data.scene ? `<div class="result-scene"><h4>چرا این حدس؟</h4><p>${escapeHtml(data.scene)}</p></div>` : ''}
    ${alts.length ? `<div class="alternatives"><h4>احتمالات دیگر:</h4>${alts.map(a => `
      <div class="alt-item">
        <span>${escapeHtml(a.title || a['عنوان'] || '')}</span>
        <span class="alt-year">${a.year ? fa(a.year) : ''}${a.reason ? ' — ' + escapeHtml(a.reason) : ''}</span>
      </div>`).join('')}</div>` : ''}
    <div class="result-links">
      <a class="link-btn primary" href="${imdbUrl}" target="_blank" rel="noopener">جستجو در IMDb ↗</a>
      <a class="link-btn ghost" href="${googleUrl}" target="_blank" rel="noopener">جستجوی گوگل ↗</a>
    </div>
  `;

  resultCard.hidden = false;
  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = resultCard.querySelector('.confidence-fill');
      if (fill) fill.style.width = fill.dataset.w + '%';
    }, 120);
  });
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Gemini call helpers ---------- */
async function generateWithParts(parts) {
  const url = `${API_BASE}/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `خطای سرور Gemini (کد ${res.status})`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || '';
  if (!text) throw new Error('پاسخی از مدل دریافت نشد. دوباره تلاش کن.');
  const parsed = parseGeminiJson(text);
  if (!parsed) throw new Error('پاسخ مدل قابل خواندن نبود. دوباره تلاش کن.');
  return parsed;
}

/* ---------- Video: inline (<15MB) or Files API (>15MB) ---------- */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('خواندن فایل ناموفق بود.'));
    r.readAsDataURL(file);
  });
}

async function uploadWithFilesAPI(file) {
  // 1) start resumable session
  const startRes = await fetch(`${API_BASE.replace('/v1beta', '')}/upload/v1beta/files?key=${encodeURIComponent(cfg.key)}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name || 'reels-video' } }),
  });
  if (!startRes.ok) throw new Error('شروع آپلود ویدیو ناموفق بود (کد ' + startRes.status + ')');
  const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('آدرس آپلود دریافت نشد.');

  // 2) upload bytes
  setProgress(8, 'در حال آپلود ویدیو...');
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(file.size),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });
  if (!putRes.ok) throw new Error('آپلود ویدیو ناموفق بود (کد ' + putRes.status + ')');
  const { file: uploaded } = await putRes.json();
  if (!uploaded?.uri) throw new Error('اطلاعات فایل آپلودشده دریافت نشد.');

  // 3) wait until ACTIVE
  setProgress(45, 'پردازش ویدیو روی سرور...');
  let state = uploaded.state || 'PROCESSING';
  let tries = 0;
  while (state !== 'ACTIVE' && tries < 60) {
    if (state === 'FAILED') throw new Error('پردازش ویدیو روی سرور Gemini ناموفق بود.');
    await new Promise(r => setTimeout(r, 2500));
    const st = await fetch(`${API_BASE}/files/${uploaded.name.replace('files/', '')}?key=${encodeURIComponent(cfg.key)}`);
    if (!st.ok) throw new Error('بررسی وضعیت ویدیو ناموفق بود.');
    const j = await st.json();
    state = j.state || 'PROCESSING';
    setProgress(45 + Math.min(40, tries * 2), 'پردازش ویدیو روی سرور...');
    tries++;
  }
  if (state !== 'ACTIVE') throw new Error('پردازش ویدیو بیش از حد طول کشید. ویدیوی کوتاه‌تری امتحان کن.');
  setProgress(90, 'آماده‌ی تحلیل...');
  return uploaded.uri;
}

function setProgress(pct, label) {
  uploadProgress.hidden = false;
  progressFill.style.width = pct + '%';
  progressText.textContent = label;
}

/* ---------- Actions ---------- */
textSearchBtn.addEventListener('click', async () => {
  const story = storyInput.value.trim();
  if (story.length < 10) { showError('توضیح خیلی کوتاه است', 'لطفاً هرچی از فیلم یادته رو با جزئیات بیشتری بنویس — حتی یه سکانس یا یه دیالوگ کافیه.'); return; }
  if (!cfg.key) { showError('کلید API تنظیم نشده', 'فایل config.js را بررسی کن.'); return; }

  textSearchBtn.disabled = true;
  const btnLabel = textSearchBtn.querySelector('.btn-label');
  btnLabel.textContent = 'در حال جستجو...';
  showLoader([
    '› تحلیل توصیف شما...',
    '› بررسی ژانر، فضا و جزئیات صحنه...',
    '› مقایسه با فیلم‌ها و سریال‌های ایرانی و خارجی...',
  ]);
  rotateLoaderText();

  try {
    const prompt = buildPrompt(story, yearHint.value.trim(), countryHint.value.trim(), 'فیلم یا سریال');
    const data = await generateWithParts([{ text: prompt }]);
    showResult(data);
  } catch (err) {
    showError('جستجو ناموفق بود', err.message);
  } finally {
    textSearchBtn.disabled = false;
    btnLabel.textContent = 'پیدا کن!';
  }
});

videoSearchBtn.addEventListener('click', async () => {
  if (!videoFile) return;
  if (!cfg.key) { showError('کلید API تنظیم نشده', 'فایل config.js را بررسی کن.'); return; }

  videoSearchBtn.disabled = true;
  const btnLabel = videoSearchBtn.querySelector('.btn-label');
  btnLabel.textContent = 'در حال تحلیل...';

  const caption = captionInput.value.trim();
  try {
    const videoPrompt = buildPrompt(
      caption || 'در ویدیوی پیوست، بخشی از یک فیلم یا سریال آمده است. آن را شناسایی کن.',
      '', '', 'ویدیوی پیوست‌شده'
    );

    if (videoFile.size <= INLINE_LIMIT) {
      showLoader([
        '› آماده‌سازی ویدیو...',
        '› تحلیل فریم‌های ویدیو توسط هوش مصنوعی...',
        '› جستجوی فیلم بر اساس تصاویر و صحنه‌ها...',
      ]);
      rotateLoaderText();
      const b64 = await fileToBase64(videoFile);
      const data = await generateWithParts([
        { inlineData: { mimeType: videoFile.type || 'video/mp4', data: b64 } },
        { text: videoPrompt },
      ]);
      showResult(data);

    } else {
      showLoader([
        '› آپلود ویدیو (فایل بزرگ → آپلود به سرور گوگل)...',
        '› پردازش ویدیو...',
        '› تحلیل صحنه‌ها و شناسایی فیلم...',
      ]);
      rotateLoaderText();
      const uri = await uploadWithFilesAPI(videoFile);
      const data = await generateWithParts([
        { fileData: { fileUri: uri, mimeType: videoFile.type || 'video/mp4' } },
        { text: videoPrompt },
      ]);
      showResult(data);
    }

  } catch (err) {
    showError('تحلیل ویدیو ناموفق بود', err.message);
  } finally {
    uploadProgress.hidden = true;
    progressFill.style.width = '0%';
    videoSearchBtn.disabled = !videoFile;
    btnLabel.textContent = 'تحلیل کن و پیدا کن!';
  }
});
