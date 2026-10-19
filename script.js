const cfg = window.APP_CONFIG || { OPENROUTER_API_KEY: '', MODELS: ['openrouter/free'] };
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const FRAME_COUNT = 6;
const FRAME_WIDTH = 512;

// 🔴 کلید API رایگان OMDb رو اینجا بذار (از سایت omdbapi.com بگیر)
const OMDB_API_KEY = 'YOUR_OMDB_API_KEY'; 

const $ = id => document.getElementById(id);
// ... (بقیه متغیرهای DOM مثل قبل بمونن) ...
const tabs = document.querySelectorAll('.tab');
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
const resultBox = $('result');

function switchTab(which) {
  tabs.forEach(t => {
    const active = t.dataset.tab === which;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
  });
  Object.entries(panels).forEach(([k, p]) => p.classList.toggle('active', k === which));
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

let selectedFile = null;

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
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
  return mb >= 1 ? mb.toFixed(1) + ' مگابایت' : (bytes / 1024).toFixed(0) + ' کیلوبایت';
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
  return `تو یک کارشناس و دایرةالمعارف سینما هستی. کاربر در حال توصیف یک فیلم یا سریال است.
اطلاعات کاربر:
متن: "${text}"
سال (اختیاری): ${year || 'نامشخص'}
کشور (اختیاری): ${country || 'نامشخص'}

وظیفه تو:
نام دقیق اثر (فارسی و انگلیسی)، سال ساخت، کشور، نوع (فیلم/سریال)، و توضیح اینکه چرا این اثر با توصیف کاربر مطابقت دارد را پیدا کن.
همچنین اگر توانستی، آیدی IMDb آن را پیدا کن (مثلاً tt0903747).

خروجی را **فقط** به صورت یک آبجکت JSON خالص (بدون هیچ متن اضافه یا بک‌تیک مارک‌داون) برگردان با این ساختار:
{
  "title_fa": "نام فارسی",
  "title_en": "نام انگلیسی",
  "year": "سال ساخت",
  "type": "فیلم یا سریال",
  "imdbID": "شناسه IMDb (اگر پیدا کردی، در غیر این صورت خالی بگذار)",
  "confidence": "درصد اطمینان بین 0 تا 100 (فقط عدد)",
  "explanation": "توضیح کامل و جذاب به زبان فارسی که چرا این اثر همان چیزی است که کاربر می‌خواهد.",
  "alternatives": [
    { "title_fa": "نام جایگزین ۱", "title_en": "Alternate 1", "reason": "دلیل کوتاه" }
  ]
}`;
}

async function callOpenRouter(content) {
  for (const model of cfg.MODELS) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin,
          'X-Title': 'Film-Yab'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: content }],
          temperature: 0.1
        })
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('کلید API نامعتبر است.');
        if (res.status === 429) throw new Error('محدودیت درخواست. کمی بعد تلاش کنید.');
        continue; // امتحان مدل بعدی
      }

      const data = await res.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }
    } catch (err) {
      console.warn(`مدل ${model} خطا داد:`, err);
    }
  }
  throw new Error('متاسفانه هیچ‌کدام از مدل‌ها پاسخ ندادند. لطفاً دوباره تلاش کنید.');
}

async function runTextSearch() {
  const text = storyInput.value.trim();
  if (text.length < 10) {
    return showError('لطفاً توضیحات بیشتری درباره فیلم بنویسید (حداقل ۱۰ کاراکتر).');
  }

  showLoader(true);
  const prompt = buildPrompt(text, yearInput.value.trim(), countryInput.value.trim(), false);
  
  try {
    const rawResponse = await callOpenRouter([{ type: "text", text: prompt }]);
    const data = parseJson(rawResponse);
    showResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoader(false);
  }
}

