import { App, TFile, TFolder, stringifyYaml } from "obsidian";
import { generateId, SkryptProject, SkryptType, defaultFieldsFor, todayISO } from "./types";
import { ensureFolder } from "./project";

export const SECTION_FOLDERS: Record<Exclude<SkryptType, "note"> | "note", string> = {
	note: "Notes",
	character: "Characters",
	location: "Locations",
};

/** Sanitizes a title into a safe filename fragment. */
function safeName(title: string): string {
	return title.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "Untitled";
}

interface CreateNoteOptions {
	project: SkryptProject;
	type: SkryptType;
	title: string;
	/** skrypt.id of the parent character/setting, when creating a sub-note. */
	parentId?: string;
	/** Folder to place a character/setting's own Notes subsection under. */
	parentFolder?: string;
}

export async function createSkryptNote(
	app: App,
	opts: CreateNoteOptions
): Promise<TFile> {
	const { project, type, title, parentId, parentFolder } = opts;
	const id = generateId();
	const name = safeName(title);

	let folderPath: string;
	if (parentFolder) {
		// A sub-note living under a character/setting's own Notes/ folder.
		folderPath = `${parentFolder}/Notes`;
	} else {
		folderPath = `${project.folderPath}/${SECTION_FOLDERS[type]}`;
	}
	await ensureFolder(app, folderPath);

	let filePath = `${folderPath}/${name}.md`;
	let suffix = 2;
	while (app.vault.getAbstractFileByPath(filePath)) {
		filePath = `${folderPath}/${name} ${suffix}.md`;
		suffix++;
	}

	const frontmatter: Record<string, unknown> = {
		id,
		type,
		title,
		story: project.story,
		created: todayISO(),
		...defaultFieldsFor(type),
	};
	if (parentId) frontmatter.parent = parentId;

	const body = `---\nskrypt:\n${indent(stringifyYaml(frontmatter))}---\n\n`;
	const file = await app.vault.create(filePath, body);
	return file;
}

function indent(yaml: string): string {
	return yaml
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => `  ${line}`)
		.join("\n") + "\n";
}

/** For a character/setting note, the folder that holds its own sub-notes. */
export function ownFolderFor(project: SkryptProject, type: SkryptType, title: string): string {
	return `${project.folderPath}/${SECTION_FOLDERS[type]}/${safeName(title)}`;
}
