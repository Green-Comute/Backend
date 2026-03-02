/**
 * @fileoverview Organization Admin Controller Tests
 * @description Integration tests for org admin endpoints — member listing and removal.
 * Uses Supertest (same pattern as authController.test.js).
 */

import request from "supertest";
import app from "../app.js";

describe("Org Admin API — Basic Tests", () => {
    // ── List Members ────────────────────────────────────────────────────────
    describe("GET /org-admin/members", () => {
        test("should return 401 without JWT", async () => {
            const res = await request(app).get("/org-admin/members");
            expect(res.status).toBe(401);
        });

        test("should return 401 with an invalid JWT", async () => {
            const res = await request(app)
                .get("/org-admin/members")
                .set("Authorization", "Bearer invalidtoken123");
            expect(res.status).toBe(401);
        });
    });

    // ── Remove User ─────────────────────────────────────────────────────────
    describe("DELETE /org-admin/remove-user/:userId", () => {
        test("should return 401 without JWT", async () => {
            const res = await request(app).delete(
                "/org-admin/remove-user/507f1f77bcf86cd799439011"
            );
            expect(res.status).toBe(401);
        });

        test("should return 401 with an invalid JWT", async () => {
            const res = await request(app)
                .delete("/org-admin/remove-user/507f1f77bcf86cd799439011")
                .set("Authorization", "Bearer invalidtoken123");
            expect(res.status).toBe(401);
        });
    });

    // ── Pending Users ───────────────────────────────────────────────────────
    describe("GET /org-admin/pending-users", () => {
        test("should return 401 without JWT", async () => {
            const res = await request(app).get("/org-admin/pending-users");
            expect(res.status).toBe(401);
        });
    });

    // ── Approve User ────────────────────────────────────────────────────────
    describe("POST /org-admin/approve-user", () => {
        test("should return 401 without JWT", async () => {
            const res = await request(app)
                .post("/org-admin/approve-user")
                .send({ userId: "507f1f77bcf86cd799439011" });
            expect(res.status).toBe(401);
        });
    });
});
