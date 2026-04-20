-- people
CREATE TABLE auth.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut VARCHAR(12) UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  birth_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USERS (CLIENTS)
CREATE TABLE auth.user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  people_id UUID NOT NULL,
  password TEXT NOT NULL,
  state BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user_people
    FOREIGN KEY (people_id)
    REFERENCES auth.people(id)
    ON DELETE CASCADE
);