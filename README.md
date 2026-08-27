# Auth & Protected API (Backend Track Week 2)

A secure Node.js/Express API featuring user authentication, local JWT verification, protected endpoints, and PostgreSQL database storage.

## Features
- **User Authentication:** Sign up, log in, and log out functionality.
- **JWT Verification:** Custom auth middleware securing private routes via `Authorization: Bearer <token>`.
- **Database Integration:** User and task records stored securely in PostgreSQL.
- **API Documentation:** Interactive Swagger UI documentation with Bearer Auth support.

---

## Environment Setup

Create a `.env` file in the root directory based on `.env.example`:

\`\`\`env
PORT=3000
JWT_SECRET=your-secret-key
DATABASE_URL=postgres://username:password@localhost:5432/yourdatabase
\`\`\`

---

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run the server:
   \`\`\`bash
   node server.js
   \`\`\`

3. Access Swagger UI Documentation:
   Navigate to `http://localhost:3000/docs` in your browser.

---

## API Reference

| Endpoint | Method | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `/public/info` | GET | Read public open information | No |
| `/auth/signup` | POST | Register a new user account | No |
| `/auth/login` | POST | Authenticate user & return JWT | No |
| `/auth/logout` | POST | End user session | Yes (`Bearer Token`) |
| `/protected/profile` | GET | Fetch private user profile | Yes (`Bearer Token`) |
| `/protected/dashboard`| GET | Fetch private user dashboard | Yes (`Bearer Token`) |
| `/tasks` | GET / POST | Manage user-bound tasks | Yes (`Bearer Token`) |