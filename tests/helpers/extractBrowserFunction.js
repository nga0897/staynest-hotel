"use strict";

/**
 * Extracts a top-level `function <name>(...) { ... }` declaration verbatim
 * from a browser script file (public/app.js, public/admin.js) and evals it
 * in isolation, so unit tests exercise the REAL source text instead of a
 * hand-copied reimplementation that could drift from the actual file.
 *
 * Those files touch `document.*` at module scope, so they can't be
 * `require()`d directly in plain Node without a DOM — extracting just the
 * pure function under test avoids needing a jsdom dependency.
 */

const fs = require("node:fs");

function extractFunctionSource(fileContent, functionName) {
  const needle = `function ${functionName}(`;
  const startIdx = fileContent.indexOf(needle);
  if (startIdx === -1) {
    throw new Error(`function ${functionName} not found in source`);
  }

  const braceStart = fileContent.indexOf("{", startIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < fileContent.length; i++) {
    if (fileContent[i] === "{") depth++;
    else if (fileContent[i] === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }

  return fileContent.slice(startIdx, i);
}

function loadFunctionFromFile(filePath, functionName) {
  const source = fs.readFileSync(filePath, "utf8");
  const fnSource = extractFunctionSource(source, functionName);
  const factory = new Function(`${fnSource}\nreturn ${functionName};`);
  return factory();
}

module.exports = { loadFunctionFromFile, extractFunctionSource };
