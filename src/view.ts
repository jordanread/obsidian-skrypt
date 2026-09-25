import { ItemView, WorkspaceLeaf, TFile, TFolder, Notice } from "obsidian";
import { findProjects, projectForPath } from "./project";
import { createSkryptNote, SECTION_FOLDERS, ownFolderFor } from "./notes";
import { SkryptProject, SkryptType } from "./types";

export const VIEW_TYPE_SKRYPT = "skrypt-sidebar";

interface SectionDef {
	type: SkryptType;
	label: string;
	singular: string;
}

const SECTIONS: SectionDef[] = [
	{ type: "note", label: "General Notes", singular: "Note" },
	{ type: "character", label: "Characters", singular: "Character" },
	{ type: "location", label: "Locations", singular: "Location" },
];

export class SkryptView extends ItemView {
	private projects: SkryptProject[] = [];
	private activeProject: SkryptProject | null = null;
	private expanded = new Set<string>();

	getViewType(): string {
		return VIEW_TYPE_SKRYPT;
	}

	getDisplayText(): string {
		return "Skrypt";
	}

	getIcon(): string {
		return "feather";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(this.app.metadataCache.on("changed", () => this.refresh()));
		this.registerEvent(this.app.vault.on("create", () => this.refresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.onActiveLeafChange())
		);
		this.refresh();
	}

	private onActiveLeafChange(): void {
		const active = this.app.workspace.getActiveFile();
		if (!active) return;
		const proj = projectForPath(this.projects, active.path);
		if (proj && proj.folderPath !== this.activeProject?.folderPath) {
			this.activeProject = proj;
			this.render();
		}
	}

	private refresh(): void {
		this.projects = findProjects(this.app);
		if (!this.activeProject || !this.projects.find((p) => p.folderPath === this.activeProject?.folderPath)) {
			const active = this.app.workspace.getActiveFile();
			this.activeProject =
				(active && projectForPath(this.projects, active.path)) ?? this.projects[0] ?? null;
		}
		this.render();
	}

	private render(): void {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("skrypt-view");

		if (this.projects.length === 0) {
			container.createEl("p", {
				text: "No Skrypt/Longform projects found. A project is any folder with an Index.md.",
				cls: "skrypt-empty",
			});
			return;
		}

		this.renderProjectPicker(container);

		if (!this.activeProject) return;

		for (const section of SECTIONS) {
			this.renderSection(container, this.activeProject, section);
		}
	}

	private renderProjectPicker(container: Element): void {
		const picker = container.createEl("select", { cls: "skrypt-project-picker" });
		for (const project of this.projects) {
			const opt = picker.createEl("option", { text: project.story, value: project.folderPath });
			if (project.folderPath === this.activeProject?.folderPath) opt.selected = true;
		}
		picker.addEventListener("change", () => {
			this.activeProject = this.projects.find((p) => p.folderPath === picker.value) ?? null;
			this.render();
		});
	}

	/** The trailing "type a title, hit Enter" row Longform uses for "New Scene". */
	private renderCreateRow(
		parent: HTMLElement,
		placeholder: string,
		onCreate: (title: string) => Promise<void>
	): void {
		const row = parent.createDiv({ cls: "skrypt-create-row" });
		const input = row.createEl("input", {
			type: "text",
			cls: "skrypt-create-input",
			attr: { placeholder: `New ${placeholder}` },
		});
		input.addEventListener("keydown", async (evt) => {
			if (evt.key !== "Enter") return;
			const title = input.value.trim();
			if (!title) return;
			input.disabled = true;
			try {
				await onCreate(title);
				input.value = "";
			} catch (e) {
				new Notice(`Skrypt: couldn't create note (${(e as Error).message})`);
			} finally {
				input.disabled = false;
				input.focus();
			}
		});
	}

	private renderSection(container: Element, project: SkryptProject, section: SectionDef): void {
		const wrap = container.createDiv({ cls: "skrypt-section" });
		wrap.createDiv({ text: section.label, cls: "skrypt-section-title" });

		const folderPath = `${project.folderPath}/${SECTION_FOLDERS[section.type]}`;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		const list = wrap.createEl("ul", { cls: "skrypt-list" });

		if (folder instanceof TFolder) {
			const entries = folder.children
				.filter((f): f is TFile => f instanceof TFile && f.extension === "md")
				.sort((a, b) => a.basename.localeCompare(b.basename));

			for (const file of entries) {
				this.renderEntry(list, project, section, file);
			}
		}

		this.renderCreateRow(wrap, section.singular, async (title) => {
			await createSkryptNote(this.app, { project, type: section.type, title });
		});
	}

	private renderEntry(list: HTMLElement, project: SkryptProject, section: SectionDef, file: TFile): void {
		const item = list.createEl("li", { cls: "skrypt-item" });
		const row = item.createDiv({ cls: "skrypt-item-row" });
		const link = row.createEl("span", { text: file.basename, cls: "skrypt-item-title" });
		link.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(file));

		if (section.type === "note") return; // notes don't get their own sub-notes

		const key = file.path;
		const toggle = row.createEl("button", {
			text: this.expanded.has(key) ? "▾" : "▸",
			cls: "skrypt-toggle",
		});
		toggle.addEventListener("click", () => {
			if (this.expanded.has(key)) this.expanded.delete(key);
			else this.expanded.add(key);
			this.render();
		});

		if (!this.expanded.has(key)) return;

		const sub = item.createDiv({ cls: "skrypt-subsection" });
		sub.createDiv({ text: "Notes", cls: "skrypt-section-title skrypt-sub-title" });

		const cache = this.app.metadataCache.getFileCache(file);
		const parentId = (cache?.frontmatter?.skrypt as { id?: string } | undefined)?.id;
		const parentFolder = ownFolderFor(project, section.type, file.basename);

		const subList = sub.createEl("ul", { cls: "skrypt-list skrypt-sublist" });
		const subFolder = this.app.vault.getAbstractFileByPath(`${parentFolder}/Notes`);
		if (subFolder instanceof TFolder) {
			const subEntries = subFolder.children
				.filter((f): f is TFile => f instanceof TFile && f.extension === "md")
				.sort((a, b) => a.basename.localeCompare(b.basename));
			for (const f of subEntries) {
				const li = subList.createEl("li", { text: f.basename, cls: "skrypt-item-title" });
				li.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(f));
			}
		}

		this.renderCreateRow(sub, "Note", async (title) => {
			await createSkryptNote(this.app, {
				project,
				type: "note",
				title,
				parentId,
				parentFolder,
			});
		});
	}
}
