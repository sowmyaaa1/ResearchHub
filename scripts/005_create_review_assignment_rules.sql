CREATE TABLE IF NOT EXISTS review_assignment_rules (
  id INTEGER PRIMARY KEY,
  keywords TEXT,
  expertise TEXT,
  reviewer_count INTEGER,
  updated_at TIMESTAMP
);
