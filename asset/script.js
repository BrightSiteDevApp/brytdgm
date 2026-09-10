// =========================================
// 🚀 1. INITIALIZE SUPABASE
// =========================================
const SUPABASE_URL = 'https://ueaiwswzgzvkncjpxrxe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYWl3c3d6Z3p2a25janB4cnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzc3OTUsImV4cCI6MjA5MDgxMzc5NX0.CPDAZDwT80ft2w1GfpscK3Q7s0-a__x5mDEuG_kZKIE';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================
// 🛡️ SECURITY & UTILS
// =========================================
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}

function escapeJS(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// =========================================
// 🚀 2. UNIVERSAL SCROLL RESTORATION
// =========================================
window.addEventListener("beforeunload", () => {
    sessionStorage.setItem('scrollPos_' + window.location.pathname, window.scrollY);
});

function restorePageScroll() {
    const scrollY = sessionStorage.getItem('scrollPos_' + window.location.pathname);
    if (scrollY) {
        setTimeout(() => window.scrollTo(0, parseInt(scrollY)), 50);
    }
}

// =========================================
// 🚀 3. AUTHENTICATION & INITIALIZATION
// =========================================
async function requireLogin(targetUrl) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = targetUrl;
    } else {
        window.location.href = "login/index.html";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    // 🚀 Auto-update copyright year
    document.getElementById('current-year').textContent = new Date().getFullYear();

    setupSearch();
    setupExpandableFooter(); 
    checkGlobalBadges();
    fetchAdPopup(); 

    // Wait for all homepage widgets to load before attempting to restore scroll
    await Promise.all([
        fetchItems(),
        fetchVendors(),
        fetchReviews(),
        fetchBlogs()
    ]);
    
    restorePageScroll();
});

// =========================================
// 🚀 4. THE SMART BADGE CHECKER
// =========================================
async function checkGlobalBadges() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    try {
        const { data: chats } = await supabaseClient.from('chats')
            .select('customer_id, vendor_id, unread_by_customer, unread_by_vendor')
            .or(`customer_id.eq.${uid},vendor_id.eq.${uid}`);

        if (chats) {
            const hasUnreadMsg = chats.some(c => 
                (c.customer_id === uid && c.unread_by_customer === true) || 
                (c.vendor_id === uid && c.unread_by_vendor === true)
            );
            if (hasUnreadMsg) {
                document.querySelectorAll('.msg-dot').forEach(dot => dot.style.display = 'block');
            }
        }

        const lastClearedTime = new Date(localStorage.getItem('notifs_cleared_time') || '2000-01-01');
        const { data: notifs } = await supabaseClient.from('notifications')
            .select('user_id, is_read, created_at')
            .or(`user_id.eq.${uid},user_id.is.null`);
            
        if (notifs) {
            const hasUnreadNotif = notifs.some(n => {
                const notifTime = new Date(n.created_at);
                return (notifTime > lastClearedTime) && (n.is_read !== true);
            });

            if (hasUnreadNotif) {
                document.querySelectorAll('.notify-dot').forEach(dot => dot.style.display = 'block');
            }
        }
    } catch (e) { console.error("Badge check failed:", e); }
}

function setupSearch() {
    const searchInput = document.getElementById('main-search');
    const searchIcon = document.getElementById('search-btn-icon');

    if (!searchInput || !searchIcon) return;

    function executeSearch() {
        const query = searchInput.value.trim();
        if (query) window.location.href = `search/index.html?q=${encodeURIComponent(query)}`;
    }

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') executeSearch();
    });
    
    searchIcon.addEventListener('click', executeSearch);
}

