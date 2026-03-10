import express from "express";
import cors from "cors";

// Epic-1 Routes
import authRoutes from "./routes/authRoutes.js";
import platformRoutes from "./routes/platform.routes.js";
import orgAdminRoutes from "./routes/orgAdmin.routes.js";
import userRoutes from "./routes/user.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import adminDriverRoutes from "./routes/adminDriver.routes.js";

// Security & Rate Limiting
import { globalLimiter, authLimiter } from "./middlewares/rateLimiter.middleware.js";

// Epic-2 Routes (new trip/ride functionality)
import tripRoutes from "./routes/tripRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";

// Epic-3 Routes (Carbon calculation + ESG Impact Intelligence)
import carbonRoutes from "./routes/carbon.routes.js";
import impactRoutes from "./routes/impact.routes.js";
import esgAdminRoutes from "./routes/esgAdmin.routes.js";
import exportRoutes from "./routes/export.routes.js";
import mockTripRoutes from "./routes/mockTrip.routes.js";
import smartPickupZoneRoutes from "./routes/smartPickupZone.routes.js";

// Epic-4 Routes (Gamification & Rewards)
import gamificationRoutes from "./routes/gamification.routes.js";
import rewardsRoutes from "./routes/rewards.routes.js";
import rewardsAdminRoutes from "./routes/rewardsAdmin.routes.js";
import pointRulesRoutes from "./routes/pointRules.routes.js";

// Epic-5 Routes (Privacy, Safety & Feedback)
import ratingRoutes from "./routes/rating.routes.js";
import safetyRoutes from "./routes/safety.routes.js";
import tripShareRoutes from "./routes/tripShare.routes.js";
import privacyRoutes from "./routes/privacy.routes.js";
import supportRoutes from "./routes/support.routes.js";
import adminSafetyRoutes from "./routes/adminSafety.routes.js";

const app = express();

// Security: Dynamic CORS configuration (Fix #3)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Apply global rate limiter to all routes (Fix #2)
app.use(globalLimiter);

// Epic-1 Routes (Organization-based)
// Apply stricter rate limiting to auth routes
app.use("/auth", authLimiter, authRoutes);
app.use("/platform", platformRoutes);
app.use("/org-admin", orgAdminRoutes);
app.use("/org-admin", adminDriverRoutes);
app.use("/api/users", userRoutes);
app.use("/driver", driverRoutes);

// Epic-2 Routes (Trip/Ride functionality)
app.use("/api", tripRoutes);
app.use("/api", rideRoutes);
app.use("/api/pickup-zones", smartPickupZoneRoutes);

// Epic-3 Routes (Carbon calculation + ESG Impact Intelligence)
app.use("/api/carbon", carbonRoutes);
app.use("/api/impact", impactRoutes);
app.use("/api/esg-admin", esgAdminRoutes);
app.use("/api/export", exportRoutes);

// Epic-4 Routes (Gamification & Rewards)
app.use("/api/gamification", gamificationRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/org-admin/rewards", rewardsAdminRoutes);
app.use("/platform/point-rules", pointRulesRoutes);

// Epic-5 Routes (Privacy, Safety & Feedback)
app.use("/api/ratings", ratingRoutes);
app.use("/api/safety", safetyRoutes);
app.use("/api/trip", tripShareRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/support", supportRoutes);
// Admin routes (incidents + guideline CMS) and user-facing guideline routes
// all live under /api/admin to keep the namespace consistent.
app.use("/api/admin", adminSafetyRoutes);

// Mock/Testing Routes
app.use("/api/mock", mockTripRoutes);

// Serve uploaded documents
app.use("/uploads", express.static("uploads"));

// Health check
app.get("/", (req, res) => {
  res.send("Backend v1 running");
});

export default app;
