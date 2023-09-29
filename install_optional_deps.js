#!/usr/bin/env node
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

if (!fs.existsSync(path.join(__dirname, "./node_modules/@sap/cds"))) {
  console.log("Installing no trace dependencies ...");
  const { VERSION, MTXS_VERSION } = require("./src/cds.version");
  const deps = [
    `@sap/cds@${VERSION}`, `@sap/cds-dk@${VERSION}`, `@sap/cds-mtxs@${MTXS_VERSION}`, `sqlite3`
  ];

  const p = spawn(
    `npm i --no-save express ${deps.join(" ")}`,
    {
      shell: true
    }
  );
  p.stdout.pipe(process.stdout);
  p.stderr.pipe(process.stderr);
  p.on("error", console.error);
  p.on("exit", () => console.log("done"));
}