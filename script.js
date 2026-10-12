const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const today = new Date();
today.setHours(0, 0, 0, 0);
const dateKey = (date) => {
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const todayKey = dateKey(today);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowKey = dateKey(tomorrow);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const starterTasks = [
  { id: uid(), title: "Review Java OOP notes", notes: "Revise inheritance, polymorphism and interfaces", due: todayKey, priority: "high", done: false, created: Date.now() - 50000 },
  { id: uid(), title: "Finish database assignment", notes: "Complete the SQL queries and check the output", due: tomorrowKey, priority: "normal", done: false, created: Date.now() - 40000 },
  { id: uid(), title: "Practise CSS layout", notes: "Spend 30 minutes on flexbox and responsive design", due: "", priority: "low", done: false, created: Date.now() - 30000 },
  { id: uid(), title: "Organise this week's study plan", notes: "Pick the three most important things to finish first", due: todayKey, priority: "normal", done: true, created: Date.now() - 20000 }
];

let tasks;
try {
  const saved = localStorage.getItem("daymark-tasks-v1");
  tasks = saved ? JSON.parse(saved) : starterTasks;
  if (!Array.isArray(tasks)) tasks = starterTasks;
} catch {
  tasks = starterTasks;
}

let currentView = "all";
let currentFilter = "all";
let toastTimer;

const viewLabels = {
  all: { title: "Make room for <em>what matters.</em>", subtitle: "A little progress every day goes a long way.", heading: "Your task list", description: "Everything you want to get done, in one place." },
  today: { title: "One day at a <em>time.</em>", subtitle: "Keep today's priorities close and manageable.", heading: "Today's tasks", description: "What needs your attention today." },
  upcoming: { title: "A little planning goes <em>a long way.</em>", subtitle: "See what's coming up and give yourself a head start.", heading: "Coming up", description: "Tasks with a future due date." },
  completed: { title: "Look how far you've <em>come.</em>", subtitle: "Every finished task is progress worth noticing.", heading: "Done and dusted", description: "A record of the things you've finished." }
};

function save() {
  try { localStorage.setItem("daymark-tasks-v1", JSON.stringify(tasks)); } catch { showToast("Couldn't save in this browser."); }
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
function formatDate(key) {
  if (!key) return "No due date";
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  const date = new Date(`${key}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function dateState(task) {
  if (!task.due || task.done) return "";
  if (task.due < todayKey) return "overdue";
  if (task.due === todayKey) return "today";
  return "";
}
function visibleTasks() {
  const query = $("#taskSearch").value.trim().toLowerCase();
  let list = tasks.filter(task => {
    if (currentView === "today" && task.due !== todayKey) return false;
    if (currentView === "upcoming" && (!task.due || task.due <= todayKey || task.done)) return false;
    if (currentView === "completed" && !task.done) return false;
    if (currentView !== "completed" && currentView !== "upcoming" && currentView !== "today" && false) return false;
    if (currentFilter === "open" && task.done) return false;
    if (currentFilter === "done" && !task.done) return false;
    return `${task.title} ${task.notes || ""}`.toLowerCase().includes(query);
  });
  const sort = $("#sortTasks").value;
  list.sort((a, b) => {
    if (sort === "priority") {
      const weight = { high: 0, normal: 1, low: 2 };
      return Number(a.done) - Number(b.done) || weight[a.priority] - weight[b.priority] || (a.due || "9999").localeCompare(b.due || "9999");
    }
    if (sort === "created") return b.created - a.created;
    return Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999") || b.created - a.created;
  });
  return list;
}
function renderTask(task) {
  const dueClass = dateState(task);
  const dueLabel = task.due && task.due < todayKey && !task.done ? `Overdue · ${formatDate(task.due)}` : formatDate(task.due);
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  return `<article class="task-row ${task.done ? "is-done" : ""}" data-id="${escapeHTML(task.id)}">
    <button class="check-button" data-action="toggle" aria-label="${task.done ? "Mark as not done" : "Mark complete"}" title="${task.done ? "Mark as not done" : "Mark complete"}">${task.done ? "✓" : ""}</button>
    <div class="task-copy">
      <p class="task-title">${escapeHTML(task.title)}</p>
      ${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ""}
    </div>
    <div class="task-meta"><span class="priority ${escapeHTML(task.priority)}">${priorityLabel}</span><span class="due-date ${dueClass}">${escapeHTML(dueLabel)}</span></div>
    <button class="delete-button" data-action="delete" aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">×</button>
  </article>`;
}
function render() {
  const openCount = tasks.filter(t => !t.done).length;
  const doneCount = tasks.filter(t => t.done).length;
  const todayCount = tasks.filter(t => !t.done && t.due === todayKey).length;
  const weekDone = tasks.filter(t => t.done).length;
  const progress = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;

  $("#totalTasks").textContent = tasks.length;
  $("#completedTasks").textContent = doneCount;
  $("#dueTodayTasks").textContent = todayCount;
  $("#completionMessage").textContent = doneCount ? "Nice work — keep going" : "Every check counts";
  $("#navAllCount").textContent = openCount;
  $("#navTodayCount").textContent = todayCount;
  $("#weekProgress").style.width = `${progress}%`;
  $("#weekProgressText").textContent = `${doneCount} of ${tasks.length} done`;
  $("#headingCount").textContent = visibleTasks().length;
  $("#footerCount").textContent = `${tasks.length} task${tasks.length === 1 ? "" : "s"} total`;

  const config = viewLabels[currentView];
  $("#pageTitle").innerHTML = config.title;
  $("#pageSubtitle").textContent = config.subtitle;
  $("#breadcrumbCurrent").textContent = ({ all: "My tasks", today: "Today", upcoming: "Upcoming", completed: "Completed" })[currentView];
  $("#listHeading").innerHTML = `${config.heading} <span class="heading-count" id="headingCount">${visibleTasks().length}</span>`;
  $("#listDescription").textContent = config.description;

  $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === currentView));
  $$(".filter-pill").forEach(btn => btn.classList.toggle("active", btn.dataset.filter === currentFilter));

  const list = visibleTasks();
  $("#resultsLabel").textContent = $("#taskSearch").value.trim() ? `${list.length} matching` : `Showing ${list.length} task${list.length === 1 ? "" : "s"}`;
  $("#taskList").innerHTML = list.map(renderTask).join("");
  $("#taskList").classList.toggle("hidden", list.length === 0);
  $("#emptyState").classList.toggle("hidden", list.length !== 0);
  $("#emptyTitle").textContent = $("#taskSearch").value.trim() ? "Nothing matched that search." : currentView === "completed" ? "Your next win is waiting." : "A clear desk, a clear mind.";
  $("#emptyCopy").textContent = $("#taskSearch").value.trim() ? "Try a different word or clear your search." : currentView === "completed" ? "Finish a task and it will find a home here." : "No tasks here right now. Add one when you're ready.";
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}
function openModal() {
  $("#modalBackdrop").classList.remove("hidden");
  $("#formError").textContent = "";
  $("#taskTitle").focus();
}
function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
  $("#taskForm").reset();
  $("#taskPriority").value = "normal";
  $("#formError").textContent = "";
}
function switchView(view) {
  currentView = view;
  currentFilter = "all";
  render();
  if (window.innerWidth <= 760) $("#sidebar").classList.remove("open");
}

$("#todayDate").textContent = today.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
$("#taskDue").value = todayKey;
$("#openAddTask").addEventListener("click", openModal);
$("#emptyAddButton").addEventListener("click", openModal);
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
$("#modalBackdrop").addEventListener("click", e => { if (e.target === $("#modalBackdrop")) closeModal(); });
$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

$$(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
$$(".filter-pill").forEach(btn => btn.addEventListener("click", () => { currentFilter = btn.dataset.filter; render(); }));
$("#taskSearch").addEventListener("input", render);
$("#sortTasks").addEventListener("change", render);

$("#taskList").addEventListener("click", e => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const row = button.closest(".task-row");
  const task = tasks.find(t => t.id === row?.dataset.id);
  if (!task) return;
  if (button.dataset.action === "toggle") {
    task.done = !task.done;
    save(); render();
    showToast(task.done ? "Task completed. Nice work!" : "Task moved back to your list.");
  } else if (button.dataset.action === "delete") {
    tasks = tasks.filter(t => t.id !== task.id);
    save(); render(); showToast("Task removed.");
  }
});

$("#taskForm").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("#taskTitle").value.trim();
  if (!title) { $("#formError").textContent = "Give your task a name first."; $("#taskTitle").focus(); return; }
  const task = {
    id: uid(),
    title,
    notes: $("#taskNotes").value.trim(),
    due: $("#taskDue").value,
    priority: $("#taskPriority").value,
    done: false,
    created: Date.now()
  };
  tasks.unshift(task);
  save();
  currentView = "all";
  currentFilter = "all";
  closeModal();
  render();
  showToast("Task added to your list.");
});

render();
