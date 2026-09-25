import { ItemView, WorkspaceLeaf, TFile, TFolder, Notice } from "obsidian";
import { findProjects, projectForPath } from "./project";
import { createSkryptNote, SECTION_FOLDERS, ownFolderFor } from "./notes";
import { SkryptProject, SkryptType } from "./types";
import { promptForTitle } from "./title-modal";

export const VIEW_TYPE_SKRYPT = "skrypt-sidebar";

interface SectionDef {
	type: SkryptType;
	label: string;
}

const SECTIONS: SectionDef[] = [
	{ type: "note", label: "General Notes" },
	{ type: "character", label: "Characters" },
	{ type: "setting", label: "Settings" },
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

	private renderSection(container: Element, project: SkryptProject, section: SectionDef): void {
		const wrap = container.createDiv({ cls: "skrypt-section" });
		const header = wrap.createDiv({ cls: "skrypt-section-header" });
		header.createEl("span", { text: section.label, cls: "skrypt-section-title" });
		const addBtn = header.createEl("button", { text: "+ New", cls: "skrypt-add-btn" });
		addBtn.addEventListener("click", async () => {
			const title = await promptForTitle(this.app, section.label);
			if (!title) return;
			try {
				const file = await createSkryptNote(this.app, { project, type: section.type, title });
				await this.app.workspace.getLeaf(false).openFile(file);
			} catch (e) {
				new Notice(`Skrypt: couldn't create note (${(e as Error).message})`);
			}
		});

		const folderPath = `${project.folderPath}/${SECTION_FOLDERS[section.type]}`;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		const list = wrap.createEl("ul", { cls: "skrypt-list" });

		if (!(folder instanceof TFolder)) return;

		const entries = folder.children
			.filter((f): f is TFile => f instanceof TFile && f.extension === "md")
			.sort((a, b) => a.basename.localeCompare(b.basename));

		for (const file of entries) {
			this.renderEntry(list, project, section, file);
		}
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
		const subHeader = sub.createDiv({ cls: "skrypt-section-header" });
		subHeader.createEl("span", { text: "Notes", cls: "skrypt-section-title skrypt-sub-title" });
		const subAdd = subHeader.createEl("button", { text: "+ New", cls: "skrypt-add-btn" });

		const cache = this.app.metadataCache.getFileCache(file);
		const parentId = (cache?.frontmatter?.skrypt as { id?: string } | undefined)?.id;
		const parentFolder = ownFolderFor(project, section.type, file.basename);

		subAdd.addEventListener("click", async () => {
			const title = await promptForTitle(this.app, `Note for ${file.basename}`);
			if (!title) return;
			const created = await createSkryptNote(this.app, {
				project,
				type: "note",
				title,
				parentId,
				parentFolder,
			});
			await this.app.workspace.getLeaf(false).openFile(created);
		});

		const subFolder = this.app.vault.getAbstractFileByPath(`${parentFolder}/Notes`);
		const subList = sub.createEl("ul", { cls: "skrypt-list skrypt-sublist" });
		if (subFolder instanceof TFolder) {
			const subEntries = subFolder.children
				.filter((f): f is TFile => f instanceof TFile && f.extension === "md")
				.sort((a, b) => a.basename.localeCompare(b.basename));
			for (const f of subEntries) {
				const li = subList.createEl("li", { text: f.basename, cls: "skrypt-item-title" });
				li.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(f));
			}
		}
	}
}
