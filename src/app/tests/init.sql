CREATE TABLE IF NOT EXISTS setari (cheie TEXT PRIMARY KEY, valoare TEXT);
CREATE TABLE IF NOT EXISTS rate_log (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT NOT NULL, ip TEXT NOT NULL, creat TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
-- cheia de test a moderatorului: Cheie-Locala-Test-2026 (doar pentru baza locală)
INSERT OR REPLACE INTO setari VALUES ('app_mod_salt','saretest'),('app_mod_hash','7d6384b69061958bf72a09cb234a5d7233d0d9d247aad0372a163629ec8ef38c');
