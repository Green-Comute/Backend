# 🌱 GreenCommute — Backend

## Intelligent Ride Sharing & Sustainable Mobility API

> Node.js/Express backend for the GreenCommute carpooling platform — featuring JWT auth, geospatial trip matching, real-time tracking, and multi-role access control.

---

## 🚀 Tech Stack

- **Node.js** + **Express.js** v5
- **MongoDB** + **Mongoose** (with GeoJSON & 2dsphere indexes)
- **JWT** Authentication
- **Socket.io** (real-time events)
- **Multer** (file uploads)
- **Nodemailer** (email service)
- **Jest** + **Supertest** + **Sinon** (testing)

---

## 📁 Project Structure

```
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Express app setup
│   ├── config/                # DB & Socket config
│   ├── controllers/           # Route handlers
│   ├── middlewares/            # Auth, role, upload middleware
│   ├── models/                # Mongoose schemas
│   ├── routes/                # API route definitions
│   ├── services/              # Business logic (email, token, ETA)
│   ├── sockets/               # Socket.io event handlers
│   └── utils/                 # Helpers (password, OTP)
├── uploads/                   # File uploads directory
├── docs/                      # Diagrams & screenshots
├── package.json
├── eslint.config.js
└── jest.config.js
```

---

## ⚙ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file:

```
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Production

```bash
npm start
```

---

## 📡 API Overview

### Authentication
```
POST /auth/register
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password/:token
```

### Organization Admin
```
GET  /org-admin/pending-users
POST /org-admin/approve-user
GET  /org-admin/driver-requests
POST /org-admin/driver-requests/:id/approve
POST /org-admin/driver-requests/:id/reject
```

### Driver
```
POST /driver/upload-documents
```

### Trips
```
POST /api/trips
GET  /api/trips/search
POST /api/trips/:id/start
POST /api/trips/:id/complete
POST /api/trips/:id/location
```

### Rides
```
POST /api/rides/request
POST /api/rides/:id/approve
POST /api/rides/:id/reject
POST /api/rides/:id/pickup
POST /api/rides/:id/dropoff
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

---

## 🔧 Linting

```bash
npm run lint
```

---

## 🔐 Security Highlights

- Org-level data isolation via `organizationId`
- Role-based route guards
- Secure JWT verification middleware
- Document uploads validated
- No cross-org access allowed

---

## 📜 License

Open-source academic project.
