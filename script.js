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

  document.getElementById(pageId).classList.remove("hidden");

  if (pageId === "savedPage") {
    renderSavedArticles();
  }

  if (pageId === "newsPage") {
    loadNews();
  }
}

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
    preferences: {
      category: "",
      keyword: ""
    },
    savedArticles: []
  };

  saveUsers(users);

  alert("Registration successful!");
}

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  let users = getUsers();

  if (!users[username]) {
    alert("User not found");
    return;
  }

  if (users[username].password !== password) {
    alert("Incorrect password");
    return;
  }

  setCurrentUser(username);
  showPage("newsPage");

  loadNews();
}

function logout() {
  clearCurrentUser();
  showPage("authPage");
}

/* ================= PREFERENCES ================= */
function savePreferences() {
  const category = document.getElementById("prefCategory").value;
  const keyword = document.getElementById("prefKeyword").value;

  let users = getUsers();
  const user = getCurrentUser();

  if (!user) return;

  users[user].preferences = {
    category,
    keyword
  };

  saveUsers(users);

  alert("Preferences saved!");
}

/* ================= NEWS API ================= */
const API_KEY = "fcde91c2e5ba40878f79b4539f54c930";

async function loadNews() {
  const container = document.getElementById("news-articles-container");
  container.innerHTML = "<p>Loading news...</p>";

  try {
    const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    renderNews(data.articles || []);

  } catch (err) {
    console.error("Error fetching news:", err);
    container.innerHTML = "<p class='text-red-500'>Failed to load news.</p>";
  }
}

/* ================= SAVE SYSTEM ================= */
function isArticleSaved(article) {
  const user = getCurrentUser();
  let users = getUsers();

  if (!user) return false;

  return users[user].savedArticles.some(a => a.url === article.url);
}

function toggleSaveArticle(article) {
  const user = getCurrentUser();
  let users = getUsers();

  if (!user) return;

  let saved = users[user].savedArticles;

  const index = saved.findIndex(a => a.url === article.url);

  if (index > -1) {
    saved.splice(index, 1);
  } else {
    saved.push(article);
  }

  saveUsers(users);

  // refresh UI
  loadNews();
}

function getSavedArticles() {
  const user = getCurrentUser();
  let users = getUsers();

  if (!user) return [];

  return users[user].savedArticles || [];
}

function renderSavedArticles() {
  const container = document.getElementById("saved-articles-container");
  container.innerHTML = "";

  const articles = getSavedArticles();

  if (articles.length === 0) {
    container.innerHTML = `
      <p class="text-center text-gray-500 mt-10">
        No saved articles yet ⭐
      </p>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  articles.forEach(article => {
    const div = document.createElement("div");

    const saved = true; // always true here

    div.innerHTML = `
      <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition flex flex-col h-full">

        <img 
          src="${article.urlToImage || 'https://via.placeholder.com/400x200?text=No+Image'}" 
          class="w-full h-48 object-cover"
        />

        <div class="p-4 flex flex-col flex-grow">

          <h3 class="font-bold text-lg mb-2 line-clamp-2">
            ${article.title}
          </h3>

          <p class="text-sm text-gray-600 mb-3 line-clamp-3">
            ${article.description || "No description available"}
          </p>

          <div class="flex-grow"></div>

          <div class="text-xs text-gray-500 mb-2 flex justify-between">
            <span>${article.source?.name || "Unknown"}</span>
            <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
          </div>

          <div class="flex justify-between items-center">

            <span class="text-xs text-gray-400">
              Saved
            </span>

            <button class="remove-btn text-yellow-500 text-xl">
              ⭐
            </button>

          </div>

        </div>

      </div>
    `;

    const btn = div.querySelector(".remove-btn");
    btn.onclick = () => {
      toggleSaveArticle(article);
      renderSavedArticles(); // refresh saved page
    };

    grid.appendChild(div);
  });

  container.appendChild(grid);
}

/* ================= SCORING ================= */
function scoreArticle(article, preferences = {}) {
  let score = 0;

  const keyword = preferences.keyword?.toLowerCase();

  if (keyword) {
    if (article.title?.toLowerCase().includes(keyword)) score += 50;
    if (article.description?.toLowerCase().includes(keyword)) score += 30;
  }

  const publishedDate = new Date(article.publishedAt);
  const now = new Date();
  const hoursDiff = (now - publishedDate) / (1000 * 60 * 60);

  if (hoursDiff < 24) score += 20;

  return Math.min(score, 100);
}

/* ================= RENDER NEWS ================= */
function renderNews(articles) {
  const container = document.getElementById("news-articles-container");
  container.innerHTML = "";

  if (articles.length === 0) {
    container.innerHTML = "<p>No articles found.</p>";
    return;
  }

  const user = getCurrentUser();
  const users = getUsers();
  const prefs = users[user]?.preferences || {};

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  articles.forEach(article => {
    const div = document.createElement("div");

    const score = scoreArticle(article, prefs);
    const saved = isArticleSaved(article);

    div.innerHTML = `
      <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition flex flex-col h-full">

        <img 
          src="${article.urlToImage || 'https://via.placeholder.com/400x200?text=No+Image'}" 
          class="w-full h-48 object-cover"
        />

        <div class="p-4 flex flex-col flex-grow">

          <h3 class="font-bold text-lg mb-2 line-clamp-2">
            ${article.title}
          </h3>

          <p class="text-sm text-gray-600 mb-3 line-clamp-3">
            ${article.description || "No description available"}
          </p>

          <div class="flex-grow"></div>

          <div class="text-xs text-gray-500 mb-2 flex justify-between">
            <span>${article.source?.name || "Unknown"}</span>
            <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
          </div>

          <div class="flex justify-between items-center">

            <span class="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded">
              🔥 ${score}%
            </span>

            <button class="save-btn text-xl ${
              saved ? "text-yellow-500" : "text-gray-400"
            }">
              ${saved ? "⭐" : "☆"}
            </button>

          </div>

        </div>

      </div>
    `;

    const btn = div.querySelector(".save-btn");
    btn.onclick = () => toggleSaveArticle(article);

    grid.appendChild(div);
  });

  container.appendChild(grid);
}

/* ================= INIT APP ================= */
window.onload = function () {
  initStorage();

  const user = getCurrentUser();

  if (user) {
    showPage("newsPage");
    loadNews();
  } else {
    showPage("authPage");
  }
};