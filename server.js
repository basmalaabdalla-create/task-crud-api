const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");

const app = express();
app.use(express.json());

const Database = require('better-sqlite3');
const db = new Database('tasks.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER DEFAULT 0
  )
`);

const count = db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count;

if (count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  insert.run('Learn Node.js', 1);
  insert.run('Build a CRUD API', 1);
  insert.run('Connect to SQLite', 0);
}

// Serve Swagger UI at /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// In-memory array pre-filled with 3 example tasks
const tasks = [
    { id: 1, title: "Learn Node.js", done: true },
    { id: 2, title: "Build Stage 2 CRUD endpoints", done: false },
    { id: 3, title: "Push to GitHub", done: false }
];

// Stage 1: Root endpoint
app.get("/", (req, res) => {
    res.json({
        name: "Task API",
        version: "1.0",
        endpoints: ["/tasks", "/docs"]
    });
});

// Stage 1: Health endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// GET /tasks - Read all tasks from SQLite
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.json(tasks);
});

// GET /tasks/:id - Read a single task by ID from SQLite
app.get('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.json(task);
});

// POST /tasks - Create a new task in SQLite
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  // Validate title: missing or empty string returns 400
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: "Title is required" });
  }

  // Insert the task into the database (done defaults to 0/false)
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const result = insert.run(title.trim(), 0);

  // Retrieve the newly created task using its auto-generated ID
  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(newTask);
});

// Stage 4: PUT /tasks/:id
app.put("/tasks/:id", (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    const { title, done } = req.body;

    if (title === undefined && done === undefined) {
        return res.status(400).json({ error: "Request body must contain title or done status" });
    }

    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
        return res.status(400).json({ error: "Title must be a non-empty string" });
    }

    if (title !== undefined) tasks[taskIndex].title = title.trim();
    if (done !== undefined) tasks[taskIndex].done = Boolean(done);

    res.json(tasks[taskIndex]);
});

// Stage 4: DELETE /tasks/:id
app.delete("/tasks/:id", (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    tasks.splice(taskIndex, 1);
    res.status(204).send();
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    console.log("Swagger UI available at http://localhost:3000/docs");
});