#!/bin/bash
# Register a vocabulary word to the English learning app via Convex API
# Usage: register_word.sh <word> [folderId]
# Requires: GEMINI_API_KEY environment variable

set -euo pipefail

CONVEX_URL="https://moonlit-tern-609.convex.cloud"
GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

WORD="$1"
FOLDER_ID="${2:-}"

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "Error: GEMINI_API_KEY environment variable is required" >&2
  exit 1
fi

# Step 1: Generate word info via Gemini
GEMINI_PROMPT="You are an English-Japanese dictionary API. Given an English word or phrase, return JSON with these fields:
- reading: katakana pronunciation
- meaning: Japanese meaning (concise)
- example: example sentence using the word
- exampleJa: Japanese translation of the example
- tags: comma-separated category tags (e.g. daily,business,academic)
- imagePrompt: a short English prompt to generate an illustration for this word

Word: \"${WORD}\"

Return ONLY valid JSON, no markdown."

GEMINI_BODY=$(cat <<ENDJSON
{
  "contents": [{"parts": [{"text": $(echo "$GEMINI_PROMPT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}]}],
  "generationConfig": {
    "responseMimeType": "application/json",
    "temperature": 0.3
  }
}
ENDJSON
)

GEMINI_RESPONSE=$(curl -s -X POST "${GEMINI_URL}?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$GEMINI_BODY")

# Extract the generated text
WORD_INFO=$(echo "$GEMINI_RESPONSE" | python3 -c '
import sys, json
data = json.load(sys.stdin)
text = data["candidates"][0]["content"]["parts"][0]["text"]
info = json.loads(text)
print(json.dumps(info))
')

if [ -z "$WORD_INFO" ] || [ "$WORD_INFO" = "null" ]; then
  echo "Error: Failed to generate word info from Gemini" >&2
  exit 1
fi

# Step 2: Build Convex mutation args
CONVEX_ARGS=$(echo "$WORD_INFO" | python3 -c "
import sys, json
info = json.load(sys.stdin)
args = {
    'word': '${WORD}',
    'reading': info.get('reading'),
    'meaning': info.get('meaning', ''),
    'example': info.get('example'),
    'exampleJa': info.get('exampleJa'),
    'tags': info.get('tags'),
}
folder_id = '${FOLDER_ID}'
if folder_id:
    args['folderId'] = folder_id
# Remove None values
args = {k: v for k, v in args.items() if v is not None}
print(json.dumps(args))
")

CONVEX_BODY=$(python3 -c "
import json
args = json.loads('$(echo "$CONVEX_ARGS" | sed "s/'/\\\\'/g")')
body = {'path': 'vocabulary:create', 'args': args, 'format': 'json'}
print(json.dumps(body))
")

# Step 3: Register to Convex
CONVEX_RESPONSE=$(curl -s -X POST "${CONVEX_URL}/api/mutation" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$CONVEX_BODY")

STATUS=$(echo "$CONVEX_RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","error"))')

if [ "$STATUS" = "success" ]; then
  echo "Successfully registered: ${WORD}"
  echo "$WORD_INFO" | python3 -c "
import sys, json
info = json.load(sys.stdin)
print('  Reading:', info.get('reading', 'N/A'))
print('  Meaning:', info.get('meaning', 'N/A'))
print('  Example:', info.get('example', 'N/A'))
print('  Tags:   ', info.get('tags', 'N/A'))
"
else
  echo "Error registering word: $CONVEX_RESPONSE" >&2
  exit 1
fi
