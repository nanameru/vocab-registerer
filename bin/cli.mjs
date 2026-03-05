#!/usr/bin/env node

const CONVEX_URL = "https://moonlit-tern-609.convex.cloud";

const args = process.argv.slice(2);

// Parse flags
const flags = {};
const words = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--folder" && args[i + 1]) {
    flags.folderId = args[++i];
  } else if (args[i] === "--list-folders") {
    flags.listFolders = true;
  } else if (args[i] === "--help" || args[i] === "-h") {
    flags.help = true;
  } else {
    words.push(args[i]);
  }
}

function printHelp() {
  console.log(`
vocab-registerer - Register English words to your learning app

Usage:
  npx github:nanameru/vocab-registerer <word1> [word2] [word3] ...
  npx github:nanameru/vocab-registerer --list-folders

Options:
  --folder <folderId>      Register words into a specific folder
  --list-folders           List available folders
  -h, --help               Show this help

Examples:
  npx github:nanameru/vocab-registerer ephemeral ubiquitous pragmatic
  npx github:nanameru/vocab-registerer "break down" --folder k57abc123def
`);
}

if (flags.help) {
  printHelp();
  process.exit(0);
}

async function listFolders() {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "folders:getAll", args: {}, format: "json" }),
  });
  const data = await res.json();
  if (data.status !== "success") {
    console.error("Failed to fetch folders:", data.errorMessage);
    process.exit(1);
  }
  console.log("\nAvailable folders:");
  console.log("-".repeat(40));
  for (const f of data.value) {
    console.log(`  ${f.icon || "folder"} ${f.name}  (ID: ${f.id})`);
  }
  console.log("");
}

async function registerWord(word, folderId) {
  const mutationArgs = {
    word,
    meaning: "",
  };
  if (folderId) mutationArgs.folderId = folderId;

  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "vocabulary:create",
      args: mutationArgs,
      format: "json",
    }),
  });

  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.errorMessage || "Registration failed");
  }
  return data;
}

// Main
async function main() {
  if (flags.listFolders) {
    await listFolders();
    return;
  }

  if (words.length === 0) {
    printHelp();
    process.exit(1);
  }

  console.log(`\nRegistering ${words.length} word(s)...\n`);

  let success = 0;
  let fail = 0;

  for (const word of words) {
    try {
      await registerWord(word, flags.folderId);
      console.log(`  + ${word}`);
      success++;
    } catch (err) {
      console.error(`  x Failed "${word}": ${err.message}`);
      fail++;
    }
  }

  console.log("\n" + "-".repeat(40));
  console.log(`Done! ${success} registered${fail > 0 ? `, ${fail} failed` : ""}`);
  console.log("Open the app to see your new words!\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
