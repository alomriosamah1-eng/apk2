/** Complete SQL schema string for creating all tables and indexes. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'personal',
    icon TEXT DEFAULT 'shield-lock',
    color TEXT DEFAULT '#6C63FF',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_accessed_at INTEGER,
    is_locked INTEGER NOT NULL DEFAULT 1,
    encrypted_pin_hash TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    failed_attempts INTEGER DEFAULT 0,
    locked_until INTEGER,
    item_count INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    backup_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    vault_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER DEFAULT 0,
    encrypted_path TEXT,
    encrypted_data TEXT,
    thumbnail_path TEXT,
    metadata_json TEXT,
    is_favorite INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    vault_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    encrypted_content TEXT NOT NULL,
    is_encrypted INTEGER NOT NULL DEFAULT 1,
    color TEXT,
    is_pinned INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passwords (
    id TEXT PRIMARY KEY NOT NULL,
    vault_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    service_url TEXT,
    username TEXT,
    encrypted_password TEXT NOT NULL,
    category TEXT,
    notes TEXT,
    strength_score INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY NOT NULL,
    vault_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_metadata (
    id TEXT PRIMARY KEY NOT NULL,
    version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    file_size INTEGER,
    checksum TEXT,
    is_encrypted INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_items_vault_id ON items(vault_id);
CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(is_deleted);
CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
CREATE INDEX IF NOT EXISTS idx_notes_vault_id ON notes(vault_id);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_passwords_vault_id ON passwords(vault_id);
CREATE INDEX IF NOT EXISTS idx_passwords_category ON passwords(category);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
`;
