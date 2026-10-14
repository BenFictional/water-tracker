// ---------- Config ----------
const TARGET_OZ = 96;    // daily goal
const INCREMENT_OZ = 8;  // oz added per button press

const STORAGE_KEY = 'water-tracker';
const WEEK_DAYS = 7;
const GOAL_MSG_MS = 3000; // how long "Goal reached!" stays visible
const RIPPLE_COUNT = 3;
const RIPPLE_STAGGER_MS = 220;
const GLASS_WAVE_DELAY_MS = 220; // wait for the ripples before the glasses wave
const GLASS_WAVE_STAGGER_MS = 70;

// ---------- Elements ----------
const glassesEl = document.getElementById('glasses');
const glassTpl = document.getElementById('glassTpl');
const drinkBtn = document.getElementById('drinkBtn');
const drinkWrap = document.getElementById('drinkWrap');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const goalMsg = document.getElementById('goalMsg');
const totalEl = document.getElementById('totalOz');
const targetEl = document.getElementById('targetOz');
const waterLevel = document.getElementById('waterLevel');
const streakEl = document.getElementById('streak');
const weekRow = document.getElementById('weekRow');

const glassCount = Math.ceil(TARGET_OZ / INCREMENT_OZ);

// ---------- Storage ----------
// Data is stored per calendar day: { "2026-10-13": 24, ... }

function dateKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function todayKey() {
  return dateKey(new Date());
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage full or unavailable; the app still works for this session.
  }
}

let history = loadHistory();
let day = todayKey();
let total = history[day] || 0;

function setTotal(next, renderOpts) {
  total = Math.max(0, next);
  history[day] = total;
  saveHistory(history);
  render(renderOpts);
}

// ---------- Goal history ----------
// Pass/fail is judged against the current TARGET_OZ.

function metGoal(daysBack) {
  return (history[dateKey(daysAgo(daysBack))] || 0) >= TARGET_OZ;
}

// Consecutive days meeting the goal. Today only counts once it's met,
// so an unfinished today doesn't break yesterday's streak.
function getStreak() {
  let streak = 0;
  for (let i = metGoal(0) ? 0 : 1; metGoal(i); i++) streak++;
  return streak;
}

// ---------- Render ----------

function buildGlasses() {
  for (let i = 0; i < glassCount; i++) {
    glassesEl.appendChild(glassTpl.content.firstElementChild.cloneNode(true));
  }
}

function render({ pop = false } = {}) {
  const filled = Math.min(glassCount, Math.floor(total / INCREMENT_OZ));

  [...glassesEl.children].forEach((glass, i) => {
    const isFull = i < filled;
    const justFilled = pop && i === filled - 1;
    glass.classList.toggle('is-full', isFull);
    if (justFilled) {
      glass.classList.add('is-pop');
      setTimeout(() => glass.classList.remove('is-pop'), 250);
    }
  });

  glassesEl.setAttribute('aria-label', `${filled} of ${glassCount} glasses`);
  totalEl.textContent = total;
  waterLevel.style.setProperty('--progress', Math.min(1, total / TARGET_OZ));
  document.body.classList.toggle('is-goal', total >= TARGET_OZ);
  undoBtn.disabled = total === 0;
  resetBtn.disabled = total === 0;

  renderStreak();
  renderWeek();
}

function renderStreak() {
  const streak = getStreak();
  streakEl.textContent = streak ? `${streak}-day streak` : 'Start a streak today';
}

function renderWeek() {
  const items = [];
  for (let i = 0; i < WEEK_DAYS; i++) {
    const date = daysAgo(i);
    const oz = history[dateKey(date)] || 0;
    const pass = oz >= TARGET_OZ;
    const isToday = i === 0;

    const li = document.createElement('li');
    li.className = 'day';
    li.classList.toggle('is-pass', pass);
    li.classList.toggle('is-today', isToday);

    const name = isToday ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' });
    const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const status = pass ? 'goal met' : isToday ? 'in progress' : 'goal missed';
    li.setAttribute('aria-label', `${name}, ${dateLabel}: ${oz} oz, ${status}`);

    li.innerHTML = `
      <span class="day__name">${name}</span>
      <span class="day__date">${dateLabel}</span>
      <span class="day__oz">${oz} oz</span>`;
    li.insertBefore(glassTpl.content.firstElementChild.cloneNode(true), li.lastElementChild);
    items.push(li);
  }
  weekRow.replaceChildren(...items);
}

let goalMsgTimer;

function showGoalMessage() {
  goalMsg.textContent = 'Goal reached!';
  goalMsg.classList.add('is-visible');
  clearTimeout(goalMsgTimer);
  goalMsgTimer = setTimeout(() => goalMsg.classList.remove('is-visible'), GOAL_MSG_MS);
}

function celebrate() {
  showGoalMessage();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Ripple rings, inserted behind the button so it paints on top
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const ring = document.createElement('span');
    ring.className = 'ripple';
    ring.style.animationDelay = `${i * RIPPLE_STAGGER_MS}ms`;
    ring.addEventListener('animationend', () => ring.remove());
    drinkWrap.prepend(ring);
  }

  // Stadium wave across the glasses row
  [...glassesEl.children].forEach((glass, i) => {
    glass.classList.remove('is-wave');
    glass.style.animationDelay = `${GLASS_WAVE_DELAY_MS + i * GLASS_WAVE_STAGGER_MS}ms`;
    glass.addEventListener('animationend', () => glass.classList.remove('is-wave'), { once: true });
    void glass.offsetWidth; // restart the animation if it's already running
    glass.classList.add('is-wave');
  });
}

// ---------- Events ----------

drinkBtn.addEventListener('click', () => {
  const wasBelowGoal = total < TARGET_OZ;
  setTotal(total + INCREMENT_OZ, { pop: true });
  if (navigator.vibrate) navigator.vibrate(15);
  if (wasBelowGoal && total >= TARGET_OZ) celebrate();
});

undoBtn.addEventListener('click', () => {
  setTotal(total - INCREMENT_OZ);
});

resetBtn.addEventListener('click', () => {
  if (confirm("Reset today's water to 0?")) setTotal(0);
});

// Roll over to a fresh day if the app is left open past midnight.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = todayKey();
  if (now !== day) {
    day = now;
    history = loadHistory();
    total = history[day] || 0;
    render();
  }
});

// ---------- Init ----------

targetEl.textContent = TARGET_OZ;
buildGlasses();
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js');
}
