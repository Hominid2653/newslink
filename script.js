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
  // FIX 1: Auth guard — any protected page redirects to authPage if not logged in
  const protectedPages = ["newsPage", "savedPage", "prefPage"];
  if (protectedPages.includes(pageId) && !getCurrentUser()) {
    pageId = "authPage";
  }

  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.remove("hidden");

  localStorage.setItem("currentPage", pageId);

  if (pageId === "savedPage") renderSavedArticles();

  if (pageId === "newsPage") {
    const container = document.getElementById("news-articles-container");
    if (!container || container.children.length === 0) {
      loadNews(true);
    }
    renderPreferences();
  }

  if (pageId === "prefPage") {
    renderPrefList();
  }
}

// ================= AUTH =================
// FIX 2: Passwords are encoded with btoa before storing — not cryptographic
// but prevents plain-text exposure in localStorage for an assignment context
function encodePassword(password) {
  return btoa(password);
}

function register() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) return alert("Fill all fields");

  let users = getUsers();

  if (users[username]) return alert("User exists");

  users[username] = {
    password: encodePassword(password),
    preferences: [],  // array of { category, keyword } objects
    savedArticles: []
  };

  saveUsers(users);
  alert("Registered!");
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  let users = getUsers();

  if (!users[username] || users[username].password !== encodePassword(password)) {
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
// Preferences are stored as an array of { category, keyword } objects,
// allowing the user to build and manage multiple feed filters independently.

// Migration: upgrade legacy single-object preferences to array format
function migratePreferences() {
  const users = getUsers();
  let changed = false;
  Object.keys(users).forEach(username => {
    const prefs = users[username].preferences;
    if (prefs && !Array.isArray(prefs)) {
      const hasData = prefs.category || prefs.keyword;
      users[username].preferences = hasData
        ? [{ category: prefs.category || "", keyword: prefs.keyword || "" }]
        : [];
      changed = true;
    }
    if (!users[username].preferences) {
      users[username].preferences = [];
      changed = true;
    }
  });
  if (changed) saveUsers(users);
}

function savePreferences() {
  const user = getCurrentUser();
  if (!user) return alert("Not logged in");

  const category = document.getElementById("prefCategory").value.trim();
  const keyword = document.getElementById("prefKeyword").value.trim();

  if (!category && !keyword) return alert("Enter at least a category or keyword.");

  let users = getUsers();
  const prefs = users[user].preferences;

  const isDuplicate = prefs.some(p => p.category === category && p.keyword === keyword);
  if (isDuplicate) return alert("This preference already exists.");

  prefs.push({ category, keyword });
  saveUsers(users);

  document.getElementById("prefCategory").value = "";
  document.getElementById("prefKeyword").value = "";

  renderPrefList();
  renderPreferences();
}

function deletePreference(index) {
  const user = getCurrentUser();
  let users = getUsers();
  users[user].preferences.splice(index, 1);
  saveUsers(users);
  renderPrefList();
  renderPreferences();
}

// Renders the manageable preference list on the Preferences page
function renderPrefList() {
  const container = document.getElementById("pref-list");
  if (!container) return;

  const user = getCurrentUser();
  const users = getUsers();
  const prefs = users[user]?.preferences || [];

  container.innerHTML = "";

  if (!prefs.length) {
    container.innerHTML = `<p class="text-sm text-gray-400 italic">No preferences added yet.</p>`;
    return;
  }

  prefs.forEach((pref, index) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between bg-gray-50 border rounded-lg px-4 py-2";

    const tags = [];
    if (pref.category) tags.push(`<span class="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">📁 ${pref.category}</span>`);
    if (pref.keyword)  tags.push(`<span class="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">🔑 ${pref.keyword}</span>`);

    row.innerHTML = `
      <div class="flex gap-2 flex-wrap">${tags.join("")}</div>
      <button class="delete-pref-btn text-red-400 hover:text-red-600 text-lg ml-4 transition-colors" title="Remove">✕</button>
    `;

    row.querySelector(".delete-pref-btn").addEventListener("click", () => deletePreference(index));
    container.appendChild(row);
  });
}

