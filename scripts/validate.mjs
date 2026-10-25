import { readFile } from "node:fs/promises";
import { validateDirectory } from "../public/directory.mjs";
import { coverageStats, validateCoverage } from "../public/coverage.mjs";

const data = JSON.parse(await readFile(new URL("../public/data/beijing.json", import.meta.url), "utf8"));
const coverage = JSON.parse(await readFile(new URL("../public/data/coverage.json", import.meta.url), "utf8"));
const errors = [...validateDirectory(data), ...validateCoverage(coverage, data)];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Valid directory: ${data.hospitals.length} hospitals, ${data.doctors.length} doctors, ${data.sources.length} sources.`);
  console.log("Valid partial coverage:", coverageStats(coverage));
}
