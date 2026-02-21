local wezterm = require("wezterm")
local act = wezterm.action
local config = wezterm.config_builder()

-- Theme: Cyberpunk (matching Ghostty)
config.colors = {
	foreground = "#e5e5e5",
	background = "#332a57",
	cursor_fg = "#ffffff",
	cursor_bg = "#21f6bc",
	selection_fg = "#000000",
	selection_bg = "#c1deff",
	ansi = {
		"#000000", -- black
		"#ff7092", -- red
		"#00fbac", -- green
		"#fffa6a", -- yellow
		"#00bfff", -- blue
		"#df95ff", -- magenta
		"#86cbfe", -- cyan
		"#ffffff", -- white
	},
	visual_bell = "#483d73",
	brights = {
		"#595959", -- bright black
		"#ff8aa4", -- bright red
		"#21f6bc", -- bright green
		"#fff787", -- bright yellow
		"#1bccfd", -- bright blue
		"#e6aefe", -- bright magenta
		"#99d6fc", -- bright cyan
		"#ffffff", -- bright white
	},
}

-- Font
config.font = wezterm.font("MesloLGM Nerd Font Mono")
config.font_size = 13.0
config.freetype_load_flags = "FORCE_AUTOHINT" -- approximate font-thicken
config.cell_width = 1.0
config.line_height = 1.1 -- approximate adjust-cell-height = 10%

-- Window
config.window_padding = {
	left = 24,
	right = 24,
	top = 4,
	bottom = 4,
}
config.window_decorations = "INTEGRATED_BUTTONS|RESIZE" -- transparent titlebar
config.native_macos_fullscreen_mode = false

-- Maximize on startup
wezterm.on("gui-startup", function(cmd)
	local _, _, window = wezterm.mux.spawn_window(cmd or {})
	window:gui_window():maximize()
end)

-- Behavior
config.window_close_confirmation = "NeverPrompt" -- confirm-close-surface = false
config.scrollback_lines = 1000000

-- Misc
config.check_for_updates = true

-- Visual bell: subtle purple flash matching the cyberpunk theme
config.visual_bell = {
	fade_in_function = "EaseIn",
	fade_in_duration_ms = 75,
	fade_out_function = "EaseOut",
	fade_out_duration_ms = 150,
	target = "BackgroundColor",
}

-- Disable dimming of inactive panes
config.inactive_pane_hsb = {
	saturation = 0.9,
	brightness = 0.85,
}

-- Clickable file paths: open in $EDITOR
-- Start with default rules (URLs, mailto, etc.)
config.hyperlink_rules = wezterm.default_hyperlink_rules()

-- Absolute paths with optional :line:col
table.insert(config.hyperlink_rules, {
	regex = [[(/[\w\.\-/]+\.\w+)(?::(\d+))?(?::(\d+))?]],
	format = "editor:$1:$2:$3",
	highlight = 0,
})

-- Tilde paths with optional :line:col
table.insert(config.hyperlink_rules, {
	regex = [[(~[\w\.\-/]+\.\w+)(?::(\d+))?(?::(\d+))?]],
	format = "editor:$1:$2:$3",
	highlight = 0,
})

-- Relative paths (./foo, ../foo, or bare file.ext) with optional :line:col
table.insert(config.hyperlink_rules, {
	regex = [[(\.\.?/[\w\.\-/]+\.\w+)(?::(\d+))?(?::(\d+))?]],
	format = "editor:$1:$2:$3",
	highlight = 0,
})

-- Bare filenames like file.lua, src/main.rs (must contain a dot for extension)
table.insert(config.hyperlink_rules, {
	regex = [[\b([\w\-]+(?:/[\w\.\-]+)*\.[\w]+)(?::(\d+))?(?::(\d+))?\b]],
	format = "editor:$1:$2:$3",
	highlight = 0,
})

wezterm.on("open-uri", function(window, pane, uri)
	local match = uri:match("^editor:(.+)")
	if not match then
		return -- let default handler deal with non-editor URIs
	end

	-- Parse file:line:col from "editor:path:line:col"
	-- Tricky: path itself may contain colons (unlikely for files, but be safe)
	-- Our format is always "editor:$1:$2:$3" so trailing ::, :N:, :N:N
	local file, line, col = match:match("^(.+):(%d*):(%d*)$")
	if not file then
		file = match
	end

	-- Resolve tilde
	local home = os.getenv("HOME") or ""
	if file:sub(1, 1) == "~" then
		file = home .. file:sub(2)
	end

	-- Resolve relative paths using pane's cwd
	if file:sub(1, 1) ~= "/" then
		local cwd_url = pane:get_current_working_dir()
		if cwd_url then
			local cwd
			if type(cwd_url) == "userdata" or type(cwd_url) == "table" then
				cwd = cwd_url.file_path
			else
				cwd = cwd_url:match("file://[^/]*(/.+)")
			end
			if cwd then
				cwd = cwd:gsub("/$", "")
				if file:sub(1, 2) == "./" then
					file = file:sub(3)
				end
				file = cwd .. "/" .. file
			end
		end
	end

	-- Check that the file actually exists
	local f = io.open(file, "r")
	if not f then
		return -- file doesn't exist, do nothing
	end
	f:close()

	-- Build editor command
	local editor = os.getenv("VISUAL") or os.getenv("EDITOR") or "vi"

	-- Split editor string in case it contains args (e.g. "code --wait")
	local editor_args = {}
	for word in editor:gmatch("%S+") do
		table.insert(editor_args, word)
	end
	local editor_bin = editor_args[1]

	local args = {}
	for _, v in ipairs(editor_args) do
		table.insert(args, v)
	end

	-- Add line number support based on editor
	if line and line ~= "" then
		if editor_bin:match("vim") or editor_bin:match("nvim") or editor_bin:match("vi$") then
			table.insert(args, "+" .. line)
		elseif editor_bin:match("code") then
			-- VS Code uses --goto file:line:col
			table.insert(args, "--goto")
			local goto_target = file .. ":" .. line
			if col and col ~= "" then
				goto_target = goto_target .. ":" .. col
			end
			table.insert(args, goto_target)
			window:perform_action(act.SpawnCommandInNewTab({ args = args }), pane)
			return false
		elseif editor_bin:match("nano") then
			table.insert(args, "+" .. line)
		elseif editor_bin:match("emacs") then
			table.insert(args, "+" .. line)
		end
	end

	table.insert(args, file)

	window:perform_action(act.SpawnCommandInNewTab({ args = args }), pane)
	return false
end)

