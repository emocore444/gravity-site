const revealItems = document.querySelectorAll(".reveal");
const themeButtons = document.querySelectorAll(".theme-toggle");
const storedTheme = localStorage.getItem("cp-theme");
const AUTH_KEY = "cp-admin-auth";
const ADMIN_TOKEN_KEY = "cp-admin-token";
const USER_KEY = "cp-user";

if (storedTheme === "dark") {
  document.body.classList.add("dark-theme");
}

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch (error) {
    return null;
  }
};

if (document.body.classList.contains("staff-body") && getCurrentUser()?.role !== "admin") {
  window.location.replace("index.html");
}

const syncThemeButtons = () => {
  const isDark = document.body.classList.contains("dark-theme");
  themeButtons.forEach((button) => {
    button.querySelector(".theme-toggle-icon").textContent = isDark ? "☾" : "☀";
    button.setAttribute("aria-pressed", String(isDark));
  });
};

syncThemeButtons();

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    document.body.classList.toggle("dark-theme");
    localStorage.setItem("cp-theme", document.body.classList.contains("dark-theme") ? "dark" : "light");
    syncThemeButtons();
  });
});

const staffLinks = document.querySelectorAll("[data-staff-link]");
const loginOpenButtons = document.querySelectorAll("[data-login-open]");
const registerOpenButtons = document.querySelectorAll("[data-register-open]");
const logoutButtons = document.querySelectorAll("[data-logout]");
const loginModal = document.querySelector("[data-login-modal]");
const registerModal = document.querySelector("[data-register-modal]");
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const profileModal = document.querySelector("[data-profile-modal]");
const profileForm = document.querySelector("[data-profile-form]");
const profileOpenButtons = document.querySelectorAll("[data-profile-open]");
const profileAvatarInput = document.querySelector("[data-profile-avatar]");
const profilePreview = document.querySelector("[data-profile-preview]");
const profileStatus = document.querySelector("[data-profile-status]");
const loginError = document.querySelector("[data-login-error]");
const registerError = document.querySelector("[data-register-error]");
const accountNameItems = document.querySelectorAll("[data-account-name]");
const passwordToggleButtons = document.querySelectorAll("[data-toggle-password]");
const brandLogoImages = document.querySelectorAll("[data-brand-logo]");
const bugForm = document.querySelector("[data-bug-form]");
const bugStatus = document.querySelector("[data-bug-status]");
const mobileHeaders = document.querySelectorAll("[data-mobile-header]");

const isAdminLoggedIn = () => getCurrentUser()?.role === "admin";

const escapeAttr = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

const readImageFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать изображение")));
    reader.readAsDataURL(file);
  });

const renderAvatar = (user, className = "account-avatar") =>
  user?.avatar
    ? `<img class="${className}" src="${escapeAttr(user.avatar)}" alt="">`
    : `<span class="${className}">${escapeAttr(initials(user?.name || user?.login))}</span>`;

const updateFileLabel = (input) => {
  const label = input.closest(".file-upload");
  const name = label?.querySelector("[data-file-name]");
  if (!name) return;
  name.textContent = input.files?.[0]?.name || "Файл не выбран";
};

const resetFileLabels = (root = document) => {
  root.querySelectorAll("[data-file-input]").forEach(updateFileLabel);
};

document.querySelectorAll("[data-file-input]").forEach((input) => {
  input.addEventListener("change", () => updateFileLabel(input));
  updateFileLabel(input);
});

window.resetFileLabels = resetFileLabels;

const applyLogoSettings = (logo = {}) => {
  const src = logo.src || "logo.png";
  const x = Number.isFinite(Number(logo.x)) ? Number(logo.x) : 50;
  const y = Number.isFinite(Number(logo.y)) ? Number(logo.y) : 50;
  const zoom = Number.isFinite(Number(logo.zoom)) ? Number(logo.zoom) : 1;
  brandLogoImages.forEach((image) => {
    image.src = src;
    image.style.objectPosition = `${x}% ${y}%`;
    image.style.transformOrigin = `${x}% ${y}%`;
    image.style.transform = `scale(${zoom})`;
  });
};

