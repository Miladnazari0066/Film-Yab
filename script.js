// 🔑 کلیدهای API
const OPENROUTER_KEY = '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'; 
const TMDB_KEY = '0d6b2e67010cce1ffb27d958cb1bc152';
const OMDB_KEY = 'b44a4ca6';

const FRAME_COUNT = 4; 
const FRAME_WIDTH = 400;

const $ = id => document.getElementById(id);

// المان‌ها
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = { text: $('panel-text'), video: $('panel-video'), trending: $('panel-trending'), favorites: $('panel-favorites') };
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
const modalOverlay = $('result-modal');
const modalBody = $('modal-body');
const trendingList = $('trending-list');
const genreSelect = $('genre-select');
const favoritesList = $('favorites-list');

let hasLoadedTrending = false; 
let selectedFile = null;
let currentMovieData = null; 

// مدیریت تب‌ها
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        Object.keys(panels).forEach(key => panels[key].classList.toggle('active', key === target));

        if (target === 'trending' && !hasLoadedTrending) loadTrending('all');
        if (target === 'favorites') renderFavorites();
    });
});

// ================= 🎬 پیشنهاد امروز =================
genreSelect.addEventListener('change', (e) => loadTrending(e.target.value));

function showSkeletons(container) {
    let html = '';
    for(let i=0; i<5; i++) {
        html += `<div class="skeleton-item"><div class="skeleton-poster"></div><div class="skeleton-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
    }
    container.innerHTML = html;
}

const fallbackMovies = [
    { title: "Inception", year: "2010", poster: "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_UX182_CR0,0,182,268_AL_.jpg", rating: "8.8" },
    { title: "The Dark Knight", year: "2008", poster: "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_UX182_CR0,0,182,268_AL_.jpg", rating: "9.0" },
    { title: "Interstellar", year: "2014", poster: "https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_UX182_CR0,0,182,268_AL_.jpg", rating: "8.7" },
    { title: "The Matrix", year: "1999", poster: "https://m.media-amazon.com/images/M/MV5BNzQzOTk3OTAtNDQ0Zi00ZTVkLWI0MTEtMDllZjNkYzNjNTc4L2ltYWdlXkEyXkFqcGdeQXVyNjU0OTQ0OTY@._V1_UX182_CR0,0,182,268_AL_.jpg", rating: "8.7" },
    { title: "Pulp Fiction", year: "1994", poster: "https://m.media-amazon.com/images/M/MV5BNGNhMDIzZTUtNTBlZi00MTRlLWFjM2ItYzViMjE3YzI5MjljXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_UX182_CR0,0,182,268_AL_.jpg", rating: "8.9" }
];

// استفاده از پروکسی قوی‌تر و تایم‌اوت برای جلوگیری از کندی
async function fetchTMDB(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const targetUrl = `https://api.themoviedb.org/3/${endpoint}${separator}api_key=${TMDB_KEY}&language=fa-IR&page=1`;
    
    // پروکسی بسیار پایدارتر
    const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000); // حداکثر ۷ ثانیه صبر میکنه

        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error("Proxy failed");
        
        const data = await res.json();
        if (data.results) return data.results;
    } catch (e) {
        console.warn(`TMDB دریافت نشد:`, e.message);
    }
    return null;
}

function getProxiedImageUrl(path, size = 'w200') {
    if (!path) return '';
    const originalUrl = `image.tmdb.org/t/p/${size}${path}`;
    return `https://images.weserv.nl/?url=${originalUrl}`;
}

