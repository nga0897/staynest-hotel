"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadFunctionFromFile } = require("../helpers/extractBrowserFunction");

const APP_JS = path.join(__dirname, "..", "..", "public", "app.js");
const ADMIN_JS = path.join(__dirname, "..", "..", "public", "admin.js");

for (const [label, filePath] of [
  ["public/app.js", APP_JS],
  ["public/admin.js", ADMIN_JS],
]) {
  describe(`escapeHtml() in ${label}`, () => {
    const escapeHtml = loadFunctionFromFile(filePath, "escapeHtml");

    test("escapes all 5 special characters (& < > \" ')", () => {
      // Arrange
      const input = `<script>alert("xss")&'x'</script>`;

      // Act
      const result = escapeHtml(input);

      // Assert
      assert.equal(
        result,
        "&lt;script&gt;alert(&quot;xss&quot;)&amp;&#39;x&#39;&lt;/script&gt;",
      );
      assert.ok(!result.includes("<script>"), "raw <script> tag must not survive escaping");
    });

    test("leaves a string with no special characters unchanged", () => {
      const input = "Phòng tiêu chuẩn 20m2";
      const result = escapeHtml(input);
      assert.equal(result, input);
    });

    test("returns empty string for null", () => {
      assert.equal(escapeHtml(null), "");
    });

    test("returns empty string for undefined", () => {
      assert.equal(escapeHtml(undefined), "");
    });

    test("coerces non-string input (number) to string", () => {
      assert.equal(escapeHtml(380000), "380000");
    });

    test("escapes an <img onerror=...> XSS payload used in innerHTML sinks", () => {
      const payload = `<img src=x onerror="alert('pwned')">`;
      const result = escapeHtml(payload);
      assert.ok(!result.includes("<img"), "raw <img> tag must not survive escaping");
      assert.ok(!result.includes('onerror="alert'), "raw event handler attribute must not survive escaping");
    });
  });
}
