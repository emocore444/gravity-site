(() => {
const statusLabels = {
  new: "Новая",
  contacted: "На связи",
  scheduled: "Записан"
};

const list = document.querySelector("[data-lead-list]");
const usersList = document.querySelector("[data-users-list]");
const employeesAdminList = document.querySelector("[data-employees-admin-list]");
const employeeForm = document.querySelector("[data-employee-form]");
const employeeUserSelect = document.querySelector("[data-employee-user]");
const employeeStatus = document.querySelector("[data-employee-status]");
const eventForm = document.querySelector("[data-event-form]");
const eventStatus = document.querySelector("[data-event-status]");
const eventsAdminList = document.querySelector("[data-events-admin-list]");
const linkForm = document.querySelector("[data-link-form]");
const linkStatus = document.querySelector("[data-link-status]");
const linksAdminList = document.querySelector("[data-links-admin-list]");
const bugsAdminList = document.querySelector("[data-bugs-list]");
const logoForm = document.querySelector("[data-logo-form]");
const logoFileInput = document.querySelector("[data-logo-file]");
const logoPreview = document.querySelector("[data-logo-preview]");
const logoZoomInput = document.querySelector("[data-logo-zoom]");
const logoXInput = document.querySelector("[data-logo-x]");
const logoYInput = document.querySelector("[data-logo-y]");
const logoStatus = document.querySelector("[data-logo-status]");
const superOnlyPanels = document.querySelectorAll("[data-super-only]");
const search = document.querySelector("[data-search]");
const filterButtons = document.querySelectorAll("[data-filter]");
const refreshButton = document.querySelector("[data-refresh]");

let activeFilter = "all";
let leadsCache = [];
let usersCache = [];
let employeesCache = [];
let eventsCache = [];
let linksCache = [];
let bugsCache = [];
let logoState = { src: "logo.png", zoom: 1, x: 50, y: 50 };
let logoDirty = false;
const currentUser = JSON.parse(localStorage.getItem("cp-user") || "null");
let isSuperAdmin = Boolean(currentUser?.isSuperAdmin || currentUser?.login === "adminprofile");

const setSuperAdminAccess = (allowed) => {
  isSuperAdmin = allowed;
  superOnlyPanels.forEach((panel) => {
    panel.hidden = !allowed;
  });
};

setSuperAdminAccess(isSuperAdmin);

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("cp-admin-token") || ""}`
});

const escapeLeadHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "сегодня";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

const renderSmallAvatar = (user, className = "admin-avatar") =>
  user?.avatar
    ? `<img class="${className}" src="${escapeLeadHtml(user.avatar)}" alt="">`
    : `<span class="${className}">${escapeLeadHtml(initials(user?.name || user?.login))}</span>`;

const updateStats = (leads) => {
  document.querySelector("[data-stat='total']").textContent = leads.length;
  document.querySelector("[data-stat='new']").textContent = leads.filter((lead) => lead.status === "new").length;
  document.querySelector("[data-stat='contacted']").textContent = leads.filter((lead) => lead.status === "contacted").length;
  document.querySelector("[data-stat='scheduled']").textContent = leads.filter((lead) => lead.status === "scheduled").length;
};

const render = () => {
  const query = search.value.trim().toLowerCase();
  const visible = leadsCache.filter((lead) => {
    const matchesStatus = activeFilter === "all" || lead.status === activeFilter;
    const haystack = `${lead.name} ${lead.phone} ${lead.program} ${lead.note}`.toLowerCase();
    return matchesStatus && haystack.includes(query);
  });

  updateStats(leadsCache);

  if (visible.length === 0) {
    list.innerHTML = '<div class="empty-state">Заявок пока нет</div>';
    return;
  }

  list.innerHTML = visible
    .map(
      (lead) => `
        <article class="lead-card" data-id="${escapeLeadHtml(lead.id)}">
          <div>
            <h3>${escapeLeadHtml(lead.name)}</h3>
            <div class="lead-meta">${escapeLeadHtml(lead.program)}</div>
            <div class="lead-meta">${escapeLeadHtml(lead.phone)} · ${escapeLeadHtml(formatDate(lead.createdAt))}</div>
            <p class="lead-note">${escapeLeadHtml(lead.note)}</p>
          </div>
          <div class="lead-actions">
            <select class="status-select" data-status="${escapeLeadHtml(lead.id)}">
              ${Object.entries(statusLabels)
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${lead.status === value ? "selected" : ""}>${label}</option>`
                )
                .join("")}
            </select>
            <a class="lead-call" href="tel:${escapeLeadHtml(lead.phone.replace(/[^\d+]/g, ""))}">Позвонить</a>
            ${isSuperAdmin ? `<button class="role-button danger" type="button" data-delete-lead="${escapeLeadHtml(lead.id)}">Удалить</button>` : ""}
          </div>
        </article>
      `
    )
    .join("");
};

