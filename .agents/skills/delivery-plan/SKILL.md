---
name: delivery-plan
description: Add or update rows in a Google Sheets delivery plan. Use when the user asks to update a delivery plan, add tickets to a spreadsheet, or sync Jira tickets to a sheet.
argument-hint: "[sheet URL] [instructions]"
---

## Task

Update a Google Sheets delivery plan based on the user's instructions.

**User instructions:** $ARGUMENTS

If no sheet URL or instructions were provided, ask the user before proceeding.

## Tool: `gws` CLI

All Google Sheets operations use the `gws` CLI (Google Workspace CLI) which is
available on PATH. Auth is handled automatically via keyring.

## Reading the sheet

1. Extract the spreadsheet ID from the URL (the long alphanumeric string
   between `/d/` and `/edit`).
2. Get sheet names:
   ```
   gws sheets spreadsheets get --params '{"spreadsheetId": "<ID>", "includeGridData": false}'
   ```
   Parse the `sheets[].properties.title` fields.
3. Read all values (use `FORMULA` render option to see hyperlinks):
   ```
   gws sheets spreadsheets values get --params '{"spreadsheetId": "<ID>", "range": "<Sheet Name>", "valueRenderOption": "FORMULA"}'
   ```
4. **Always read the sheet before making any changes** to understand the current
   structure and find the correct row/column positions.

## Adding new rows

### Step 1: Copy an existing row

Never write cells from scratch. Always clone an existing data row to preserve
formatting, data validation (dropdowns, checkboxes), and conditional formatting
rules. Use `PASTE_NORMAL` to copy everything:

```
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "<ID>"}' --json '{
  "requests": [{
    "copyPaste": {
      "source":      {"sheetId": 0, "startRowIndex": <src>, "endRowIndex": <src+1>, "startColumnIndex": 0, "endColumnIndex": 14},
      "destination":  {"sheetId": 0, "startRowIndex": <dst>, "endRowIndex": <dst+1>, "startColumnIndex": 0, "endColumnIndex": 14},
      "pasteType": "PASTE_NORMAL"
    }
  }]
}'
```

**Pick a source row that has the same status as the target** (e.g., copy a
BLOCKED row when adding a BLOCKED ticket). This preserves chip-style dropdown
formatting in the status column.

Multiple rows can be copied in a single `batchUpdate` with multiple requests.

### Step 2: Update only the cells that differ

After cloning, update **only** the cells whose values need to change. Typically
this is just the ticket hyperlink in column B:

```
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "<ID>", "range": "B<row>", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["=HYPERLINK(\"https://jira.zalando.net/browse/<TICKET>\",\"<TICKET> - <Summary>\")"]]}'
```

**Critical**: Do NOT overwrite cells that already have the correct value from
the copy — especially status dropdowns in column C. Writing a plain string to a
chip-style dropdown cell **destroys the chip formatting** and there is no way to
restore it via the API. Only write to column C if the status actually needs to
change from what was copied.

### Step 3: Extend conditional formatting if needed

Check whether conditional formatting rules cover the new rows:

```
gws sheets spreadsheets get --params '{"spreadsheetId": "<ID>", "includeGridData": false}'
```

Look at `sheets[].conditionalFormats[].ranges[].endRowIndex`. If any rule's
`endRowIndex` is less than or equal to the new row's 0-based index, update it
with `updateConditionalFormatRule`. Preserve all existing rule properties — only
change the `endRowIndex`.

## Updating status cells

Status dropdowns render as colored pill/chip UI in Google Sheets. This styling
is a client-side rendering feature — the API cannot create or restore it.
Writing a plain string via the values API **destroys the pill**, even though the
underlying data validation is preserved.

To update a status and keep the pill styling, **copy-paste the cell** from a row
that already has the desired status:

```
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "<ID>"}' --json '{
  "requests": [{
    "copyPaste": {
      "source":      {"sheetId": 0, "startRowIndex": <row-with-desired-status>, "endRowIndex": <+1>, "startColumnIndex": 2, "endColumnIndex": 3},
      "destination":  {"sheetId": 0, "startRowIndex": <target-row>, "endRowIndex": <+1>, "startColumnIndex": 2, "endColumnIndex": 3},
      "pasteType": "PASTE_NORMAL"
    }
  }]
}'
```

Multiple status updates can be batched in a single request. Group by target
status and find one source row per status value.

## Updating CW columns (assignee per calendar week)

CW columns (F onwards) track who worked on a ticket in a given calendar week.
The names are **person smart chips** (`chipRuns`), not plain text. Writing a
plain string will work visually but won't link to the person's Google profile.

To write a person chip, use `updateCells` with `chipRuns`:

```
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "<ID>"}' --json '{
  "requests": [{
    "updateCells": {
      "range": {"sheetId": 0, "startRowIndex": <row-0idx>, "endRowIndex": <+1>, "startColumnIndex": <col-0idx>, "endColumnIndex": <+1>},
      "rows": [{
        "values": [{
          "userEnteredValue": {"stringValue": "@"},
          "chipRuns": [{
            "chip": {
              "personProperties": {
                "email": "<user>@zalando.de",
                "displayFormat": "DEFAULT"
              }
            }
          }]
        }]
      }],
      "fields": "userEnteredValue,chipRuns"
    }
  }]
}'
```

Key details:
- The cell text is literally `@` — the chip replaces it with the person's name.
- Each `chipRun` needs a `chip` with `personProperties.email`. Do NOT include a
  trailing empty run for the non-chipped remainder (the API rejects it).
- Multiple cells can be updated in a single `batchUpdate` with multiple
  `updateCells` requests.
- CW column mapping depends on the header row. Read row 1 to map CW numbers to
  column indices (e.g., CW09=F, CW10=G, ...).

## Updating other cells

1. Read the sheet to find the row number of the ticket.
2. Update only the changed cell(s) using `values update` with `USER_ENTERED`.

## Column conventions

These are typical but **may vary per sheet**. Always verify by reading first.

| Column | Content | Notes |
|--------|---------|-------|
| A | Assigned checkbox | Formula like `=COUNTA(F<row>:AU<row>)>0`, auto-computed |
| B | Ticket link | `=HYPERLINK("https://jira.zalando.net/browse/<ID>","<ID> - <Summary>")` |
| C | Status dropdown | Chip-style dropdown (BACKLOG, TO DO, IN PROGRESS, IN REVIEW, QA, DONE, CANCELED, BLOCKED, ON HOLD) |
| D | (varies) | |
| E | Notes | |
| F+ | Assignees per calendar week | |

## Safety rules

- **Always read before writing** to avoid overwriting data.
- **Show the user what you plan to change** before making modifications.
- **Never delete rows** unless explicitly asked.
- **Clone rows** instead of constructing them from scratch.
- When adding multiple rows, copy them all first, then update values.
