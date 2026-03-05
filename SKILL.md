---
name: vocab-registerer
description: >
  Register English vocabulary words to the learning app via CLI.
  Use when the user says "add word", "register word", "save this word",
  or wants to save English words for study. Supports bulk registration.
---

# Vocabulary Registerer

CLI tool to register English words with auto-generated info (reading, meaning, example, tags) via Gemini AI.

## Install & Use

```bash
npx vocab-registerer <word1> [word2] [word3] ... --key <GEMINI_API_KEY>
```

Or set the env var:

```bash
export GEMINI_API_KEY=your_key_here
npx vocab-registerer ephemeral ubiquitous pragmatic
```

## Commands

```bash
npx vocab-registerer --help                    # Show help
npx vocab-registerer --list-folders            # List available folders
npx vocab-registerer "break down" --folder ID  # Register to specific folder
```

## Get API Key

Get a free Gemini API key at: https://aistudio.google.com/apikey
