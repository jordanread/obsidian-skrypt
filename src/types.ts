export type SkryptType = "note" | "character" | "setting";

export interface SkryptFrontmatter {
	id: string;
	type: SkryptType;
	title: string;
	story: string;
	parent?: string;
}

export interface SkryptProject {
	/** Folder containing this project's Index.md (the Longform project root). */
	folderPath: string;
	/** Project name, taken from the folder name. Used as the story FK value. */
	story: string;
	indexPath: string;
}

export function generateId(): string {
	// Short, stable, collision-unlikely id for cross-referencing notes via
	// skrypt.parent instead of by title (titles can be renamed).
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}

type FieldKind = "string" | "number" | "text" | "list" | "date";

interface FieldDef {
	kind: FieldKind;
}

/**
 * Extra per-type fields, ported from TW-Skrypt's
 * wiki/tiddlers/$__skrypt_schema_{character,location,note}.json.
 * `location` there maps to `setting` here.
 */
export const TYPE_SCHEMAS: Record<SkryptType, Record<string, FieldDef>> = {
	character: {
		role: { kind: "string" },
		archetype: { kind: "string" },
		age: { kind: "number" },
		gender: { kind: "string" },
		description: { kind: "text" },
		goals: { kind: "text" },
		motivation: { kind: "text" },
		conflict: { kind: "text" },
		"character-arc": { kind: "text" },
		"first-appearance": { kind: "string" },
	},
	setting: {
		"location-type": { kind: "string" },
		region: { kind: "string" },
		description: { kind: "text" },
		culture: { kind: "text" },
		"first-appearance": { kind: "string" },
	},
	note: {
		tags: { kind: "list" },
	},
};

function emptyValueFor(kind: FieldKind): unknown {
	switch (kind) {
		case "number":
			return null;
		case "list":
			return [];
		default:
			return "";
	}
}

/** Blank stub fields for a type, so the frontmatter block has every slot ready to fill in. */
export function defaultFieldsFor(type: SkryptType): Record<string, unknown> {
	const schema = TYPE_SCHEMAS[type];
	const fields: Record<string, unknown> = {};
	for (const [name, def] of Object.entries(schema)) {
		fields[name] = emptyValueFor(def.kind);
	}
	return fields;
}

export function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}