const renderUsers = () => {
  if (!isSuperAdmin) return;
  if (usersCache.length === 0) {
    usersList.innerHTML = '<div class="empty-state">Пользователей пока нет</div>';
    return;
  }

  usersList.innerHTML = usersCache
    .map((user) => {
      const isMainAdmin = user.login === "adminprofile";
      const isSelf = user.id === currentUser?.id;
      const nextRole = user.role === "admin" ? "user" : "admin";
      const buttonText = user.role === "admin" ? "Снять права" : "Сделать админом";
      const disabled = isMainAdmin || isSelf ? "disabled" : "";
      return `
        <article class="user-card" data-id="${escapeLeadHtml(user.id)}">
          <div class="user-main">
            ${renderSmallAvatar(user)}
            <div>
              <h3>${escapeLeadHtml(user.name || user.login)}</h3>
              <div class="user-meta">@${escapeLeadHtml(user.login)} · ${escapeLeadHtml(formatDate(user.createdAt))}</div>
              <span class="role-pill">${user.role === "admin" ? "Администратор" : "Пользователь"}</span>
            </div>
          </div>
          <div class="user-actions">
            <button
              class="role-button ${user.role === "admin" ? "warning" : ""}"
              type="button"
              data-role-user="${escapeLeadHtml(user.id)}"
              data-next-role="${nextRole}"
              ${disabled}
            >
              ${isMainAdmin ? "Главный админ" : isSelf ? "Это вы" : buttonText}
            </button>
            ${
              isMainAdmin || isSelf
                ? ""
                : `<button class="role-button danger" type="button" data-delete-user="${escapeLeadHtml(user.id)}">Удалить</button>`
            }
          </div>
        </article>
      `;
    })
    .join("");
};

const renderEmployeeUserOptions = () => {
  if (!employeeUserSelect || !isSuperAdmin) return;
  employeeUserSelect.innerHTML = '<option value="">Без привязки к аккаунту</option>';
  employeeUserSelect.innerHTML += usersCache
    .map((user) => `<option value="${escapeLeadHtml(user.id)}">${escapeLeadHtml(user.name || user.login)} (@${escapeLeadHtml(user.login)})</option>`)
    .join("");
};

const renderEmployeesAdmin = () => {
  if (!employeesAdminList || !isSuperAdmin) return;
  if (employeesCache.length === 0) {
    employeesAdminList.innerHTML = '<div class="empty-state">Сотрудники пока не добавлены</div>';
    return;
  }

  employeesAdminList.innerHTML = employeesCache
    .map(
      (employee) => {
        const account = employee.account || null;
        const linked = Boolean(employee.accountLinked || employee.userId);
        return `
        <article class="employee-admin-card">
          <div class="employee-admin-main">
            ${renderSmallAvatar(account || employee, "admin-avatar")}
            <div>
              <h3>${escapeLeadHtml(employee.name)}</h3>
              <div class="user-meta">${escapeLeadHtml(employee.role)}</div>
              ${account ? `<div class="user-meta">@${escapeLeadHtml(account.login)}</div>` : ""}
            </div>
          </div>
          <div class="user-actions">
            <span class="role-pill">${linked ? "Из аккаунта" : "Без аккаунта"}</span>
            <button class="role-button danger" type="button" data-delete-employee="${escapeLeadHtml(employee.id)}">Удалить</button>
          </div>
        </article>
      `;
      }
    )
    .join("");
};

