const express = require("express");
const app = express();

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
        endpoints: ["/tasks"]
    });
});

// Stage 1: Health endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

// Stage 1: returns whole list
app.get("/tasks", (req,res) => {
    res.json(tasks);
});

// Stage 2: GET /tasks/:id - Return a single task by ID
app.get("/tasks/:id", (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    res.json(task);
});

app.listen(3000);