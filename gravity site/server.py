#!/usr/bin/env python3
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
import json
import re
import secrets
import hashlib
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "outputs"
DATA_DIR = ROOT / "data"
LEADS_FILE = DATA_DIR / "leads.json"
USERS_FILE = DATA_DIR / "users.json"
EMPLOYEES_FILE = DATA_DIR / "employees.json"
EVENTS_FILE = DATA_DIR / "events.json"
LINKS_FILE = DATA_DIR / "links.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
BUGS_FILE = DATA_DIR / "bugs.json"

ADMIN_LOGIN = "adminprofile"
ADMIN_PASSWORD = "gravitycenter12"
SESSIONS = {}
DEFAULT_EMPLOYEES = [
    {
        "id": "default-ekaterina-gayanova",
        "userId": "",
        "name": "Екатерина Гаянова",
        "role": "Руководитель центра",
        "createdAt": "2026-06-30T00:00:00.000Z",
    },
    {
        "id": "default-nadezhda-leukhina",
        "userId": "",
        "name": "Надежда Леухина",
        "role": "Руководитель центра",
        "createdAt": "2026-06-30T00:00:00.000Z",
    },
]
DEFAULT_SETTINGS = {
    "logo": {
        "src": "logo.png",
        "zoom": 1,
        "x": 50,
        "y": 50,
    }
}


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return {"salt": salt, "hash": digest}


def verify_password(password, user):
    password_data = hash_password(password, user.get("salt", ""))
    return secrets.compare_digest(password_data["hash"], user.get("passwordHash", ""))


def ensure_storage():
    DATA_DIR.mkdir(exist_ok=True)
    if not LEADS_FILE.exists():
        LEADS_FILE.write_text("[]", encoding="utf-8")
    if not USERS_FILE.exists():
        USERS_FILE.write_text("[]", encoding="utf-8")
    if not EMPLOYEES_FILE.exists():
        EMPLOYEES_FILE.write_text(json.dumps(DEFAULT_EMPLOYEES, ensure_ascii=False, indent=2), encoding="utf-8")
    if not EVENTS_FILE.exists():
        EVENTS_FILE.write_text("[]", encoding="utf-8")
    if not LINKS_FILE.exists():
        LINKS_FILE.write_text("[]", encoding="utf-8")
    if not SETTINGS_FILE.exists():
        SETTINGS_FILE.write_text(json.dumps(DEFAULT_SETTINGS, ensure_ascii=False, indent=2), encoding="utf-8")
    if not BUGS_FILE.exists():
        BUGS_FILE.write_text("[]", encoding="utf-8")
    users = read_users_raw()
    if not any(user.get("login") == ADMIN_LOGIN for user in users):
        password_data = hash_password(ADMIN_PASSWORD)
        users.insert(
            0,
            {
                "id": secrets.token_hex(8),
                "login": ADMIN_LOGIN,
                "name": "Администратор",
                "role": "admin",
                "createdAt": "2026-06-30T00:00:00.000Z",
                "salt": password_data["salt"],
                "passwordHash": password_data["hash"],
            },
        )
        write_users_raw(users)