window.applyLogoSettings = applyLogoSettings;

const isMobileHeaderMode = () => window.matchMedia("(max-width: 620px)").matches;

mobileHeaders.forEach((header) => {
  header.addEventListener("click", (event) => {
    if (!isMobileHeaderMode()) return;
    const clickedClosedHeader = !header.classList.contains("is-open");
    const clickedBrand = event.target.closest(".brand");
    const clickedPanel = event.target.closest(".nav, .header-actions");

    if (clickedClosedHeader || clickedBrand) {
      event.preventDefault();
      header.classList.toggle("is-open");
      return;
    }

    if (clickedPanel && event.target.closest("a")) {
      header.classList.remove("is-open");
    }
  });
});

window.addEventListener("resize", () => {
  if (isMobileHeaderMode()) return;
  mobileHeaders.forEach((header) => header.classList.remove("is-open"));
});

const loadSiteSettings = async () => {
  try {
    const response = await fetch("/api/settings", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить настройки");
    applyLogoSettings(result.settings?.logo);
    window.dispatchEvent(new CustomEvent("cp:settings-loaded", { detail: result.settings }));
  } catch (error) {
    applyLogoSettings();
  }
};

const syncAuthUi = () => {
  const user = getCurrentUser();
  const loggedIn = Boolean(user);
  const isAdmin = user?.role === "admin";
  staffLinks.forEach((link) => {
    link.hidden = !isAdmin;
  });
  loginOpenButtons.forEach((button) => {
    button.hidden = loggedIn;
  });
  registerOpenButtons.forEach((button) => {
    button.hidden = loggedIn;
  });
  logoutButtons.forEach((button) => {
    button.hidden = !loggedIn;
  });
  accountNameItems.forEach((item) => {
    item.hidden = !loggedIn;
    item.innerHTML = user
      ? `${renderAvatar(user)}<span>${escapeAttr(user.name || user.login)} · ${user.role === "admin" ? "админ" : "пользователь"}</span>`
      : "";
  });
};

const openLoginModal = () => {
  if (!loginModal) return;
  loginModal.hidden = false;
  document.body.classList.add("modal-open");
  loginError.hidden = true;
  loginForm.reset();
  loginForm.querySelector("input[name='login']").focus();
};

const closeLoginModal = () => {
  if (!loginModal) return;
  loginModal.hidden = true;
  document.body.classList.remove("modal-open");
};

const openRegisterModal = () => {
  if (!registerModal) return;
  registerModal.hidden = false;
  document.body.classList.add("modal-open");
  registerError.hidden = true;
  registerForm.reset();
  registerForm.querySelector("input[name='name']").focus();
};

const closeRegisterModal = () => {
  if (!registerModal) return;
  registerModal.hidden = true;
  document.body.classList.remove("modal-open");
};

const renderProfilePreview = (avatar, user = getCurrentUser()) => {
  if (!profilePreview) return;
  if (avatar || user?.avatar) {
    profilePreview.innerHTML = `<img src="${escapeAttr(avatar || user.avatar)}" alt="">`;
    return;
  }
  profilePreview.textContent = initials(user?.name || user?.login);
};

const openProfileModal = () => {
  const user = getCurrentUser();
  if (!profileModal || !profileForm || !user) return;
  profileModal.hidden = false;
  document.body.classList.add("modal-open");
  profileStatus.hidden = true;
  profileForm.elements.name.value = user.name || user.login || "";
  profileAvatarInput.value = "";
  updateFileLabel(profileAvatarInput);
  renderProfilePreview("", user);
};

const closeProfileModal = () => {
  if (!profileModal) return;
  profileModal.hidden = true;
  document.body.classList.remove("modal-open");
};

syncAuthUi();
loadSiteSettings();

passwordToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.closest(".password-field")?.querySelector("input");
    if (!input) return;
    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.setAttribute("aria-label", shouldShow ? "Скрыть пароль" : "Показать пароль");
    button.classList.toggle("is-visible", shouldShow);
  });
});

