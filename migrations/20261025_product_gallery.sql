-- Additive migration: existing cover photos and listings are preserved.
ALTER TABLE products ADD COLUMN gallery TEXT NOT NULL DEFAULT '[]';
