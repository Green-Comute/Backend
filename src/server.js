import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import setupRideSocket from "./sockets/rideSocket.js";
import setupTrackingSocket from "./sockets/trackingSocket.js";
import { setIO } from "./config/socket.js";

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
