import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
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

const processedContainers = new WeakSet<Element>();

export function registerFrontmatterPanel(app: App, register: (cb: any) => void): void {
	register((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const fm = ctx.frontmatter?.skrypt as
			| { type?: SkryptType; [k: string]: unknown }
			| undefined;
		if (!fm?.type) return;

		const container = el.parentElement;
		if (!container || processedContainers.has(container)) return;
		processedContainers.add(container);

		const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		const panel = document.createElement("div");
		panel.addClass("skrypt-panel");

		const fields = Object.entries(fm).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && formatValue(v));
		if (fields.length > 0) {
			console.info(`Processing ${fields}`)
			const grid = panel.createDiv({ cls: "skrypt-panel-grid" });
			for (const [key, value] of fields) {
				const row = grid.createDiv({ cls: "skrypt-panel-row" });
				row.createDiv({ text: humanize(key), cls: "skrypt-panel-label" });
				row.createDiv({ text: formatValue(value) ?? "", cls: "skrypt-panel-value" });
			}
		}

		if (fm.type === "character" || fm.type === "location") {
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

		container.prepend(panel);
	});
}
