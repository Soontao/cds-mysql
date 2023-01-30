#!/usr/bin/env node

const { build } = require("../lib/scripts/build");
build().catch(console.error);
