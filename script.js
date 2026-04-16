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

  // 🔥 Instantly apply preferences
  loadNews();

  alert("Preferences saved!");
}

/* ================= NEWS API ================= */
const API_KEY = "fcde91c2e5ba40878f79b4539f54c930";

async function loadNews() {
  const container = document.getElementById("news-articles-container");
  container.innerHTML = "<p>Loading news...</p>";

  try {
    const user = getCurrentUser();
    const users = getUsers();
    const prefs = users[user]?.preferences || {};

    let url = "";

    // 🔥 If keyword exists → use EVERYTHING search
    if (prefs.keyword) {
      url = `https://newsapi.org/v2/everything?q=${prefs.keyword}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`;
    } 
    // 📰 If category exists → use top-headlines category
    else if (prefs.category) {
      url = `https://newsapi.org/v2/top-headlines?country=us&category=${prefs.category}&pageSize=10&apiKey=${API_KEY}`;
    } 
    // 🌍 Default fallback
    else {
      url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${API_KEY}`;
    }

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

/* ================= ADVANCED SCORING ================= */
function scoreArticle(article, preferences = {}, savedArticles = []) {
  let score = 0;

  const title = article.title?.toLowerCase() || "";
  const desc = article.description?.toLowerCase() || "";

  const keyword = preferences.keyword?.toLowerCase();
  const category = preferences.category?.toLowerCase();

  // 🔥 1. Keyword Match (STRONG)
  if (keyword) {
    if (title.includes(keyword)) score += 40;
    if (desc.includes(keyword)) score += 30;
  }

  // 📰 2. Category Match
  if (category) {
    if (title.includes(category)) score += 25;
    if (desc.includes(category)) score += 15;
  }

  // ⭐ 3. Similar to Saved Articles (VERY POWERFUL)
  savedArticles.forEach(saved => {
    const savedTitle = saved.title?.toLowerCase() || "";

    // basic similarity: shared words
    const words = savedTitle.split(" ");
    words.forEach(word => {
      if (word.length > 4 && title.includes(word)) {
        score += 2;
      }
    });
  });

  // ⏱ 4. Freshness
  const hoursDiff = (new Date() - new Date(article.publishedAt)) / (1000 * 60 * 60);

  if (hoursDiff < 12) score += 20;
  else if (hoursDiff < 24) score += 15;
  else if (hoursDiff < 72) score += 5;

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
  const saved = users[user]?.savedArticles || [];

  // 🧠 Score all articles
  const scoredArticles = articles.map(article => ({
    ...article,
    score: scoreArticle(article, prefs, saved)
  }));

  // 🔥 Sort by score
  scoredArticles.sort((a, b) => b.score - a.score);

  // 🎯 Split
  const recommended = scoredArticles.slice(0, 4);
  const others = scoredArticles.slice(4);

  // ===== RECOMMENDED SECTION =====
  const recTitle = document.createElement("h2");
  recTitle.className = "text-xl font-bold mb-4";
  recTitle.textContent = "🎯 Recommended For You";
  container.appendChild(recTitle);

  container.appendChild(createGrid(recommended, prefs, saved));

  // ===== ALL NEWS =====
  const allTitle = document.createElement("h2");
  allTitle.className = "text-xl font-bold mt-8 mb-4";
  allTitle.textContent = "📰 More News";
  container.appendChild(allTitle);

  container.appendChild(createGrid(others, prefs, saved));
}

function createGrid(articles, prefs, savedArticles) {
  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  articles.forEach(article => {
    const div = document.createElement("div");

    const score = scoreArticle(article, prefs, savedArticles);
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

    div.querySelector(".save-btn").onclick = () => toggleSaveArticle(article);

    grid.appendChild(div);
  });

  return grid;
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