// Offline tests for routing and parsing. Run: node --experimental-strip-types --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, parseMvReport, routeMillionVerifier, routeNo2Bounce, routeReoon } from "../scripts/verify-lib.ts";

test("Reoon routing is unchanged", () => {
  assert.equal(routeReoon("safe", true), "KEEP");
  assert.equal(routeReoon("safe", false), "REMOVE");
  for (const s of ["catch_all", "unknown", "role_account"]) assert.equal(routeReoon(s, false), "SECOND");
  for (const s of ["invalid", "disabled", "spamtrap", "inbox_full", "weird"]) assert.equal(routeReoon(s, false), "REMOVE");
});
test("MillionVerifier routing", () => {
  assert.equal(routeMillionVerifier("ok"), "KEEP");
  assert.equal(routeMillionVerifier("OK"), "KEEP");
  assert.equal(routeMillionVerifier("invalid"), "REMOVE");
  assert.equal(routeMillionVerifier("disposable"), "REMOVE");
  for (const s of ["catch_all", "unknown", "error", "reverify", "", "something_new"]) assert.equal(routeMillionVerifier(s), "SECOND");
});
test("No2Bounce routing is unchanged", () => {
  for (const s of ["Deliverable", "Deliverable/AcceptAll", "Risky/AcceptAll"]) assert.equal(routeNo2Bounce(s), "KEEP");
  for (const s of ["UnDeliverable", "UnDeliverable/AcceptAll", ""]) assert.equal(routeNo2Bounce(s), "REMOVE");
});
test("decide with No2Bounce second step", () => {
  assert.deepEqual(decide("KEEP", "no2bounce"), { keep: true, held: false });
  assert.deepEqual(decide("REMOVE", "no2bounce"), { keep: false, held: false });
  assert.deepEqual(decide("SECOND", "no2bounce", "Deliverable/AcceptAll"), { keep: true, held: false });
  assert.deepEqual(decide("SECOND", "no2bounce", "UnDeliverable"), { keep: false, held: false });
  assert.deepEqual(decide("SECOND", "no2bounce", undefined), { keep: false, held: false });
});
test("decide MillionVerifier-only holds risky instead of sending", () => {
  assert.deepEqual(decide("SECOND", "none"), { keep: false, held: true });
  assert.deepEqual(decide("KEEP", "none"), { keep: true, held: false });
});
test("MillionVerifier report parsing", () => {
  const r = parseMvReport('email,quality,result,resultcode,subresult\n"A@x.com",good,ok,1,ok\nb@y.com,bad,invalid,6,mailbox_not_found\n');
  assert.deepEqual(r, { "a@x.com": "ok", "b@y.com": "invalid" });
  assert.throws(() => parseMvReport("foo,bar\n1,2\n"));
});
