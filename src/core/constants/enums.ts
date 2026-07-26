/** Available visual theme modes. */
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  AMOLED = 'amoled',
  SYSTEM = 'system',
}

/** Categorisation of vault types. */
export enum VaultType {
  PERSONAL = 'personal',
  WORK = 'work',
  PRIVATE = 'private',
  CUSTOM = 'custom',
}

/** Types of items that can be stored in a vault. */
export enum ItemType {
  FOLDER = 'folder',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  FILE = 'file',
  NOTE = 'note',
  PASSWORD = 'password',
}

/** Supported authentication methods. */
export enum AuthMethod {
  PIN = 'pin',
  PASSWORD = 'password',
  BIOMETRIC = 'biometric',
  PATTERN = 'pattern',
}

/** Auto-lock timeout options. */
export enum LockType {
  IMMEDIATE = 'immediate',
  AFTER_30S = 'after_30s',
  AFTER_1M = 'after_1m',
  AFTER_5M = 'after_5m',
  AFTER_15M = 'after_15m',
  NEVER = 'never',
}

/** Actions recorded in the activity log. */
export enum ActivityAction {
  CREATE_VAULT = 'create_vault',
  DELETE_VAULT = 'delete_vault',
  LOCK_VAULT = 'lock_vault',
  UNLOCK_VAULT = 'unlock_vault',
  ADD_ITEM = 'add_item',
  DELETE_ITEM = 'delete_item',
  MOVE_ITEM = 'move_item',
  RENAME_ITEM = 'rename_item',
  EXPORT_ITEM = 'export_item',
  CREATE_NOTE = 'create_note',
  EDIT_NOTE = 'edit_note',
  DELETE_NOTE = 'delete_note',
  ADD_PASSWORD = 'add_password',
  EDIT_PASSWORD = 'edit_password',
  DELETE_PASSWORD = 'delete_password',
  LOGIN = 'login',
  LOGIN_FAILED = 'login_failed',
  BACKUP_CREATED = 'backup_created',
  BACKUP_RESTORED = 'backup_restored',
  SETTINGS_CHANGED = 'settings_changed',
}

/** Sortable field options. */
export enum SortBy {
  NAME = 'name',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  SIZE = 'size',
  TYPE = 'type',
}

/** Sort direction options. */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/** Current state of a system permission. */
export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNDETERMINED = 'undetermined',
  LIMITED = 'limited',
}
