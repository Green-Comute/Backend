import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import { validateFuelTypesConfig } from "./config/fuelTypes.js";

// Fail fast if fuel types are misconfigured
validateFuelTypesConfig();
import setupRideSocket from "./sockets/rideSocket.js";
import setupTrackingSocket from "./sockets/trackingSocket.js";
import { setIO } from "./config/socket.js";

const cors = require("cors");

app.use(cors({
  origin: [
    "http://localhost:5173", 
    "https://frontend-tau-ecru-80.vercel.app"
  ],
  credentials: true
}));

connectDB();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store io instance for use in controllers
setIO(io);

// Setup socket handlers
// IMPORTANT: trackingSocket MUST be initialized first — it registers the
// io.use() JWT authentication middleware that all socket connections need.
setupTrackingSocket(io);
setupRideSocket(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io initialized`);
});