const formatEventDate = (value) => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Дата уточняется";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать фото")));
    reader.readAsDataURL(file);
  });

const applyLogoPreview = () => {
  if (!logoPreview) return;
  logoPreview.src = logoState.src || "logo.png";
  logoPreview.style.objectPosition = `${logoState.x}% ${logoState.y}%`;
  logoPreview.style.transformOrigin = `${logoState.x}% ${logoState.y}%`;
  logoPreview.style.transform = `scale(${logoState.zoom})`;
  document.querySelectorAll("[data-brand-logo]").forEach((image) => {
    image.src = logoState.src || "logo.png";
    image.style.objectPosition = `${logoState.x}% ${logoState.y}%`;
    image.style.transformOrigin = `${logoState.x}% ${logoState.y}%`;
    image.style.transform = `scale(${logoState.zoom})`;
  });
};

const fillLogoControls = (logo) => {
  logoState = {
    src: logo?.src || "logo.png",
    zoom: Number(logo?.zoom || 1),
    x: Number(logo?.x ?? 50),
    y: Number(logo?.y ?? 50)
  };
  if (logoZoomInput) logoZoomInput.value = logoState.zoom;
  if (logoXInput) logoXInput.value = logoState.x;
  if (logoYInput) logoYInput.value = logoState.y;
  applyLogoPreview();
};

const renderEventsAdmin = () => {
  if (!eventsAdminList) return;
  if (eventsCache.length === 0) {
    eventsAdminList.innerHTML = '<div class="empty-state">Событий пока нет</div>';
    return;
  }

  eventsAdminList.innerHTML = eventsCache
    .map(
      (event) => `
        <article class="admin-content-card">
          ${event.photo ? `<img src="${escapeLeadHtml(event.photo)}" alt="">` : '<div class="admin-card-placeholder">Событие</div>'}
          <div>
            <span class="event-date">${escapeLeadHtml(formatEventDate(event.date))}</span>
            <h3>${escapeLeadHtml(event.title)}</h3>
            <p>${escapeLeadHtml(event.description)}</p>
            ${event.contacts ? `<div class="user-meta">${escapeLeadHtml(event.contacts)}</div>` : ""}
          </div>
          <button class="role-button danger" type="button" data-delete-event="${escapeLeadHtml(event.id)}">Удалить</button>
        </article>
      `
    )
    .join("");
};

const renderLinksAdmin = () => {
  if (!linksAdminList || !isSuperAdmin) return;
  if (linksCache.length === 0) {
    linksAdminList.innerHTML = '<div class="empty-state">Ссылок пока нет</div>';
    return;
  }

  linksAdminList.innerHTML = linksCache
    .map(
      (link) => `
        <article class="admin-content-card compact">
          <div>
            <h3>${escapeLeadHtml(link.title)}</h3>
            <p>${escapeLeadHtml(link.description || link.url)}</p>
            <a class="user-meta" href="${escapeLeadHtml(link.url)}" target="_blank" rel="noopener">${escapeLeadHtml(link.url)}</a>
          </div>
          <button class="role-button danger" type="button" data-delete-link="${escapeLeadHtml(link.id)}">Удалить</button>
        </article>
      `
    )
    .join("");
};

