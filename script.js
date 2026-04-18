// ================= INIT STORAGE =================
function initStorage() {
  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify({}));
  }
}

// ================= STORAGE HELPERS =================
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

// ================= SPA NAV =================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.remove("hidden");

  localStorage.setItem("currentPage", pageId);

  if (pageId === "savedPage") renderSavedArticles();

  // FIX: only fetch fresh news when explicitly navigating to newsPage
  // and only if the container is empty (avoids re-fetch on every tab switch)
  if (pageId === "newsPage") {
    const container = document.getElementById("news-articles-container");
    if (!container || container.children.length === 0) {
      loadNews(true);
    }
    renderPreferences();
  }
}

// ================= AUTH =================
function register() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) return alert("Fill all fields");

  let users = getUsers();

  if (users[username]) return alert("User exists");

  users[username] = {
    password,
    preferences: { category: "", keyword: "" },
    savedArticles: []
  };

  saveUsers(users);
  alert("Registered!");
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  let users = getUsers();

  if (!users[username] || users[username].password !== password) {
    return alert("Invalid login");
  }

  setCurrentUser(username);
  showPage("newsPage");
}

function logout() {
  clearCurrentUser();
  showPage("authPage");
}

// ================= PREFERENCES =================
// FIX: function was referenced in HTML but never defined
function savePreferences() {
  const user = getCurrentUser();
  if (!user) return alert("Not logged in");

  const category = document.getElementById("prefCategory").value.trim();
  const keyword = document.getElementById("prefKeyword").value.trim();

  let users = getUsers();
  users[user].preferences = { category, keyword };
  saveUsers(users);

  alert("Preferences saved!");
  renderPreferences();
}

function renderPreferences() {
  const list = document.getElementById("current-preferences");
  if (!list) return;

  const user = getCurrentUser();
  const users = getUsers();
  const prefs = users[user]?.preferences || {};

  list.innerHTML = "";

  if (!prefs.category && !prefs.keyword) {
    list.innerHTML = `<li class="text-gray-400 italic">No preferences set</li>`;
    return;
  }

  if (prefs.category) {
    const li = document.createElement("li");
    li.textContent = `Category: ${prefs.category}`;
    list.appendChild(li);
  }
  if (prefs.keyword) {
    const li = document.createElement("li");
    li.textContent = `Keyword: ${prefs.keyword}`;
    list.appendChild(li);
  }
}

// ================= SEARCH =================
// FIX: search was wired to a <form> submit that caused page reload;
// now handled via handleSearch() called by a plain button onclick
function handleSearch() {
  const query = document.getElementById("search-input").value.trim();
  loadNews(true, query);
}

// ================= NEWS ENGINE =================
const API_KEY = "pub_198996087b1e4c98b6eb271bfb7ebfbb";

let isLoading = false;
let hasMore = true;
let nextPageToken = null;
let currentSearchQuery = "";

async function loadNews(reset = false, query = "") {
  const container = document.getElementById("news-articles-container");
  if (!container) return;

  if (reset) {
    nextPageToken = null;
    hasMore = true;
    container.innerHTML = "";
    currentSearchQuery = query;
  }

  if (isLoading || !hasMore) return;
  isLoading = true;

  try {
    const user = getCurrentUser();
    const users = getUsers();
    const prefs = users[user]?.preferences || {};
    const savedArticles = users[user]?.savedArticles || [];

    let searchQuery = currentSearchQuery || prefs.keyword || "";

    let url = `https://newsdata.io/api/1/news?apikey=${API_KEY}`;

    if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
    if (prefs.category) url += `&category=${prefs.category}`;
    if (nextPageToken) url += `&page=${nextPageToken}`;

    const res = await fetch(url);
    const data = await res.json();

    const articles = data.results || [];

    if (articles.length === 0) {
      hasMore = false;
      return;
    }

    nextPageToken = data.nextPage || null;
    if (!nextPageToken) hasMore = false;

    // Normalize API response
    const normalized = articles.map(a => ({
      title: a.title,
      description: a.description,
      url: a.link,
      urlToImage: a.image_url,
      source: { name: a.source_id },
      publishedAt: a.pubDate
    }));

    normalized.forEach(article => {
      article.relevance = scoreArticle(article, prefs, savedArticles);
    });

    normalized.sort((a, b) => b.relevance - a.relevance);

    renderNews(normalized);

  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    isLoading = false;
  }
}

function refreshNews() {
  loadNews(true);
}