async function loadTrending(genreId = 'all') {
    showSkeletons(trendingList);
    let results = null;

    if (genreId === 'all') {
        results = await fetchTMDB('trending/all/day');
        if (!results) results = await fetchTMDB('movie/upcoming');
    } else {
        results = await fetchTMDB(`discover/movie?with_genres=${genreId}&sort_by=popularity.desc`);
    }

    // اگر ارتباط برقرار نشد، سریع لیست پیش‌فرض رو نشون بده
    if (!results || results.length === 0) {
        trendingList.innerHTML = `<div style="text-align:center; padding: 10px; color: #f5b942; font-size: 0.9rem;">⚠️ سرور فیلم‌ها در دسترس نیست. نمایش لیست پیش‌فرض:</div>` + 
        fallbackMovies.map(m => `
            <a href="https://www.google.com/search?q=${encodeURIComponent(m.title + ' movie')}" target="_blank" class="trending-item">
                <img src="${m.poster}" class="trending-poster" loading="lazy">
                <div class="trending-info">
                    <div class="trending-title">${m.title}</div>
                    <div class="trending-meta"><span>📅 ${m.year}</span><span style="color:#f5c518;">⭐ ${m.rating}</span></div>
                </div>
            </a>
        `).join('');
        hasLoadedTrending = true;
        return;
    }

    hasLoadedTrending = true;
    trendingList.innerHTML = results.map(m => {
        const title = m.title || m.name || 'بدون نام';
        const year = (m.release_date || m.first_air_date || '').split('-')[0] || '---';
        const poster = getProxiedImageUrl(m.poster_path);
        const rating = m.vote_average ? m.vote_average.toFixed(1) : '0.0';
        const type = m.media_type === 'tv' || m.first_air_date ? 'سریال' : 'فیلم';
        const link = `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + year + ' movie')}`;

        return `
            <a href="${link}" target="_blank" class="trending-item">
                ${poster ? `<img src="${poster}" class="trending-poster" loading="lazy">` : `<div class="trending-poster">🎬</div>`}
                <div class="trending-info">
                    <div class="trending-title">${title}</div>
                    <div class="trending-meta"><span>📅 ${year}</span><span style="color:#f5c518;">⭐ ${rating}</span><span>🎬 ${type}</span></div>
                </div>
            </a>`;
    }).join('');
}

// ================= ❤️ علاقه‌مندی‌ها =================
function getFavorites() { return JSON.parse(localStorage.getItem('filmYabFavorites') || '[]'); }

window.toggleFavorite = function(movieData) {
    let favs = getFavorites();
    const index = favs.findIndex(f => f.imdbID === movieData.imdbID || f.title_en === movieData.title_en);
    if (index > -1) favs.splice(index, 1); else favs.push(movieData);
    localStorage.setItem('filmYabFavorites', JSON.stringify(favs));
    
    const btn = $('bookmark-btn');
    if (btn) {
        const isSaved = favs.some(f => f.imdbID === movieData.imdbID || f.title_en === movieData.title_en);
        btn.classList.toggle('saved', isSaved);
        btn.innerHTML = isSaved ? '★' : '☆';
    }
};

function renderFavorites() {
    const favs = getFavorites();
    if (favs.length === 0) {
        favoritesList.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">هنوز فیلمی ذخیره نکرده‌اید.</p>';
        return;
    }
    favoritesList.innerHTML = favs.map(m => `
        <div class="trending-item" style="cursor:pointer;" onclick="openSavedMovie('${m.title_en}')">
            ${m.poster && m.poster !== 'N/A' ? `<img src="${m.poster}" class="trending-poster">` : `<div class="trending-poster">🎬</div>`}
            <div class="trending-info">
                <div class="trending-title">${m.title_fa}</div>
                <div class="trending-meta"><span>📅 ${m.year}</span><span style="color:#f5c518;">⭐ ${m.imdbRating || ''}</span></div>
            </div>
        </div>
    `).join('');
}

window.openSavedMovie = (titleEn) => {
    const movie = getFavorites().find(f => f.title_en === titleEn);
    if (movie) showResult(movie);
};

// ================= 📝 جستجوها =================
btnText.addEventListener('click', async () => {
    const text = storyInput.value.trim();
    if (text.length < 10) return alert('توضیحات بیشتری بنویسید.');

    showLoader(true); startProgress();
    try {
        const prompt = buildPrompt(text, false);
        const rawResponse = await callOpenRouter([{ type: "text", text: prompt }], false);
        const parsedData = parseJson(rawResponse);
        finishProgress();
        setTimeout(async () => { showLoader(false); await showResult(parsedData); }, 400);
    } catch (err) { finishProgress(); setTimeout(() => { showLoader(false); alert("خطا در جستجو:\n" + err.message); }, 400); }
});

btnVideo.addEventListener('click', async () => {
    const instaUrl = instaLinkInput.value.trim();
    if (!selectedFile && !instaUrl) return alert('فایل یا لینک انتخاب کنید.');
    
    showLoader(true); startProgress();
    try {
        let frames = [];
        if (instaUrl) {
            loaderText.textContent = 'در حال دریافت از اینستاگرام...';
            const videoUrl = await getInstagramVideoUrl(instaUrl);
            frames = await extractFrames(videoUrl);
        } else {
            loaderText.textContent = 'در حال استخراج فریم‌ها...';
            frames = await extractFrames(selectedFile);
        }
        
        const prompt = buildPrompt(captionInput.value.trim() || '', true);
        const content = [{ type: "text", text: prompt }, ...frames.map(f => ({ type: "image_url", image_url: { url: f } }))];

        loaderText.textContent = 'در حال تحلیل تصاویر...';
        const rawResponse = await callOpenRouter(content, true);
        const parsedData = parseJson(rawResponse);
        
        finishProgress();
        setTimeout(async () => { showLoader(false); await showResult(parsedData); }, 400);
    } catch (err) { finishProgress(); setTimeout(() => { showLoader(false); alert("خطا در تحلیل:\n" + err.message); }, 400); }
});

