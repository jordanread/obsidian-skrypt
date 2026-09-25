import { App, TFile, TFolder } from "obsidian";
import { SkryptProject } from "./types";

/**
 * A project is any folder whose direct child is an "Index.md" carrying
 * either Longform's `longform` frontmatter key or our own `skrypt` key.
 * This lets Skrypt sit alongside an existing Longform project without
 * requiring you to touch Longform's own frontmatter.
 */
export function findProjects(app: App): SkryptProject[] {
	const projects: SkryptProject[] = [];
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		if (file.basename !== "Index") continue;
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm) continue;
		if (!("longform" in fm) && !("skrypt" in fm)) continue;

		const folder = file.parent;
		if (!(folder instanceof TFolder)) continue;

		projects.push({
			folderPath: folder.path,
			story: folder.name,
			indexPath: file.path,
		});
	}

	return projects.sort((a, b) => a.story.localeCompare(b.story));
}

/** Finds the project that owns a given file path, by nearest ancestor folder. */
export function projectForPath(
	projects: SkryptProject[],
	path: string
): SkryptProject | null {
	let best: SkryptProject | null = null;
	for (const project of projects) {
		if (path === project.folderPath || path.startsWith(project.folderPath + "/")) {
			if (!best || project.folderPath.length > best.folderPath.length) {
				best = project;
			}
		}
	}
	return best;
}

export async function ensureFolder(app: App, path: string): Promise<TFolder> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return existing;
	return app.vault.createFolder(path);
}