// =========================================
// --- FETCH ITEMS (UPDATED DOM) ---
// =========================================
async function fetchItems() {
    const grid = document.getElementById('product-grid');
    if (!grid) return; 

    const cachedData = sessionStorage.getItem('home_items');
    let displayItems = [];

    if (cachedData) {
        displayItems = JSON.parse(cachedData);
    } else {
        try {
            const { data: products, error } = await supabaseClient.from('products').select('id, name, price, image_urls, category, is_pinned').eq('status', 'Active').order('is_pinned', { ascending: false }).limit(100);
            if (error) throw error;
            if (products.length === 0) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: var(--text-muted);">No items posted yet.</p>`; return; }

            const pinnedItems = products.filter(p => p.is_pinned === true);
            let unpinnedItems = shuffleArray(products.filter(p => p.is_pinned !== true));
            displayItems = [...pinnedItems, ...unpinnedItems].slice(0, 50);

            sessionStorage.setItem('home_items', JSON.stringify(displayItems));
        } catch (error) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: var(--cat-red-txt);">Failed to load items.</p>`; return; }
    }

    grid.innerHTML = ""; 
    displayItems.forEach(p => {
        const imgUrl = escapeHTML((p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : 'https://via.placeholder.com/300?text=No+Image');
        const formattedPrice = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p.price);
        
        // Polished premium badge
        const pinBadge = p.is_pinned ? `<div style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.65); color: white; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; backdrop-filter: blur(8px);">Featured</div>` : '';

        grid.insertAdjacentHTML('beforeend', `
            <div class="card" style="position: relative;" onclick="window.location.href='product/index.html?id=${escapeJS(p.id)}'">
                ${pinBadge}
                <img src="${imgUrl}" class="card-img" onerror="this.src='https://via.placeholder.com/300'">
                <div class="card-price">${formattedPrice}</div>
                <div>
                    <div class="card-title">${escapeHTML(p.name)}</div>
                    <div class="card-desc">${escapeHTML(p.category)}</div>
                </div>
            </div>
        `);
    });
}

// =========================================
// --- FETCH VENDORS (UPDATED DOM) ---
// =========================================
async function fetchVendors() {
    const grid = document.getElementById('vendor-grid');
    if (!grid) return;

    const cachedData = sessionStorage.getItem('home_vendors');
    let displayVendors = [];

    if (cachedData) {
        displayVendors = JSON.parse(cachedData);
    } else {
        try {
            const { data: vendors, error } = await supabaseClient.from('vendors').select('id, business_name, description, logo_url, subscription_plan, is_pinned').eq('is_active', true).order('is_pinned', { ascending: false }).limit(100);
            if (error) throw error;
            if (vendors.length === 0) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: var(--text-muted);">No vendors registered yet.</p>`; return; }

            const pinnedVendors = vendors.filter(v => v.is_pinned === true);
            let unpinnedVendors = shuffleArray(vendors.filter(v => v.is_pinned !== true));
            displayVendors = [...pinnedVendors, ...unpinnedVendors].slice(0, 30);

            sessionStorage.setItem('home_vendors', JSON.stringify(displayVendors));
        } catch (error) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: var(--cat-red-txt);">Failed to load vendors.</p>`; return; }
    }

    grid.innerHTML = "";
    displayVendors.forEach(v => {
        const logo = escapeHTML(v.logo_url || "https://via.placeholder.com/100");
        const nameTxt = escapeHTML(v.business_name ? v.business_name : 'Unknown');
        const descTxt = escapeHTML(v.description ? v.description.substring(0, 25) + '...' : 'Verified Seller');
        const pinBadge = v.is_pinned ? `<div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.65); color: #facc15; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; backdrop-filter: blur(8px); z-index: 10;"><i class="fas fa-thumbtack"></i></div>` : '';

        // Verification Badge colors leveraging CSS var mappings
        let badgeColor = "var(--brand-primary)"; 
        if (v.subscription_plan === "Influencer") badgeColor = "#f59e0b"; 
        if (v.subscription_plan === "Icon") badgeColor = "var(--text-main)"; 

        grid.insertAdjacentHTML('beforeend', `
            <div class="card center-align" style="position: relative;" onclick="window.location.href='vendors/profile/index.html?id=${escapeJS(v.id)}'">
                ${pinBadge}
                <img src="${logo}" style="width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px; flex-shrink: 0; object-fit: cover; background: var(--bg-input);" onerror="this.src='https://via.placeholder.com/100'">
                <div style="width: 100%; text-align: center;">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${nameTxt} <i class="fas fa-check-circle" style="color: ${badgeColor}; font-size: 12px; margin-left: 2px;"></i>
                    </div>
                    <div style="margin-top: 4px; font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${descTxt}</div>
                </div>
            </div>
        `);
    });
}

