import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { NextRequest } from "next/server";

// Exercise real route/guard/validation code with a deterministic Supabase boundary.
test("HTTP contracts, auth, CSRF, admin scope, validation and service error mapping", async () => {
  const require = createRequire(`${process.cwd()}/package.json`);
  const helperPath = require.resolve(`${process.cwd()}/src/lib/api-helper.ts`);
  const adminPath = require.resolve(
    `${process.cwd()}/src/lib/supabase/admin.ts`,
  );
  const helpers = require(helperPath);
  const originalHelper = require.cache[helperPath]!.exports;
  require(adminPath);
  const originalAdmin = require.cache[adminPath]!.exports;
  const oldSecret = process.env.CSRF_SECRET;
  const oldInternalSecret = process.env.INTERNAL_API_SECRET;
  process.env.CSRF_SECRET = "isolated-http-test-secret";
  let authStatus = 0;
  let role = "user";
  let rpcError: { code: string } | null = null;
  let rpcCalls = 0;
  const record = {
    id: "00000000-0000-4000-8000-000000000001",
    user_id: "00000000-0000-4000-8000-000000000001",
    work_date: "2026-10-15",
    first_heartbeat_at: "2026-10-15T00:00:00Z",
    last_heartbeat_at: "2026-10-15T00:00:00Z",
    heartbeat_count: 1,
    manual_check_in_at: null,
    manual_check_out_at: null,
    correction_reason: null,
    version: 1,
  };
  const leave = {
    id: record.id,
    leave_type: "annual",
    start_date: "2026-10-15",
    end_date: "2026-10-16",
    half_day_slot: null,
    requested_days: 2,
    deduct_days: 2,
    status: "draft",
    reason: null,
    document_id: null,
    approval_request_id: null,
    created_at: "2026-10-15T00:00:00Z",
  };
  let leaveRows: unknown[] = [];
  let approvalRows: unknown[] = [];
  const predicates: Array<[string, string, unknown]> = [];
  class Query {
    columns = "";
    singleRow = false;
    constructor(private table: string) {}
    select(columns: string) {
      this.columns = columns;
      return this;
    }
    eq(column: string, value: unknown) {
      predicates.push([this.table, column, value]);
      return this;
    }
    not() {
      return this;
    }
    in() {
      return this;
    }
    gte() {
      return this;
    }
    lte() {
      return this;
    }
    order() {
      return this;
    }
    range() {
      return this;
    }
    limit() {
      return this;
    }
    maybeSingle() {
      this.singleRow = true;
      return this;
    }
    single() {
      this.singleRow = true;
      return this;
    }
    then(
      resolve: (result: unknown) => unknown,
      reject?: (error: unknown) => unknown,
    ) {
      const data =
        this.table === "users"
          ? this.singleRow
            ? { is_active: true, role }
            : [{ id: record.user_id, name: "사용자", department_id: null }]
          : this.table === "attendance_records"
            ? [record]
            : this.table === "leave_requests"
              ? leaveRows
              : this.table === "approval_requests" ? approvalRows : [];
      return Promise.resolve({ data, error: null, count: 1 }).then(
        resolve,
        reject,
      );
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    auth: {
      getClaims: async () => ({
        data: { claims: { session_id: "session" } },
        error: null,
      }),
    },
    rpc: async (name: string) => {
      rpcCalls++;
      return {
        data:
          name === "leave_write"
            ? leave
            : name === "leave_balance"
              ? { computable: false, reason: "no_hire_date" }
              : record,
        error: rpcError,
      };
    },
  };
  require.cache[helperPath]!.exports = {
    ...helpers,
    withAuth: async () =>
      authStatus
        ? {
            error: helpers.fail("인증 실패", authStatus),
            supabase: null,
            userId: null,
          }
        : { error: null, supabase: client, userId: record.user_id },
  };
  require.cache[adminPath]!.exports = {
    createAdminSupabaseClient: () => client,
  };
  const route = (name: string) =>
    require(`${process.cwd()}/src/app/api/${name}/route.ts`);
  const req = (
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
    origin?: string,
  ) =>
    new NextRequest(`http://localhost:3000/api/${path}`, {
      method,
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(token ? { "X-CSRF-Token": token } : {}),
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    const embed = route("documents/embed-all");
    authStatus = 401; // internal calls must not depend on browser authentication.
    delete process.env.INTERNAL_API_SECRET;
    assert.equal((await embed.POST(req("documents/embed-all", "POST"))).status, 401);
    process.env.INTERNAL_API_SECRET = "isolated-internal-secret";
    assert.equal((await embed.POST(req("documents/embed-all", "POST"))).status, 401);
    const internalRequest = req("documents/embed-all", "POST");
    internalRequest.headers.set("x-internal-secret", "wrong");
    assert.equal((await embed.POST(internalRequest)).status, 401);
    internalRequest.headers.set("x-internal-secret", process.env.INTERNAL_API_SECRET);
    const embedded = await embed.POST(internalRequest);
    assert.equal(embedded.status, 200);
    assert.deepEqual(await embedded.json(), { total: 0, success: 0, failed: 0 });
    const attendance = route("attendance");
    authStatus = 401;
    assert.equal(
      (await attendance.GET(req("attendance?from=2026-10-01&to=2026-10-31")))
        .status,
      401,
    );
    authStatus = 503;
    assert.equal(
      (await attendance.GET(req("attendance?from=2026-10-01&to=2026-10-31")))
        .status,
      503,
    );
    authStatus = 0;
    const csrf = await route("csrf").GET(req("csrf"));
    const issued = await csrf.json();
    assert.equal(issued.success, true);
    assert.equal(typeof issued.data.token, "string");
    assert.ok(issued.data.expiresAt);
    const token = issued.data.token;
    const response = await attendance.GET(
      req("attendance?from=2026-10-01&to=2026-10-31"),
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(Object.keys((await response.json()).data), ["days"]);
    assert.equal(
      (await attendance.GET(req("attendance?from=bad&to=2026-10-31"))).status,
      400,
    );
    const hb = route("attendance/heartbeat");
    assert.equal(
      (await hb.POST(req("attendance/heartbeat", "POST", {}))).status,
      403,
    );
    assert.equal(
      (
        await hb.POST(
          req(
            "attendance/heartbeat",
            "POST",
            {},
            token,
            "https://evil.example",
          ),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await hb.POST(
          req(
            "attendance/heartbeat",
            "POST",
            {},
            undefined,
            "http://localhost:3000",
          ),
        )
      ).status,
      403,
    );
    assert.equal(rpcCalls, 0);
    const beat = await hb.POST(
      req(
        "attendance/heartbeat",
        "POST",
        { userId: "forged", workDate: "1900-01-01" },
        token,
        "http://localhost:3000",
      ),
    );
    assert.deepEqual(Object.keys((await beat.json()).data), [
      "workDate",
      "firstHeartbeatAt",
      "lastHeartbeatAt",
      "heartbeatCount",
    ]);
    rpcError = { code: "54000" };
    assert.equal(
      (
        await hb.POST(
          req(
            "attendance/heartbeat",
            "POST",
            {},
            token,
            "http://localhost:3000",
          ),
        )
      ).status,
      429,
    );
    rpcError = null;
    const correction = route("attendance/[workDate]");
    const ctx = { params: Promise.resolve({ workDate: "2025-10-15" }) };
    const corrected = await correction.PATCH(
      req(
        "attendance/2025-10-15",
        "PATCH",
        { mode: "restore", reason: "복원", version: 1 },
        token,
        "http://localhost:3000",
      ),
      ctx,
    );
    assert.equal(corrected.status, 200);
    assert.equal((await corrected.json()).data.source, "auto");
    rpcError = { code: "P0001" };
    assert.equal(
      (
        await correction.PATCH(
          req(
            "attendance/2025-10-15",
            "PATCH",
            { mode: "restore", reason: "복원", version: 1 },
            token,
            "http://localhost:3000",
          ),
          ctx,
        )
      ).status,
      409,
    );
    rpcError = null;
    const admin = route("attendance/admin");
    assert.equal(
      (await admin.GET(req("attendance/admin?from=2026-10-01&to=2026-10-31")))
        .status,
      403,
    );
    role = "manager";
    assert.equal(
      (await admin.GET(req("attendance/admin?from=2026-10-01&to=2026-10-31")))
        .status,
      403,
    );
    role = "admin";
    const all = await admin.GET(
      req("attendance/admin?from=2026-10-01&to=2026-10-31"),
    );
    assert.equal((await all.json()).data.rows[0].userName, "사용자");
    const leaves = route("leave-requests");
    assert.deepEqual(
      (await (await leaves.GET(req("leave-requests"))).json()).data,
      { requests: [] },
    );
    for (const deniedRole of ["user", "manager"]) {
      role = deniedRole;
      for (const query of ["scope=all", `userId=${record.user_id}`]) {
        assert.equal((await leaves.GET(req(`leave-requests?${query}`))).status, 403);
      }
    }
    role = "admin";
    leaveRows = [
      { ...leave, user_id: record.user_id },
      { ...leave, id: "mismatch", user_id: record.user_id, status: "pending", approval_request_id: "a" },
      { ...leave, id: "missing", user_id: record.user_id, status: "approved", approval_request_id: "b" },
      { ...leave, id: "consistent", user_id: record.user_id, status: "approved", approval_request_id: "c" },
      { ...leave, id: "unlinked", user_id: record.user_id, status: "pending" },
    ];
    approvalRows = [{ id: "a", status: "rejected" }, { id: "c", status: "approved" }];
    predicates.length = 0;
    const expanded = await leaves.GET(req("leave-requests?scope=all"));
    assert.equal(expanded.status, 200);
    const expandedRows = (await expanded.json()).data.requests;
    assert.deepEqual(expandedRows.map((r: { inconsistent: boolean }) => r.inconsistent), [false, true, true, false, true]);
    assert.equal(expandedRows[0].userId, record.user_id);
    assert.equal(predicates.some(([table]) => table === "leave_requests"), false);
    predicates.length = 0;
    assert.equal((await leaves.GET(req(`leave-requests?userId=${record.user_id}`))).status, 200);
    assert.ok(predicates.some(([table, column, value]) => table === "leave_requests" && column === "user_id" && value === record.user_id));
    role = "user";
    predicates.length = 0;
    const own = await leaves.GET(req("leave-requests"));
    assert.equal(own.status, 200);
    assert.ok(predicates.some(([table, column, value]) => table === "leave_requests" && column === "user_id" && value === record.user_id));
    assert.equal((await own.json()).data.requests[0].userId, undefined);
    leaveRows = [];
    approvalRows = [];
    const created = await leaves.POST(
      req(
        "leave-requests",
        "POST",
        {
          leaveType: "annual",
          startDate: "2026-10-15",
          endDate: "2026-10-16",
          idempotencyKey: "retry",
        },
        token,
        "http://localhost:3000",
      ),
    );
    assert.equal(created.status, 201);
    assert.equal((await created.json()).data.leaveType, "annual");
    const patch = await route("leave-requests/[id]").PATCH(
      req(
        `leave-requests/${record.id}`,
        "PATCH",
        { action: "update", reason: "변경" },
        token,
        "http://localhost:3000",
      ),
      { params: Promise.resolve({ id: record.id }) },
    );
    assert.equal(patch.status, 200);
    const balance = await route("leave-requests/balance").GET(
      req("leave-requests/balance"),
    );
    assert.equal(balance.status, 200);
    assert.equal((await balance.json()).data.reason, "no_hire_date");
  } finally {
    if (oldInternalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = oldInternalSecret;
    require.cache[helperPath]!.exports = originalHelper;
    require.cache[adminPath]!.exports = originalAdmin;
    if (oldSecret === undefined) delete process.env.CSRF_SECRET;
    else process.env.CSRF_SECRET = oldSecret;
  }
});
