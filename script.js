






//Initializing localstorage
function initStorage() {
  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify({}));
  }
}

//storage helpers
function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || {};
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getCurrentUser() {
  return localStorage.getItem("currentUser");
}

function setCurrentUser(username) {
  localStorage.setItem("currentUser", username);
}

function clearCurrentUser() {
  localStorage.removeItem("currentUser");
}

//SPA Navigation
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.remove("hidden");

  localStorage.setItem("currentPage", pageId);

  if (pageId === "savedPage") {
    renderSavedArticles();
  }

  if (pageId === "newsPage") {
    loadNews(true); // reset feed when loading
  }

  if (pageId === "prefPage") {
    // Logic for preferences UI
  }
}

// Logic for auto-refresh
setInterval(() => {
  if (localStorage.getItem("currentPage") === "newsPage") {
    refreshNews();
  }
}, 300000); // 5 minutes

//login Authenticatoin
function register() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Please fill all fields");
    return;
  }

  let users = getUsers();
  if (users[username]) {
    alert("User already exists");
    return;
  }

  users[username] = {
    password: password,
    preferences: { category: "", keyword: "" },
    savedArticles: []
  };

  saveUsers(users);
  alert("Registration successful!");
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  let users = getUsers();

  if (!users[username] || users[username].password !== password) {
    alert("Invalid credentials");
    return;
  }

  setCurrentUser(username);
  showPage("newsPage");
}

function logout() {
  clearCurrentUser();
  showPage("authPage");
}

// News Fetching and Rendering and searching

const API_KEY = import.meta.env.VITE_NEWS_API_KEY;
let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentSearchQuery = ""

