(() => {
  "use strict";

  // ---------- storage ----------
  const KEY = "spark.v1";
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const yesterdayKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const defaultState = () => ({
    theme: "dark",
    habits: [], // {id, name, streak, lastDone}
    tasks: [],  // {id, name, done}
    tasksDate: todayKey(),
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = { ...defaultState(), ...JSON.parse(raw) };
      // Reset tasks each new day, keep habits.
      if (s.tasksDate !== todayKey()) {
        s.tasks = [];
        s.tasksDate = todayKey();
      }
      return s;
    } catch {
      return defaultState();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  let state = load();
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---------- elements ----------
  const $ = (id) => document.getElementById(id);
  const habitList = $("habitList");
  const taskList = $("taskList");
  const habitsEmpty = $("habitsEmpty");
  const tasksEmpty = $("tasksEmpty");
  const ringFg = $("ringFg");
  const ringPct = $("ringPct");
  const ringSub = $("ringSub");
  const RING_LEN = 2 * Math.PI * 52;

  // ---------- helpers ----------
  function haptic() {
    if (navigator.vibrate) navigator.vibrate(10);
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
  }

  const checkSVG = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;

  // ---------- rendering ----------
  function render() {
    renderHabits();
    renderTasks();
    renderRing();
    save();
  }

  function renderHabits() {
    habitList.innerHTML = "";
    habitsEmpty.classList.toggle("hidden", state.habits.length > 0);
    state.habits.forEach((h) => {
      const done = h.lastDone === todayKey();
      const li = document.createElement("li");
      li.className = "item" + (done ? " done" : "");
      li.innerHTML = `
        <button class="check ${done ? "done" : ""}" aria-label="Toggle">${checkSVG}</button>
        <div class="item-body">
          <div class="item-name"></div>
          <div class="item-meta">
            <span class="streak">🔥 ${h.streak} day${h.streak === 1 ? "" : "s"}</span>
          </div>
        </div>
        <button class="del" aria-label="Delete">✕</button>`;
      li.querySelector(".item-name").textContent = h.name;
      li.querySelector(".check").addEventListener("click", () => toggleHabit(h.id));
      li.querySelector(".del").addEventListener("click", () => removeHabit(h.id));
      habitList.appendChild(li);
    });
  }

  function renderTasks() {
    taskList.innerHTML = "";
    tasksEmpty.classList.toggle("hidden", state.tasks.length > 0);
    state.tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "item" + (t.done ? " done" : "");
      li.innerHTML = `
        <button class="check ${t.done ? "done" : ""}" aria-label="Toggle">${checkSVG}</button>
        <div class="item-body"><div class="item-name"></div></div>
        <button class="del" aria-label="Delete">✕</button>`;
      li.querySelector(".item-name").textContent = t.name;
      li.querySelector(".check").addEventListener("click", () => toggleTask(t.id));
      li.querySelector(".del").addEventListener("click", () => removeTask(t.id));
      taskList.appendChild(li);
    });
  }

  function renderRing() {
    // Progress = habits done today + tasks done, over total items.
    const totalHabits = state.habits.length;
    const doneHabits = state.habits.filter((h) => h.lastDone === todayKey()).length;
    const totalTasks = state.tasks.length;
    const doneTasks = state.tasks.filter((t) => t.done).length;
    const total = totalHabits + totalTasks;
    const done = doneHabits + doneTasks;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    ringFg.style.strokeDasharray = RING_LEN;
    ringFg.style.strokeDashoffset = RING_LEN * (1 - pct / 100);
    ringPct.textContent = pct + "%";
    ringSub.textContent = total === 0 ? "add to begin" : `${done}/${total} done today`;
  }

  // ---------- habit actions ----------
  function toggleHabit(id) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    haptic();
    if (h.lastDone === todayKey()) {
      // Undo today's completion.
      h.lastDone = null;
      h.streak = Math.max(0, h.streak - 1);
    } else {
      // Continue streak if last done was yesterday, else restart at 1.
      h.streak = h.lastDone === yesterdayKey() ? h.streak + 1 : 1;
      h.lastDone = todayKey();
      if (h.streak > 1) toast(`🔥 ${h.streak} day streak!`);
    }
    render();
  }

  function addHabit(name) {
    state.habits.push({ id: uid(), name, streak: 0, lastDone: null });
    render();
  }

  function removeHabit(id) {
    state.habits = state.habits.filter((h) => h.id !== id);
    render();
  }

  // ---------- task actions ----------
  function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    haptic();
    t.done = !t.done;
    if (t.done) toast("Nice — one down ✅");
    render();
  }

  function addTask(name) {
    state.tasks.push({ id: uid(), name, done: false });
    render();
  }

  function removeTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    render();
  }

  // ---------- forms ----------
  $("habitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("habitInput");
    const v = input.value.trim();
    if (!v) return;
    addHabit(v);
    input.value = "";
  });

  $("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("taskInput");
    const v = input.value.trim();
    if (!v) return;
    addTask(v);
    input.value = "";
  });

  // ---------- tabs ----------
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.tab;
      $("habitsView").classList.toggle("active", which === "habits");
      $("tasksView").classList.toggle("active", which === "tasks");
    });
  });

  // ---------- theme ----------
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    $("themeToggle").textContent = state.theme === "dark" ? "🌙" : "☀️";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "dark" ? "#0b0f1a" : "#f4f6fc");
  }
  $("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    save();
    haptic();
  });

  // ---------- date label ----------
  $("todayLabel").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // ---------- install hint (iOS Safari) ----------
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  if (isIos && !standalone) $("installHint").classList.remove("hidden");

  // ---------- service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ---------- seed first-run demo data ----------
  if (state.habits.length === 0 && !localStorage.getItem(KEY)) {
    addHabit("Drink water 💧");
    addHabit("Move 20 min 🏃");
  }

  applyTheme();
  render();
})();
