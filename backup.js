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

  // 🔥 Auto-load news after login
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

  // Loading state
  container.innerHTML = "<p>Loading news...</p>";

  try {
    const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    console.log("FULL API RESPONSE:", data);
    console.log("FIRST ARTICLE:", data.articles[0]);

    renderNews(data.articles || []);

  } catch (err) {
    console.error("Error fetching news:", err);
    container.innerHTML = "<p class='text-red-500'>Failed to load news.</p>";
  }
}

/* ================= RENDER NEWS ================= */
function renderNews(articles) {
  const container = document.getElementById("news-articles-container");

  container.innerHTML = "";

  if (articles.length === 0) {
    container.innerHTML = "<p>No articles found.</p>";
    return;
  }

  articles.forEach(article => {
    const div = document.createElement("div");

    div.className = "bg-white p-4 shadow rounded";

    div.innerHTML = `
      <h3 class="font-bold mb-2">${article.title}</h3>
      <p class="text-sm text-gray-600 mb-2">
        ${article.description || "No description available"}
      </p>
      <a href="${article.url}" target="_blank" class="text-blue-500 underline">
        Read more
      </a>
    `;

    container.appendChild(div);
    div.innerHTML = `
  <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition flex flex-col h-full">

    <!-- IMAGE -->
    <img 
      src="${article.urlToImage || 'https://via.placeholder.com/400x200?text=No+Image'}" 
      class="w-full h-48 object-cover"
    />

    <!-- CONTENT -->
    <div class="p-4 flex flex-col flex-grow">

      <!-- TITLE -->
      <h3 class="font-bold text-lg mb-2 line-clamp-2">
        ${article.title}
      </h3>

      <!-- DESCRIPTION -->
      <p class="text-sm text-gray-600 mb-3 line-clamp-3">
        ${article.description || "No description available"}
      </p>

      <!-- SPACER -->
      <div class="flex-grow"></div>

      <!-- META -->
      <div class="text-xs text-gray-500 mb-2 flex justify-between">
        <span>${article.source?.name || "Unknown"}</span>
        <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
      </div>

      <!-- ACTIONS -->
      <div class="flex justify-between items-center">

        <!-- SCORE BADGE (placeholder for now) -->
        <span class="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded">
          🔥 80%
        </span>

        <!-- SAVE BUTTON -->
        <button class="text-yellow-500 hover:scale-110 transition">
          ⭐
        </button>

      </div>

    </div>

  </div>
`;
  });

  
}

/* ================= INIT APP ================= */
window.onload = function () {
  initStorage();

  const user = getCurrentUser();

  if (user) {
    showPage("newsPage");
    loadNews(); // auto-load if already logged in
  } else {
    showPage("authPage");
  }
};