// =========================================
// --- FETCH REVIEWS (UPDATED DOM WITH FIX) ---
// =========================================
async function fetchReviews() {
    const slider = document.getElementById('reviews-slider');
    if(!slider) return;

    const cachedData = sessionStorage.getItem('home_reviews');
    let displayReviews = [];

    if (cachedData) {
        displayReviews = JSON.parse(cachedData);
    } else {
        try {
            const { data, error } = await supabaseClient.from('reviews').select('rating, review_text, legacy_name, legacy_avatar, profiles(full_name, avatar_url)').eq('status', 'approved').limit(20);
            if (error) throw error;
            if (data.length === 0) { slider.innerHTML = "<p style='padding:20px; color:var(--text-muted); font-size:13px;'>No reviews yet.</p>"; return; }
            
            displayReviews = shuffleArray(data).slice(0, 5);
            sessionStorage.setItem('home_reviews', JSON.stringify(displayReviews));
        } catch (error) { slider.innerHTML = "<p style='padding:20px; color:var(--cat-red-txt);'>Failed to load reviews.</p>"; return; }
    }

    slider.innerHTML = "";
    displayReviews.forEach(r => {
        const name = escapeHTML(r.profiles?.full_name || r.legacy_name || "Student");
        // FIX: Replaced fallback with a reliable web placeholder
        const avatar = escapeHTML(r.profiles?.avatar_url || r.legacy_avatar || "https://via.placeholder.com/100?text=User");
        const safeText = escapeHTML(r.review_text);
        
        // FIX: Added `this.onerror=null` to prevent infinite loading loops
        slider.insertAdjacentHTML('beforeend', `
            <div class="review-card">
                <div class="rev-header">
                    <img src="${avatar}" class="rev-img" onerror="this.onerror=null; this.src='https://via.placeholder.com/100?text=User';">
                    <div>
                        <div class="rev-name">${name} <i class="fas fa-check-circle" style="color: var(--cat-green-txt); font-size:11px;"></i></div>
                        <div class="rev-stars">${'<i class="fas fa-star"></i>'.repeat(r.rating)}</div>
                    </div>
                </div>
                <div class="rev-text">"${safeText}"</div>
            </div>
        `);
    });

    startReviewSlider();
}

function startReviewSlider() {
    const slider = document.getElementById('reviews-slider');
    if(!slider) return;
    
    setInterval(() => {
        const maxScroll = slider.scrollWidth - slider.clientWidth;
        if (slider.scrollLeft >= maxScroll - 10) {
            slider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            slider.scrollBy({ left: 280, behavior: 'smooth' });
        }
    }, 2500);
}

// =========================================
// --- FETCH BLOGS (UPDATED DOM) ---
// =========================================
async function fetchBlogs() {
    const list = document.getElementById('blog-list');
    if (!list) return;

    const cachedData = sessionStorage.getItem('home_blogs');
    let displayBlogs = [];

    if (cachedData) {
        displayBlogs = JSON.parse(cachedData);
    } else {
        try {
            const { data, error } = await supabaseClient.from('blogs').select('id, title, snippet, category, image_url, created_at').order('created_at', { ascending: false }).limit(5);
            if (error) throw error;
            if (data.length === 0) { list.innerHTML = "<p style='text-align:center; color:var(--text-muted); font-size:13px;'>No news updates yet.</p>"; return; }
            
            displayBlogs = data;
            sessionStorage.setItem('home_blogs', JSON.stringify(displayBlogs));
        } catch (error) { list.innerHTML = "<p style='text-align:center; color:var(--cat-red-txt);'>Failed to load news.</p>"; return; }
    }

    list.innerHTML = "";
    displayBlogs.forEach(b => {
        const imgUrl = escapeHTML(b.image_url || 'https://via.placeholder.com/100');
        const postDate = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const niceSlug = createSlug(b.title) + '--' + b.id;

        list.insertAdjacentHTML('beforeend', `
            <div class="blog-card" onclick="window.location.href='blog-content/index.html?post=${encodeURIComponent(niceSlug)}'">
                <img src="${imgUrl}" class="blog-img" onerror="this.src='https://via.placeholder.com/100'">
                <div class="blog-info">
                    <div class="blog-cat-row">
                        <div class="blog-cat">${escapeHTML(b.category || 'News')}</div>
                        <div class="blog-date">${postDate}</div>
                    </div>
                    <div class="blog-title">${escapeHTML(b.title)}</div>
                    <div class="blog-desc">${escapeHTML(b.snippet)}</div>
                </div>
            </div>
        `);
    });
}

function createSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// =========================================
// --- FETCH AD POPUP (UPDATED MODAL LOGIC) ---
// =========================================
async function fetchAdPopup() {
    try {
        const { data, error } = await supabaseClient.from('ads').select('*').eq('is_active', true);
        if (error || !data || data.length === 0) return;

        const randomAd = data[Math.floor(Math.random() * data.length)];

        document.getElementById('ad-title').innerText = randomAd.title;
        document.getElementById('ad-content').innerText = randomAd.content;
        
        const adBtn = document.getElementById('ad-btn');
        if(randomAd.button_text) adBtn.innerText = randomAd.button_text;
        adBtn.href = randomAd.button_link || "#";

        const adImg = document.getElementById('ad-image');
        if (randomAd.image_url) {
            adImg.src = escapeHTML(randomAd.image_url);
            adImg.classList.remove('hidden');
        } else {
            adImg.classList.add('hidden');
        }

        setTimeout(() => {
            const popup = document.getElementById('ad-popup');
            if (popup) popup.classList.remove('hidden');
        }, 1500);
        
    } catch (err) { console.error("Ad fetch error:", err); }
}

// =========================================
// 🚀 UI: EXPANDABLE FOOTER
// =========================================
function setupExpandableFooter() {
    const footer = document.getElementById('main-app-footer');
    const toggleBtn = document.getElementById('footer-expand-btn');
    const arrowIcon = document.getElementById('footer-arrow-icon');

    if(!footer || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        if(footer.classList.contains('collapsed')) {
            footer.classList.remove('collapsed');
            footer.classList.add('expanded');
            arrowIcon.classList.remove('fa-chevron-down');
            arrowIcon.classList.add('fa-chevron-up'); 
        } else {
            footer.classList.remove('expanded');
            footer.classList.add('collapsed');
            arrowIcon.classList.remove('fa-chevron-up');
            arrowIcon.classList.add('fa-chevron-down'); 
        }
    });
}

// =========================================
// 🚀 PWA INSTALLATION LOGIC (UPDATED UI)
// =========================================
let deferredPrompt;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker Registered Successfully!'))
            .catch(err => console.log('Service Worker Registration Failed', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

window.downloadApp = async function() {
    if (isIOS) {
        const iosPopup = document.getElementById('ios-install-popup');
        if (iosPopup) {
            iosPopup.classList.remove('hidden');
        } else {
            alert("To install BRYT DGM on iOS:\n\n1. Tap the 'Share' icon at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.");
        }
    } else if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('PWA Installed!');
        }
        deferredPrompt = null;
    } else {
        alert("The app is already installed on your device or your current browser doesn't support automatic installation.");
    }
};

// =========================================
// 🌙 GLOBAL DARK MODE LOGIC (UPDATED BTN UI)
// =========================================
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

document.addEventListener("DOMContentLoaded", () => {
    const headerTop = document.querySelector('.header-top');
    
    if (headerTop) {
        const themeBtn = document.createElement('button');
        themeBtn.className = "theme-toggle-btn";
        
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        themeBtn.onclick = function() {
            const darkModeActive = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', darkModeActive ? 'dark' : 'light');
            themeBtn.innerHTML = darkModeActive ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        };
        
        const notifyIcon = document.querySelector('.notify-icon-container');
        if (notifyIcon) {
            headerTop.insertBefore(themeBtn, notifyIcon);
        } else {
            headerTop.appendChild(themeBtn);
        }
    }
});

// =========================================
// 🚀 EMERGENCY SERVICE WORKER KILL SWITCH
// =========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            if(registration.active.scriptURL.includes('wrong-sw.js')) {
                registration.unregister();
            }
        }
    });
}