def read_leads():
    ensure_storage()
    try:
        return json.loads(LEADS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_leads(leads):
    ensure_storage()
    LEADS_FILE.write_text(json.dumps(leads, ensure_ascii=False, indent=2), encoding="utf-8")


def read_users_raw():
    try:
        return json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def write_users_raw(users):
    DATA_DIR.mkdir(exist_ok=True)
    USERS_FILE.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


def public_user(user):
    return {
        "id": user.get("id"),
        "login": user.get("login"),
        "name": user.get("name"),
        "role": user.get("role", "user"),
        "avatar": user.get("avatar", ""),
        "isSuperAdmin": user.get("login") == ADMIN_LOGIN,
        "createdAt": user.get("createdAt"),
    }


def find_user(login):
    normalized = str(login).strip().lower()
    for user in read_users_raw():
        if user.get("login", "").lower() == normalized:
            return user
    return None


def auth_user(headers):
    auth = headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        user = SESSIONS.get(auth.removeprefix("Bearer ").strip())
        if user is not None:
            return user
    cookie = SimpleCookie(headers.get("Cookie", ""))
    session_cookie = cookie.get("cp_session")
    if session_cookie is None:
        return None
    return SESSIONS.get(session_cookie.value)


def require_admin(handler):
    user = auth_user(handler.headers)
    if not user or user.get("role") != "admin":
        handler.send_json({"ok": False, "error": "Нужны права администратора"}, HTTPStatus.FORBIDDEN)
        return None
    return user


def require_super_admin(handler):
    user = require_admin(handler)
    if user is None:
        return None
    if user.get("login") != ADMIN_LOGIN:
        handler.send_json({"ok": False, "error": "Доступ только для главного администратора"}, HTTPStatus.FORBIDDEN)
        return None
    return user


def read_employees():
    ensure_storage()
    try:
        return json.loads(EMPLOYEES_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_employees(employees):
    ensure_storage()
    EMPLOYEES_FILE.write_text(json.dumps(employees, ensure_ascii=False, indent=2), encoding="utf-8")


def enriched_employees():
    users_by_id = {user.get("id"): public_user(user) for user in read_users_raw()}
    employees = []
    for employee in read_employees():
        item = dict(employee)
        account = users_by_id.get(item.get("userId"))
        item["accountLinked"] = account is not None
        item["account"] = account
        if account:
            item["avatar"] = account.get("avatar", "")
            item["accountLogin"] = account.get("login", "")
        employees.append(item)
    return employees


def read_events():
    ensure_storage()
    try:
        return json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_events(events):
    ensure_storage()
    EVENTS_FILE.write_text(json.dumps(events, ensure_ascii=False, indent=2), encoding="utf-8")


def read_links():
    ensure_storage()
    try:
        return json.loads(LINKS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_links(links):
    ensure_storage()
    LINKS_FILE.write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding="utf-8")


def read_settings():
    ensure_storage()
    try:
        settings = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        settings = {}
    return {**DEFAULT_SETTINGS, **settings}


def write_settings(settings):
    ensure_storage()
    SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")


def read_bugs():
    ensure_storage()
    try:
        return json.loads(BUGS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def write_bugs(bugs):
    ensure_storage()
    BUGS_FILE.write_text(json.dumps(bugs, ensure_ascii=False, indent=2), encoding="utf-8")


def bounded_float(value, default, minimum, maximum):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return min(max(number, minimum), maximum)


class GravityHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=HTTPStatus.OK, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/leads":
            leads = sorted(read_leads(), key=lambda item: item.get("createdAt", ""), reverse=True)
            self.send_json({"leads": leads})
            return
        if parsed.path == "/api/users":
            if require_super_admin(self) is None:
                return
            users = sorted(read_users_raw(), key=lambda item: item.get("createdAt", ""), reverse=True)
            self.send_json({"users": [public_user(user) for user in users]})
            return
        if parsed.path == "/api/employees":
            employees = sorted(enriched_employees(), key=lambda item: item.get("createdAt", ""))
            self.send_json({"employees": employees})
            return
        if parsed.path == "/api/events":
            events = sorted(read_events(), key=lambda item: item.get("date", ""))
            self.send_json({"events": events})
            return
        if parsed.path == "/api/links":
            links = sorted(read_links(), key=lambda item: item.get("createdAt", ""), reverse=True)
            self.send_json({"links": links})
            return
        if parsed.path == "/api/settings":
            self.send_json({"settings": read_settings()})
            return
        if parsed.path == "/api/bugs":
            if require_super_admin(self) is None:
                return
            bugs = sorted(read_bugs(), key=lambda item: item.get("createdAt", ""), reverse=True)
            self.send_json({"bugs": bugs})
            return
        if parsed.path == "/api/health":
            self.send_json({"ok": True})
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/login":
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            user = find_user(payload.get("login", ""))
            if user and verify_password(str(payload.get("password", "")), user):
                token = secrets.token_urlsafe(24)
                SESSIONS[token] = public_user(user)
                self.send_json(
                    {"ok": True, "token": token, "user": public_user(user)},
                    extra_headers={"Set-Cookie": f"cp_session={token}; Path=/; SameSite=Lax"},
                )
                return
            self.send_json({"ok": False, "error": "Неверный логин или пароль"}, HTTPStatus.UNAUTHORIZED)
            return

        if parsed.path == "/api/register":
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            login = str(payload.get("login", "")).strip()
            name = str(payload.get("name", "")).strip()
            password = str(payload.get("password", ""))
            if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", login):
                self.send_json({"ok": False, "error": "Логин: 3-32 символа, латиница/цифры/._-"}, HTTPStatus.BAD_REQUEST)
                return
            if len(password) < 6:
                self.send_json({"ok": False, "error": "Пароль должен быть не короче 6 символов"}, HTTPStatus.BAD_REQUEST)
                return
            if find_user(login):
                self.send_json({"ok": False, "error": "Такой логин уже зарегистрирован"}, HTTPStatus.CONFLICT)
                return

            password_data = hash_password(password)
            user = {
                "id": secrets.token_hex(8),
                "login": login,
                "name": name[:120] or login,
                "role": "user",
                "createdAt": str(payload.get("createdAt", "")),
                "salt": password_data["salt"],
                "passwordHash": password_data["hash"],
            }
            users = read_users_raw()
            users.insert(0, user)
            write_users_raw(users)
            token = secrets.token_urlsafe(24)
            SESSIONS[token] = public_user(user)
            self.send_json(
                {"ok": True, "token": token, "user": public_user(user)},
                HTTPStatus.CREATED,
                {"Set-Cookie": f"cp_session={token}; Path=/; SameSite=Lax"},
            )
            return

        if parsed.path == "/api/logout":
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                SESSIONS.pop(auth.removeprefix("Bearer ").strip(), None)
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            session_cookie = cookie.get("cp_session")
            if session_cookie is not None:
                SESSIONS.pop(session_cookie.value, None)
            self.send_json(
                {"ok": True},
                extra_headers={"Set-Cookie": "cp_session=; Path=/; Max-Age=0; SameSite=Lax"},
            )
            return

        if parsed.path == "/api/leads":
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            name = str(payload.get("name", "")).strip()
            phone = str(payload.get("phone", "")).strip()
            program = str(payload.get("program", "")).strip()
            if not name or not phone or not program:
                self.send_json({"ok": False, "error": "Заполните имя, телефон и программу"}, HTTPStatus.BAD_REQUEST)
                return

            lead = {
                "id": secrets.token_hex(8),
                "name": name[:120],
                "phone": phone[:60],
                "program": program[:160],
                "status": "new",
                "createdAt": str(payload.get("createdAt", "")),
                "note": "Заявка с сайта",
            }

            leads = read_leads()
            leads.insert(0, lead)
            write_leads(leads)
            self.send_json({"ok": True, "lead": lead}, HTTPStatus.CREATED)
            return

        if parsed.path == "/api/employees":
            if require_super_admin(self) is None:
                return
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            user_id = str(payload.get("userId", "")).strip()
            name = str(payload.get("name", "")).strip()
            role = str(payload.get("role", "")).strip()
            if user_id:
                user = next((item for item in read_users_raw() if item.get("id") == user_id), None)
                if user is None:
                    self.send_json({"ok": False, "error": "Пользователь не найден"}, HTTPStatus.NOT_FOUND)
                    return
                name = name or user.get("name") or user.get("login")
            if not name or not role:
                self.send_json({"ok": False, "error": "Заполните ФИО и роль"}, HTTPStatus.BAD_REQUEST)
                return

            employee = {
                "id": secrets.token_hex(8),
                "userId": user_id,
                "name": name[:120],
                "role": role[:120],
                "createdAt": str(payload.get("createdAt", "")),
            }
            employees = read_employees()
            employees.append(employee)
            write_employees(employees)
            self.send_json({"ok": True, "employee": employee}, HTTPStatus.CREATED)
            return

        if parsed.path == "/api/bugs":
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            title = str(payload.get("title", "")).strip()
            description = str(payload.get("description", "")).strip()
            contacts = str(payload.get("contacts", "")).strip()
            screenshot = str(payload.get("screenshot", "")).strip()
            if not title or not description:
                self.send_json({"ok": False, "error": "Заполните тему и описание ошибки"}, HTTPStatus.BAD_REQUEST)
                return
            if screenshot and not screenshot.startswith("data:image/"):
                self.send_json({"ok": False, "error": "Скриншот должен быть изображением"}, HTTPStatus.BAD_REQUEST)
                return

            reporter = auth_user(self.headers)
            bug = {
                "id": secrets.token_hex(8),
                "title": title[:140],
                "description": description[:1600],
                "contacts": contacts[:240],
                "screenshot": screenshot[:1200000],
                "page": str(payload.get("page", ""))[:600],
                "status": "new",
                "createdAt": str(payload.get("createdAt", "")),
                "reporter": reporter if reporter else None,
            }
            bugs = read_bugs()
            bugs.insert(0, bug)
            write_bugs(bugs)
            self.send_json({"ok": True, "bug": bug}, HTTPStatus.CREATED)
            return

        if parsed.path == "/api/events":
            if require_admin(self) is None:
                return
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            title = str(payload.get("title", "")).strip()
            date = str(payload.get("date", "")).strip()
            description = str(payload.get("description", "")).strip()
            contacts = str(payload.get("contacts", "")).strip()
            photo = str(payload.get("photo", "")).strip()
            if not title or not date or not description:
                self.send_json({"ok": False, "error": "Заполните название, дату и описание"}, HTTPStatus.BAD_REQUEST)
                return

            event = {
                "id": secrets.token_hex(8),
                "title": title[:140],
                "date": date[:40],
                "description": description[:1200],
                "contacts": contacts[:240],
                "photo": photo if photo.startswith("data:image/") else "",
                "createdAt": str(payload.get("createdAt", "")),
            }
            events = read_events()
            events.insert(0, event)
            write_events(events)
            self.send_json({"ok": True, "event": event}, HTTPStatus.CREATED)
            return

        if parsed.path == "/api/links":
            if require_super_admin(self) is None:
                return
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            title = str(payload.get("title", "")).strip()
            url = str(payload.get("url", "")).strip()
            description = str(payload.get("description", "")).strip()
            if not title or not re.fullmatch(r"https?://.+", url):
                self.send_json({"ok": False, "error": "Укажите название и ссылку с http/https"}, HTTPStatus.BAD_REQUEST)
                return

            link = {
                "id": secrets.token_hex(8),
                "title": title[:140],
                "url": url[:600],
                "description": description[:500],
                "createdAt": str(payload.get("createdAt", "")),
            }
            links = read_links()
            links.insert(0, link)
            write_links(links)
            self.send_json({"ok": True, "link": link}, HTTPStatus.CREATED)
            return

        if parsed.path == "/api/settings/logo":
            if require_super_admin(self) is None:
                return
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            src = str(payload.get("src", "")).strip()
            if src and not src.startswith("data:image/") and src != "logo.png":
                self.send_json({"ok": False, "error": "Загрузите изображение логотипа"}, HTTPStatus.BAD_REQUEST)
                return
            logo = {
                "src": src or "logo.png",
                "zoom": bounded_float(payload.get("zoom"), 1, 1, 3),
                "x": bounded_float(payload.get("x"), 50, 0, 100),
                "y": bounded_float(payload.get("y"), 50, 0, 100),
            }
            settings = read_settings()
            settings["logo"] = logo
            write_settings(settings)
            self.send_json({"ok": True, "settings": settings})
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/profile":
            session_user = auth_user(self.headers)
            if session_user is None:
                self.send_json({"ok": False, "error": "Нужно войти в аккаунт"}, HTTPStatus.FORBIDDEN)
                return
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            name = str(payload.get("name", "")).strip()
            avatar = str(payload.get("avatar", "")).strip()
            if avatar and not avatar.startswith("data:image/"):
                self.send_json({"ok": False, "error": "Загрузите изображение профиля"}, HTTPStatus.BAD_REQUEST)
                return

            users = read_users_raw()
            for user in users:
                if user.get("id") == session_user.get("id"):
                    if name:
                        user["name"] = name[:120]
                    user["avatar"] = avatar[:900000]
                    write_users_raw(users)
                    for token, current in list(SESSIONS.items()):
                        if current.get("id") == user.get("id"):
                            SESSIONS[token] = public_user(user)
                    self.send_json({"ok": True, "user": public_user(user)})
                    return

            self.send_json({"ok": False, "error": "Пользователь не найден"}, HTTPStatus.NOT_FOUND)
            return

        user_match = re.fullmatch(r"/api/users/([a-f0-9]+)", parsed.path)
        if user_match:
            if require_super_admin(self) is None:
                return
            try:
                payload = self.read_json_body()
            except json.JSONDecodeError:
                self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
                return

            role = payload.get("role")
            if role not in {"user", "admin"}:
                self.send_json({"ok": False, "error": "Некорректная роль"}, HTTPStatus.BAD_REQUEST)
                return

            users = read_users_raw()
            for user in users:
                if user.get("id") == user_match.group(1):
                    if user.get("login") == ADMIN_LOGIN and role != "admin":
                        self.send_json({"ok": False, "error": "Главного администратора нельзя понизить"}, HTTPStatus.BAD_REQUEST)
                        return
                    user["role"] = role
                    write_users_raw(users)
                    for token, session_user in list(SESSIONS.items()):
                        if session_user.get("id") == user.get("id"):
                            SESSIONS[token] = public_user(user)
                    self.send_json({"ok": True, "user": public_user(user)})
                    return

            self.send_json({"ok": False, "error": "Пользователь не найден"}, HTTPStatus.NOT_FOUND)
            return

        match = re.fullmatch(r"/api/leads/([a-f0-9]+)", parsed.path)
        if not match:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            payload = self.read_json_body()
        except json.JSONDecodeError:
            self.send_json({"ok": False, "error": "Некорректный JSON"}, HTTPStatus.BAD_REQUEST)
            return

        status = payload.get("status")
        if status not in {"new", "contacted", "scheduled"}:
            self.send_json({"ok": False, "error": "Некорректный статус"}, HTTPStatus.BAD_REQUEST)
            return

        lead_id = match.group(1)
        leads = read_leads()
        for lead in leads:
            if lead.get("id") == lead_id:
                lead["status"] = status
                write_leads(leads)
                self.send_json({"ok": True, "lead": lead})
                return

        self.send_json({"ok": False, "error": "Заявка не найдена"}, HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        parsed = urlparse(self.path)

        lead_match = re.fullmatch(r"/api/leads/([a-f0-9]+)", parsed.path)
        if lead_match:
            if require_super_admin(self) is None:
                return
            leads = read_leads()
            next_leads = [lead for lead in leads if lead.get("id") != lead_match.group(1)]
            if len(next_leads) == len(leads):
                self.send_json({"ok": False, "error": "Заявка не найдена"}, HTTPStatus.NOT_FOUND)
                return
            write_leads(next_leads)
            self.send_json({"ok": True})
            return

        user_match = re.fullmatch(r"/api/users/([a-f0-9]+)", parsed.path)
        if user_match:
            current_user = require_super_admin(self)
            if current_user is None:
                return
            users = read_users_raw()
            target = next((user for user in users if user.get("id") == user_match.group(1)), None)
            if target is None:
                self.send_json({"ok": False, "error": "Пользователь не найден"}, HTTPStatus.NOT_FOUND)
                return
            if target.get("login") == ADMIN_LOGIN or target.get("id") == current_user.get("id"):
                self.send_json({"ok": False, "error": "Главного администратора нельзя удалить"}, HTTPStatus.BAD_REQUEST)
                return
            write_users_raw([user for user in users if user.get("id") != target.get("id")])
            employees = read_employees()
            for employee in employees:
                if employee.get("userId") == target.get("id"):
                    employee["userId"] = ""
            write_employees(employees)
            for token, session_user in list(SESSIONS.items()):
                if session_user.get("id") == target.get("id"):
                    SESSIONS.pop(token, None)
            self.send_json({"ok": True})
            return

        employee_match = re.fullmatch(r"/api/employees/([a-f0-9]+|default-[a-z0-9-]+)", parsed.path)
        if employee_match:
            if require_super_admin(self) is None:
                return
            employees = read_employees()
            next_employees = [employee for employee in employees if employee.get("id") != employee_match.group(1)]
            if len(next_employees) == len(employees):
                self.send_json({"ok": False, "error": "Сотрудник не найден"}, HTTPStatus.NOT_FOUND)
                return
            write_employees(next_employees)
            self.send_json({"ok": True})
            return

        event_match = re.fullmatch(r"/api/events/([a-f0-9]+)", parsed.path)
        if event_match:
            if require_admin(self) is None:
                return
            events = read_events()
            next_events = [event for event in events if event.get("id") != event_match.group(1)]
            if len(next_events) == len(events):
                self.send_json({"ok": False, "error": "Событие не найдено"}, HTTPStatus.NOT_FOUND)
                return
            write_events(next_events)
            self.send_json({"ok": True})
            return

        link_match = re.fullmatch(r"/api/links/([a-f0-9]+)", parsed.path)
        if link_match:
            if require_super_admin(self) is None:
                return
            links = read_links()
            next_links = [link for link in links if link.get("id") != link_match.group(1)]
            if len(next_links) == len(links):
                self.send_json({"ok": False, "error": "Ссылка не найдена"}, HTTPStatus.NOT_FOUND)
                return
            write_links(next_links)
            self.send_json({"ok": True})
            return

        bug_match = re.fullmatch(r"/api/bugs/([a-f0-9]+)", parsed.path)
        if bug_match:
            if require_super_admin(self) is None:
                return
            bugs = read_bugs()
            next_bugs = [bug for bug in bugs if bug.get("id") != bug_match.group(1)]
            if len(next_bugs) == len(bugs):
                self.send_json({"ok": False, "error": "Сообщение не найдено"}, HTTPStatus.NOT_FOUND)
                return
            write_bugs(next_bugs)
            self.send_json({"ok": True})
            return

        self.send_error(HTTPStatus.NOT_FOUND)


if __name__ == "__main__":
    ensure_storage()
    server = ThreadingHTTPServer(("127.0.0.1", 4173), GravityHandler)
    print("Центр Притяжения: http://127.0.0.1:4173")
    server.serve_forever()
