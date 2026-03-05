#!/usr/bin/env node

const CONVEX_URL = "https://moonlit-tern-609.convex.cloud";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const args = process.argv.slice(2);

// Parse flags
const flags = {};
const words = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--folder" && args[i + 1]) {
    flags.folderId = args[++i];
  } else if (args[i] === "--key" && args[i + 1]) {
    flags.apiKey = args[++i];
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
  npx vocab-registerer <word1> [word2] [word3] ...
  npx vocab-registerer --list-folders

Options:
  --key <GEMINI_API_KEY>   Gemini API key (or set GEMINI_API_KEY env var)
  --folder <folderId>      Register words into a specific folder
  --list-folders           List available folders
  -h, --help               Show this help

Examples:
  npx vocab-registerer ephemeral ubiquitous pragmatic
  npx vocab-registerer "break down" --folder k57abc123def
  GEMINI_API_KEY=xxx npx vocab-registerer resilient
`);
}

if (flags.help) {
  printHelp();
  process.exit(0);
}

const GEMINI_API_KEY = flags.apiKey || process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is required.");
  console.error("Set it via --key flag or GEMINI_API_KEY environment variable.");
  console.error("");
  console.error("Get a free API key at: https://aistudio.google.com/apikey");
  process.exit(1);
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
  console.log("─".repeat(40));
  for (const f of data.value) {
    console.log(`  ${f.icon || "📁"} ${f.name}  (ID: ${f.id})`);
  }
  console.log("");
}

async function generateWordInfo(word) {
  const prompt = `You are an English-Japanese dictionary API. Given an English word or phrase, return JSON with these fields:
- reading: katakana pronunciation
- meaning: Japanese meaning (concise)
- example: example sentence using the word
- exampleJa: Japanese translation of the example
- tags: comma-separated category tags (e.g. daily,business,academic)

Word: "${word}"

Return ONLY valid JSON.`;

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
  });

  const data = await res.json();
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error("Gemini API returned no content");
  }
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

async function registerWord(word, info, folderId) {
  const mutationArgs = {
    word,
    meaning: info.meaning,
  };
  if (info.reading) mutationArgs.reading = info.reading;
  if (info.example) mutationArgs.example = info.example;
  if (info.exampleJa) mutationArgs.exampleJa = info.exampleJa;
  if (info.tags) mutationArgs.tags = info.tags;
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

async function processWord(word, folderId) {
  process.stdout.write(`  Generating info for "${word}"...`);

  const info = await generateWordInfo(word);
  process.stdout.write(" registering...");

  await registerWord(word, info, folderId);

  console.log(" done!");
  console.log(`    📖 ${info.reading || ""}`);
  console.log(`    💡 ${info.meaning}`);
  console.log(`    📝 ${info.example}`);
  console.log(`    🏷️  ${info.tags || ""}`);
  console.log("");
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

  console.log(`\n🔤 Registering ${words.length} word(s)...\n`);

  let success = 0;
  let fail = 0;

  for (const word of words) {
    try {
      await processWord(word, flags.folderId);
      success++;
    } catch (err) {
      console.error(`  ❌ Failed "${word}": ${err.message}\n`);
      fail++;
    }
  }

  console.log("─".repeat(40));
  console.log(`✅ ${success} registered${fail > 0 ? `, ❌ ${fail} failed` : ""}`);
  console.log("📱 Open the app to see your new words!\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