-- Pane splitting
-- Equalize panes by walking left-to-right, reading actual dimensions after
-- each adjustment (not pre-computed). This handles WezTerm's binary tree
-- proportional distribution correctly.
local function equalize_panes(window, pane)
	local tab = window:active_tab()
	local info = tab:panes_with_info()
	if #info < 2 then return end

	local original_idx = 0
	for _, pi in ipairs(info) do
		if pi.is_active then original_idx = pi.index break end
	end

	-- Horizontal equalization: only for flat layouts (all panes share top=0)
	local all_same_top = true
	for _, p in ipairs(info) do
		if p.top ~= 0 then all_same_top = false break end
	end

	if all_same_top then
		local n = #info
		local total = 0
		for _, p in ipairs(info) do total = total + p.width end
		local target = math.floor(total / n)

		-- Navigate to leftmost pane
		for j = 1, n do
			window:perform_action(act.ActivatePaneDirection("Left"), tab:active_pane())
		end

		-- Walk left-to-right: for each pane, read its ACTUAL size and adjust
		for i = 1, n - 1 do
			local current = tab:active_pane():get_dimensions().cols
			local delta = current - target

			if delta > 0 then
				-- Too wide: move right to next pane, grow it leftward (shrinks current)
				window:perform_action(act.ActivatePaneDirection("Right"), tab:active_pane())
				window:perform_action(act.AdjustPaneSize({ "Left", delta }), tab:active_pane())
				-- Already at pane i+1 for next iteration
			elseif delta < 0 then
				-- Too narrow: grow current pane rightward (shrinks next)
				window:perform_action(act.AdjustPaneSize({ "Right", -delta }), tab:active_pane())
				window:perform_action(act.ActivatePaneDirection("Right"), tab:active_pane())
			else
				-- Already correct, just move right
				window:perform_action(act.ActivatePaneDirection("Right"), tab:active_pane())
			end
		end
	end

	-- Vertical equalization: only for flat layouts (all panes share left=0)
	local all_same_left = true
	for _, p in ipairs(info) do
		if p.left ~= 0 then all_same_left = false break end
	end

	if all_same_left and not all_same_top then
		local n = #info
		local total = 0
		for _, p in ipairs(info) do total = total + p.height end
		local target = math.floor(total / n)

		for j = 1, n do
			window:perform_action(act.ActivatePaneDirection("Up"), tab:active_pane())
		end

		for i = 1, n - 1 do
			local current = tab:active_pane():get_dimensions().viewport_rows
			local delta = current - target

			if delta > 0 then
				window:perform_action(act.ActivatePaneDirection("Down"), tab:active_pane())
				window:perform_action(act.AdjustPaneSize({ "Up", delta }), tab:active_pane())
			elseif delta < 0 then
				window:perform_action(act.AdjustPaneSize({ "Down", -delta }), tab:active_pane())
				window:perform_action(act.ActivatePaneDirection("Down"), tab:active_pane())
			else
				window:perform_action(act.ActivatePaneDirection("Down"), tab:active_pane())
			end
		end
	end

	window:perform_action(act.ActivatePaneByIndex(original_idx), tab:active_pane())
end

config.keys = {
	{ key = "Enter", mods = "ALT", action = act.DisableDefaultAssignment },
	{ key = "d", mods = "SUPER", action = act.SplitHorizontal({ domain = "CurrentPaneDomain" }) },
	{ key = "d", mods = "SUPER|SHIFT", action = act.SplitVertical({ domain = "CurrentPaneDomain" }) },
	{ key = "w", mods = "SUPER", action = act.CloseCurrentPane({ confirm = false }) },
	{ key = "LeftArrow", mods = "SUPER|OPT", action = act.ActivatePaneDirection("Left") },
	{ key = "RightArrow", mods = "SUPER|OPT", action = act.ActivatePaneDirection("Right") },
	{
		key = "e",
		mods = "SUPER|SHIFT",
		action = wezterm.action_callback(equalize_panes),
	},
}

-- Cmd+Click to open hyperlinks (macOS)
config.mouse_bindings = {
	{
		event = { Up = { streak = 1, button = "Left" } },
		mods = "SUPER",
		action = act.OpenLinkAtMouseCursor,
	},
	{
		event = { Down = { streak = 1, button = "Left" } },
		mods = "SUPER",
		action = act.Nop,
	},
}

return config
