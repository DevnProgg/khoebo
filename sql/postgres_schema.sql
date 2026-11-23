BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 17181c55d223

CREATE TABLE users (
    id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL,
    is_superuser BOOLEAN NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE businesses (
    id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_businesses PRIMARY KEY (id),
    CONSTRAINT fk_businesses_owner_id_users FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_businesses_owner_id ON businesses (owner_id);

CREATE UNIQUE INDEX ix_businesses_slug ON businesses (slug);

CREATE TABLE refresh_tokens (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT fk_refresh_tokens_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE accounts (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(20) NOT NULL,
    is_system BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_accounts PRIMARY KEY (id),
    CONSTRAINT fk_accounts_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT uq_accounts_business_code UNIQUE (business_id, code)
);

CREATE INDEX ix_accounts_business_id ON accounts (business_id);

CREATE TABLE business_members (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_business_members PRIMARY KEY (id),
    CONSTRAINT fk_business_members_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT fk_business_members_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT uq_business_members_business_user UNIQUE (business_id, user_id)
);

CREATE INDEX ix_business_members_business_id ON business_members (business_id);

CREATE INDEX ix_business_members_user_id ON business_members (user_id);

CREATE TABLE journal_entries (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    entry_date DATE NOT NULL,
    memo VARCHAR(255) NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(64),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_journal_entries PRIMARY KEY (id),
    CONSTRAINT fk_journal_entries_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT fk_journal_entries_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_journal_entries_business_id ON journal_entries (business_id);

CREATE TABLE products (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_price NUMERIC(14, 2) NOT NULL,
    cost_price NUMERIC(14, 2) NOT NULL,
    stock_quantity NUMERIC(14, 3) NOT NULL,
    low_stock_threshold NUMERIC(14, 3) NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_products PRIMARY KEY (id),
    CONSTRAINT fk_products_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT uq_products_business_sku UNIQUE (business_id, sku)
);

CREATE INDEX ix_products_business_id ON products (business_id);

CREATE TABLE reminders (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    user_id UUID NOT NULL,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    frequency VARCHAR(20) NOT NULL,
    next_due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_reminders PRIMARY KEY (id),
    CONSTRAINT fk_reminders_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT fk_reminders_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_reminders_business_id ON reminders (business_id);

CREATE INDEX ix_reminders_user_id ON reminders (user_id);

CREATE TABLE sales (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    reference VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL,
    discount_amount NUMERIC(14, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL,
    tax_amount NUMERIC(14, 2) NOT NULL,
    total NUMERIC(14, 2) NOT NULL,
    notes TEXT,
    created_by UUID,
    refunded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_sales PRIMARY KEY (id),
    CONSTRAINT fk_sales_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT fk_sales_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT uq_sales_business_reference UNIQUE (business_id, reference)
);

CREATE INDEX ix_sales_business_id ON sales (business_id);

CREATE TABLE expenses (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    account_id UUID NOT NULL,
    journal_entry_id UUID,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_expenses PRIMARY KEY (id),
    CONSTRAINT fk_expenses_account_id_accounts FOREIGN KEY(account_id) REFERENCES accounts (id) ON DELETE RESTRICT,
    CONSTRAINT fk_expenses_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT fk_expenses_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_expenses_journal_entry_id_journal_entries FOREIGN KEY(journal_entry_id) REFERENCES journal_entries (id) ON DELETE SET NULL
);

CREATE INDEX ix_expenses_business_id ON expenses (business_id);

CREATE TABLE journal_lines (
    id UUID NOT NULL,
    journal_entry_id UUID NOT NULL,
    account_id UUID NOT NULL,
    description VARCHAR(255),
    debit NUMERIC(14, 2) NOT NULL,
    credit NUMERIC(14, 2) NOT NULL,
    CONSTRAINT pk_journal_lines PRIMARY KEY (id),
    CONSTRAINT ck_journal_lines_single_sided CHECK (NOT (debit > 0 AND credit > 0)),
    CONSTRAINT ck_journal_lines_credit_non_negative CHECK (credit >= 0),
    CONSTRAINT ck_journal_lines_debit_non_negative CHECK (debit >= 0),
    CONSTRAINT fk_journal_lines_account_id_accounts FOREIGN KEY(account_id) REFERENCES accounts (id) ON DELETE RESTRICT,
    CONSTRAINT fk_journal_lines_journal_entry_id_journal_entries FOREIGN KEY(journal_entry_id) REFERENCES journal_entries (id) ON DELETE CASCADE
);

CREATE INDEX ix_journal_lines_account_id ON journal_lines (account_id);

CREATE INDEX ix_journal_lines_journal_entry_id ON journal_lines (journal_entry_id);

CREATE TABLE sale_items (
    id UUID NOT NULL,
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL,
    unit_price NUMERIC(14, 2) NOT NULL,
    unit_cost NUMERIC(14, 2) NOT NULL,
    line_total NUMERIC(14, 2) NOT NULL,
    CONSTRAINT pk_sale_items PRIMARY KEY (id),
    CONSTRAINT fk_sale_items_product_id_products FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT,
    CONSTRAINT fk_sale_items_sale_id_sales FOREIGN KEY(sale_id) REFERENCES sales (id) ON DELETE CASCADE
);

CREATE INDEX ix_sale_items_product_id ON sale_items (product_id);

CREATE INDEX ix_sale_items_sale_id ON sale_items (sale_id);

CREATE TABLE stock_movements (
    id UUID NOT NULL,
    business_id UUID NOT NULL,
    product_id UUID NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL,
    unit_cost NUMERIC(14, 2),
    reason VARCHAR(255),
    reference_type VARCHAR(50),
    reference_id VARCHAR(64),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    CONSTRAINT pk_stock_movements PRIMARY KEY (id),
    CONSTRAINT fk_stock_movements_business_id_businesses FOREIGN KEY(business_id) REFERENCES businesses (id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_movements_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_stock_movements_product_id_products FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE CASCADE
);

CREATE INDEX ix_stock_movements_business_id ON stock_movements (business_id);

CREATE INDEX ix_stock_movements_product_id ON stock_movements (product_id);

INSERT INTO alembic_version (version_num) VALUES ('17181c55d223') RETURNING alembic_version.version_num;

-- Running upgrade 17181c55d223 -> 3d8e6e1f4a2b

UPDATE businesses SET currency = 'LSL';

ALTER TABLE businesses ALTER COLUMN currency SET DEFAULT 'LSL';

UPDATE alembic_version SET version_num='3d8e6e1f4a2b' WHERE alembic_version.version_num = '17181c55d223';

-- Running upgrade 3d8e6e1f4a2b -> e4353398e982

ALTER TABLE businesses ADD COLUMN business_model VARCHAR(20);

UPDATE businesses SET business_model = 'hybrid';

ALTER TABLE businesses ALTER COLUMN business_model SET NOT NULL;

ALTER TABLE businesses ALTER COLUMN business_model SET DEFAULT 'stock';

UPDATE alembic_version SET version_num='e4353398e982' WHERE alembic_version.version_num = '3d8e6e1f4a2b';

-- Running upgrade e4353398e982 -> 20ac806b791a

ALTER TABLE sales ADD COLUMN amount_paid NUMERIC(14, 2);

ALTER TABLE sales ADD COLUMN change_given NUMERIC(14, 2) DEFAULT 0 NOT NULL;

UPDATE alembic_version SET version_num='20ac806b791a' WHERE alembic_version.version_num = 'e4353398e982';

COMMIT;