// دریافت لینک اینستاگرام
async function getInstagramVideoUrl(instaUrl) {
    const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(instaUrl)}`;
    try {
        const res = await fetch(proxyUrl);
        const html = await res.text();
        const match = html.match(/<meta property="og:video" content="([^"]+)"/) || html.match(/"video_url":"([^"]+)"/);
        if (match && match[1]) return match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
    } catch (e) { console.warn("پروکسی خطا داد:", e); }
    throw new Error("نتوانستم ویدیو را دریافت کنم. لینک را بررسی کنید یا از فایل استفاده کنید.");
}

// ================= بخش «کجا ببینم» =================
async function fetchWatchProviders(titleEn, year) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(titleEn)}&year=${year}`;
        const searchRes = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(searchUrl)}`);
        const searchData = await searchRes.json();
        
        if (!searchData.results || searchData.results.length === 0) return null;
        const movieId = searchData.results[0].id;
        
        const providerUrl = `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${TMDB_KEY}`;
        const providerRes = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(providerUrl)}`);
        const providerData = await providerRes.json();
        
        const regionData = providerData.results?.US || providerData.results?.IR;
        if (!regionData) return null;

        const providers = regionData.flatrate || regionData.rent || providerData.results?.US?.buy || [];
        return providers.length > 0 ? providers : null;
    } catch (e) { return null; }
}

// ================= نمایش نتیجه =================
async function showResult(data) {
    if (!data) return alert('داده‌ای یافت نشد.');
    
    let rawTitleFa = data.title_fa || 'نامشخص';
    rawTitleFa = rawTitleFa.replace(/پیکینگ باد/gi, 'بریکینگ بد').replace(/برکینگ باد/gi, 'بریکینگ بد');
    
    let omdbData = { poster: null, rating: null };
    try {
        const omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_KEY}&${data.imdbID ? 'i='+data.imdbID : 't='+encodeURIComponent(data.title_en)}`;
        const omdbRes = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(omdbUrl)}`);
        const omdbJson = await omdbRes.json();
        if (omdbJson.Response === 'True') {
            omdbData.poster = omdbJson.Poster !== 'N/A' ? omdbJson.Poster : null;
            omdbData.rating = omdbJson.imdbRating !== 'N/A' ? omdbJson.imdbRating : null;
        }
    } catch(e) {}

    const watchProviders = await fetchWatchProviders(data.title_en, data.year);

    currentMovieData = {
        title_fa: rawTitleFa, title_en: data.title_en, year: data.year, type: data.type,
        imdbID: data.imdbID, explanation: data.explanation, confidence: data.confidence,
        poster: omdbData.poster, imdbRating: omdbData.rating
    };

    const isSaved = getFavorites().some(f => f.imdbID === data.imdbID || f.title_en === data.title_en);
    
    let providersHtml = '';
    if (watchProviders) {
        providersHtml = `
            <div class="watch-providers">
                <div class="providers-title">📍 کجا می‌تونم ببینم؟</div>
                <div class="providers-list">
                    ${watchProviders.map(p => `<img src="${getProxiedImageUrl(p.logo_path, 'w92')}" class="provider-logo" title="${p.provider_name}">`).join('')}
                </div>
            </div>`;
    }

    modalBody.innerHTML = `
        <div class="result-card">
            <div class="poster-container">
                ${omdbData.poster ? `<img src="${omdbData.poster}" class="poster">` : `<div class="poster">${data.title_en.charAt(0)}</div>`}
                <button class="bookmark-btn ${isSaved ? 'saved' : ''}" id="bookmark-btn" onclick="toggleFavorite(currentMovieData)">${isSaved ? '★' : '☆'}</button>
            </div>
            <div class="info">
                <h2 class="title-fa">${rawTitleFa}</h2>
                <div class="title-en">${data.title_en} (${data.year})</div>
                <div class="badges">
                    <span class="badge">🎬 ${data.type}</span>
                    <span class="badge">📅 ${data.year}</span>
                    ${omdbData.rating ? `<span class="badge" style="background: #f5c518; color: #000; font-weight: bold;">⭐ ${omdbData.rating}/10</span>` : ''}
                </div>
                <div class="desc">${data.explanation}</div>
                ${providersHtml}
                <div class="actions" style="margin-top: 20px;">
                    <a href="https://www.imdb.com/find?q=${encodeURIComponent(data.title_en)}" target="_blank" class="btn-action btn-imdb">IMDb</a>
                    <a href="https://www.google.com/search?q=${encodeURIComponent(data.title_en + ' movie')}" target="_blank" class="btn-action btn-google">گوگل</a>
                </div>
            </div>
        </div>`;
    modalOverlay.classList.add('active');
}