loginOpenButtons.forEach((button) => {
  button.addEventListener("click", openLoginModal);
});

document.querySelectorAll("[data-login-close]").forEach((item) => {
  item.addEventListener("click", closeLoginModal);
});

registerOpenButtons.forEach((button) => {
  button.addEventListener("click", openRegisterModal);
});

document.querySelectorAll("[data-register-close]").forEach((item) => {
  item.addEventListener("click", closeRegisterModal);
});

profileOpenButtons.forEach((button) => {
  button.addEventListener("click", openProfileModal);
});

document.querySelectorAll("[data-profile-close]").forEach((item) => {
  item.addEventListener("click", closeProfileModal);
});

profileAvatarInput?.addEventListener("change", async () => {
  const file = profileAvatarInput.files?.[0];
  if (!file) {
    renderProfilePreview("");
    return;
  }
  renderProfilePreview(await readImageFile(file));
});

const saveSession = (result) => {
  localStorage.setItem(AUTH_KEY, result.user?.role === "admin" ? "true" : "false");
  localStorage.setItem(ADMIN_TOKEN_KEY, result.token || "");
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
};

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const login = String(formData.get("login") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ login, password })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Ошибка входа");
    saveSession(result);
    syncAuthUi();
    closeLoginModal();
    if (result.user?.role === "admin") {
      window.location.href = "staff.html";
    }
    return;
  } catch (error) {
    loginError.textContent = error.message || "Неверный логин или пароль";
    loginError.hidden = false;
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    login: String(formData.get("login") || "").trim(),
    password: String(formData.get("password") || ""),
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось создать аккаунт");
    saveSession(result);
    syncAuthUi();
    closeRegisterModal();
  } catch (error) {
    registerError.textContent = error.message || "Не удалось создать аккаунт";
    registerError.hidden = false;
  }
});

logoutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    fetch("/api/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` },
      credentials: "same-origin",
      keepalive: true
    }).catch(() => {});
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    syncAuthUi();
    if (document.body.classList.contains("staff-body")) {
      window.location.href = "index.html";
    }
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

revealItems.forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
  revealObserver.observe(item);
});

document.querySelectorAll(".magnetic").forEach((button) => {
  button.addEventListener("mousemove", (event) => {
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    button.style.transform = `translate(${x * 0.08}px, ${y * 0.16}px) scale(1.02)`;
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "";
  });
});

