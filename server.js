require('dotenv').config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");

const app = express();
app.use(express.json());

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    );
  `);

  const res = await pool.query('SELECT COUNT(*) FROM tasks');
  if (parseInt(res.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO tasks (title, done) VALUES
        ('Learn Docker', false),
        ('Connect Postgres', false),
        ('Ship Assignment 3', false);
    `);
  }
}

initDb().catch(console.error);


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

// PUT /tasks/:id - Update a task in SQLite
app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, done } = req.body;

  // Validate request body
  if (!title || typeof title !== 'string' || title.trim() === '' || typeof done !== 'boolean') {
    return res.status(400).json({ error: "Invalid title or done status" });
  }

  // Convert boolean to 0 or 1 for SQLite
  const doneValue = done ? 1 : 0;

  // Execute update query
  const update = db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?');
  const info = update.run(title.trim(), doneValue, id);

  // If no rows were updated, task doesn't exist
  if (info.changes === 0) {
    return res.status(404).json({ error: "Task not found" });
  }

  // Fetch and return the updated task
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updatedTask);
});

// DELETE /tasks/:id - Delete a task from SQLite
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;

  const del = db.prepare('DELETE FROM tasks WHERE id = ?');
  const info = del.run(id);

  // If no rows were deleted, task doesn't exist
  if (info.changes === 0) {
    return res.status(404).json({ error: "Task not found" });
  }

  // Success: 204 No Content
  res.status(204).send();
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    console.log("Swagger UI available at http://localhost:3000/docs");
});