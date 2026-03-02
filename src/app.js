import express from "express";
import cors from "cors";

// Epic-1 Routes
import authRoutes from "./routes/authRoutes.js";
import platformRoutes from "./routes/platform.routes.js";
import orgAdminRoutes from "./routes/orgAdmin.routes.js";
import userRoutes from "./routes/user.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import adminDriverRoutes from "./routes/adminDriver.routes.js";

// Epic-2 Routes (new trip/ride functionality)
import tripRoutes from "./routes/tripRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";

const app = express();

// Global middlewares
app.use(cors());
app.use(express.json());

// Epic-1 Routes (Organization-based)
app.use("/auth", authRoutes);
app.use("/platform", platformRoutes);
app.use("/org-admin", orgAdminRoutes);
app.use("/org-admin", adminDriverRoutes);
app.use("/api/users", userRoutes);
app.use("/driver", driverRoutes);

// Epic-2 Routes (Trip/Ride functionality)
app.use("/api", tripRoutes);
app.use("/api", rideRoutes);

// Serve uploaded documents
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/", (req, res) => {
  res.send("Backend v1 running");
});

export default app;
