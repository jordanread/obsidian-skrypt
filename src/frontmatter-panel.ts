import { App, MarkdownView, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { findRelated } from "./relations";
import { SkryptType } from "./types";

// Internal/structural fields already shown elsewhere (title in the note title,
// id/story/parent are plumbing) - don't clutter the panel with them.
const HIDDEN_FIELDS = new Set(["id", "title", "story", "parent", "type", "links"]);

function humanize(key: string): string {
	return key
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function formatValue(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	if (Array.isArray(value)) return value.length ? value.join(", ") : null;
	return String(value);
}

function buildPanel(app: App, file: TFile, fm: Record<string, unknown> & { type: SkryptType }): HTMLElement {
	const panel = document.createElement("div");
	panel.addClass("skrypt-panel");

	const fields = Object.entries(fm).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && formatValue(v));
	if (fields.length > 0) {
		const grid = panel.createDiv({ cls: "skrypt-panel-grid" });
		for (const [key, value] of fields) {
			const row = grid.createDiv({ cls: "skrypt-panel-row" });
			row.createDiv({ text: humanize(key), cls: "skrypt-panel-label" });
			row.createDiv({ text: formatValue(value) ?? "", cls: "skrypt-panel-value" });
		}
	}

	if (fm.type !== "note") {
		const related = findRelated(app, file);
		if (related.length > 0) {
			const relWrap = panel.createDiv({ cls: "skrypt-related" });
			relWrap.createEl("div", { text: "Related", cls: "skrypt-panel-label" });
			const list = relWrap.createEl("div", { cls: "skrypt-related-list" });
			for (const entry of related) {
				const chip = list.createEl("a", {
					text: entry.title,
					cls: `skrypt-chip skrypt-chip-${entry.type}`,
				});
				chip.addEventListener("click", (evt) => {
					evt.preventDefault();
					app.workspace.getLeaf(false).openFile(entry.file);
				});
			}
		}
	}

	return panel;
}

/**
 * Finds the reading-mode content container for a MarkdownView. Present even
 * when the note body is empty, unlike markdown-post-processor blocks - which
 * is exactly the case a frontmatter-only Skrypt note stub hits every time.
 */
function previewSizer(view: MarkdownView): HTMLElement | null {
	// previewMode is public API on MarkdownView; containerEl holds the sizer
	// regardless of whether any blocks were rendered inside it.
	const containerEl = (view as unknown as { previewMode?: { containerEl?: HTMLElement } }).previewMode
		?.containerEl;
	return containerEl?.querySelector(":scope .markdown-preview-sizer") ?? null;
}

function updateLeaf(app: App, leaf: WorkspaceLeaf): void {
	const view = leaf.view;
	if (!(view instanceof MarkdownView)) return;

	const sizer = previewSizer(view);
	if (!sizer) return;

	// Always clear a stale panel first - covers switching files/modes and
	// frontmatter edits removing the skrypt block entirely.
	sizer.querySelector(":scope > .skrypt-panel")?.remove();

	if (view.getMode() !== "preview") return;
	const file = view.file;
	if (!file) return;

	const fm = app.metadataCache.getFileCache(file)?.frontmatter?.skrypt as
		| (Record<string, unknown> & { type?: SkryptType })
		| undefined;
	if (!fm?.type) return;

	sizer.prepend(buildPanel(app, file, fm as Record<string, unknown> & { type: SkryptType }));
}

export function registerFrontmatterPanel(app: App, plugin: Plugin): void {
	const refreshAll = () => {
		for (const leaf of app.workspace.getLeavesOfType("markdown")) {
			updateLeaf(app, leaf);
		}
	};

	plugin.registerEvent(app.workspace.on("active-leaf-change", refreshAll));
	plugin.registerEvent(app.workspace.on("file-open", refreshAll));
	plugin.registerEvent(app.workspace.on("layout-change", refreshAll));
	plugin.registerEvent(app.metadataCache.on("changed", refreshAll));

	app.workspace.onLayoutReady(refreshAll);
}
