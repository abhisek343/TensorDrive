Markdown

# Self-Driving Car Simulation with FNN-TF.js Pipeline

## Project Vision & Goal

This project implements a multi-user, web-based self-driving car simulation platform. The core concept involves training an AI car initially controlled by a simple Feedforward Neural Network (FNN), capturing its driving data (sensor inputs, control outputs), and using that data to train a more sophisticated TensorFlow.js (TF.js) model directly in the user's browser. The system features an automated "brain handoff" mechanism, switching control from the FNN to the trained TF.js model once it meets a defined performance threshold.

Users can register, log in, save simulation sessions, manage training data, and interact with different AI models within a real-time 2D simulation environment.

## Key Features

* **Real-time 2D Simulation**: Built using HTML Canvas API and TypeScript, featuring multiple AI cars, dummy traffic, road boundaries, and basic physics.
* **FNN Control & Evolution**: AI cars initially use a basic FNN. The best-performing FNN brain's structure can be persisted via `localStorage`.
* **In-Browser TF.js Training**: Captures input (sensor readings, risk score) and output (control actions) data from the best FNN car during simulation. This data is used to asynchronously train a TF.js model in the browser background.
* **Automated Brain Handoff**: Once the TF.js model reaches a target training loss, the system automatically switches control of the AI car from the FNN to the newly trained TF.js model.
* **User Authentication**: Secure user registration and login system using JWT (jsonwebtoken) for session management and bcrypt for password hashing.
* **Backend Data Persistence**:
    * User accounts stored securely.
    * Simulation session results (score, model used, etc.) saved per user.
    * Captured FNN training data saved per user.
    * Successfully trained TF.js models automatically uploaded to the server.
* **Model Management**: Users can manually load previously saved/uploaded TF.js models. The system lists available models fetched from the backend.
* **Full-Stack Architecture**: Clear separation between the React/TypeScript frontend and the Node.js/Express/TypeScript backend.

## Technologies Used

* **Frontend**:
    * React (v19)
    * TypeScript
    * TensorFlow.js (TF.js)
    * HTML Canvas API
    * React Router (v7)
    * CSS
* **Backend**:
    * Node.js
    * Express (v5)
    * TypeScript
    * PostgreSQL (using `pg` library)
    * jsonwebtoken (JWT)
    * bcrypt
    * Multer (for file uploads)
* **Database**:
    * PostgreSQL
* **Development**:
    * `nodemon` (for backend auto-restart)
    * `ts-node` (for running TS backend directly)
    * `concurrently` (or similar, assumed for running both client/server)

## Project Structure

/
├── client/       # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/ # UI Components (CarSimulation, AIControlPanel, Auth pages...)
│   │   ├── hooks/      # Custom Hooks (useSimulationCore...)
│   │   ├── simulation/ # Core simulation logic (Car, Road, Sensor, NN, TFBrain...)
│   │   ├── utils/      # Utility functions (apiClient, modelLoader, trainTfModel...)
│   │   ├── App.tsx     # Main routing
│   │   └── index.tsx   # Entry point
│   ├── package.json
│   └── tsconfig.json
│
├── server/       # Node.js Backend
│   ├── public/
│   │   └── models/ # Statically served TF.js models
│   ├── src/
│   │   ├── controllers/ # Request handlers (auth, models, sessions, trainingData)
│   │   ├── middleware/  # Express middleware (auth, upload)
│   │   ├── routes/      # API route definitions
│   │   ├── db.ts        # Database connection setup
│   │   └── server.ts    # Express server setup
│   ├── package.json
│   ├── tsconfig.json
│   └── nodemon.json # Recommended nodemon configuration
│
└── README.md     # This file


## Setup and Installation

**Prerequisites:**

* Node.js (Check `server/package.json` for recommended version, likely >=14)
* npm or yarn
* PostgreSQL Database Server

**1. Clone Repository:**

