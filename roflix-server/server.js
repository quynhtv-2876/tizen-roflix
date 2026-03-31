// Load environment variables first
require("dotenv").config();

const express = require("express");
const puppeteer = require("puppeteer-extra");
const puppeteerCore = require("puppeteer-core"); // Use puppeteer-core
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");
const cors = require("cors");
const { URL } = require("url");
const axios = require("axios"); // Used for both NguonC API and Proxy

// Tell puppeteer-extra to use puppeteer-core
puppeteer.puppeteer = puppeteerCore;
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;
const ROPHIM_BASE_URL = process.env.ROPHIM_BASE_URL || 'https://rophim.mx';
// SỬA LỖI: Dùng API base URL chuẩn theo tài liệu
const OPHIM_API_URL = process.env.OPHIM_API_URL || 'https://phim.nguonc.com/api';
// Domain gốc để tạo link tuyệt đối nếu cần
const OPHIM_DOMAIN = 'https://phim.nguonc.com';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    console.error("!!! CRITICAL ERROR: API_KEY environment variable is not set.");
    process.exit(1);
}

// --- XÁC ĐỊNH ĐƯỜNG DẪN CHROMIUM ---
const possiblePaths = [
    process.env.CHROME_PATH, // Allow overriding via env var
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
].filter(Boolean);
const CHROMIUM_EXECUTABLE_PATH = possiblePaths[0];

if (!CHROMIUM_EXECUTABLE_PATH) {
    console.warn(
        `!!! WARNING: Could not find Chromium executable.\n` +
        `    => Nguồn 'nguonc.com' (nhanh) sẽ hoạt động bình thường.\n` +
        `    => Nguồn 'rophim.mx' (chậm) sẽ thất bại. (yêu cầu Puppeteer).\n`
    );
} else {
    console.log(`Using Chromium executable found at: ${CHROMIUM_EXECUTABLE_PATH}`);
}
// --- KẾT THÚC ---

// Middleware xác thực
const authenticateKey = (req, res, next) => {
    const providedApiKey = req.headers['x-api-key'];
    if (providedApiKey && providedApiKey === API_KEY) {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized: API Key is invalid.' });
    }
};

app.use(cors());