// ================= RENDER NEWS =================
function renderNews(articles) {
  const container = document.getElementById("news-articles-container");

  const user = getCurrentUser();
  const users = getUsers();
  const savedArticles = users[user]?.savedArticles || [];

  articles.forEach(article => {
    const isSaved = savedArticles.some(a => a.url === article.url);
    const relevance = article.relevance || 0;

    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-md hover:shadow-lg flex flex-col overflow-hidden relative";

    card.innerHTML = `
      <div class="absolute top-2 left-2 bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded">
        ${relevance}% Match
      </div>

      <img src="${article.urlToImage || 'https://via.placeholder.com/400x200'}" class="w-full h-48 object-cover">

      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-lg mb-2 line-clamp-2">${article.title}</h3>
        <p class="text-sm text-gray-600 mb-4 line-clamp-3">${article.description || ""}</p>

        <div class="mt-auto flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-500">${article.source.name}</span>
            <button class="save-btn text-xl">${isSaved ? "⭐" : "☆"}</button>
          </div>

          <a href="${article.url}" target="_blank"
             class="bg-blue-600 text-white text-center py-2 rounded hover:bg-blue-700">
             Read Article
          </a>
        </div>
      </div>
    `;

    // FIX: event listener attached directly to the element reference,
    // not via inline onclick string — avoids scope issues with module scripts
    card.querySelector(".save-btn").addEventListener("click", () => toggleSaveArticle(article, card));

    container.appendChild(card);
  });
}

// ================= SAVED =================
function renderSavedArticles() {
  const container = document.getElementById("saved-articles-container");
  container.innerHTML = "";

  const user = getCurrentUser();
  const users = getUsers();
  const articles = users[user]?.savedArticles || [];

  if (!articles.length) {
    container.innerHTML = `
      <p class="col-span-full text-center text-gray-500 py-10">
        No saved articles yet ⭐
      </p>
    `;
    return;
  }

  articles.forEach(article => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow-md hover:shadow-lg flex flex-col overflow-hidden relative";

    card.innerHTML = `
      <div class="absolute top-2 left-2 bg-green-100 text-green-700 px-2 py-1 text-xs rounded">
        Saved
      </div>

      <img src="${article.urlToImage || 'https://via.placeholder.com/400x200'}"
           class="w-full h-48 object-cover">

      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-lg mb-2 line-clamp-2">
          ${article.title}
        </h3>

        <p class="text-sm text-gray-600 mb-4 line-clamp-3">
          ${article.description || ""}
        </p>

        <div class="mt-auto flex flex-col gap-2">
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-500">
              ${article.source?.name || "Unknown"}
            </span>

            <button class="remove-btn text-xl text-yellow-500">
              ⭐
            </button>
          </div>

          <a href="${article.url}" target="_blank"
             class="bg-blue-600 text-white text-center py-2 rounded hover:bg-blue-700">
             Read Article
          </a>
        </div>
      </div>
    `;

    // FIX: same pattern — addEventListener instead of .onclick assignment
    card.querySelector(".remove-btn").addEventListener("click", () => {
      toggleSaveArticle(article, card);
      renderSavedArticles();
    });

    container.appendChild(card);
  });
}

// ================= SAVE =================
// FIX: removed refreshNews() call — that was re-fetching from the API
// unnecessarily. Instead we just update the button state in-place.
function toggleSaveArticle(article, cardEl) {
  const user = getCurrentUser();
  let users = getUsers();

  let saved = users[user].savedArticles || [];
  const index = saved.findIndex(a => a.url === article.url);

  if (index > -1) {
    saved.splice(index, 1);
  } else {
    saved.push(article);
  }

  users[user].savedArticles = saved;
  saveUsers(users);

  // Update just the star button on the card without re-fetching
  const isSaved = index === -1; // if it wasn't saved before, it is now
  const btn = cardEl?.querySelector(".save-btn");
  if (btn) btn.textContent = isSaved ? "⭐" : "☆";
}

// ================= SCORING =================
function scoreArticle(article, preferences, savedArticles) {
  let score = 0;

  const title = (article.title || "").toLowerCase();
  const desc = (article.description || "").toLowerCase();

  const keyword = (preferences.keyword || "").toLowerCase();
  const category = (preferences.category || "").toLowerCase();

  if (keyword) {
    if (title.includes(keyword)) score += 60;
    else if (desc.includes(keyword)) score += 30;
  }

  if (category && (title.includes(category) || desc.includes(category))) {
    score += 20;
  }

  savedArticles.slice(-10).forEach(saved => {
    saved.title.toLowerCase().split(" ").slice(0, 2).forEach(word => {
      if (title.includes(word)) score += 5;
    });
  });

  return Math.min(score || 5, 100);
}

// ================= INFINITE SCROLL =================
window.addEventListener("scroll", () => {
  if (localStorage.getItem("currentPage") !== "newsPage") return;

  if (
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
    !isLoading &&
    hasMore
  ) {
    loadNews();
  }
});

// ================= EXPOSE FUNCTIONS TO HTML =================
// FIX: all functions called via inline onclick in HTML must be on window.
// Since this file uses type="module", they are NOT global by default.
window.login = login;
window.register = register;
window.logout = logout;
window.showPage = showPage;
window.toggleSaveArticle = toggleSaveArticle;
window.savePreferences = savePreferences;
window.refreshNews = refreshNews;
window.handleSearch = handleSearch;

// ================= INIT =================
initStorage();