```bash
git clone <your-repository-url>
cd <your-repository-name>
2. Backend Setup:

Bash

cd server

# Install dependencies
npm install
# or: yarn install

# Create a .env file in the server/ directory
# Add your database credentials and a strong JWT secret:
# Example .env content:
# PORT=5000
# DB_USER=postgres
# DB_HOST=localhost
# DB_NAME=carlogic # Or your preferred DB name
# DB_PASSWORD=your_db_password
# DB_PORT=5432
# JWT_SECRET=your_very_strong_jwt_secret_key_here

# Setup PostgreSQL Database
# 1. Connect to your PostgreSQL server (e.g., using psql or a GUI like pgAdmin)
# 2. Create the database (if it doesn't exist):
#    CREATE DATABASE carlogic; # Or the name you put in .env
# 3. Connect to the newly created database.
# 4. Run the SQL schema commands (create tables - provide schema.sql or describe below)
#    (You need to provide the SQL commands to create the users, sessions, models, training_data tables)

# Create nodemon.json file (if not present) in server/ directory
# See "Recommended nodemon.json" section below.

cd ..
3. Frontend Setup:

Bash

cd client

# Install dependencies
npm install
# or: yarn install

cd ..
4. Database Schema SQL (Example - provide your actual schema)

SQL

-- Example schema - Replace with your actual CREATE TABLE statements

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Enable UUID generation if needed

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    url_path TEXT NOT NULL,
    input_shape JSONB, -- Store array like '[6]'
    output_nodes INTEGER,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Foreign Key
    score INTEGER,
    path JSONB, -- Store path data
    model_used TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE training_data (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Foreign Key
    input_data JSONB NOT NULL, -- Store input array
    output_data JSONB NOT NULL, -- Store output array
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance if needed, e.g., on user_id columns
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_training_data_user_id ON training_data(user_id);
5. Recommended nodemon.json (Place in server/)

JSON

{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": [
    "src/**/*.spec.ts",
    "node_modules",
    "build",
    "public/models/*"
  ],
  "exec": "ts-node ./src/server.ts"
}
Running the Application
You can run the client and server separately or use a tool like concurrently.

1. Run Backend Server:

Bash

cd server
npm start
# or: yarn start
# (This assumes your start script uses nodemon with ts-node)
The server should start on http://localhost:5000 (or the port specified in .env).

2. Run Frontend Client:

Open another terminal:

Bash

cd client
npm start
# or: yarn start
The frontend development server should start, usually on http://localhost:3000, and open in your browser.

API Endpoints
Auth:
POST /api/auth/register - Register a new user ({username, password})
POST /api/auth/login - Log in a user ({username, password}), returns JWT token.
Models:
GET /api/models - List metadata of available saved models (Public).
POST /api/models/upload - Upload a new model (model.json, model.weights.bin files + modelName, description fields) (Requires Auth).
Sessions: (All Require Auth)
POST /api/sessions - Save session data ({score, path, model_used}).
GET /api/sessions - Get list of user's past sessions.
GET /api/sessions/:id - Get details of a specific session.
Training Data: (Requires Auth)
POST /api/training-data - Upload a batch of training data points ({ dataBatch: [{input: [], output: []}, ...] }).
Known Issues / Future Enhancements
Frontend Auth Check: Currently relies on client-side token decoding. Needs a backend endpoint (/api/auth/me?) to securely verify token on load.
Model Metadata Parsing: The backend logic for extracting shapes/nodes from uploaded model.json might need refinement based on the exact TF.js save format.
TF Driving Performance: The quality of TF driving depends heavily on FNN data quality and hyperparameter tuning.
Path Tracking: Session saving includes a path field, but the actual path recording logic might be placeholder.
UI Feedback: More robust user feedback for errors (API calls, model loading) could be added.
Genetic Algorithm: The FNN evolution part using GA mentioned in the vision might be basic or not fully implemented.
Resource Usage: Simulating many cars is intensive; optimizations (fewer cars, less frequent updates) might be needed for lower-end machines.
License
(Specify your license here, e.g., MIT License)