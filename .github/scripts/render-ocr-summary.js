// SPDX-License-Identifier: MIT
// Render an `ocr review --format json` payload into a GitHub step summary.
//
// Used by .github/workflows/ocr-review-push.yml, where there is no pull
// request to post inline comments to, so findings land in the run log instead.
//
// Usage: node render-ocr-summary.js <result.json>
// Exits non-zero (and prints nothing to stdout) when the payload is missing or
// unparsable, so the caller can fall back to raw stderr.
//
// Fields read from the envelope documented at
// https://open-codereview.ai/docs/cli-reference/#json
//   status   terminal_state when a manifest is present, else success/warnings
//   llm      resolved provider + model
//   summary  files_reviewed, comments, token counts, elapsed
//   comments[]  path, content, start_line, end_line, suggestion_code

"use strict";

const fs = require("fs");

const resultPath = process.argv[2];
if (!resultPath) {
  console.error("usage: node render-ocr-summary.js <result.json>");
  process.exit(2);
}

let result;
try {
  result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
} catch (err) {
  console.error(`could not parse ${resultPath}: ${err.message}`);
  process.exit(1);
}

if (!result || typeof result !== "object") {
  console.error(`${resultPath} did not contain a JSON object`);
  process.exit(1);
}

const out = [];
const comments = Array.isArray(result.comments) ? result.comments : [];

// Escape the pipe and fence characters that would otherwise break the table
// or terminate a code block in the rendered markdown.
const cell = (value) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();

const inline = (value) =>
  cell(value).replace(/`/g, "'").replace(/</g, "&lt;").replace(/>/g, "&gt;");

out.push("## OCR Review (push)");
out.push("");
out.push(`Commit \`${process.env.HEAD_SHA || ""}\``);
out.push("");

// Status line. The manifest's terminal_state is authoritative when present:
// it is what the action itself gates comment posting on.
const status = result.status || (result.manifest && result.manifest.terminal_state) || "unknown";
const llm = result.llm || {};
const model = llm.model || process.env.OCR_LLM_MODEL || "";

const meta = [`Status: **${cell(status)}**`];
if (model) meta.push(`Model: \`${cell(model)}\``);
if (result.summary && result.summary.elapsed) meta.push(`Elapsed: ${cell(result.summary.elapsed)}`);
if (result.summary && Number.isFinite(result.summary.files_reviewed)) {
  meta.push(`Files reviewed: ${result.summary.files_reviewed}`);
}
if (result.summary && Number.isFinite(result.summary.total_tokens)) {
  meta.push(`Tokens: ${result.summary.total_tokens}`);
}
out.push(meta.join(" · "));
out.push("");

if (result.message) {
  out.push(`> ${cell(result.message)}`);
  out.push("");
}

if (comments.length === 0) {
  out.push("No findings. Nothing to fix in this range.");
  out.push("");
  process.stdout.write(out.join("\n"));
  process.exit(0);
}

out.push(`### ${comments.length} finding${comments.length === 1 ? "" : "s"}`);
out.push("");
out.push("| Location | Finding |");
out.push("| --- | --- |");

// Group by file so a file with several findings reads as one block rather
// than a run of separate rows.
const byFile = new Map();
for (const comment of comments) {
  const path = comment.path || "(unknown)";
  if (!byFile.has(path)) byFile.set(path, []);
  byFile.get(path).push(comment);
}

for (const [path, group] of byFile) {
  for (const comment of group) {
    const start = Number.isFinite(comment.start_line) ? comment.start_line : null;
    const end = Number.isFinite(comment.end_line) ? comment.end_line : null;
    let location;
    if (start === null) {
      location = `\`${cell(path)}\``;
    } else if (end !== null && end !== start) {
      location = `\`${cell(path)}\`:${start}-${end}`;
    } else {
      location = `\`${cell(path)}\`:${start}`;
    }
    out.push(`| ${location} | ${inline(comment.content) || "_(empty)_"} |`);
  }
}

out.push("");

// Suggestions are diffs; they need their own fenced block to render legibly.
const withSuggestions = comments.filter(
  (comment) => typeof comment.suggestion_code === "string" && comment.suggestion_code.trim() !== ""
);
if (withSuggestions.length > 0) {
  out.push("<details><summary>Suggested changes</summary>");
  out.push("");
  for (const comment of withSuggestions) {
    const start = Number.isFinite(comment.start_line) ? comment.start_line : "";
    const end = Number.isFinite(comment.end_line) ? comment.end_line : "";
    const span = start === "" ? "" : end === "" || end === start ? `:${start}` : `:${start}-${end}`;
    out.push(`**\`${cell(comment.path || "")}${span}\`**`);
    out.push("");
    out.push("```diff");
    out.push(comment.suggestion_code);
    out.push("```");
    out.push("");
  }
  out.push("</details>");
  out.push("");
}

out.push("---");
out.push("");
out.push(
  "Posted by OpenCodeReview on push. Full JSON and stderr are attached to this run as artifacts."
);

process.stdout.write(out.join("\n"));