async function runVideoSearch() {
  if (!selectedFile) return showError('لطفاً ابتدا یک ویدیو انتخاب کنید.');
  
  showLoader(true);
  loaderText.textContent = 'در حال استخراج فریم‌ها از ویدیو...';
  
  try {
    const frames = await extractFrames(selectedFile);
    const caption = captionInput.value.trim() || 'این ویدیو را تحلیل کن و فیلم یا سریال مربوطه را پیدا کن.';
    const prompt = buildPrompt(caption, '', '', true);
    
    const content = [{ type: "text", text: prompt }];
    frames.forEach(frame => {
      content.push({ type: "image_url", image_url: { url: frame } });
    });

    loaderText.textContent = 'در حال جستجو در حافظه سینما...';
    const rawResponse = await callOpenRouter(content);
    const data = parseJson(rawResponse);
    showResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  loader.style.display = show ? 'flex' : 'none';
  resultBox.style.display = 'none';
  if (show) {
    const msgs = ['در حال آماده‌سازی...', 'در حال تحلیل داستان...', 'جستجو در آرشیو سینما...'];
    let i = 0;
    loaderText.textContent = msgs[0];
    const int = setInterval(() => {
      i = (i + 1) % msgs.length;
      loaderText.textContent = msgs[i];
    }, 2500);
    loader.dataset.interval = int;
  } else {
    clearInterval(loader.dataset.interval);
  }
}

function showError(msg) {
  resultBox.style.display = 'block';
  resultBox.innerHTML = `<div style="background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.3); color: #ff6b6b; padding: 16px; border-radius: 12px; text-align: center;">${escapeHtml(msg)}</div>`;
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
    throw new Error('پاسخ دریافتی از هوش مصنوعی ساختار درستی نداشت.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// تابع نمایش نتیجه با طراحی حرفه‌ای جدید
function showResult(data) {
  resultBox.style.display = 'block';
  
  const titleFa = escapeHtml(data.title_fa || 'نامشخص');
  const titleEn = escapeHtml(data.title_en || 'Unknown');
  const year = escapeHtml(data.year || '---');
  const type = escapeHtml(data.type || 'نامشخص');
  const confidence = escapeHtml(data.confidence || '0');
  const explanation = escapeHtml(data.explanation || 'توضیحی یافت نشد.');
  const imdbID = data.imdbID || '';
  
  // ساخت پوستر: اگر IMDB ID و API Key داشتیم، پوستر واقعی، وگرنه یک باکس گرادیانتی زیبا
  let posterHtml = '';
  if (imdbID && OMDB_API_KEY !== 'YOUR_OMDB_API_KEY') {
    const posterUrl = `https://img.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbID}`;
    posterHtml = `<img src="${posterUrl}" alt="${titleEn}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                  <div class="poster-fallback" style="display:none;">${titleEn.charAt(0)}</div>`;
  } else {
    posterHtml = `<div class="poster-fallback">${titleEn.charAt(0)}</div>`;
  }

  // ساخت دکمه‌ها
  const imdbLink = imdbID ? `https://www.imdb.com/title/${imdbID}` : `https://www.imdb.com/find?q=${encodeURIComponent(titleEn)}`;
  const googleLink = `https://www.google.com/search?q=${encodeURIComponent(titleEn + ' ' + year + ' movie')}`;
  
  // بررسی اینکه آیا توضیحات انگلیسی است یا خیر (برای اصلاح RTL)
  const isEnglish = /^[A-Za-z\s.,!?'-]+$/.test(explanation);
  const descDir = isEnglish ? 'ltr' : 'rtl';

  // ساخت بخش احتمالات
  let altHtml = '';
  if (data.alternatives && data.alternatives.length > 0) {
    altHtml = `<div class="alternatives-box" style="grid-column: 1 / -1; width: 100%;">
      <h4>احتمالات دیگر:</h4>
      ${data.alternatives.map(alt => `<div style="font-size: 13px; color: #ccc; margin-bottom: 6px;">• <b>${escapeHtml(alt.title_fa)}</b> (${escapeHtml(alt.title_en)}) - ${escapeHtml(alt.reason)}</div>`).join('')}
    </div>`;
  }

  resultBox.innerHTML = `
    <div class="result-card-pro">
      
      <div class="poster-container">
        ${posterHtml}
      </div>

      <div class="info-container">
        <h2 class="result-title">${titleFa}</h2>
        <div class="result-title-en">${titleEn} (${year})</div>
        
        <div class="badges-row">
          <span class="badge">📺 ${type}</span>
          <span class="badge">📅 ${year}</span>
          <span class="badge confidence">✓ اطمینان: ${confidence}٪</span>
        </div>

        <div class="result-desc" dir="${descDir}">
          ${explanation}
        </div>

        <div class="action-buttons">
          <a href="${imdbLink}" target="_blank" rel="noopener" class="btn-action imdb">
            IMDb
          </a>
          <a href="${googleLink}" target="_blank" rel="noopener" class="btn-action">
            جستجو در گوگل
          </a>
        </div>
      </div>

      ${altHtml}
      
    </div>
  `;
}

// اتصال دکمه‌ها
btnText.addEventListener('click', runTextSearch);
btnVideo.addEventListener('click', runVideoSearch);