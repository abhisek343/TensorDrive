TensorDrive 🚗

What is TensorDrive?
TensorDrive is a fun and educational web app that simulates self-driving cars in a 2D world, right in your browser! It uses artificial intelligence (AI) to control cars, starting with a simple neural network and upgrading to a more advanced model trained with TensorFlow.js. Whether you're a beginner or an experienced developer, you can explore, contribute, and learn about AI, web development, and simulations.

Table of Contents

What is TensorDrive?
How It Works
Key Features
Tech Stack
Getting Started
Running the App
Contributing
Troubleshooting
Roadmap
License

How It Works
TensorDrive trains AI to drive cars in a 2D environment using these steps:

Start Simple: Cars are controlled by a basic Feedforward Neural Network (FNN), like a beginner driver.
Collect Data: The best-performing car shares its "driving experience" (sensor data and actions).
Train in Browser: TensorFlow.js uses this data to train a smarter AI model while you watch.
Upgrade Control: When the new model is good enough, it takes over, making the car drive better!

This all happens in your browser, with data saved to a database so you can pick up where you left off.
Key Features

🚗 2D Driving Simulation: Watch cars navigate using HTML Canvas, with realistic physics and sensors.
🧠 AI Brain Switch: Seamlessly upgrades from a simple FNN to a trained TensorFlow.js model.
🌐 Browser-Based AI: Train and run AI models without needing a powerful server.
🔒 User Accounts: Sign up, log in, and save your progress securely.
💾 Save Models: Store and load your trained AI models to keep improving.

Tech Stack

Frontend: React (web interface), TypeScript (safe coding), TensorFlow.js (AI), React Router (navigation)
Backend: Node.js, Express (API), TypeScript, PostgreSQL (database), JWT (secure login), Bcrypt (password safety)
Tools: npm (package manager), nodemon (auto-restart server), ts-node (run TypeScript)

Getting Started
Follow these steps to set up TensorDrive on your computer. Don’t worry if you’re new—we’ll guide you!
Prerequisites

Node.js: Download and install from nodejs.org (v14 or later).
PostgreSQL: Install a free database from postgresql.org or use a tool like pgAdmin.
Git: Install from git-scm.com to clone the project.
Code Editor: Try VS Code (free and beginner-friendly).

Setup Checklist

Clone the Project:
git clone https://github.com/abhisek343/TensorDrive.git
cd TensorDrive


Set Up the Backend:
cd server
npm install


Copy the example environment file:cp .env.example .env


Open .env in a text editor and add:
PostgreSQL details (e.g., DB_USER=your_username, DB_PASSWORD=your_password, DB_NAME=tensordrive).
A secret key for JWT_SECRET (e.g., JWT_SECRET=your_unique_secret_123).




Set Up the Database:

Start PostgreSQL on your computer.
Create a database named tensordrive:psql -U your_username -c "CREATE DATABASE tensordrive;"


Run the schema.sql file to create tables (you’ll need to create this file based on the example below):-- server/schema.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE models (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    model_name VARCHAR(100) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    score INTEGER NOT NULL,
    model_id INTEGER REFERENCES models(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE training_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


Save this as server/schema.sql and run:psql -U your_username -d tensordrive -f server/schema.sql




Set Up the Frontend:
cd ../client
npm install



Running the App
You’ll need two terminal windows (open two VS Code terminals or command prompts).

Start the Backend:
cd server
npm start


Look for a message like Server running on port 5000 and Database connected.


Start the Frontend:
cd client
npm start


Your browser should open http://localhost:3000. If not, visit that URL.


Try It Out:

Sign up or log in.
Start the simulation to see cars drive with AI.
Check the browser console (right-click → Inspect → Console) for training updates.
When the AI improves, it’ll switch to a smarter model automatically!



Contributing
We love contributions from everyone, especially beginners! Here’s how you can help:

Report Bugs: Find something broken? Open an issue on GitHub.
Suggest Features: Have an idea? Share it in an issue.
Fix or Add Code:
Fork the repository (click “Fork” on GitHub).
Clone your fork: git clone https://github.com/your-username/TensorDrive.git.
Create a branch: git checkout -b my-feature.
Make changes and test them.
Commit: git commit -m "Add my feature".
Push: git push origin my-feature.
Open a pull request on GitHub.


Improve Docs: Fix typos or clarify this README.
Beginner Tasks: Check issues labeled “good first issue” on GitHub.

No contribution is too small! If you’re stuck, ask for help in an issue.
Troubleshooting

PostgreSQL Error: Ensure PostgreSQL is running and .env has correct DB_USER, DB_PASSWORD, and DB_NAME.
npm install Fails: Run npm cache clean --force and try again.
Simulation Slow: Use Chrome or Firefox, and ensure your computer has 8GB+ RAM.
No Cars Moving: Check the browser console for errors and ensure the backend is running.

Still stuck? Open an issue on GitHub, and we’ll help!
Roadmap

🚀 Add multiplayer mode for cars to compete.
📱 Make the simulation work on phones.
🧠 Support more advanced AI models (e.g., deeper neural networks).
📊 Show training progress in the UI.

Want to help with these? Check the Contributing section!
License
MIT License© 2024 Abhisek Behera

