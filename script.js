// initialising local storage
function initStorage() {
  if (!localStorage.getItem("users")) {
    localStorage.setItem("users", JSON.stringify({}));
  }
}

// Storage helpers
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

// Navigation
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
    renderCategoryPicker();
    renderPrefList();
  }
}

// Auth
// Passwords are encoded with btoa before storing 

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

// Preferences
// All 18 categories supported by newsdata.io — hardcoded-from docs
const CATEGORIES = [
  { value: "business",       label: "Business",       emoji: "💼" },
  { value: "crime",          label: "Crime",           emoji: "🔍" },
  { value: "domestic",       label: "Domestic",        emoji: "🏠" },
  { value: "education",      label: "Education",       emoji: "🎓" },
  { value: "entertainment",  label: "Entertainment",   emoji: "🎬" },
  { value: "environment",    label: "Environment",     emoji: "🌿" },
  { value: "food",           label: "Food",            emoji: "🍽️" },
  { value: "health",         label: "Health",          emoji: "❤️" },
  { value: "lifestyle",      label: "Lifestyle",       emoji: "✨" },
  { value: "other",          label: "Other",           emoji: "📦" },
  { value: "politics",       label: "Politics",        emoji: "🏛️" },
  { value: "science",        label: "Science",         emoji: "🔬" },
  { value: "sports",         label: "Sports",          emoji: "⚽" },
  { value: "technology",     label: "Technology",      emoji: "💻" },
  { value: "top",            label: "Top Stories",     emoji: "🔥" },
  { value: "tourism",        label: "Tourism",         emoji: "✈️" },
  { value: "world",          label: "World",           emoji: "🌍" },
  { value: "general",        label: "General",         emoji: "📰" },
];

// Tracks which category tag is currently selected in the picker
let selectedCategory = "";

function renderCategoryPicker() {
  const container = document.getElementById("category-tag-picker");
  if (!container) return;

  container.innerHTML = "";
  selectedCategory = ""; // reset on each render
  document.getElementById("prefCategory").value = "";

  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.value = cat.value;
    btn.className = [
      "category-tag px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
      "border-gray-200 bg-gray-50 text-gray-600",
      "hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700"
    ].join(" ");
    btn.innerHTML = `${cat.emoji} ${cat.label}`;

    btn.addEventListener("click", () => {
      // Deselect if already selected, otherwise select this one
      if (selectedCategory === cat.value) {
        selectedCategory = "";
        document.getElementById("prefCategory").value = "";
      } else {
        selectedCategory = cat.value;
        document.getElementById("prefCategory").value = cat.value;
      }
      // Update visual state of all tags
      container.querySelectorAll(".category-tag").forEach(b => {
        const isSelected = b.dataset.value === selectedCategory;
        b.className = [
          "category-tag px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
          isSelected
            ? "border-purple-500 bg-purple-600 text-white shadow-sm"
            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700"
        ].join(" ");
      });
    });

    container.appendChild(btn);
  });
}

// Preferences are stored as an array of { category, keyword } objects,
// allowing the user to build and manage multiple feed filters independently.

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
  // Reset the tag picker visual state
  selectedCategory = "";
  document.querySelectorAll(".category-tag").forEach(btn => {
    btn.className = "category-tag px-3 py-1.5 rounded-full text-sm font-medium border transition-all border-gray-200 bg-gray-50 text-gray-600 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700";
  });

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

// Renders the preference list on the Preferences page
function renderPrefList() {
  const container = document.getElementById("pref-list");
  if (!container) return;

  const user = getCurrentUser();
  const users = getUsers();
  const prefs = users[user]?.preferences || [];

  // Update count badge
  const countEl = document.getElementById("pref-count");
  if (countEl) countEl.textContent = prefs.length;

  container.innerHTML = "";

  if (!prefs.length) {
    container.innerHTML = `
      <div class="flex flex-col items-center py-6 text-gray-400">
        <span class="text-3xl mb-2">🗂️</span>
        <p class="text-sm italic">No preferences added yet.</p>
        <p class="text-xs mt-1">Add a category or keyword above to personalise your feed.</p>
      </div>
    `;
    return;
  }

  prefs.forEach((pref, index) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 group";

    const tags = [];
    if (pref.category) {
      // Look up the emoji label for the category value
      const catMeta = CATEGORIES.find(c => c.value === pref.category);
      const label = catMeta ? `${catMeta.emoji} ${catMeta.label}` : pref.category;
      tags.push(`<span class="bg-purple-100 text-purple-700 text-xs font-medium px-3 py-1 rounded-full">${label}</span>`);
    }
    if (pref.keyword) {
      tags.push(`<span class="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">🔑 ${pref.keyword}</span>`);
    }

    row.innerHTML = `
      <div class="flex gap-2 flex-wrap">${tags.join("")}</div>
      <button class="delete-pref-btn opacity-40 group-hover:opacity-100 hover:text-red-500 text-gray-400 text-sm ml-4 transition-all font-bold" title="Remove preference">✕</button>
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

// Searching
function handleSearch() {
  const query = document.getElementById("search-input").value.trim();
  loadNews(true, query);
}

// News engine
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

  // Show a loading spinner while fetching
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

    // Merge all keywords and categories across preferences into csv
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
      // Show a feedback when no results come back
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
    // Surface fetch errors to the user instead of silently failing
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
    // Removing spinner after fetching
    document.getElementById("news-spinner")?.remove();
  }
}

function refreshNews() {
  loadNews(true);
}

// Render news articles on the News page, called after fetching and scoring
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

    
    card.querySelector(".save-btn").addEventListener("click", () => toggleSaveArticle(article, card));

    container.appendChild(card);
  });
}

// Saved articles page
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

    card.querySelector(".remove-btn").addEventListener("click", () => {
      toggleSaveArticle(article, card);
      renderSavedArticles();
    });

    container.appendChild(card);
  });
}

// Saveing articles
function toggleSaveArticle(article, cardEl) {
  const user = getCurrentUser();
  let users = getUsers();

  let saved = users[user].savedArticles || [];
  const index = saved.findIndex(a => a.url === article.url);

  if (index > -1) {
    saved.splice(index, 1);
  } else {
    
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

// Scoring
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

// infinite scroller
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

// exposing functions to html for oclicks
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