const courseGroups = {
  preschool: {
    title: "Дошкольники 2-6 лет",
    intro:
      "Программы для мягкого старта: развиваем речь, мышление, моторику, уверенность, самостоятельность и интерес к обучению.",
    note: "Старт занятий с сентября. Количество мест в группах ограничено.",
    courses: [
      {
        name: "Чудо-детки",
        age: "от 2 до 6 лет",
        text:
          "Комплексные развивающие занятия в игровой форме: речь, моторика, память, внимание, логика и азы математики. Учимся общаться со сверстниками и познаем мир вместе."
      },
      {
        name: "Ментальная арифметика",
        age: "от 4 до 7 лет",
        text:
          "Методика развития интеллекта, которая тренирует оба полушария мозга, улучшает концентрацию, память, скорость мышления и помогает считать в уме."
      },
      {
        name: "Учусь читать",
        age: "от 5 до 7 лет",
        text:
          "Помогаем ребенку спокойно перейти от букв к слогам, от слогов к словам и уверенно читать предложения без страха перед буквами."
      },
      {
        name: "Подготовка к школе",
        age: "6-7 лет",
        text:
          "Чтение, основы математики, письмо, кругозор и школьные навыки: слушать педагога, работать в группе, быть усидчивым и уверенным."
      },
      {
        name: "Английский язык для детей",
        age: "от 6 лет",
        text:
          "Учимся говорить на иностранном языке через игры, диалоги и песни, чтобы английский стал понятным и живым."
      },
      {
        name: "Акробатика для малышей",
        age: "от 3 лет",
        text:
          "Развиваем ловкость, силу, гибкость и координацию. Упражнения укрепляют мышечный корсет, осанку и дают заряд эмоций."
      }
    ]
  },
  junior: {
    title: "1-4 классы",
    intro:
      "Курсы для школьников младших классов: помощь по программе, развитие навыков будущего и раскрытие творческого потенциала.",
    note: "Старт занятий с первой недели сентября.",
    courses: [
      {
        name: "Английский язык",
        age: "1-4 класс",
        text: "Учимся уверенно говорить, писать, читать и понимать английскую речь."
      },
      {
        name: "Русский язык",
        age: "2-4 класс",
        text: "Осваиваем правила правописания, повышаем грамотность, учимся писать красиво и без ошибок."
      },
      {
        name: "Учусь читать",
        age: "1 класс",
        text: "Помогаем первоклашке перейти от чтения по слогам к беглому, осознанному и выразительному чтению."
      },
      {
        name: "Математика",
        age: "3-4 класс",
        text: "Решаем сложные задачи, работаем с примерами, развиваем логику и готовимся к средней школе без страха."
      },
      {
        name: "Ментальная арифметика",
        age: "1-2 класс",
        text: "Развиваем скорость мышления, память, концентрацию и внимание. Учимся считать в уме быстрее и увереннее."
      },
      {
        name: "Компьютерная грамотность",
        age: "3-4 класс",
        text: "Безопасная работа в сети, презентации, текст и изображения. Готовим ребенка к современным учебным задачам."
      },
      {
        name: "Арт-студия",
        age: "1-4 класс",
        text: "Творческая перезагрузка после учебной недели: воображение, мелкая моторика, вкус и эмоциональная разрядка."
      }
    ]
  },
  senior: {
    title: "5-11 классы",
    intro:
      "Академическая поддержка для средних и старших классов: закрываем пробелы, готовимся к ВПР, ОГЭ и ЕГЭ, развиваем навыки будущего.",
    note: "Старт занятий с первой недели сентября. Телефоны: +7 (909) 369-19-09, +7 (917) 707-71-41.",
    courses: [
      {
        name: "Английский язык",
        age: "5-11 классы",
        text: "Грамматика, лексика, письмо и разговорная практика. Целенаправленная подготовка к ВПР, ОГЭ и ЕГЭ."
      },
      {
        name: "Русский язык",
        age: "5-11 классы",
        text: "Систематизируем знания, повышаем грамотность, учимся писать сочинения и изложения, готовимся к экзаменам."
      },
      {
        name: "Математика",
        age: "5-9 классы",
        text: "Алгебра, геометрия, сложные темы, ликвидация пробелов и эффективная подготовка к ОГЭ."
      },
      {
        name: "Физика",
        age: "8-9 классы",
        text: "Учим понимать физику, решать задачи и видеть закономерности в окружающем мире. Фундамент для ОГЭ и ЕГЭ."
      },
      {
        name: "Информатика",
        age: "9 класс",
        text: "Ключевой курс для подготовки к ОГЭ и первый шаг к IT-профессии."
      },
      {
        name: "Арт-студия",
        age: "5-8 классы",
        text: "Антистресс и творческая реализация. Развиваем креативное мышление через рисунок и современные техники."
      },
      {
        name: "Основы компьютерной грамотности",
        age: "5-6 класс",
        text: "Офисные программы, безопасность в сети, создание презентаций и полезные цифровые навыки."
      }
    ]
  }
};

