-- MemorialConnect platform layer schema (Neon/PostgreSQL)

-- SaaS plans
CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly_cents INTEGER NOT NULL DEFAULT 0,
    price_yearly_cents INTEGER NOT NULL DEFAULT 0,
    max_users INTEGER,
    max_memorials INTEGER,
    max_requests_per_month INTEGER,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plans_active_idx ON plans (is_active);

-- Organization subscriptions
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED')),
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    trial_ends_at TIMESTAMP,
    current_period_end TIMESTAMP,
    canceled_at TIMESTAMP,
    external_customer_id VARCHAR(255),
    external_subscription_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS organization_subscriptions_org_idx ON organization_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS organization_subscriptions_status_idx ON organization_subscriptions (status);
CREATE UNIQUE INDEX IF NOT EXISTS organization_subscriptions_one_active_idx
    ON organization_subscriptions (organization_id)
    WHERE status IN ('TRIAL', 'ACTIVE', 'PAST_DUE');

-- Marketplace visibility per organization
CREATE TABLE IF NOT EXISTS organization_marketplace_settings (
    organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    is_listed_public BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    public_name VARCHAR(255),
    public_description TEXT,
    website_url VARCHAR(255),
    phone VARCHAR(50),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_marketplace_settings_status_idx
    ON organization_marketplace_settings (status, is_listed_public);

-- Feature flags per organization
CREATE TABLE IF NOT EXISTS organization_feature_flags (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    flag_key VARCHAR(100) NOT NULL,
    flag_value BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS organization_feature_flags_org_idx
    ON organization_feature_flags (organization_id);

-- Global feature flags
CREATE TABLE IF NOT EXISTS global_feature_flags (
    id SERIAL PRIMARY KEY,
    flag_key VARCHAR(100) UNIQUE NOT NULL,
    flag_value BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Global security settings (singleton row)
CREATE TABLE IF NOT EXISTS security_settings_global (
    id SERIAL PRIMARY KEY,
    min_password_length INTEGER NOT NULL DEFAULT 8,
    require_2fa_for_org_admins BOOLEAN NOT NULL DEFAULT FALSE,
    lockout_threshold INTEGER NOT NULL DEFAULT 10,
    lockout_duration_minutes INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ensure only one active row for security settings
CREATE UNIQUE INDEX IF NOT EXISTS security_settings_global_singleton_idx
    ON security_settings_global ((true));

-- Admin actions audit log
CREATE TABLE IF NOT EXISTS admin_actions_log (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_actions_log_admin_idx
    ON admin_actions_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_log_target_idx
    ON admin_actions_log (target_type, target_id);

-- Admin impersonations (optional)
CREATE TABLE IF NOT EXISTS admin_impersonations (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    reason TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_impersonations_admin_idx
    ON admin_impersonations (admin_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS admin_impersonations_target_idx
    ON admin_impersonations (target_user_id, started_at DESC);

-- Cemetery sites (branches/physical locations per organization)
CREATE TABLE IF NOT EXISTS cemetery_sites (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    region VARCHAR(100),
    comuna VARCHAR(100),
    address TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique non-null code per organization, if code is used
CREATE UNIQUE INDEX IF NOT EXISTS cemetery_sites_org_code_unique
    ON cemetery_sites (organization_id, code)
    WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cemetery_sites_org
    ON cemetery_sites (organization_id);

CREATE INDEX IF NOT EXISTS idx_cemetery_sites_org_status
    ON cemetery_sites (organization_id, status);

-- Cemetery structure: areas, sectors, subsectors, plot types, plots, spaces

-- Areas (within a site)
CREATE TABLE IF NOT EXISTS cemetery_areas (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES cemetery_sites(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cemetery_areas_site
    ON cemetery_areas (site_id);

CREATE UNIQUE INDEX IF NOT EXISTS cemetery_areas_site_code_unique
    ON cemetery_areas (site_id, code)
    WHERE code IS NOT NULL;

-- Sectors (within an area)
CREATE TABLE IF NOT EXISTS cemetery_sectors (
    id SERIAL PRIMARY KEY,
    area_id INTEGER NOT NULL REFERENCES cemetery_areas(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cemetery_sectors_area
    ON cemetery_sectors (area_id);

CREATE UNIQUE INDEX IF NOT EXISTS cemetery_sectors_area_code_unique
    ON cemetery_sectors (area_id, code)
    WHERE code IS NOT NULL;

-- Subsectors (within a sector)
CREATE TABLE IF NOT EXISTS cemetery_subsectors (
    id SERIAL PRIMARY KEY,
    sector_id INTEGER NOT NULL REFERENCES cemetery_sectors(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cemetery_subsectors_sector
    ON cemetery_subsectors (sector_id);

CREATE UNIQUE INDEX IF NOT EXISTS cemetery_subsectors_sector_code_unique
    ON cemetery_subsectors (sector_id, code)
    WHERE code IS NOT NULL;

-- Plot types (global)
CREATE TABLE IF NOT EXISTS cemetery_plot_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    default_capacity_spaces INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed example types
INSERT INTO cemetery_plot_types (code, name, default_capacity_spaces)
VALUES
('GROUND_SINGLE', 'Tumba Tierra Simple', 1),
('GROUND_DOUBLE', 'Tumba Tierra Doble', 2),
('NICHE_FOUR', 'Nicho para 4 urnas', 4)
ON CONFLICT (code) DO NOTHING;

-- Plots (within a subsector)
CREATE TABLE IF NOT EXISTS cemetery_plots (
    id SERIAL PRIMARY KEY,
    subsector_id INTEGER NOT NULL REFERENCES cemetery_subsectors(id) ON DELETE CASCADE,
    plot_type_id INTEGER NOT NULL REFERENCES cemetery_plot_types(id),
    code VARCHAR(100) NOT NULL,
    row_label VARCHAR(50),
    column_label VARCHAR(50),
    capacity_spaces INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (subsector_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cemetery_plots_subsector
    ON cemetery_plots (subsector_id);

CREATE INDEX IF NOT EXISTS idx_cemetery_plots_type
    ON cemetery_plots (plot_type_id);

-- Spaces (within a plot)
CREATE TABLE IF NOT EXISTS cemetery_spaces (
    id SERIAL PRIMARY KEY,
    plot_id INTEGER NOT NULL REFERENCES cemetery_plots(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','RESERVED','OCCUPIED','LOCKED')),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (plot_id, position)
);

CREATE INDEX IF NOT EXISTS idx_cemetery_spaces_plot
    ON cemetery_spaces (plot_id);

-- Deceased records (per organization/site)
CREATE TABLE IF NOT EXISTS deceased_records (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    rut VARCHAR(20),
    date_of_birth DATE,
    date_of_death DATE NOT NULL,
    notes TEXT,
    plot_id INTEGER NOT NULL REFERENCES cemetery_plots(id),
    space_id INTEGER REFERENCES cemetery_spaces(id),
    organization_id INTEGER NOT NULL,
    site_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deceased_records_site_org
    ON deceased_records (site_id, organization_id, date_of_death DESC);

CREATE INDEX IF NOT EXISTS idx_deceased_records_plot_space
    ON deceased_records (plot_id, space_id);
