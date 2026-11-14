import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { statSync } from "node:fs";
import { homedir } from "node:os";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * Turns existing file paths in finished assistant text into clickable markdown links.
 * Vault files → obsidian://, code/text → zed://file, documents/images/directories → file://.
 */

export type PathKind = "file" | "dir";

export type LinkifyOptions = {
	cwd: string;
	home: string;
	/** Returns the kind of the path if it exists, otherwise undefined. */
	exists: (absolutePath: string) => PathKind | undefined;
};

const VAULT_NAME = "org";
const VAULT_SUBPATH = join("jcloud", "org");

const NON_TEXT_EXTENSIONS = new Set(
	(
		"pdf png jpg jpeg gif webp bmp tif tiff heic ico avif svg psd " +
		"mp3 mp4 m4a mov avi mkv wav flac ogg webm " +
		"doc docx xls xlsx ppt pptx odt ods odp key numbers pages rtf epub " +
		"zip tar gz tgz bz2 xz 7z rar jar war dmg pkg iso exe dll so dylib class woff woff2 ttf otf"
	).split(" "),
);

// Plain-text path token: a run of characters that are not whitespace or markdown/prose delimiters.
const TOKEN = /[^\s`<>()[\]{}"'*,;|=]+/g;
const TRAILING_PUNCTUATION = /[.,:;!?]+$/;
const LOCATION_SUFFIX = /^(.+?)(?::(\d+)(?:-\d+)?(?::(\d+))?)?$/;
const URL_LIKE = /:\/\/|^[a-zA-Z][\w+.-]*:(?!\d)/;
const HAS_EXTENSION = /\.[A-Za-z0-9]+$/;

type Location = { path: string; line?: string; column?: string };

const parseLocation = (raw: string): Location | undefined => {
	const match = LOCATION_SUFFIX.exec(raw);
	return match ? { path: match[1]!, line: match[2], column: match[3] } : undefined;
};

const resolvePath = (path: string, { cwd, home }: LinkifyOptions): string =>
	path === "~" || path.startsWith("~/") ? join(home, path.slice(1)) : isAbsolute(path) ? path : resolve(cwd, path);

const isPlausiblePathShape = (path: string): boolean =>
	path.length > 1 && path.includes("/") && !URL_LIKE.test(path) && !/^\.{1,2}\/?$/.test(path);

const isRepoRelative = (path: string): boolean => !path.startsWith("/") && !path.startsWith("~");

const encodePath = (absolutePath: string): string =>
	absolutePath
		.split("/")
		.map((segment) => encodeURIComponent(segment).replace(/[()'*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
		.join("/");

const vaultRelative = (absolutePath: string, home: string): string | undefined => {
	const rel = relative(join(home, VAULT_SUBPATH), absolutePath);
	return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : undefined;
};

const buildUrl = (absolutePath: string, kind: PathKind, location: Location, home: string): string => {
	const inVault = kind === "file" ? vaultRelative(absolutePath, home) : undefined;
	if (inVault) return `obsidian://open?vault=${VAULT_NAME}&file=${encodeURIComponent(inVault.replace(/\.md$/i, ""))}`;
	if (kind === "dir" || NON_TEXT_EXTENSIONS.has(extname(absolutePath).slice(1).toLowerCase())) {
		return `file://${encodePath(absolutePath)}`;
	}
	const suffix = location.line ? `:${location.line}${location.column ? `:${location.column}` : ""}` : "";
	return `zed://file${encodePath(absolutePath)}${suffix}`;
};

/** Returns the link URL for a path as written (incl. optional :line[:col] / :start-end), or undefined. */
const urlFor = (raw: string, options: LinkifyOptions): string | undefined => {
	const location = parseLocation(raw);
	if (!location || !isPlausiblePathShape(location.path)) return undefined;
	const absolutePath = resolvePath(location.path, options);
	const kind = options.exists(absolutePath);
	if (!kind) return undefined;
	if (isRepoRelative(location.path) && kind === "file" && !HAS_EXTENSION.test(location.path)) return undefined;
	return buildUrl(absolutePath, kind, location, options.home);
};

const linkifyPlain = (text: string, options: LinkifyOptions): string =>
	text.replace(TOKEN, (token) => {
		const trailing = TRAILING_PUNCTUATION.exec(token)?.[0] ?? "";
		const candidate = token.slice(0, token.length - trailing.length);
		const url = candidate ? urlFor(candidate, options) : undefined;
		return url ? `[${candidate}](${url})${trailing}` : token;
	});

// --- inline scanner -------------------------------------------------------------------------

/** Index just past the bracket matching the opener at `start`, or -1. Does not cross blank lines. */
const matchBracket = (text: string, start: number, open: string, close: string): number => {
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		const c = text[i];
		if (c === "\\") i++;
		else if (c === "\n" && text[i + 1] === "\n") return -1;
		else if (c === open) depth++;
		else if (c === close && --depth === 0) return i + 1;
	}
	return -1;
};

