import fs from "node:fs/promises";

const requiredFiles = ["public/index.html", "public/styles.css", "public/app.js", "server.js"];

await Promise.all(requiredFiles.map((file) => fs.access(file)));

console.log("Build verification complete.");