// --- UTILITY FUNCTIONS ---
async function launchBrowser() {
    if (!CHROMIUM_EXECUTABLE_PATH) {
        throw new Error("Chromium executable path not configured. Cannot launch browser for RoPhim.");
    }
    console.log("Đang khởi chạy trình duyệt ảo (chế độ tàng hình)...");
    try {
        return await puppeteer.launch({
            headless: true,
            executablePath: CHROMIUM_EXECUTABLE_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
    } catch (launchError) {
         console.error("!!! LỖI KHỞI CHẠY PUPPETEER:", launchError.message);
         if (launchError.message.includes('Failed to launch')) {
             console.error("   => Suggestion: Verify Chromium installation and CHROME_PATH environment variable.");
         }
         throw launchError;
    }
 }
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 250;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
 }
 // Helper function to ensure URL is absolute
 const makeAbsoluteUrl = (url, base) => {
     if (!url || typeof url !== 'string') return null;
     if (url.startsWith('http')) return url;
     // Handle cases like "//example.com/path" which are protocol-relative
     if (url.startsWith('//')) return `https:${url}`;
     // Handle cases like "/path"
     if (url.startsWith('/')) return `${new URL(base).origin}${url}`;
     // Assume it's relative to the base path
     return `${base.endsWith('/') ? base : base + '/'}${url}`;
 };


// --- ROPHIM ROUTER (Sử dụng Puppeteer) ---
const rophimRouter = express.Router();
rophimRouter.use(authenticateKey);

rophimRouter.get('/phimhay', async (req, res) => {
    let browser;
    console.log("--- ROPHIM: Nhận yêu cầu /phimhay ---");
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        const url = `${ROPHIM_BASE_URL}/phimhay`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('div.sw-item', { timeout: 30000 });
        const scrollCount = 5;
        for (let i = 0; i < scrollCount; i++) {
            await autoScroll(page);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        const pageContent = await page.content();
        const $ = cheerio.load(pageContent);
        const movies = [];
        const movieLinks = new Set();
        $('div.sw-item').each((i, el) => {
            const titleAnchor = $(el).find('h4.item-title a');
            const title = titleAnchor.attr('title');
            const link = titleAnchor.attr('href'); // Link tương đối
            const imgTag = $(el).find('a.v-thumbnail img');
            let imageUrl = imgTag.attr('data-src') || imgTag.attr('src');
            imageUrl = makeAbsoluteUrl(imageUrl, ROPHIM_BASE_URL); // Đảm bảo tuyệt đối
            if (title && link && imageUrl && !movieLinks.has(link)) {
                // Trả về link TƯƠNG ĐỐI cho App, nhưng slug là link tuyệt đối để server dùng
                movies.push({ title, link: link, imageUrl, slug: makeAbsoluteUrl(link, ROPHIM_BASE_URL) });
                movieLinks.add(link);
            }
        });
        if (movies.length === 0) throw new Error("Không tìm thấy phim nào.");
        console.log(`--- ROPHIM: Lấy thành công ${movies.length} phim.`);
        res.json({ movies, pagination: { currentPage: 1, totalPages: 1 } });
    } catch (error) {
        console.error('!!! ROPHIM LỖI tại /phimhay:', error.message);
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách phim RoPhim.', error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

rophimRouter.get('/details', async (req, res) => {
    let { movieUrl } = req.query; // Nhận link TƯƠNG ĐỐI hoặc slug TUYỆT ĐỐI từ App
    if (!movieUrl) return res.status(400).json({ message: 'URL phim không hợp lệ.' });
    // Server luôn cần URL tuyệt đối để truy cập
    const absoluteMovieUrl = movieUrl.startsWith('http') ? movieUrl : `${ROPHIM_BASE_URL}${movieUrl}`;
    let browser;
    console.log(`--- ROPHIM: Nhận yêu cầu /details: ${absoluteMovieUrl} ---`);
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.goto(absoluteMovieUrl, { waitUntil: 'networkidle2' });
        const details = await page.evaluate((baseUrl) => {
            const description = document.querySelector('div.description')?.innerText.trim() || "Không có mô tả.";
            const episodesData = [];
            const serverEpisodes = [];
            document.querySelectorAll('#episodes-list .de-type .item, #episodes-list .de-eps .item').forEach(el => {
                let episodeLink = el.getAttribute('href'); // Có thể tương đối
                const episodeName = el.querySelector('.info .ver span')?.innerText.trim() || el.querySelector('.ep-sort')?.innerText.trim() || el.innerText.trim() || 'Xem phim';
                if (episodeLink) {
                    // Trả về link TƯƠNG ĐỐI cho App
                    serverEpisodes.push({ name: episodeName, link: episodeLink.startsWith(baseUrl) ? episodeLink.substring(baseUrl.length) : episodeLink });
                }
            });
            if (serverEpisodes.length === 0) {
                 const watchButton = document.querySelector('a.button-play');
                 if (watchButton) {
                     let watchLink = watchButton.getAttribute('href');
                     if (watchLink) {
                        serverEpisodes.push({ name: 'Xem phim', link: watchLink.startsWith(baseUrl) ? watchLink.substring(baseUrl.length) : watchLink });
                     }
                 }
            }
            if(serverEpisodes.length > 0) {
                episodesData.push({ server_name: 'RoPhim', episodes: serverEpisodes });
            }
            return { description, episodes: episodesData };
        }, ROPHIM_BASE_URL);
        console.log(`--- ROPHIM: Lấy thành công details.`);
        res.json(details);
    } catch (error) {
        console.error('!!! ROPHIM LỖI tại /details:', error.message);
        res.status(500).json({ message: 'Lỗi server khi lấy chi tiết phim RoPhim.', error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

rophimRouter.get('/watch', async (req, res) => {
    let { episodeLink } = req.query; // Nhận link TƯƠNG ĐỐI từ App
    if (!episodeLink) return res.status(400).json({ message: 'URL tập phim không hợp lệ.' });
    const episodeUrl = makeAbsoluteUrl(episodeLink, ROPHIM_BASE_URL); // Server cần link tuyệt đối
    if (!episodeUrl) return res.status(400).json({ message: 'Không thể tạo URL tuyệt đối hợp lệ.' });

    let browser;
    console.log(`--- ROPHIM: Nhận yêu cầu /watch: ${episodeUrl} ---`);
    try {
        browser = await launchBrowser();
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
        let refererUrl;
        const resourcesPromise = new Promise((resolve, reject) => {
            let videoUrl, subtitleUrl;
            let videoFound = false;
            page.on('response', (response) => {
                const url = response.url();
                if (url.includes('.m3u8') && !videoUrl) {
                    videoUrl = url;
                    refererUrl = response.request().headers().referer;
                    videoFound = true;
                    setTimeout(() => {
                        page.removeAllListeners('response');
                        resolve({ videoUrl, subtitleUrl });
                    }, 2000);
                }
                if (url.includes('.vtt') && !subtitleUrl) {
                    subtitleUrl = url;
                }
            });
            setTimeout(() => {
                if (!videoFound) reject(new Error("Timeout: Không tìm thấy link video .m3u8"));
            }, 60000);
        });
        await page.goto(episodeUrl, { waitUntil: 'networkidle2' });
        const iframeElement = await page.waitForSelector('#embed-player', { timeout: 10000 });
        const frame = await iframeElement.contentFrame();
        if (!frame) throw new Error("Không thể truy cập iframe.");
        const playButtonSelector = '[aria-label="Play"], .jw-icon-playback, .vjs-big-play-button, #play-button, .play-btn';
        await frame.waitForSelector(playButtonSelector, { timeout: 15000, visible: true });
        await frame.click(playButtonSelector);
        const { videoUrl, subtitleUrl } = await resourcesPromise;
        const protocol = req.protocol;
        const host = req.get('host');
        // Trả về link proxy TUYỆT ĐỐI
        const videoProxyUrl = `${protocol}://${host}/api/proxy?videoUrl=${encodeURIComponent(videoUrl)}&referer=${encodeURIComponent(refererUrl || 'https://goatembed.com/')}`;
        let subtitleProxyUrl = null;
        if (subtitleUrl) {
            subtitleProxyUrl = `${protocol}://${host}/api/proxy?videoUrl=${encodeURIComponent(subtitleUrl)}&referer=${encodeURIComponent(refererUrl || 'https://goatembed.com/')}`;
        }
        console.log(`--- ROPHIM: Lấy link thành công.`);
        res.json({ videoUrl: videoProxyUrl, subtitleUrl: subtitleProxyUrl });
    } catch (error) {
        console.error('!!! ROPHIM LỖI tại /watch:', error.message);
        res.status(500).json({ message: 'Lỗi server khi lấy link xem phim RoPhim.', error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});


// --- NGUONC ROUTER (Sử dụng Axios và API phim.nguonc.com/api) ---
const nguoncRouter = express.Router();
nguoncRouter.use(authenticateKey);

async function callNguonCApi(endpoint) {
    const url = `${OPHIM_API_URL}${endpoint}`; // OPHIM_API_URL là phim.nguonc.com/api
    console.log(`--- NGUONC: Gọi API: ${url} ---`);
    try {
        const { data } = await axios.get(url, { timeout: 15000 });
        // Kiểm tra cấu trúc response cơ bản
        if (!data || (data.status && data.status !== 'success' && data.status !== true)) {
            // Log lỗi từ API nếu có
             console.error(`!!! NGUONC LỖI API ${url}: Status không thành công`, data);
            throw new Error(`API NguonC báo lỗi: ${data.msg || 'Không rõ nguyên nhân'}`);
        }
        return data;
    } catch (error) {
        console.error(`!!! NGUONC LỖI khi gọi ${url}:`, error.response?.status, error.message);
        // Ném lỗi rõ ràng hơn
        const status = error.response?.status;
        const apiMsg = error.response?.data?.msg;
        throw new Error(`NguonC API Error (${status || error.code})${apiMsg ? `: ${apiMsg}`: ''}`);
    }
}

nguoncRouter.get('/phimhay', async (req, res) => {
    const batch = parseInt(req.query.batch) || 1; // Batch number (1, 2, 3...)
    try {
        // Mỗi batch load 3 trang
        const pagesPerBatch = 3;
        const startPage = (batch - 1) * pagesPerBatch + 1;
        const endPage = batch * pagesPerBatch;
        
        const promises = [];
        for (let page = startPage; page <= endPage; page++) {
            promises.push(callNguonCApi(`/films/phim-moi-cap-nhat?page=${page}`));
        }
        
        const results = await Promise.all(promises);
        
        // Gộp tất cả phim từ các trang
        const allMovies = [];
        for (const data of results) {
            if (data && data.items) {
                const movies = data.items.map(item => ({
                    title: item.name,
                    link: `/phim/${item.slug}`,
                    imageUrl: makeAbsoluteUrl(item.poster_url, OPHIM_DOMAIN),
                    slug: item.slug
                }));
                allMovies.push(...movies);
            }
        }
        
        console.log(`--- NGUONC: Lấy thành công ${allMovies.length} phim từ batch ${batch} (trang ${startPage}-${endPage}).`);
        
        // Trả về phim, không có pagination
        res.json({ 
            movies: allMovies,
            batch: batch,
            hasMore: allMovies.length >= pagesPerBatch * 10 // Có thể có thêm nếu đủ phim
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi lấy danh sách phim NguonC.', error: error.message });
    }
});

// SỬA LỖI: Dùng đúng endpoint /films/search
nguoncRouter.get('/search', async (req, res) => {
    const keyword = req.query.keyword;
    // const page = req.query.page || 1; // API search này không phân trang theo docs
    if (!keyword) return res.status(400).json({ message: 'Thiếu từ khóa tìm kiếm.' });
    try {
        // SỬA LỖI: Dùng đúng endpoint theo docs
        const data = await callNguonCApi(`/films/search?keyword=${encodeURIComponent(keyword)}`);
        // API này trả về `data.items` và `data.pagination`
        const movies = (data.items || []).map(item => ({
            title: item.name,
            link: `/phim/${item.slug}`, // Link TƯƠNG ĐỐI
            imageUrl: makeAbsoluteUrl(item.poster_url, OPHIM_DOMAIN), // Xử lý link ảnh
            slug: item.slug
        }));
         console.log(`--- NGUONC: Tìm thấy ${movies.length} phim cho "${keyword}".`);
        res.json({
            movies,
            pagination: data.pagination // Dùng pagination trả về (nếu có)
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server khi tìm kiếm phim NguonC.', error: error.message });
    }
});


nguoncRouter.get('/details', async (req, res) => {
    const { movieSlug } = req.query; // Nhận slug từ App
    if (!movieSlug) return res.status(400).json({ message: 'Thiếu slug phim.' });
    try {
        // SỬA LỖI: Dùng đúng endpoint theo docs
        const data = await callNguonCApi(`/film/${movieSlug}`);
        // API này trả về `data.movie` và `data.episodes`
        const movie = data.movie;
        if (!movie) throw new Error("API không trả về thông tin phim.");

        console.log(`--- NGUONC DEBUG: Raw episodes data:`, JSON.stringify(data.episodes, null, 2));

        // SỬA LỖI: Phân tích cấu trúc episodes theo JSON bạn cung cấp
        const episodesByServer = (data.episodes || []).map(serverGroup => {
            console.log(`--- Processing server: ${serverGroup.server_name}, items:`, serverGroup.items?.length);
            return {
                server_name: serverGroup.server_name,
                // Đọc từ `serverGroup.items` thay vì `serverGroup.server_data`
                episodes: (serverGroup.items || []).map(ep => ({
                    name: ep.name,
                    // Đảm bảo link embed và m3u8 là tuyệt đối
                    link: makeAbsoluteUrl(ep.embed, OPHIM_DOMAIN),
                    direct_link_m3u8: makeAbsoluteUrl(ep.m3u8, OPHIM_DOMAIN)
                }))
            };
        });
        
        console.log(`--- NGUONC: Lấy thành công chi tiết phim "${movie.name}".`);
        console.log(`--- NGUONC: Số server: ${episodesByServer.length}`);
        episodesByServer.forEach((server, idx) => {
            console.log(`   Server ${idx}: ${server.server_name}, ${server.episodes.length} tập`);
        });
        
        res.json({
            title: movie.name,
            origin_title: movie.original_name, // Sửa tên field
            description: cheerio.load(movie.description || movie.content || '').text(), // Lấy description hoặc content
            // SỬA LỖI: Đảm bảo imageUrl là tuyệt đối
            imageUrl: makeAbsoluteUrl(movie.poster_url || movie.thumb_url, OPHIM_DOMAIN),
            episodes: episodesByServer
        });
    } catch (error) {
        console.error(`!!! NGUONC LỖI /details:`, error);
        res.status(500).json({ message: 'Lỗi server khi lấy chi tiết phim NguonC.', error: error.message });
    }
});


// SỬA LỖI: Loại bỏ hoàn toàn Puppeteer khỏi /api/nguonc/watch
nguoncRouter.get('/watch', async (req, res) => {
    let { episodeLink, direct_link_m3u8 } = req.query; // Nhận link TUYỆT ĐỐI từ App
    if (!episodeLink && !direct_link_m3u8) {
        return res.status(400).json({ message: 'Thiếu link xem phim (cả embed và m3u8).' });
    }
    console.log(`--- NGUONC: Nhận yêu cầu /watch (chỉ dùng Proxy) ---`);
    console.log(`   - Link Embed: ${episodeLink}`);
    console.log(`   - Link M3U8 trực tiếp: ${direct_link_m3u8}`);

    try {
        let finalVideoUrl;
        let refererNeeded;

        if (direct_link_m3u8) {
            console.log("1. Ưu tiên xử lý link M3U8 trực tiếp.");
            finalVideoUrl = direct_link_m3u8; // Link đã là tuyệt đối
            refererNeeded = episodeLink || OPHIM_DOMAIN + '/'; // Referer là link embed (tuyệt đối) hoặc domain gốc
        } else if (episodeLink) {
             console.error("!!! NGUONC: Chỉ có link embed, không có link m3u8 trực tiếp từ API details. Không thể tạo link proxy.");
             throw new Error("API NguonC không cung cấp link M3U8 trực tiếp cho tập này.");
        } else {
             throw new Error("Không có link nào để xử lý.");
        }

        if (!finalVideoUrl) {
             throw new Error("Không thể xác định được link video hợp lệ.");
        }

        // Tạo link proxy TUYỆT ĐỐI
        const protocol = req.protocol;
        const host = req.get('host');
        const videoProxyUrl = `${protocol}://${host}/api/proxy?videoUrl=${encodeURIComponent(finalVideoUrl)}&referer=${encodeURIComponent(refererNeeded)}`;

        console.log(`2. THÀNH CÔNG: Trả về link proxy cho TV (Referer: ${refererNeeded})`);
        res.json({
            videoUrl: videoProxyUrl,
            subtitleUrl: null // NguonC API không cung cấp link sub riêng
        });

    } catch (error) {
        console.error('!!! NGUONC LỖI tại /watch:', error.message);
        res.status(500).json({ message: 'Lỗi server khi lấy link xem phim NguonC.', error: error.message });
    }
});


// --- API PROXY (Dùng chung) ---
app.get('/api/proxy', async (req, res) => {
    const { videoUrl, referer } = req.query;
    if (!videoUrl || !referer) return res.status(400).send('Thiếu videoUrl hoặc referer');
    const decodedVideoUrl = decodeURIComponent(videoUrl);
    const decodedReferer = decodeURIComponent(referer);
    const requestType = decodedVideoUrl.includes('.m3u8') ? 'Playlist' : (decodedVideoUrl.includes('.vtt') ? 'Subtitle' : 'Segment');

    console.log(`--- PROXY (${requestType}): Nhận yêu cầu cho: ${decodedVideoUrl} (Referer: ${decodedReferer})`);
    try {
        const isText = requestType === 'Playlist' || requestType === 'Subtitle';
        const response = await axios({
            method: 'get',
            url: decodedVideoUrl,
            responseType: isText ? 'text' : 'stream',
            headers: {
                'Referer': decodedReferer,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Origin': new URL(decodedReferer).origin
            },
            timeout: 15000
        });

        if (requestType === 'Playlist') {
            const protocol = req.protocol;
            const host = req.get('host');
            const proxyBaseUrl = `${protocol}://${host}`;

            const baseUrl = decodedVideoUrl.substring(0, decodedVideoUrl.lastIndexOf('/') + 1);
            const modifiedPlaylist = response.data.split('\n').map(line => {
                line = line.trim();
                // Sửa link segment (.ts, ...)
                if (line && !line.startsWith('#')) {
                    const absoluteUrl = makeAbsoluteUrl(line, baseUrl); // Dùng helper function
                    return `${proxyBaseUrl}/api/proxy?videoUrl=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(decodedReferer)}`;
                }
                 // Sửa link key giải mã
                if (line.startsWith('#EXT-X-KEY')) {
                    const uriMatch = line.match(/URI="([^"]+)"/);
                    if (uriMatch && uriMatch[1]) {
                        const keyUri = uriMatch[1];
                        const absoluteKeyUri = makeAbsoluteUrl(keyUri, baseUrl); // Dùng helper function
                        const proxyKeyUri = `${proxyBaseUrl}/api/proxy?videoUrl=${encodeURIComponent(absoluteKeyUri)}&referer=${encodeURIComponent(decodedReferer)}`;
                        return line.replace(keyUri, proxyKeyUri);
                    }
                }
                return line;
            }).join('\n');
            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            res.send(modifiedPlaylist);
             console.log(`--- PROXY (Playlist): Đã gửi nội dung đã sửa đổi.`);

        } else if (requestType === 'Subtitle') {
            res.set('Content-Type', 'text/vtt');
            res.send(response.data);
            console.log("--- PROXY (Subtitle): Đã gửi file vtt.");

        } else { // Segment or other binary data
            res.set('Content-Type', response.headers['content-type'] || 'video/MP2T');
            response.data.pipe(res);
             console.log(`--- PROXY (Segment): Bắt đầu chuyển tiếp stream...`);
             response.data.on('end', () => console.log(`--- PROXY (Segment): Chuyển tiếp stream hoàn tất.`));
             response.data.on('error', (streamError) => console.error(`--- PROXY (Segment): Lỗi stream:`, streamError.message));
             res.on('close', () => {
                 console.log(`--- PROXY (Segment): Client đóng kết nối.`);
                 if (response.request?.abort) {
                     response.request.abort();
                     console.log(`--- PROXY (Segment): Đã hủy yêu cầu đến server video.`);
                 }
             });
             res.on('error', (resStreamError) => console.error(`--- PROXY (Segment): Lỗi gửi stream về client:`, resStreamError.message));
        }
    } catch (error) {
         const statusCode = error.response ? error.response.status : 500;
         const errorMessage = error.message;
        console.error(`--- PROXY (${requestType}): Lỗi ${statusCode} khi lấy ${decodedVideoUrl}:`, errorMessage);
        res.status(statusCode).send(`Lỗi proxy (${statusCode}): ${errorMessage}`);
    }
});


// --- Áp dụng các router ---
app.use('/api/rophim', rophimRouter);
app.use('/api/nguonc', nguoncRouter);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Using API Key: ${API_KEY}`);
  console.log(`RoPhim Base URL: ${ROPHIM_BASE_URL}`);
  console.log(`Ophim API URL: ${OPHIM_API_URL}`); // Log ra để kiểm tra
  console.log('Server is ready and listening for connections...');
});

