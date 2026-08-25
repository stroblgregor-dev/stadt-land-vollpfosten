(() => {
  "use strict";

  const STORAGE_KEY = "slv.categories.v1";
  const VOICE_STORAGE_KEY = "slv.voice.v1";

  const DEFAULT_CATEGORIES = [
    "Stadt", "Land", "Fluss", "Vorname", "Tier", "Beruf", "Pflanze", "Farbe",
    "Automarke", "Chemisches Element", "Krankheit", "Politiker", "Frisur",
    "Wetter", "Promi (Sportler oder Schauspieler)", "Berühmte tote Person",
    "Scheidungsgrund", "Kleidungsstück", "Etwas mit 4 Beinen",
    "Tier im Wasser", "Tier an Land", "Tier in der Luft", "Superheld",
    "Musikinstrument", "Schimpfwort", "Etwas größer als ein Haus",
    "Etwas kleiner als ein Fußball", "Filmtitel", "Getränk",
    "Süßigkeit", "Sportart", "Comicfigur", "Faule Ausrede",
    "Kosename für den Partner", "Etwas im Kühlschrank",
    "Ort, an dem man sich blamieren kann", "Band oder Musikgruppe",
    "Märchenfigur", "Etwas, das man nicht verlieren sollte", "Beruf im Mittelalter"
  ];

  /* ---------- state ---------- */

  let categories = loadCategories();
  let roundOrder = [];
  let roundIndex = 0;

  /* ---------- storage ---------- */

  function loadCategories() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* ignore corrupt storage */ }
    saveCategories(DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES.slice();
  }

  function saveCategories(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function persist() {
    saveCategories(categories);
  }

  /* ---------- tabs ---------- */

  const tabGameBtn = document.getElementById("tabGameBtn");
  const tabSettingsBtn = document.getElementById("tabSettingsBtn");
  const gameView = document.getElementById("gameView");
  const settingsView = document.getElementById("settingsView");

  function showView(name) {
    const isGame = name === "game";
    gameView.classList.toggle("active", isGame);
    settingsView.classList.toggle("active", !isGame);
    tabGameBtn.classList.toggle("active", isGame);
    tabSettingsBtn.classList.toggle("active", !isGame);
    if (!isGame) stopRound({ silent: true });
  }

  tabGameBtn.addEventListener("click", () => showView("game"));
  tabSettingsBtn.addEventListener("click", () => showView("settings"));

  /* ---------- settings view ---------- */

  const categoryListEl = document.getElementById("categoryList");
  const categoryCountEl = document.getElementById("categoryCount");
  const settingsEmptyHint = document.getElementById("settingsEmptyHint");
  const addForm = document.getElementById("addForm");
  const newCategoryInput = document.getElementById("newCategoryInput");

  function renderCategoryList() {
    categoryListEl.innerHTML = "";
    settingsEmptyHint.classList.toggle("hidden", categories.length > 0);
    categories.forEach((name, idx) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = name;
      const btn = document.createElement("button");
      btn.className = "delete-btn";
      btn.setAttribute("aria-label", "Kategorie löschen");
      btn.textContent = "✕";
      btn.addEventListener("click", () => removeCategory(idx));
      li.appendChild(span);
      li.appendChild(btn);
      categoryListEl.appendChild(li);
    });
    categoryCountEl.textContent = String(categories.length);
  }

  function addCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = categories.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast("Diese Kategorie gibt es schon");
      return;
    }
    categories.push(trimmed);
    persist();
    renderCategoryList();
    showToast("Kategorie hinzugefügt");
  }

  function removeCategory(idx) {
    categories.splice(idx, 1);
    persist();
    renderCategoryList();
  }

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addCategory(newCategoryInput.value);
    newCategoryInput.value = "";
    newCategoryInput.focus();
  });

  /* ---------- toast ---------- */

  const toastEl = document.getElementById("toast");
  let toastTimer = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 1800);
  }

  /* ---------- speech ---------- */

  const voiceSelect = document.getElementById("voiceSelect");
  const voiceTestBtn = document.getElementById("voiceTestBtn");

  let selectedVoiceKey = localStorage.getItem(VOICE_STORAGE_KEY) || "";

  function voiceKey(voice) {
    return `${voice.name}|${voice.lang}`;
  }

  function populateVoices() {
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    const german = voices.filter(v => v.lang.toLowerCase().startsWith("de"));
    const others = voices.filter(v => !v.lang.toLowerCase().startsWith("de"));
    const ordered = german.concat(others);

    voiceSelect.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Standard (Deutsch)";
    voiceSelect.appendChild(defaultOpt);

    ordered.forEach((voice) => {
      const opt = document.createElement("option");
      opt.value = voiceKey(voice);
      opt.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(opt);
    });

    const stillExists = ordered.some(v => voiceKey(v) === selectedVoiceKey);
    voiceSelect.value = stillExists ? selectedVoiceKey : "";
  }

  function getSelectedVoice() {
    if (!selectedVoiceKey || !("speechSynthesis" in window)) return null;
    return window.speechSynthesis.getVoices().find(v => voiceKey(v) === selectedVoiceKey) || null;
  }

  voiceSelect.addEventListener("change", () => {
    selectedVoiceKey = voiceSelect.value;
    localStorage.setItem(VOICE_STORAGE_KEY, selectedVoiceKey);
  });

  voiceTestBtn.addEventListener("click", () => {
    speak("So klingt diese Stimme. Zum Beispiel: Automarke.");
  });

  if ("speechSynthesis" in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = getSelectedVoice();
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = "de-DE";
      }
      utter.rate = 0.95;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }

  /* ---------- game view ---------- */

  const idleState = document.getElementById("idleState");
  const playState = document.getElementById("playState");
  const finishedState = document.getElementById("finishedState");
  const startBtn = document.getElementById("startBtn");
  const nextBtn = document.getElementById("nextBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const stopBtn = document.getElementById("stopBtn");
  const restartBtn = document.getElementById("restartBtn");
  const roundNumberEl = document.getElementById("roundNumber");
  const roundTotalEl = document.getElementById("roundTotal");
  const roundDotsEl = document.getElementById("roundDots");
  const speakStatus = document.getElementById("speakStatus");

  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function setState(which) {
    idleState.classList.toggle("hidden", which !== "idle");
    playState.classList.toggle("hidden", which !== "play");
    finishedState.classList.toggle("hidden", which !== "finished");
  }

  function renderDots() {
    roundDotsEl.innerHTML = "";
    roundOrder.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot";
      if (i < roundIndex) dot.classList.add("done");
      if (i === roundIndex) dot.classList.add("current");
      roundDotsEl.appendChild(dot);
    });
  }

  function startGame() {
    if (categories.length === 0) {
      showToast("Füge zuerst Kategorien hinzu");
      showView("settings");
      return;
    }
    roundOrder = shuffledCopy(categories);
    roundIndex = 0;
    roundTotalEl.textContent = String(roundOrder.length);
    setState("play");
    announceCurrent();
  }

  function announceCurrent() {
    roundNumberEl.textContent = String(roundIndex + 1);
    renderDots();
    speakStatus.textContent = "Kategorie wird vorgelesen …";
    speak(roundOrder[roundIndex]).then(() => {
      speakStatus.textContent = "Bereit – wenn beide fertig sind: Weiter";
    });
  }

  function nextRound() {
    roundIndex++;
    if (roundIndex >= roundOrder.length) {
      window.speechSynthesis && window.speechSynthesis.cancel();
      setState("finished");
      return;
    }
    announceCurrent();
  }

  function repeatCurrent() {
    speakStatus.textContent = "Kategorie wird vorgelesen …";
    speak(roundOrder[roundIndex]).then(() => {
      speakStatus.textContent = "Bereit – wenn beide fertig sind: Weiter";
    });
  }

  function stopRound({ silent } = {}) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
    if (!silent) showToast("Spiel beendet");
  }

  startBtn.addEventListener("click", startGame);
  nextBtn.addEventListener("click", nextRound);
  repeatBtn.addEventListener("click", repeatCurrent);
  stopBtn.addEventListener("click", () => stopRound());
  restartBtn.addEventListener("click", startGame);

  /* ---------- init ---------- */

  renderCategoryList();
  setState("idle");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