// ================= توابع کمکی =================
function closeModal() { modalOverlay.classList.remove('active'); }
window.closeModal = closeModal;
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--secondary-glow)'; });
dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-color)');
dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--border-color)'; if (e.dataTransfer.files[0]) setVideoFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) setVideoFile(e.target.files[0]); });

function setVideoFile(file) {
    selectedFile = file;
    instaLinkInput.value = ''; 
    videoPreview.src = URL.createObjectURL(file);
    dropzone.style.display = 'none';
    videoInfo.style.display = 'block';
    videoInfo.querySelector('.filename').textContent = file.name;
}

async function extractFrames(source, count = FRAME_COUNT) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata'; video.muted = true;
        video.src = typeof source === 'string' ? source : URL.createObjectURL(source);
        if(typeof source === 'string') video.crossOrigin = "anonymous"; 

        video.onloadedmetadata = async () => {
            const dur = video.duration;
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            const frames = [];
            const scale = Math.min(1, FRAME_WIDTH / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);

            for (let i = 0; i < count; i++) {
                video.currentTime = dur * (i + 0.5) / count;
                await new Promise(r => video.onseeked = r);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.6)); 
            }
            resolve(frames);
        };
        video.onerror = () => reject(new Error('خطا در خواندن ویدیو.'));
    });
}

function buildPrompt(text, isVideo) {
    if (isVideo) return `تو یک کارشناس سینما هستی. از روی این تصاویر فیلم را شناسایی کن. خروجی JSON: {"title_fa": "نام", "title_en": "Name", "year": "سال", "type": "نوع", "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح"}`;
    return `داستان: "${text}". بهترین فیلم را پیدا کن. خروجی JSON: {"title_fa": "نام", "title_en": "Name", "year": "سال", "type": "نوع", "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح"}`;
}

// درخواست به OpenRouter (فقط با فیلترشکن کار میکنه)
async function callOpenRouter(content, isVideoMode = false) {
    const model = isVideoMode ? "qwen/qwen2.5-vl-72b-instruct:free" : "deepseek/deepseek-chat";
    const targetUrl = "https://openrouter.ai/api/v1/chat/completions";
    const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`;

    try {
        const res = await fetch(proxyUrl, {
            method: 'POST', 
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model: model, messages: [{ role: 'user', content }], temperature: 0.0 })
        });
        
        const data = await res.json();
        if (data.choices && data.choices.length > 0) return data.choices[0].message.content;
        if (data.error) throw new Error(data.error.message || "خطای کلید API");
        
        throw new Error("پاسخ خالی از سمت سرور");
    } catch (err) {
        console.error("OpenRouter Error:", err);
        throw new Error("ارتباط با هوش مصنوعی برقرار نشد. لطفاً فیلترشکن خود را روشن کنید (سرورهای هوش مصنوعی روی IP ایران مسدود هستند).");
    }
}

// 🌟 انیمیشن لودر 🌟
const loadingMessages = ['در حال تحلیل...', 'جستجو در آرشیو...', 'در حال استخراج اطلاعات...', 'تقریبا آماده است...'];
let loadingInterval;

function showLoader(show) {
    loader.style.display = show ? 'block' : 'none';
    if (show) {
        let msgIndex = 0;
        loaderText.textContent = loadingMessages[0];
        loadingInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % loadingMessages.length;
            loaderText.textContent = loadingMessages[msgIndex];
        }, 3000);
    } else {
        clearInterval(loadingInterval);
    }
}

let progressInterval; let currentProgress = 0;
function startProgress() {
    clearInterval(progressInterval); currentProgress = 0; progressBar.style.width = '0%';
    progressInterval = setInterval(() => {
        if (currentProgress < 90) { currentProgress += Math.max(0.5, (90 - currentProgress) * 0.05); progressBar.style.width = `${currentProgress}%`; }
    }, 150);
}
function finishProgress() { clearInterval(progressInterval); progressBar.style.width = '100%'; }
function parseJson(raw) { 
    try {
        return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim()); 
    } catch(e) {
        const match = raw.match(/\{[\s\S]*\}/);
        if(match) return JSON.parse(match[0]);
        throw new Error("پاسخ JSON نامعتبر بود.");
    }
}