async function loadNews(reset = false, query = "") {
  const container = document.getElementById("news-articles-container");
  if (!container) return;

  if (reset) {
    currentPage = 1;
    hasMore = true;
    container.innerHTML = "";
    currentSearchQuery = query; // Updates the global search state
  }

  // --- Cache Logic ---
  const cacheKey = currentSearchQuery ? `search_${currentSearchQuery}` : "news_cache";
  const cacheExpiry = 60 * 60 * 1000; 
  const cachedData = JSON.parse(localStorage.getItem(cacheKey));

  if (!reset && cachedData && (Date.now() - cachedData.timestamp < cacheExpiry)) {
    console.log("Using cached results...");
    renderNews(cachedData.articles);
    return;
  }

  if (isLoading || !hasMore) return;
  isLoading = true;

  try {
    const user = getCurrentUser();
    const users = getUsers();
    const prefs = users[user]?.preferences || { category: "", keyword: "" };
    const savedArticles = users[user]?.savedArticles || [];

    // SWITCH ENDPOINT: If searching, use /everything. If not, use /top-headlines.
    let url = currentSearchQuery 
      ? `https://newsapi.org/v2/everything?q=${encodeURIComponent(currentSearchQuery)}&page=${currentPage}&pageSize=12&apiKey=${API_KEY}`
      : `https://newsapi.org/v2/top-headlines?country=us&category=${prefs.category || ''}&page=${currentPage}&pageSize=12&apiKey=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (res.status === 429) {
      alert("Rate limit reached. Try again in 24 hours.");
      return;
    }

    const articles = data.articles || [];

    if (articles.length === 0) {
      hasMore = false;
      if (reset) container.innerHTML = "<p class='col-span-full text-center py-10'>No results found.</p>";
      return;
    }

    articles.forEach(article => {
      article.relevance = scoreArticle(article, prefs, savedArticles);
    });

    articles.sort((a, b) => b.relevance - a.relevance);

    // Save to cache
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      articles: articles
    }));

    renderNews(articles);
    currentPage++;

  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    isLoading = false;
  }
}


function refreshNews() {
    loadNews(true);
}

// Renders news articles as cards with relevance badges and save buttons
function renderNews(articles) {
  const container = document.getElementById("news-articles-container");
  const currentUser = getCurrentUser();
  const users = getUsers();
  const savedArticles = users[currentUser]?.savedArticles || [];

  articles.forEach(article => {
    const isSaved = savedArticles.some(a => a.url === article.url);
    const relevance = article.relevance || 0;
    const badgeColor = relevance > 70 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition flex flex-col h-full w-full relative";
    
    card.innerHTML = `
      <div class="absolute top-2 left-2 ${badgeColor} px-2 py-1 rounded-md text-xs font-bold shadow-sm z-10">
        ${relevance}% Match
      </div>

      <img src="${article.urlToImage || 'https://placeholder.com'}" class="w-full h-48 object-cover">
      
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-lg mb-2 line-clamp-2">${article.title}</h3>
        <p class="text-sm text-gray-600 mb-4 line-clamp-3">${article.description || "No description available."}</p>
        
        <div class="mt-auto flex flex-col gap-3">
          <div class="flex justify-between items-center">
            <span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">${article.source.name}</span>
            <button class="save-btn text-2xl focus:outline-none">${isSaved ? '⭐' : '☆'}</button>
          </div>
          
          <!-- NEW: Read More Button -->
          <a href="${article.url}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
            Read Full Article
          </a>
        </div>
      </div>
    `;

    card.querySelector(".save-btn").onclick = () => toggleSaveArticle(article);
    container.appendChild(card);
  });
}



function renderSavedArticles() {
  const container = document.getElementById("saved-articles-container");
  container.innerHTML = "";
  
  const user = getCurrentUser();
  const users = getUsers();
  const articles = users[user]?.savedArticles || [];

  if (articles.length === 0) {
    container.innerHTML = `<p class="col-span-full text-center text-gray-500 py-10">No saved articles yet.</p>`;
    return;
  }

  articles.forEach(article => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-md overflow-hidden flex flex-col h-full w-full";
    card.innerHTML = `
      <img src="${article.urlToImage || 'https://via.placeholder.com/400x200'}" class="w-full h-48 object-cover">
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-lg mb-2 line-clamp-2">${article.title}</h3>
        <div class="mt-auto flex justify-between items-center">
          <span class="text-xs text-gray-500">${article.source.name}</span>
          <button class="remove-btn text-yellow-500 text-2xl">⭐</button>
        </div>
      </div>
    `;
    card.querySelector(".remove-btn").onclick = () => {
      toggleSaveArticle(article);
      renderSavedArticles();
    };
    container.appendChild(card);
  });
}

//Save or Delete  article from saved list
function toggleSaveArticle(article) {
  const username = getCurrentUser();
  if (!username) return;

  let users = getUsers();
  let saved = users[username].savedArticles || [];
  const index = saved.findIndex(a => a.url === article.url);

  if (index > -1) {
    saved.splice(index, 1);
  } else {
    saved.push(article);
  }

  users[username].savedArticles = saved;
  saveUsers(users);
  
  const currentPageId = localStorage.getItem("currentPage");
  if (currentPageId === "savedPage") renderSavedArticles();
  else refreshNews();
}

//Scoring algorithm to determine relevance of articles based on user preferences and saved articles
function scoreArticle(article, preferences, savedArticles) {
  let score = 0;
  const title = (article.title || "").toLowerCase();
  const desc = (article.description || "").toLowerCase();
  
  const keyword = (preferences.keyword || "").toLowerCase().trim();
  const category = (preferences.category || "").toLowerCase().trim();

  // 1. Keyword Match (up to 60%)
  if (keyword && keyword !== "") {
    if (title.includes(keyword)) score += 60;
    else if (desc.includes(keyword)) score += 30;
  }

  // 2. Category Match (up to 20%)
  if (category && category !== "") {
    if (title.includes(category) || desc.includes(category)) score += 20;
  }

  // 3. Saved Articles Interest (up to 20%)
  if (savedArticles.length > 0) {
    let matchCount = 0;
    // Check if current title contains words from saved titles
    savedArticles.slice(-10).forEach(saved => {
      const savedTitleWords = saved.title.toLowerCase().split(" ");
      // Check first two  words of saved titles
      const keyWords = savedTitleWords.filter(w => w.length > 4).slice(0, 2);
      keyWords.forEach(word => {
        if (title.includes(word)) matchCount++;
      });
    });
    score += Math.min(matchCount * 5, 20);
  }

  // Default baseline so cards aren't always 0%
  if (score === 0) score = Math.floor(Math.random() * 5) + 5; 

  return Math.min(score, 100);
}



// Infinite Scroll Listener


window.onscroll = () => {
  // Triggers when user is near the bottom of the page
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
    if (localStorage.getItem("currentPage") === "newsPage" && !isLoading && hasMore) {
      loadNews();
    }
  }
};

//Event listener for infinite scroll
window.addEventListener("scroll", () => {
  // Check if we are on the news page
  if (localStorage.getItem("currentPage") !== "newsPage") return;

  // Check if we're near the bottom of the page
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
    loadNews(); // This will fetch the next page
  }
});


const observer = new IntersectionObserver((entries) => {
  const entry = entries[0];

  console.log("Observer triggered:", entry.isIntersecting);

  if (
    entry.isIntersecting &&
    localStorage.getItem("currentPage") === "newsPage" &&
    !isLoading &&
    hasMore
  ) {
    console.log("Loading more news...");
    loadNews();
  }
}, {
  root: null,
  rootMargin: "200px",
  threshold: 0
});


function savePreferences() {
  const category = document.getElementById("prefCategory").value;
  const keyword = document.getElementById("prefKeyword").value;
  const user = getCurrentUser();
  if (!user) return;

  let users = getUsers();
  users[user].preferences = { category, keyword };
  saveUsers(users);
  
  alert("Preferences saved!");
  showPage("newsPage");
}

/* ================= EXPOSE FUNCTIONS TO HTML ================= */
// This allows onclick="" to work with type="module"
window.login = login;
window.register = register;
window.logout = logout;
window.showPage = showPage;
window.toggleSaveArticle = toggleSaveArticle;


//search listener
document.getElementById("search-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = document.getElementById("search-input").value.trim();
  loadNews(true, query); // Starts a fresh search
});

//infiniyte scroll listener
window.addEventListener("scroll", () => {
  if (localStorage.getItem("currentPage") !== "newsPage") return;
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
    loadNews(); // This will automatically use the currentSearchQuery
  }
});


// Global Init
initStorage();
