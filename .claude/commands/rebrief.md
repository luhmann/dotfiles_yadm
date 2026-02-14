# /rebrief Command

  ## Description
  Clears the current context and reloads a specific briefing from the designated Gistpad MCP server.

  ## Usage
  /rebrief

  ## Parameters
  - `task-id`: The task identifier used to locate the briefing file in the gistpad server

  ## Behavior
  1. **Clear Context** clear your context by running the `/clear`-command
  2. **Locate Briefing**: Searches for briefing files in the gistpad mcp server, use the gistpad:get_gist mcp command with the the gist id from your current context
  3. **File Pattern**: Looks for files starting with `agent` that contain the specified task-id in the filename
  4. **Load Content**: Reads and presents the briefing content to restart the conversation with fresh context
  5. DO NOT execute further commands just read the information provided then prompt the user for further informaton

  ## Examples
  /rebrief AI1
  Searches for briefing files containing "AI1" in the filename and loads the content.

  /rebrief feature-xyz
  Searches for briefing files containing "feature-xyz" in the filename and loads the content.

  ## File Naming Convention
  The command expects briefing files to follow the pattern:
  - Start with `agent`
  - Contain the task-id somewhere in the filename
  - Example: `agent---2025_06_27-AI_1_automatic-stream-metadata-resolution.md`

  ## Notes
  - This command completely resets the conversation context
  - Only searches the specific gistpad server defined in the local project configuration
  - If multiple files match the task-id, all matching briefings will be presented
