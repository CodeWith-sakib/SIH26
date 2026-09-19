import assert from "assert";
import bcrypt from "bcryptjs";
import http from "http";
import mongoose from "mongoose";
import axios from "axios";
import app from "../server.js";
import User from "../shared/models/User.js";
import AuditLog from "../audit/audit.model.js";
import { rateLimiterStore } from "../shared/middleware/rateLimiter.js";
const port = 5126,
  base = `http://127.0.0.1:${port}`,
  uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sih_demo";
let server: http.Server;
async function main() {
  await mongoose.connect(uri);
  server = app.listen(port);
  const email = `auth.${Date.now()}@example.com`,
    password = "SecurePassword123!",
    checks: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    checks.push(name);
    console.log(`  ✓ ${name}`);
  };
  try {
    console.log("Starting Password and JWT Authentication Self-Check...\n");
    let token = "";
    await check(
      "Registration creates an active account and returns JWT directly",
      async () => {
        const r = await axios.post(`${base}/api/auth/register`, {
          name: "Synthetic Auth Citizen",
          email,
          password,
        });
        assert.equal(r.status, 201);
        assert.ok(r.data.token);
        assert.equal(r.data.user.email, email);
        assert.equal(r.data.user.isVerified, true);
        token = r.data.token;
      },
    );
    await check(
      "Password is stored as a bcrypt hash and never returned",
      async () => {
        const user = await User.findOne({ email }).select("+password");
        assert.ok(user);
        assert.notEqual(user!.password, password);
        assert.ok(await bcrypt.compare(password, user!.password));
        const profile = await axios.get(`${base}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(JSON.stringify(profile.data).includes(password), false);
        assert.equal((profile.data.user as any).password, undefined);
      },
    );
    await check(
      "Registration JWT authenticates protected endpoints",
      async () => {
        assert.equal(
          (
            await axios.get(`${base}/api/auth/test-citizen`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          ).status,
          200,
        );
      },
    );
    await check(
      "Existing account logs in with password and receives JWT directly",
      async () => {
        const r = await axios.post(`${base}/api/auth/login`, {
          email,
          password,
        });
        assert.ok(r.data.token);
        assert.equal(r.data.user.email, email);
      },
    );
    await check("Invalid password is rejected without a token", async () => {
      const r = await axios.post(
        `${base}/api/auth/login`,
        { email, password: "WrongPassword!" },
        { validateStatus: () => true },
      );
      assert.equal(r.status, 401);
      assert.equal(r.data.token, undefined);
    });
    await check(
      "Registration and login remain audited without password data",
      async () => {
        const user = await User.findOne({ email });
        const logs = await AuditLog.find({ actorId: user!._id.toString() });
        assert.ok(logs.some((x) => x.action === "USER_REGISTERED"));
        assert.ok(logs.some((x) => x.action === "USER_LOGIN"));
        assert.equal(JSON.stringify(logs).includes(password), false);
      },
    );
    console.log(
      `\nAuthentication self-check passed (${checks.length}/${checks.length} checks).`,
    );
  } finally {
    const user = await User.findOne({ email });
    if (user) await AuditLog.deleteMany({ actorId: user._id.toString() });
    await User.deleteOne({ email });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rateLimiterStore.destroy();
    await mongoose.disconnect();
  }
}
main().catch((error) => {
  console.error(
    `Authentication self-check failed: ${error instanceof Error ? error.stack : error}`,
  );
  process.exit(1);
});
