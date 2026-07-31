# CAPACITY BUILDING
### Internal Service Desk & Task Allocation Portal

A central digital gatekeeper that replaces informal "walk-in" requests with
tracked, deadline-driven service tickets — sorted by urgency, worked in
FIFO order, and closed out with a delivered file.

---

## 1. Tech Stack

| Layer      | Choice                                            |
|------------|----------------------------------------------------|
| Database   | PostgreSQL                                         |
| Backend    | Node.js + Express.js (modular MVC)                 |
| Frontend   | HTML5 + Vanilla JS (Fetch API) + Tailwind CSS (CDN) |
| Auth       | JWT (Bearer token) + bcrypt password hashing        |
| File I/O   | Multer (disk storage under `/uploads`)              |
| Email      | Nodemailer (SMTP)                                   |

## 2. Project Structure

```
isrs-capacity-building/
├── config/db.js              PostgreSQL connection pool
├── models/                   SQL query functions per table
├── controllers/               Express request handlers
├── routes/                    URL endpoint definitions
├── middleware/                 authMiddleware.js, uploadMiddleware.js
├── uploads/{briefs,deliverables}
├── views/                     login.html, dashboard.html, admin.html, app.js
├── db/schema.sql, db/init.js
├── server.js
└── package.json
```

## 3. Setup

### 3.1 Install dependencies
```bash
cd isrs-capacity-building
npm install
```

### 3.2 Configure environment
```bash
cp .env.example .env
# edit .env with your PostgreSQL credentials, JWT secret, and SMTP settings
```

### 3.3 Create the database
```bash
createdb isrs_capacity_building
```

### 3.4 Apply schema + seed a default Admin account
```bash
npm run db:init
```
This creates all 6 tables, the required performance indexes, the 3 fixed
roles (Requester, Assignee, Admin), and a default Admin login
(`admin@capacitybuilding.local` / `ChangeMe123!` unless overridden via
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`). **Change this
password immediately after first login** — there is no in-app password
reset yet, so update it directly via the `users` table or add one before
production use.

### 3.5 Run the server
```bash
npm run dev     # nodemon, auto-restart
# or
npm start
```
Visit `http://localhost:4000` → redirects to the login screen.

## 4. Roles & Workflow

1. **Requester** logs in with corporate email → `[ + Create Request ]` →
   picks target department, category, title, description, due date, and
   attaches a brief → `[ Submit Request ]`.
2. **Service Lead / Assignee** sees their department's queue, sorted by
   `requested_due_date ASC` then `created_at ASC` (FIFO tie-break), with
   color badges:
   - 🔴 RED — due within 24h or overdue
   - 🟠 ORANGE — due in 2–3 days
   - 🟢 GREEN — due 3+ days out
   Clicks `[ Start Working ]` to claim it (status → `IN_PROGRESS`,
   requester notified by email), discusses via task-card comments, then
   `[ Complete & Deliver ]` to upload the finished file (status →
   `COMPLETED`, requester notified with a download link).
3. **System Admin** manages Users, Departments, and Categories (full CRUD)
   and views system-wide + per-department workload metrics from the Admin
   Console.

## 5. API Overview

| Method | Endpoint                              | Who              |
|--------|----------------------------------------|------------------|
| POST   | `/api/auth/register`                  | Public (Requester only) |
| POST   | `/api/auth/login`                     | Public           |
| GET    | `/api/auth/me`                        | Authenticated    |
| POST   | `/api/requests`                       | Requester        |
| GET    | `/api/requests/mine`                  | Requester        |
| POST   | `/api/requests/:id/cancel`            | Requester        |
| GET    | `/api/requests/queue`                 | Assignee/Admin   |
| POST   | `/api/requests/:id/start`             | Assignee/Admin   |
| POST   | `/api/requests/:id/deliver`           | Assignee/Admin   |
| GET    | `/api/requests/:id`                   | Owner/Dept/Admin |
| GET    | `/api/requests/:id/download`          | Owner/Dept/Admin |
| GET/POST | `/api/requests/:id/comments`        | Owner/Dept/Admin |
| GET/POST/PUT/DELETE | `/api/admin/users`       | Admin            |
| GET/POST/PUT/DELETE | `/api/admin/departments` | Admin            |
| GET/POST/PUT/DELETE | `/api/admin/categories` | Admin            |
| GET    | `/api/admin/overview`                 | Admin            |

## 6. Notes & Next Steps

- Email delivery is skipped gracefully (with a console warning) if SMTP
  env vars aren't set — the workflow keeps working without a mail server.
- Priority badges (`RED`/`ORANGE`/`GREEN`) are computed live from
  `requested_due_date`, so they stay accurate without a background job.
- The frontend uses Tailwind via CDN for a fast start; swap for a build
  step (Tailwind CLI/PostCSS) before production if you want a purged,
  optimized stylesheet.
- Add a password-reset flow and refresh tokens before shipping to
  production — current auth is a straightforward JWT bearer token with an
  8h expiry.