const courseModal = document.querySelector("[data-course-modal]");
const courseTitle = document.querySelector("[data-course-title]");
const courseIntro = document.querySelector("[data-course-intro]");
const courseNote = document.querySelector("[data-course-note]");
const courseList = document.querySelector("[data-course-list]");
const employeesList = document.querySelector("[data-employees-list]");
const publicEventsList = document.querySelector("[data-events-list]");
const publicEventTabs = document.querySelectorAll("[data-event-tab]");
const publicLinksList = document.querySelector("[data-links-list]");
let publicEventsCache = [];
let publicEventFilter = "upcoming";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const employeeInitials = (name) =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

const renderEmployees = (employees) => {
  if (!employeesList) return;
  if (!employees.length) {
    employeesList.innerHTML = '<div class="empty-state">Сотрудники скоро появятся</div>';
    return;
  }
  employeesList.innerHTML = employees
    .map(
      (employee) => {
        const avatar = employee.avatar || employee.account?.avatar || "";
        return `
        <article class="employee-card">
          <div class="employee-avatar">${
            avatar
              ? `<img src="${escapeHtml(avatar)}" alt="">`
              : escapeHtml(employeeInitials(employee.name))
          }</div>
          <h3>${escapeHtml(employee.name)}</h3>
          <p>${escapeHtml(employee.role)}</p>
        </article>
      `;
      }
    )
    .join("");
};

const loadEmployees = async () => {
  if (!employeesList) return;
  try {
    const response = await fetch("/api/employees");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить сотрудников");
    renderEmployees(result.employees || []);
  } catch (error) {
    renderEmployees([
      { name: "Екатерина Гаянова", role: "Руководитель центра" },
      { name: "Надежда Леухина", role: "Руководитель центра" }
    ]);
  }
};

loadEmployees();

const formatEventDate = (value) => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Дата уточняется";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

const eventIsPast = (event) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(`${event.date}T23:59:59`);
  return !Number.isNaN(eventDate.getTime()) && eventDate < today;
};

const renderPublicEvents = () => {
  if (!publicEventsList) return;
  const events = publicEventsCache.filter((event) =>
    publicEventFilter === "past" ? eventIsPast(event) : !eventIsPast(event)
  );
  if (events.length === 0) {
    publicEventsList.innerHTML = `<div class="empty-state">${
      publicEventFilter === "past" ? "Прошедшие события скоро появятся" : "Ближайшие события скоро появятся"
    }</div>`;
    return;
  }
  publicEventsList.innerHTML = events
    .map(
      (event) => `
        <article class="event-card">
          ${
            event.photo
              ? `<img class="event-photo" src="${escapeHtml(event.photo)}" alt="">`
              : `<div class="event-photo event-photo-placeholder">ЦП</div>`
          }
          <div class="event-body">
            <span class="event-date">${escapeHtml(formatEventDate(event.date))}</span>
            <h3>${escapeHtml(event.title)}</h3>
            <p>${escapeHtml(event.description)}</p>
            ${event.contacts ? `<div class="event-contacts">${escapeHtml(event.contacts)}</div>` : ""}
          </div>
        </article>
      `
    )
    .join("");
};

const loadPublicEvents = async () => {
  if (!publicEventsList) return;
  try {
    const response = await fetch("/api/events");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить события");
    publicEventsCache = result.events || [];
    renderPublicEvents();
  } catch (error) {
    publicEventsList.innerHTML = '<div class="empty-state">События загрузятся после запуска backend</div>';
  }
};

publicEventTabs.forEach((button) => {
  button.addEventListener("click", () => {
    publicEventFilter = button.dataset.eventTab;
    publicEventTabs.forEach((item) => item.classList.toggle("active", item === button));
    renderPublicEvents();
  });
});

const loadPublicLinks = async () => {
  if (!publicLinksList) return;
  try {
    const response = await fetch("/api/links");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Не удалось загрузить ссылки");
    const links = result.links || [];
    if (links.length === 0) {
      publicLinksList.innerHTML = '<div class="empty-state">Ссылки скоро появятся</div>';
      return;
    }
    publicLinksList.innerHTML = links
      .map(
        (link) => `
          <a class="link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
            <span>Перейти</span>
            <h3>${escapeHtml(link.title)}</h3>
            <p>${escapeHtml(link.description || link.url)}</p>
          </a>
        `
      )
      .join("");
  } catch (error) {
    publicLinksList.innerHTML = '<div class="empty-state">Ссылки загрузятся после запуска backend</div>';
  }
};

