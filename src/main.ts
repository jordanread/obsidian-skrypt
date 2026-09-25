import { Plugin, WorkspaceLeaf } from "obsidian";
import { SkryptView, VIEW_TYPE_SKRYPT } from "./view";

export default class SkryptPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(VIEW_TYPE_SKRYPT, (leaf) => new SkryptView(leaf));

		this.addRibbonIcon("feather", "Open Skrypt", () => this.activateView());

		this.addCommand({
			id: "skrypt-open-sidebar",
			name: "Open Skrypt sidebar",
			callback: () => this.activateView(),
		});
	}

	async onunload(): Promise<void> {
		// Nothing to tear down explicitly; registerView/registerEvent handle cleanup.
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_SKRYPT)[0] ?? null;

		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_SKRYPT, active: true });
		}

		if (leaf) workspace.revealLeaf(leaf);
	}
}
