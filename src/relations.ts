import { App, TFile } from "obsidian";
import { SkryptType } from "./types";

export interface RelatedEntry {
	file: TFile;
	type: SkryptType;
	title: string;
}

/**
 * Finds other skrypt-typed notes linked to or from `file`, using Obsidian's
 * own resolved-links graph (populated from wikilinks anywhere in the note,
 * including inside the `links:` frontmatter field). This piggybacks on
 * core backlinks/graph rather than maintaining a parallel relationship id.
 */
export function findRelated(app: App, file: TFile): RelatedEntry[] {
	const resolved = app.metadataCache.resolvedLinks;
	const seen = new Map<string, RelatedEntry>();

	const consider = (path: string) => {
		if (path === file.path) return;
		const target = app.vault.getAbstractFileByPath(path);
		if (!(target instanceof TFile)) return;
		const fm = app.metadataCache.getFileCache(target)?.frontmatter?.skrypt as
			| { type?: SkryptType; title?: string }
			| undefined;
		if (!fm?.type || (fm.type !== "character" && fm.type !== "location")) return;
		if (seen.has(target.path)) return;
		seen.set(target.path, { file: target, type: fm.type, title: fm.title ?? target.basename });
	};

	// Outgoing: everything this note links to.
	for (const path of Object.keys(resolved[file.path] ?? {})) {
		consider(path);
	}
	// Incoming: everything that links to this note (so relations show on both ends
	// without having to be declared twice).
	for (const [sourcePath, links] of Object.entries(resolved)) {
		if (file.path in links) consider(sourcePath);
	}

	return Array.from(seen.values()).sort((a, b) => a.title.localeCompare(b.title));
}