/** Length of a markdown link / reference / definition starting at `[`, or 0. */
const linkLength = (text: string, start: number): number => {
	const textEnd = matchBracket(text, start, "[", "]");
	if (textEnd < 0) return 0;
	const next = text[textEnd];
	if (next === "(") {
		const end = matchBracket(text, textEnd, "(", ")");
		return end < 0 ? 0 : end - start;
	}
	if (next === "[") {
		const end = matchBracket(text, textEnd, "[", "]");
		return end < 0 ? 0 : end - start;
	}
	if (next === ":" && (start === 0 || text[start - 1] === "\n")) {
		const lineEnd = text.indexOf("\n", textEnd);
		return (lineEnd < 0 ? text.length : lineEnd) - start;
	}
	return 0;
};

const ANGLE_PATTERNS = [
	/^<!--[\s\S]*?-->/,
	/^<[a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>]*>/, // autolink
	/^<[^\s@<>]+@[^\s@<>]+>/, // email autolink
	/^<a\b[^>]*>[\s\S]*?<\/a>/i,
	/^<\/?[a-zA-Z][^<>]*>/, // any other HTML tag
];

const angleLength = (text: string, start: number): number => {
	const rest = text.slice(start);
	for (const pattern of ANGLE_PATTERNS) {
		const match = pattern.exec(rest);
		if (match) return match[0].length;
	}
	return 0;
};

/** Returns [replacement, consumedLength] for a code span at `start`, or undefined if the backticks are literal. */
const codeSpan = (text: string, start: number, options: LinkifyOptions): [string, number] | undefined => {
	const fence = /^`+/.exec(text.slice(start))![0];
	const closing = new RegExp(`(?<!\`)${fence}(?!\`)`, "g");
	closing.lastIndex = start + fence.length;
	const match = closing.exec(text);
	if (!match) return undefined;
	const end = match.index + fence.length;
	const original = text.slice(start, end);
	const content = text.slice(start + fence.length, match.index);
	const url = content.trim() ? urlFor(content.trim(), options) : undefined;
	return [url ? `[${original}](${url})` : original, end - start];
};

const linkifyInline = (text: string, options: LinkifyOptions): string => {
	let output = "";
	let plain = "";
	const flush = (protectedText: string) => {
		output += linkifyPlain(plain, options) + protectedText;
		plain = "";
	};

	let i = 0;
	while (i < text.length) {
		const c = text[i]!;
		if (c === "`") {
			const span = codeSpan(text, i, options);
			if (span) {
				flush(span[0]);
				i += span[1];
				continue;
			}
			const run = /^`+/.exec(text.slice(i))![0];
			plain += run;
			i += run.length;
			continue;
		}
		const protectedLength = c === "[" ? linkLength(text, i) : c === "<" ? angleLength(text, i) : 0;
		if (protectedLength > 0) {
			flush(text.slice(i, i + protectedLength));
			i += protectedLength;
			continue;
		}
		plain += c;
		i++;
	}
	flush("");
	return output;
};

// --- fenced blocks --------------------------------------------------------------------------

type Segment = { text: string; code: boolean };

const splitFences = (text: string): Segment[] => {
	const segments: Segment[] = [];
	const push = (line: string, code: boolean) => {
		const last = segments[segments.length - 1];
		if (last && last.code === code) last.text += line;
		else segments.push({ text: line, code });
	};

	let fence: { char: string; length: number } | undefined;
	for (const line of text.split(/(?<=\n)/)) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (!fence && marker && !(marker[0] === "`" && line.slice(line.indexOf(marker) + marker.length).includes("`"))) {
			fence = { char: marker[0]!, length: marker.length };
			push(line, true);
		} else if (fence) {
			const closes = new RegExp(`^\\s*\\${fence.char}{${fence.length},}\\s*$`).test(line);
			push(line, true);
			if (closes) fence = undefined;
		} else {
			push(line, false);
		}
	}
	return segments;
};

export function linkifyPaths(text: string, options: LinkifyOptions): string {
	const cache = new Map<string, PathKind | undefined>();
	const cachedExists = (path: string) => {
		if (!cache.has(path)) cache.set(path, options.exists(path));
		return cache.get(path);
	};
	const cachedOptions = { ...options, exists: cachedExists };
	return splitFences(text)
		.map((segment) => (segment.code ? segment.text : linkifyInline(segment.text, cachedOptions)))
		.join("");
}

// --- hook -----------------------------------------------------------------------------------

const fsExists = (path: string): PathKind | undefined => {
	const stats = statSync(path, { throwIfNoEntry: false });
	return stats ? (stats.isDirectory() ? "dir" : "file") : undefined;
};

export default function (pi: ExtensionAPI) {
	pi.on("message_end", (event, ctx) => {
		const message = event.message;
		if (message.role !== "assistant" || !Array.isArray(message.content)) return;
		try {
			const options: LinkifyOptions = { cwd: ctx.cwd, home: homedir(), exists: fsExists };
			let changed = false;
			const content = message.content.map((block) => {
				if (block.type !== "text" || typeof block.text !== "string") return block;
				const text = linkifyPaths(block.text, options);
				if (text === block.text) return block;
				changed = true;
				return { ...block, text };
			});
			return changed ? { message: { ...message, content } } : undefined;
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			try {
				ctx.ui.notify(`file-links: left message unchanged after error: ${detail}`, "warning");
			} catch {
				// No UI available (print/RPC mode); the message is returned unchanged either way.
			}
			return undefined;
		}
	});
}
