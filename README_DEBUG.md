# Viibes Text Gen – Debug Share Pack

## What's broken
- Older Chat Completions params (`response_format`, `max_completion_tokens`) caused 4xx.
- Error handler returned 200 with `"{}"` so the UI showed… exactly that.

## What's fixed
- Uses **Responses API** with `text.format.json_schema` and `max_output_tokens`.
- Honest non-200 errors with readable messages.
- Server-side validation for birthday/anchors/insertWords; one strict retry.
- Optional gateway fallback kept, but secondary.

## Smoketest
Replace URL with your deployed edge function URL.

```bash
curl -sS -X POST https://qxfnvtnchuigjivcalqe.supabase.co/functions/v1/generate-text \
  -H "Content-Type: application/json" \
  -d '{
    "category":"celebrations",
    "subcategory":"birthday",
    "tone":"humorous",
    "rating":"PG-13",
    "insertWords":["Silas"],
    "gender":"neutral",
    "userId":"anonymous"
  }' | jq
```

**Expected success:**

```json
{
  "success": true,
  "options": ["...4 lines..."],
  "model": "gpt-5-2025-08-07",
  "count": 4
}
```

**If failure:** you'll get a non-2xx and `error: "OpenAI 400: ..."` or similar. That's the point.

## Frontend contract

* Calls `supabase.functions.invoke("generate-text", payload)`.
* If `success === false` or HTTP non-2xx, surface `error` string to the user.

## Env vars (Edge)

* `OPENAI_API_KEY` required for Responses API.
* Optional: `LOVABLE_API_URL`, `LOVABLE_API_KEY`, `LOVABLE_MODEL` for fallback.
