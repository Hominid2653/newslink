/* ================= INIT STORAGE ================= */
function initStorage() {
  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify({}));
  }
}

/* ================= STORAGE HELPERS ================= */
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

/* ================= SPA NAV ================= */
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

/* ================= AUTH ================= */
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

/* ================= NEWS ENGINE ================= */
const API_KEY = "fcde91c2e5ba40878f79b4539f54c930";
let currentPage = 1;
let isLoading = false;
let hasMore = true;

async function loadNews(reset = false) {
  const container = document.getElementById("news-articles-container");
  if (!container) return;

  if (reset) {
    currentPage = 1;
    hasMore = true;
    container.innerHTML = "";
  }

  if (isLoading || !hasMore) return;
  isLoading = true;

  try {
    const user = getCurrentUser();
    const users = getUsers();
    const prefs = users[user]?.preferences || {};
    const savedArticles = users[user]?.savedArticles || [];

    let url = prefs.keyword 
      ? `https://newsapi.org/v2/everything?q=${prefs.keyword}&page=${currentPage}&pageSize=12&apiKey=${API_KEY}`
      : `https://newsapi.org/v2/top-headlines?country=us&category=${prefs.category || ''}&page=${currentPage}&pageSize=12&apiKey=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();
    const articles = data.articles || [];

    if (articles.length === 0) {
      hasMore = false;
      return;
    }

    // Restore Advanced Scoring Logic
    articles.sort((a, b) => scoreArticle(b, prefs, savedArticles) - scoreArticle(a, prefs, savedArticles));

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

/* ================= RENDERING (FIXED LAYOUT) ================= */
function renderNews(articles) {
  const container = document.getElementById("news-articles-container");
  const currentUser = getCurrentUser();
  const users = getUsers();
  const savedArticles = users[currentUser]?.savedArticles || [];

  articles.forEach(article => {
    const isSaved = savedArticles.some(a => a.url === article.url);
    
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition flex flex-col h-full w-full";
    
    card.innerHTML = `
      <img src="${article.urlToImage || 'https://placeholder.com'}" class="w-full h-48 object-cover">
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-lg mb-2 line-clamp-2">${article.title}</h3>
        <p class="text-sm text-gray-600 mb-4 line-clamp-3">${article.description || "No description available."}</p>
        <div class="mt-auto flex justify-between items-center">
          <span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">${article.source.name}</span>
          <button class="save-btn text-2xl focus:outline-none">${isSaved ? '⭐' : '☆'}</button>
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

/* ================= SAVE SYSTEM ================= */
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

/* ================= SCORING LOGIC ================= */
function scoreArticle(article, preferences, savedArticles) {
  let score = 0;
  const title = (article.title || "").toLowerCase();
  const desc = (article.description || "").toLowerCase();
  const keyword = (preferences.keyword || "").toLowerCase();

  if (keyword) {
    if (title.includes(keyword)) score += 40;
    if (desc.includes(keyword)) score += 20;
  }

  // Learned interests from saved articles
  savedArticles.forEach(saved => {
    const words = saved.title.split(" ").slice(0, 2);
    words.forEach(word => {
      if (word.length > 3 && title.includes(word.toLowerCase())) score += 5;
    });
  });

  return score;
}

/* ================= INFINITE SCROLL ================= */
window.onscroll = () => {
  // Triggers when user is near the bottom of the page
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
    if (localStorage.getItem("currentPage") === "newsPage" && !isLoading && hasMore) {
      loadNews();
    }
  }
};

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

// Global Init
initStorage();
