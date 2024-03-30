/* eslint-disable @typescript-eslint/no-unused-vars */

// remove dev/optional dependency from released package

const fs = require("fs");

const p = JSON.parse(fs.readFileSync("./package.json"));
const { devDependencies, optionalDependencies, ...others } = p;
fs.writeFileSync("./package.json", JSON.stringify(others, undefined, 2)); 