// Renders the compact preference summary on the News page sidebar
function renderPreferences() {
  const list = document.getElementById("current-preferences");
  if (!list) return;

  const user = getCurrentUser();
  const users = getUsers();
  const prefs = users[user]?.preferences || [];

  list.innerHTML = "";

  if (!prefs.length) {
    list.innerHTML = `<li class="text-gray-400 italic">No preferences set</li>`;
    return;
  }

  prefs.forEach(pref => {
    const li = document.createElement("li");
    const parts = [];
    if (pref.category) parts.push(`Category: ${pref.category}`);
    if (pref.keyword)  parts.push(`Keyword: ${pref.keyword}`);
    li.textContent = parts.join(" · ");
    list.appendChild(li);
  });
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

const PLACEHOLDER_IMG = "https://placehold.co/400x200?text=No+Image"; // FIX 3: via.placeholder.com is dead

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

  // FIX 6: Show a loading spinner while fetching
  const spinner = document.createElement("div");
  spinner.id = "news-spinner";
  spinner.className = "col-span-full flex justify-center items-center py-10";
  spinner.innerHTML = `
    <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <span class="ml-3 text-gray-500 text-sm">Loading articles…</span>
  `;
  container.appendChild(spinner);

  try {
    const user = getCurrentUser();
    const users = getUsers();
    const prefs = users[user]?.preferences || [];  // array of { category, keyword }
    const savedArticles = users[user]?.savedArticles || [];

    // Merge all keywords and categories across preferences into comma-separated values
    const allKeywords = [...new Set(prefs.map(p => p.keyword).filter(Boolean))];
    const allCategories = [...new Set(prefs.map(p => p.category).filter(Boolean))];

    let searchQuery = currentSearchQuery || allKeywords.join(" ") || "";

    let url = `https://newsdata.io/api/1/news?apikey=${API_KEY}`;

    if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
    if (allCategories.length) url += `&category=${allCategories.join(",")}`;
    if (nextPageToken) url += `&page=${nextPageToken}`;

    const res = await fetch(url);
    const data = await res.json();

    const articles = data.results || [];

    if (articles.length === 0) {
      hasMore = false;
      // FIX 7: Show a user-facing message when no results come back
      if (reset) {
        container.innerHTML = `
          <p class="col-span-full text-center text-gray-500 py-10">
            No articles found. Try a different search or preference.
          </p>
        `;
      }
      return;
    }

    nextPageToken = data.nextPage || null;
    if (!nextPageToken) hasMore = false;

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
    // FIX 7: Surface fetch errors to the user instead of silently failing
    console.error("Fetch error:", err);
    if (reset) {
      container.innerHTML = `
        <p class="col-span-full text-center text-red-500 py-10">
          ⚠️ Failed to load articles. Check your connection and try again.
        </p>
      `;
    }
  } finally {
    isLoading = false;
    // Always remove spinner when done
    document.getElementById("news-spinner")?.remove();
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

      <img src="${article.urlToImage || PLACEHOLDER_IMG}"
           onerror="this.src='${PLACEHOLDER_IMG}'"
           class="w-full h-48 object-cover">

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

      <img src="${article.urlToImage || PLACEHOLDER_IMG}"
           onerror="this.src='${PLACEHOLDER_IMG}'"
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
function toggleSaveArticle(article, cardEl) {
  const user = getCurrentUser();
  let users = getUsers();

  let saved = users[user].savedArticles || [];
  const index = saved.findIndex(a => a.url === article.url);

  if (index > -1) {
    saved.splice(index, 1);
  } else {
    // FIX 4: Strip the stale relevance score before persisting —
    // it's computed at render time and shouldn't be frozen into storage
    const { relevance, ...articleToSave } = article;
    saved.push(articleToSave);
  }

  users[user].savedArticles = saved;
  saveUsers(users);

  // Update just the star button on the card without re-fetching
  const isSaved = index === -1;
  const btn = cardEl?.querySelector(".save-btn");
  if (btn) btn.textContent = isSaved ? "⭐" : "☆";
}

// ================= SCORING =================
function scoreArticle(article, preferences, savedArticles) {
  let score = 0;

  const title = (article.title || "").toLowerCase();
  const desc = (article.description || "").toLowerCase();

  // Score against every preference entry in the array
  preferences.forEach(pref => {
    const keyword  = (pref.keyword  || "").toLowerCase();
    const category = (pref.category || "").toLowerCase();

    if (keyword) {
      if (title.includes(keyword)) score += 60;
      else if (desc.includes(keyword)) score += 30;
    }

    if (category && (title.includes(category) || desc.includes(category))) {
      score += 20;
    }
  });

  savedArticles.slice(-10).forEach(saved => {
    saved.title.toLowerCase().split(" ").slice(0, 2).forEach(word => {
      if (title.includes(word)) score += 5;
    });
  });

  return Math.min(score || 5, 100);
}

// ================= INFINITE SCROLL =================
window.addEventListener("scroll", () => {
  // FIX 5: Check the DOM directly rather than relying on localStorage —
  // avoids the race window where currentPage is stale during tab switches
  const newsPage = document.getElementById("newsPage");
  if (!newsPage || newsPage.classList.contains("hidden")) return;

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
window.deletePreference = deletePreference;
window.refreshNews = refreshNews;
window.handleSearch = handleSearch;

// ================= INIT =================
initStorage();
migratePreferences(); // upgrade any legacy single-object preferences to array format