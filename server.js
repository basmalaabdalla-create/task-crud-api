const express = require("express");
const app = express();

// FIX 1: Add this middleware so Express can read incoming JSON request bodies
app.use(express.json());

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

// Stage 2: returns whole list
app.get("/tasks", (req, res) => {
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

// Stage 3: POST /tasks - Create a new task
app.post("/tasks", (req, res) => {
    // FIX 2: Extract 'title' from the req.body object
    const { title } = req.body;

    // Input Validation
    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and mustn't be empty" });
    }

    // Auto-generate the next free ID
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;

    const newTask = {
        id: newId,
        title: title.trim(),
        done: false
    };

    tasks.push(newTask);

    // Return status 201 Created with the new task object
    res.status(201).json(newTask);
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});