const renderBugsAdmin = () => {
  if (!bugsAdminList || !isSuperAdmin) return;
  if (bugsCache.length === 0) {
    bugsAdminList.innerHTML = '<div class="empty-state">Сообщений об ошибках пока нет</div>';
    return;
  }

  bugsAdminList.innerHTML = bugsCache
    .map(
      (bug) => `
        <article class="bug-admin-card">
          ${bug.screenshot ? `<a href="${escapeLeadHtml(bug.screenshot)}" target="_blank" rel="noopener"><img src="${escapeLeadHtml(bug.screenshot)}" alt=""></a>` : '<div class="admin-card-placeholder">Ошибка</div>'}
          <div>
            <span class="event-date">${escapeLeadHtml(formatDate(bug.createdAt))}</span>
            <h3>${escapeLeadHtml(bug.title)}</h3>
            <p>${escapeLeadHtml(bug.description)}</p>
            ${bug.contacts ? `<div class="user-meta">Контакт: ${escapeLeadHtml(bug.contacts)}</div>` : ""}
            ${bug.reporter ? `<div class="user-meta">Аккаунт: ${escapeLeadHtml(bug.reporter.name || bug.reporter.login)} (@${escapeLeadHtml(bug.reporter.login)})</div>` : ""}
            ${bug.page ? `<a class="user-meta" href="${escapeLeadHtml(bug.page)}" target="_blank" rel="noopener">${escapeLeadHtml(bug.page)}</a>` : ""}
          </div>
          <button class="role-button danger" type="button" data-delete-bug="${escapeLeadHtml(bug.id)}">Удалить</button>
        </article>
      `
    )
    .join("");
};

const loadLeads = async () => {
  try {
    const response = await fetch("/api/leads");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить заявки");
    leadsCache = result.leads || [];
    render();
  } catch (error) {
    list.innerHTML = '<div class="empty-state">Backend недоступен. Запустите: python3 server.py</div>';
    updateStats([]);
  }
};

