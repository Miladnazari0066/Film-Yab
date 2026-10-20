// 🔑 کلیدهای API
const OPENROUTER_KEY = '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'; 
const TMDB_KEY = '0d6b2e67010cce1ffb27d958cb1bc152';
const OMDB_KEY = 'b44a4ca6';

const FRAME_COUNT = 3; 
const FRAME_WIDTH = 350;

const $ = id => document.getElementById(id);

let hasLoadedTrending = false; 
let selectedFile = null;
let currentMovieData = null; 
let trendingCache = [];
let favoritesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const panels = { text: $('panel-text'), video: $('panel-video'), trending: $('panel-trending'), favorites: $('panel-favorites') };
    const storyInput = $('story');
    const dropzone = $('dropzone');
    const fileInput = $('file-input');
    const videoInfo = $('video-info');
    const videoPreview = $('video-preview');
    const instaLinkInput = $('insta-link');
    const captionInput = $('caption');
    const loader = $('loader');
    const loaderText = $('loader-text');
    const progressBar = $('progress-bar');
    const modalOverlay = $('result-modal');
    const modalBody = $('modal-body');
    const trendingList = $('trending-list');
    const genreSelect = $('genre-select');
    const favoritesList = $('favorites-list');

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
        for(let i=0; i<5; i++) html += `<div class="skeleton-item"><div class="skeleton-poster"></div><div class="skeleton-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
        container.innerHTML = html;
    }

    async function loadTrending(genreId = 'all') {
        showSkeletons(trendingList);
        let endpoint = genreId === 'all' ? 'trending/all/day' : `discover/movie?with_genres=${genreId}&sort_by=popularity.desc`;
        
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `https://api.themoviedb.org/3/${endpoint}${separator}api_key=${TMDB_KEY}&language=fa-IR&page=1`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (!data.results || data.results.length === 0) throw new Error("No data");

            hasLoadedTrending = true;
            trendingCache = data.results.slice(0, 20); 

            trendingList.innerHTML = trendingCache.map((m, index) => {
                const title = m.title || m.name || 'بدون نام';
                const year = (m.release_date || m.first_air_date || '').split('-')[0] || '---';
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : '';
                const rating = m.vote_average ? m.vote_average.toFixed(1) : '0.0';
                const type = m.media_type === 'tv' || m.first_air_date ? 'سریال' : 'فیلم';
                
                return `
                    <div class="trending-item" onclick="handleTrendingClick(${index})">
                        ${poster ? `<img src="${poster}" class="trending-poster" loading="lazy">` : `<div class="trending-poster">🎬</div>`}
                        <div class="trending-info">
                            <div class="trending-title">${title}</div>
                            <div class="trending-meta"><span>📅 ${year}</span><span style="color:#f5c518;">⭐ ${rating}</span><span>🎬 ${type}</span></div>
                        </div>
                    </div>`;
            }).join('');
        } catch (e) {
            trendingList.innerHTML = `<div style="text-align:center; padding: 20px; color: #ef4444; font-size: 0.9rem;">⚠️ ارتباط با سرور برقرار نشد. VPN خود را روشن کنید.</div>`;
        }
    }

    window.handleTrendingClick = (index) => {
        const m = trendingCache[index];
        const title = m.title || m.name || 'بدون نام';
        const year = (m.release_date || m.first_air_date || '').split('-')[0] || '---';
        const poster = m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : null;
        const rating = m.vote_average ? m.vote_average.toFixed(1) : '0.0';
        const type = m.media_type === 'tv' || m.first_air_date ? 'سریال' : 'فیلم';

        showResult({
            title_fa: title, title_en: title, year: year, type: type, 
            explanation: "این فیلم/سریال از لیست پیشنهاد امروز انتخاب شده است.",
            confidence: "100", poster: poster, imdbRating: rating
        });
    };

    // ================= ❤️ علاقه‌مندی‌ها =================
    function getFavorites() { 
        try { return JSON.parse(localStorage.getItem('filmYabFavorites') || '[]'); } 
        catch(e) { return []; }
    }

    window.toggleFavorite = function() {
        if(!currentMovieData) return;
        
        let favs = getFavorites();
        const index = favs.findIndex(f => f.imdbID === currentMovieData.imdbID || f.title_en === currentMovieData.title_en);
        if (index > -1) favs.splice(index, 1); else favs.push(currentMovieData);
        localStorage.setItem('filmYabFavorites', JSON.stringify(favs));
        
        const btn = $('bookmark-btn');
        if (btn) {
            const isSaved = favs.some(f => f.imdbID === currentMovieData.imdbID || f.title_en === currentMovieData.title_en);
            btn.classList.toggle('saved', isSaved);
            btn.innerHTML = isSaved ? '★' : '☆';
        }
    };

    function renderFavorites() {
        favoritesCache = getFavorites();
        if (favoritesCache.length === 0) {
            favoritesList.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">هنوز فیلمی ذخیره نکرده‌اید.</p>';
            return;
        }
        favoritesList.innerHTML = favoritesCache.map((m, index) => `
            <div class="trending-item" onclick="openSavedMovie(${index})">
                ${m.poster && m.poster !== 'N/A' ? `<img src="${m.poster}" class="trending-poster">` : `<div class="trending-poster">🎬</div>`}
                <div class="trending-info">
                    <div class="trending-title">${m.title_fa}</div>
                    <div class="trending-meta"><span>📅 ${m.year}</span><span style="color:#f5c518;">⭐ ${m.imdbRating || ''}</span></div>
                </div>
            </div>
        `).join('');
    }

    window.openSavedMovie = (index) => {
        showResult(favoritesCache[index]);
    };

    // ================= 📝 جستجوها =================
    $('btn-text').addEventListener('click', async () => {
        const text = storyInput.value.trim();
        if (text.length < 10) return alert('توضیحات بیشتری بنویسید.');

        showLoader(true); startProgress();
        try {
            const prompt = `داستان: "${text}". بهترین فیلم را پیدا کن. خروجی فقط JSON: {"title_fa": "نام", "title_en": "Name", "year": "سال", "type": "نوع", "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح"}`;
            const rawResponse = await callAI([{ type: "text", text: prompt }], false);
            finishProgress(); showLoader(false);
            showResult(parseJson(rawResponse)); 
        } catch (err) { finishProgress(); showLoader(false); alert(err.message); }
    });

    $('btn-video').addEventListener('click', async () => {
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
            
            const prompt = `تو یک کارشناس سینما هستی. از روی این تصاویر فیلم را شناسایی کن. خروجی فقط JSON: {"title_fa": "نام", "title_en": "Name", "year": "سال", "type": "نوع", "imdbID": "شناسه", "confidence": "درصد", "explanation": "توضیح"}`;
            const content = [{ type: "text", text: prompt }, ...frames.map(f => ({ type: "image_url", image_url: { url: f } }))];

            loaderText.textContent = 'در حال تحلیل تصاویر...';
            const rawResponse = await callAI(content, true);
            
            finishProgress(); showLoader(false);
            showResult(parseJson(rawResponse)); 
        } catch (err) { finishProgress(); showLoader(false); alert(err.message); }
    });

    // دریافت لینک اینستاگرام
    async function getInstagramVideoUrl(instaUrl) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(instaUrl)}`;
        const res = await fetch(proxyUrl);
        const html = await res.text();
        const match = html.match(/<meta property="og:video" content="([^"]+)"/) || html.match(/"video_url":"([^"]+)"/);
        if (match && match[1]) return match[1].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
        throw new Error("ویدیو یافت نشد. لطفا از فایل استفاده کنید.");
    }

    // ================= 🎥 لینک‌های استریم (اصلاح شده) =================
    window.openStreamingApp = function(platform) {
        if (!currentMovieData || !currentMovieData.title_en) return;
        
        const encodedTitle = encodeURIComponent(currentMovieData.title_en);
        let webUrl = '';

        switch(platform) {
            case 'filimo': webUrl = `https://www.filimo.com/search?q=${encodedTitle}`; break;
            case 'namava': webUrl = `https://www.namava.ir/search?q=${encodedTitle}`; break;
            case 'filmnet': webUrl = `https://filmnet.ir/search?q=${encodedTitle}`; break;
            case 'delfan': webUrl = `https://www.google.com/search?q=${encodedTitle}+دلفان`; break;
            case 'bolboljan': webUrl = `https://www.google.com/search?q=${encodedTitle}+بلبل+جان`; break;
        }

        // استفاده از Universal Links: باز کردن لینک وب. 
        // اگر اپ نصب باشد، سیستم عامل خودکار اپ را باز میکند.
        window.open(webUrl, '_blank');
    };

    // ================= 📺 بخش «کجا ببینم» =================
    async function fetchProvidersInBackground(titleEn, year) {
        try {
            const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(titleEn)}&year=${year}`);
            const searchData = await searchRes.json();
            if (!searchData.results || searchData.results.length === 0) return;

            const providerRes = await fetch(`https://api.themoviedb.org/3/movie/${searchData.results[0].id}/watch/providers?api_key=${TMDB_KEY}`);
            const providerData = await providerRes.json();
            const regionData = providerData.results?.US || providerData.results?.IR;
            
            if (regionData) {
                const providers = regionData.flatrate || regionData.rent || providerData.results?.US?.buy;
                if (providers && providers.length > 0) {
                    const container = $('providers-container');
                    if(container) {
                        container.innerHTML = `
                            <div class="providers-title">📍 کجا می‌تونم ببینم؟</div>
                            <div class="providers-list">
                                ${providers.map(p => `<img src="https://image.tmdb.org/t/p/w92${p.logo_path}" class="provider-logo" title="${p.provider_name}">`).join('')}
                            </div>`;
                    }
                }
            }
        } catch (e) {}
    }

    // ================= ⚡️ نمایش آنی نتیجه =================
    async function showResult(data) {
        if (!data) return alert('داده‌ای یافت نشد.');
        
        let rawTitleFa = (data.title_fa || 'نامشخص').replace(/پیکینگ باد/gi, 'بریکینگ بد').replace(/برکینگ باد/gi, 'بریکینگ بد');
        
        currentMovieData = {
            title_fa: rawTitleFa, title_en: data.title_en, year: data.year, type: data.type,
            imdbID: data.imdbID, explanation: data.explanation, confidence: data.confidence,
            poster: data.poster || null, imdbRating: data.imdbRating || null
        };

        const isSaved = getFavorites().some(f => f.imdbID === data.imdbID || f.title_en === data.title_en);
        
        const firstLetter = data.title_en ? data.title_en.charAt(0) : '?';
        const initialPoster = data.poster ? `<img src="${data.poster}" class="poster" id="modal-poster">` : `<div class="poster" id="modal-poster">${firstLetter}</div>`;
        const initialRating = data.imdbRating ? `<span class="badge" style="background: #f5c518; color: #000; font-weight: bold;" id="modal-rating">⭐ ${data.imdbRating}/10</span>` : `<span id="modal-rating"></span>`;

        modalBody.innerHTML = `
            <div class="result-card">
                <div class="poster-container">
                    ${initialPoster}
                    <button class="bookmark-btn ${isSaved ? 'saved' : ''}" id="bookmark-btn" onclick="toggleFavorite()">${isSaved ? '★' : '☆'}</button>
                </div>
                <div class="info">
                    <h2 class="title-fa">${rawTitleFa}</h2>
                    <div class="title-en">${data.title_en} (${data.year})</div>
                    <div class="badges">
                        <span class="badge">🎬 ${data.type}</span>
                        <span class="badge">📅 ${data.year}</span>
                        ${initialRating}
                    </div>
                    <div class="desc">${data.explanation}</div>
                    
                    <div id="providers-container"></div>

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border-color);">
                        <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 10px;">🎥 پخش آنلاین در ایران:</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <button class="btn-action" style="background: #ffcc00; color: #000;" onclick="openStreamingApp('filimo')">فیلیمو</button>
                            <button class="btn-action" style="background: #007bff; color: #fff;" onclick="openStreamingApp('namava')">نماوا</button>
                            <button class="btn-action" style="background: #28a745; color: #fff;" onclick="openStreamingApp('filmnet')">فیلم‌نت</button>
                            <button class="btn-action" style="background: #6f42c1; color: #fff;" onclick="openStreamingApp('delfan')">دلفان</button>
                            <button class="btn-action" style="background: #fd7e14; color: #fff;" onclick="openStreamingApp('bolboljan')">بلبل جان</button>
                        </div>
                    </div>

                    <div class="actions" style="margin-top: 15px;">
                        <a href="https://www.imdb.com/find?q=${encodeURIComponent(data.title_en)}" target="_blank" class="btn-action btn-imdb">IMDb</a>
                        <a href="https://www.google.com/search?q=${encodeURIComponent(data.title_en + ' movie')}" target="_blank" class="btn-action btn-google">گوگل</a>
                    </div>
                </div>
            </div>`;
        
        modalOverlay.classList.add('active');

        if (!data.poster || !data.imdbRating) {
            try {
                const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&${data.imdbID ? 'i='+data.imdbID : 't='+encodeURIComponent(data.title_en)}`);
                const omdbJson = await omdbRes.json();
                
                if (omdbJson.Response === 'True') {
                    if (omdbJson.Poster !== 'N/A') {
                        const posterEl = $('modal-poster');
                        if(posterEl) posterEl.outerHTML = `<img src="${omdbJson.Poster}" class="poster" id="modal-poster">`;
                        currentMovieData.poster = omdbJson.Poster;
                    }
                    if (omdbJson.imdbRating !== 'N/A') {
                        const ratingEl = $('modal-rating');
                        if(ratingEl) {
                            ratingEl.outerHTML = `<span class="badge" style="background: #f5c518; color: #000; font-weight: bold;" id="modal-rating">⭐ ${omdbJson.imdbRating}/10</span>`;
                            currentMovieData.imdbRating = omdbJson.imdbRating;
                        }
                    }
                }
            } catch (e) {}
        }

        fetchProvidersInBackground(data.title_en, data.year);
    }

    // ================= توابع کمکی =================
    window.closeModal = function() { modalOverlay.classList.remove('active'); };
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { if (e.target.files[0]) setVideoFile(e.target.files[0]); });
    
    function setVideoFile(file) {
        selectedFile = file; instaLinkInput.value = ''; 
        videoPreview.src = URL.createObjectURL(file);
        dropzone.style.display = 'none'; videoInfo.style.display = 'block';
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

    async function callAI(content, isVideoMode = false) {
        const model = isVideoMode ? "qwen/qwen2.5-vl-72b-instruct:free" : "deepseek/deepseek-chat";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); 

        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: 'POST', signal: controller.signal,
                headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.href, 'X-Title': 'Film-Yab' },
                body: JSON.stringify({ model: model, messages: [{ role: 'user', content }], temperature: 0.0 })
            });
            clearTimeout(timeoutId);
            
            const data = await res.json();
            if (data.choices && data.choices.length > 0) return data.choices[0].message.content;
            if (data.error) throw new Error(data.error.message || "خطای کلید API");
            throw new Error("پاسخ خالی");
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') throw new Error("سرور هوش مصنوعی پاسخ نداد (Timeout).");
            throw new Error("ارتباط برقرار نشد. لطفاً VPN خود را روشن کنید.");
        }
    }

    const loadingMessages = ['در حال تحلیل...', 'جستجو در آرشیو...', 'در حال استخراج اطلاعات...'];
    let loadingInterval;
    function showLoader(show) {
        loader.style.display = show ? 'block' : 'none';
        if (show) {
            let msgIndex = 0; loaderText.textContent = loadingMessages[0];
            loadingInterval = setInterval(() => { msgIndex = (msgIndex + 1) % loadingMessages.length; loaderText.textContent = loadingMessages[msgIndex]; }, 2500);
        } else { clearInterval(loadingInterval); }
    }

    let progressInterval; let currentProgress = 0;
    function startProgress() {
        clearInterval(progressInterval); currentProgress = 0; progressBar.style.width = '0%';
        progressInterval = setInterval(() => {
            if (currentProgress < 95) { currentProgress += (95 - currentProgress) * 0.1; progressBar.style.width = `${currentProgress}%`; }
        }, 100);
    }
    function finishProgress() { clearInterval(progressInterval); progressBar.style.width = '100%'; }
    
    function parseJson(raw) { 
        try { return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim()); } 
        catch(e) {
            const match = raw.match(/\{[\s\S]*\}/);
            if(match) return JSON.parse(match[0]);
            throw new Error("پاسخ JSON نامعتبر بود.");
        }
    }
});