loadPublicEvents();
loadPublicLinks();

const openCourseModal = (groupId) => {
  const group = courseGroups[groupId];
  if (!group || !courseModal) return;

  courseTitle.textContent = group.title;
  courseIntro.textContent = group.intro;
  courseNote.textContent = group.note;
  courseList.innerHTML = group.courses
    .map(
      (course) => `
        <article class="course-item">
          <span class="course-age">${escapeHtml(course.age)}</span>
          <h3>${escapeHtml(course.name)}</h3>
          <p>${escapeHtml(course.text)}</p>
        </article>
      `
    )
    .join("");

  courseModal.hidden = false;
  document.body.classList.add("modal-open");
  courseModal.querySelector(".course-close").focus();
};

const closeCourseModal = () => {
  if (!courseModal) return;
  courseModal.hidden = true;
  document.body.classList.remove("modal-open");
};

document.querySelectorAll("[data-course-group]").forEach((card) => {
  card.addEventListener("click", () => openCourseModal(card.dataset.courseGroup));
});

document.querySelectorAll("[data-course-close]").forEach((item) => {
  item.addEventListener("click", closeCourseModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCourseModal();
  if (event.key === "Escape") closeLoginModal();
  if (event.key === "Escape") closeRegisterModal();
  if (event.key === "Escape") closeProfileModal();
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const file = profileAvatarInput.files?.[0];
  const currentUser = getCurrentUser();
  const payload = {
    name: String(formData.get("name") || "").trim(),
    avatar: file ? await readImageFile(file) : currentUser?.avatar || ""
  };

  try {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}`
      },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить профиль");
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    syncAuthUi();
    profileStatus.textContent = "Профиль сохранен";
    profileStatus.hidden = false;
    window.setTimeout(closeProfileModal, 700);
  } catch (error) {
    profileStatus.textContent = error.message || "Не удалось сохранить профиль";
    profileStatus.hidden = false;
  }
});

bugForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const formData = new FormData(form);
  const file = formData.get("screenshot");
  const payload = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    contacts: String(formData.get("contacts") || "").trim(),
    screenshot: file instanceof File && file.size ? await readImageFile(file) : "",
    page: window.location.href,
    createdAt: new Date().toISOString()
  };

  button.disabled = true;
  try {
    const response = await fetch("/api/bugs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}`
      },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось отправить сообщение");
    form.reset();
    resetFileLabels(form);
    bugStatus.textContent = "Спасибо! Сообщение отправлено главному администратору.";
    bugStatus.hidden = false;
  } catch (error) {
    bugStatus.textContent = error.message || "Не удалось отправить сообщение";
    bugStatus.hidden = false;
  } finally {
    button.disabled = false;
  }
});

document.querySelector(".contact-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const status = form.querySelector("[data-form-status]");
  const originalText = button.textContent;
  const formData = new FormData(form);
  const lead = {
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
    name: formData.get("name"),
    phone: formData.get("phone"),
    program: formData.get("program"),
    status: "new",
    createdAt: new Date().toISOString(),
    note: "Заявка с сайта"
  };

  button.disabled = true;

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось отправить заявку");

    form.reset();
    button.textContent = "Заявка отправлена";
    button.classList.add("sent");
    status.textContent = "Заявка отправлена на сервер и уже доступна сотрудникам.";
    status.hidden = false;
  } catch (error) {
    status.textContent = "Не удалось отправить заявку. Запустите сайт через backend: python3 server.py";
    status.hidden = false;
  }

  window.setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove("sent");
    button.disabled = false;
    status.hidden = true;
  }, 2400);
});
