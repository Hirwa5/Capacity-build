-- =====================================================================
-- CAPACITY BUILDING - Internal Service Desk & Task Allocation Portal
-- PostgreSQL Schema
-- =====================================================================

CREATE TABLE IF NOT EXISTS departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL UNIQUE  -- Requester | Assignee | Admin
);

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    department_id   INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id              SERIAL PRIMARY KEY,
    department_id   INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    category_name   VARCHAR(150) NOT NULL,
    description     TEXT
);

CREATE TABLE IF NOT EXISTS requests (
    id                      SERIAL PRIMARY KEY,
    requester_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_department_id    INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    category_id             INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title                   VARCHAR(200) NOT NULL,
    description             TEXT,
    priority                VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- NORMAL | HIGH | URGENT (derived, but stored for filtering)
    status                  VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING | IN_PROGRESS | COMPLETED | CANCELLED | DECLINED
    requested_due_date      TIMESTAMPTZ NOT NULL,
    attachment_url          VARCHAR(500),
    completed_attachment_url VARCHAR(500),
    assigned_to             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_comments (
    id              SERIAL PRIMARY KEY,
    request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT,
    attachment_url  VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Performance indexes (per spec: due_date, created_at, status, dept)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_requests_due_date        ON requests (requested_due_date ASC);
CREATE INDEX IF NOT EXISTS idx_requests_created_at       ON requests (created_at ASC);
CREATE INDEX IF NOT EXISTS idx_requests_status           ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_target_dept      ON requests (target_department_id);
-- Composite index matching the primary queue sort (due_date ASC, created_at ASC)
CREATE INDEX IF NOT EXISTS idx_requests_queue_sort       ON requests (target_department_id, status, requested_due_date ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comments_request_id       ON request_comments (request_id);

-- ---------------------------------------------------------------------
-- Seed roles (fixed set used by the app)
-- ---------------------------------------------------------------------
INSERT INTO roles (role_name) VALUES ('Requester') ON CONFLICT (role_name) DO NOTHING;
INSERT INTO roles (role_name) VALUES ('Assignee')  ON CONFLICT (role_name) DO NOTHING;
INSERT INTO roles (role_name) VALUES ('Admin')     ON CONFLICT (role_name) DO NOTHING;

-- ---------------------------------------------------------------------
-- Trigger to keep updated_at current on requests
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_updated_at ON requests;
CREATE TRIGGER trg_requests_updated_at
BEFORE UPDATE ON requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
