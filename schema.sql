-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MODELS TABLE
CREATE TABLE models (
    name TEXT PRIMARY KEY, -- Same as uploaded model.json name
    description TEXT,
    url_path TEXT NOT NULL UNIQUE, -- e.g. /models/model1/model.json
    input_shape JSONB,             -- e.g. [5]
    output_nodes INT,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SESSIONS TABLE
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    score INT,                           -- Rounded score
    path JSONB,                          -- Optional: Store car trajectory/decision path
    model_used TEXT REFERENCES models(name) ON DELETE SET NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TRAINING DATA TABLE
CREATE TABLE training_data (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    input JSONB NOT NULL,   -- e.g. { "sensor_readings": [...] }
    output JSONB NOT NULL,  -- e.g. { "steering": 0.2 }
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