const loadUsers = async () => {
  try {
    const response = await fetch("/api/users", { headers: authHeaders(), credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить пользователей");
    setSuperAdminAccess(true);
    usersCache = result.users || [];
    renderUsers();
    renderEmployeeUserOptions();
  } catch (error) {
    setSuperAdminAccess(false);
    usersCache = [];
    employeesCache = [];
    usersList.innerHTML = "";
    employeesAdminList.innerHTML = "";
  }
};

const loadEmployeesAdmin = async () => {
  if (!isSuperAdmin) return;
  try {
    const response = await fetch("/api/employees", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить сотрудников");
    employeesCache = result.employees || [];
    renderEmployeesAdmin();
  } catch (error) {
    employeesAdminList.innerHTML = '<div class="empty-state">Не удалось загрузить сотрудников</div>';
  }
};

const loadEventsAdmin = async () => {
  if (!eventsAdminList) return;
  try {
    const response = await fetch("/api/events", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить события");
    eventsCache = result.events || [];
    renderEventsAdmin();
  } catch (error) {
    eventsAdminList.innerHTML = '<div class="empty-state">Не удалось загрузить события</div>';
  }
};

const loadLinksAdmin = async () => {
  if (!linksAdminList || !isSuperAdmin) return;
  try {
    const response = await fetch("/api/links", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить ссылки");
    linksCache = result.links || [];
    renderLinksAdmin();
  } catch (error) {
    linksAdminList.innerHTML = '<div class="empty-state">Не удалось загрузить ссылки</div>';
  }
};

const loadBugsAdmin = async () => {
  if (!bugsAdminList || !isSuperAdmin) return;
  try {
    const response = await fetch("/api/bugs", { headers: authHeaders(), credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить ошибки");
    bugsCache = result.bugs || [];
    renderBugsAdmin();
  } catch (error) {
    bugsAdminList.innerHTML = '<div class="empty-state">Не удалось загрузить сообщения</div>';
  }
};

const loadSettingsAdmin = async () => {
  if (!logoForm || !isSuperAdmin) return;
  if (logoDirty) return;
  try {
    const response = await fetch("/api/settings", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить настройки");
    fillLogoControls(result.settings?.logo);
  } catch (error) {
    fillLogoControls(logoState);
  }
};

const updateLeadStatus = async (id, status) => {
  const previous = leadsCache.map((lead) => ({ ...lead }));
  leadsCache = leadsCache.map((lead) => (lead.id === id ? { ...lead, status } : lead));
  render();

  try {
    const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить статус");
  } catch (error) {
    leadsCache = previous;
    render();
  }
};

const updateUserRole = async (id, role) => {
  const previous = usersCache.map((user) => ({ ...user }));
  usersCache = usersCache.map((user) => (user.id === id ? { ...user, role } : user));
  renderUsers();

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "same-origin",
      body: JSON.stringify({ role })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить роль");
    usersCache = usersCache.map((user) => (user.id === id ? result.user : user));
    renderUsers();
  } catch (error) {
    usersCache = previous;
    renderUsers();
  }
};

const deleteLead = async (id) => {
  const previous = leadsCache.map((lead) => ({ ...lead }));
  leadsCache = leadsCache.filter((lead) => lead.id !== id);
  render();

  try {
    const response = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить заявку");
  } catch (error) {
    leadsCache = previous;
    render();
  }
};

const deleteUser = async (id) => {
  const previous = usersCache.map((user) => ({ ...user }));
  usersCache = usersCache.filter((user) => user.id !== id);
  renderUsers();
  renderEmployeeUserOptions();

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить аккаунт");
    await loadEmployeesAdmin();
  } catch (error) {
    usersCache = previous;
    renderUsers();
    renderEmployeeUserOptions();
  }
};

const deleteEmployee = async (id) => {
  const previous = employeesCache.map((employee) => ({ ...employee }));
  employeesCache = employeesCache.filter((employee) => employee.id !== id);
  renderEmployeesAdmin();

  try {
    const response = await fetch(`/api/employees/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить сотрудника");
  } catch (error) {
    employeesCache = previous;
    renderEmployeesAdmin();
  }
};

const deleteEvent = async (id) => {
  const previous = eventsCache.map((event) => ({ ...event }));
  eventsCache = eventsCache.filter((event) => event.id !== id);
  renderEventsAdmin();

  try {
    const response = await fetch(`/api/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить событие");
  } catch (error) {
    eventsCache = previous;
    renderEventsAdmin();
  }
};

const deleteLink = async (id) => {
  const previous = linksCache.map((link) => ({ ...link }));
  linksCache = linksCache.filter((link) => link.id !== id);
  renderLinksAdmin();

  try {
    const response = await fetch(`/api/links/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить ссылку");
  } catch (error) {
    linksCache = previous;
    renderLinksAdmin();
  }
};

const deleteBug = async (id) => {
  const previous = bugsCache.map((bug) => ({ ...bug }));
  bugsCache = bugsCache.filter((bug) => bug.id !== id);
  renderBugsAdmin();

  try {
    const response = await fetch(`/api/bugs/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось удалить сообщение");
  } catch (error) {
    bugsCache = previous;
    renderBugsAdmin();
  }
};

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

search.addEventListener("input", render);

list.addEventListener("change", (event) => {
  if (!event.target.matches("[data-status]")) return;
  updateLeadStatus(event.target.dataset.status, event.target.value);
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-lead]");
  if (!button || button.disabled) return;
  deleteLead(button.dataset.deleteLead);
});

usersList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-role-user]");
  const deleteButton = event.target.closest("[data-delete-user]");
  if (button && !button.disabled) {
    updateUserRole(button.dataset.roleUser, button.dataset.nextRole);
    return;
  }
  if (deleteButton && !deleteButton.disabled) {
    deleteUser(deleteButton.dataset.deleteUser);
  }
});

employeeUserSelect?.addEventListener("change", () => {
  const user = usersCache.find((item) => item.id === employeeUserSelect.value);
  if (!user) return;
  employeeForm.elements.name.value = user.name || user.login;
});

employeeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    userId: String(formData.get("userId") || ""),
    name: String(formData.get("name") || "").trim(),
    role: String(formData.get("role") || "").trim(),
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось добавить сотрудника");
    employeeStatus.textContent = "Сотрудник добавлен на главную страницу";
    employeeStatus.hidden = false;
    employeeForm.reset();
    if (window.resetFileLabels) window.resetFileLabels(employeeForm);
    await loadEmployeesAdmin();
  } catch (error) {
    employeeStatus.textContent = error.message || "Не удалось добавить сотрудника";
    employeeStatus.hidden = false;
  }
});

employeesAdminList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-employee]");
  if (!button || button.disabled) return;
  deleteEmployee(button.dataset.deleteEmployee);
});

eventForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = formData.get("photo");
  const payload = {
    title: String(formData.get("title") || "").trim(),
    date: String(formData.get("date") || ""),
    description: String(formData.get("description") || "").trim(),
    contacts: String(formData.get("contacts") || "").trim(),
    photo: file instanceof File && file.size ? await readFileAsDataUrl(file) : "",
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось добавить событие");
    eventStatus.textContent = "Событие добавлено на сайт";
    eventStatus.hidden = false;
    eventForm.reset();
    if (window.resetFileLabels) window.resetFileLabels(eventForm);
    await loadEventsAdmin();
  } catch (error) {
    eventStatus.textContent = error.message || "Не удалось добавить событие";
    eventStatus.hidden = false;
  }
});

linkForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    url: String(formData.get("url") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось добавить ссылку");
    linkStatus.textContent = "Ссылка добавлена на сайт";
    linkStatus.hidden = false;
    linkForm.reset();
    await loadLinksAdmin();
  } catch (error) {
    linkStatus.textContent = error.message || "Не удалось добавить ссылку";
    linkStatus.hidden = false;
  }
});

eventsAdminList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-event]");
  if (!button || button.disabled) return;
  deleteEvent(button.dataset.deleteEvent);
});

linksAdminList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-link]");
  if (!button || button.disabled) return;
  deleteLink(button.dataset.deleteLink);
});

bugsAdminList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-bug]");
  if (!button || button.disabled) return;
  deleteBug(button.dataset.deleteBug);
});

logoFileInput?.addEventListener("change", async () => {
  const file = logoFileInput.files?.[0];
  if (!file) return;
  logoDirty = true;
  logoState.src = await readFileAsDataUrl(file);
  applyLogoPreview();
});

[logoZoomInput, logoXInput, logoYInput].forEach((input) => {
  input?.addEventListener("input", () => {
    logoDirty = true;
    logoState.zoom = Number(logoZoomInput?.value || 1);
    logoState.x = Number(logoXInput?.value || 50);
    logoState.y = Number(logoYInput?.value || 50);
    applyLogoPreview();
  });
});

logoForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const response = await fetch("/api/settings/logo", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "same-origin",
      body: JSON.stringify(logoState)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить логотип");
    logoDirty = false;
    fillLogoControls(result.settings?.logo);
    if (window.applyLogoSettings) window.applyLogoSettings(result.settings?.logo);
    logoStatus.textContent = "Логотип сохранен";
    logoStatus.hidden = false;
  } catch (error) {
    logoStatus.textContent = error.message || "Не удалось сохранить логотип";
    logoStatus.hidden = false;
  }
});

const refreshDashboard = async () => {
  loadLeads();
  loadEventsAdmin();
  await loadUsers();
  if (isSuperAdmin) {
    loadEmployeesAdmin();
    loadLinksAdmin();
    loadSettingsAdmin();
    loadBugsAdmin();
  }
};

refreshButton.addEventListener("click", refreshDashboard);
window.addEventListener("focus", refreshDashboard);
window.setInterval(refreshDashboard, 5000);

refreshDashboard();
})();
