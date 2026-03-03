import { classifyError, isAddressNotFound } from "../lib/email-errors";
import { suite, test, eq, assert, summary } from "./test-harness";

async function main() {
  suite("SECTION 2 — Error Classification (12 tests)");

  await test("2.1 — 550 user unknown → isAddressNotFound true", () => {
    // ADDRESS_NOT_FOUND_PHRASES includes "user unknown", not "user not found"
    const err = { message: "550 User unknown", responseCode: 550 };
    assert(isAddressNotFound(err), "should be address not found");
  });

  await test("2.2 — 550 mailbox does not exist → isAddressNotFound true", () => {
    const err = { message: "550 Mailbox does not exist", responseCode: 550 };
    assert(isAddressNotFound(err), "should be address not found");
  });

  await test("2.3 — 551 user not local → isAddressNotFound true", () => {
    // "recipient rejected" is in ADDRESS_NOT_FOUND_PHRASES
    const err = { message: "551 Recipient rejected", responseCode: 551 };
    assert(isAddressNotFound(err), "should be address not found");
  });

  await test("2.4 — 553 invalid recipient → isAddressNotFound true", () => {
    const err = { message: "553 Invalid recipient", responseCode: 553 };
    assert(isAddressNotFound(err), "should be address not found");
  });

  await test("2.5 — 421 try again later → isAddressNotFound false", () => {
    const err = { message: "421 Try again later", responseCode: 421 };
    assert(!isAddressNotFound(err), "should NOT be address not found");
  });

  await test("2.6 — 450 temporary failure → isAddressNotFound false", () => {
    const err = { message: "450 Temporary failure", responseCode: 450 };
    assert(!isAddressNotFound(err), "should NOT be address not found");
  });

  await test("2.7 — 550 policy rejection spam → isAddressNotFound false", () => {
    // Policy rejection text doesn't match ADDRESS_NOT_FOUND_PHRASES
    const err = { message: "550 Message rejected due to spam policy", responseCode: 550 };
    assert(!isAddressNotFound(err), "policy rejection should NOT be address not found");
  });

  await test("2.8 — 550 reputation blocked → isAddressNotFound false", () => {
    const err = { message: "550 Blocked due to sender reputation", responseCode: 550 };
    assert(!isAddressNotFound(err), "reputation block should NOT be address not found");
  });

  await test("2.9 — network timeout → isAddressNotFound false", () => {
    const err = new Error("ETIMEDOUT connection timed out");
    assert(!isAddressNotFound(err), "network error should NOT be address not found");
  });

  await test("2.10 — 535 auth failure → isAddressNotFound false", () => {
    const err = { message: "535 Authentication failed", responseCode: 535 };
    assert(!isAddressNotFound(err), "auth failure should NOT be address not found");
  });

  await test("2.11 — permanent type still classified correctly", () => {
    const result = classifyError({ message: "550 User unknown", responseCode: 550 });
    eq(result.type, "permanent", "type");
    eq(result.retryable, false, "retryable");
  });

  await test("2.12 — transient type still classified correctly", () => {
    const result = classifyError({ message: "421 Try again later", responseCode: 421 });
    eq(result.type, "transient", "type");
    eq(result.retryable, true, "retryable");
  });

  const s = summary();
  process.exit(s.failed > 0 ? 1 : 0);
}
main();
