const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");

const app = express();
app.use(express.json());

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

// Stage 2: GET /tasks
app.get("/tasks", (req, res) => {
    res.json(tasks);
});

// Stage 2: GET /tasks/:id
app.get("/tasks/:id", (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    res.json(task);
});

// Stage 3: POST /tasks
app.post("/tasks", (req, res) => {
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Title is required and mustn't be empty" });
    }

    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    const newTask = { id: newId, title: title.trim(), done: false };

    tasks.push(newTask);
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