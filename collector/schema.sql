-- Proof of Life telemetry (D1). One row per install per ISO week.
-- No IP address, no user agent, no timestamps finer than a UTC day.
CREATE TABLE IF NOT EXISTS heartbeats (
  install_id      TEXT    NOT NULL,           -- random 32-hex ID made on the user's machine
  iso_week        TEXT    NOT NULL,           -- '2026-W41'
  received_day    TEXT    NOT NULL,           -- UTC date the collector got it, 'YYYY-MM-DD'
  app_version     TEXT    NOT NULL,
  runs_hatched    INTEGER NOT NULL,           -- runs in the 7 days before sending
  active_days     INTEGER NOT NULL,           -- 0-7
  runs_by_species TEXT    NOT NULL,           -- JSON {cog, scholar, moth, prism, lumen, hydra, wisp}
  agent           TEXT    NOT NULL,           -- 'claude-code'
  PRIMARY KEY (install_id, iso_week)
);
CREATE INDEX IF NOT EXISTS heartbeats_week ON heartbeats (iso_week);
