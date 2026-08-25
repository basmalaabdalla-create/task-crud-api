# To-Do List CRUD API

A simple RESTful API built with Node.js, Express, and Swagger UI to manage a To-Do list in memory.

## How to Install & Run

1. Clone the repository:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd task-crud-api

# ENDPOINTS

GET / : API information
GET /health : Server health status
GET /tasks : View all tasks
GET /tasks/:id : View a specific task
POST /tasks : Create a new task
PUT /tasks/:id : Update a task
DELETE /tasks/:id : Delete a task

## Database Overview

This application uses SQLite with the `better-sqlite3` library for persistent storage.

### Schema: `tasks`
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `title` (TEXT, NOT NULL)
- `done` (INTEGER, DEFAULT 0)
