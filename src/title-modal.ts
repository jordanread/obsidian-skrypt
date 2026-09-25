import { App, Modal } from "obsidian";

export class TitleModal extends Modal {
	private value = "";
	private resolved = false;

	constructor(app: App, private context: string, private onSubmit: (title: string | null) => void) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(`New ${this.context}`);
		const input = this.contentEl.createEl("input", {
			type: "text",
			cls: "skrypt-title-input",
			attr: { placeholder: "Title" },
		});
		input.focus();

		const submit = () => {
			if (this.resolved) return;
			this.resolved = true;
			this.onSubmit(input.value.trim() || null);
			this.close();
		};

		input.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") submit();
		});

		const btnRow = this.contentEl.createDiv({ cls: "skrypt-modal-buttons" });
		const createBtn = btnRow.createEl("button", { text: "Create", cls: "mod-cta" });
		createBtn.addEventListener("click", submit);
		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolved = true;
			this.onSubmit(null);
		}
		this.contentEl.empty();
	}
}

export function promptForTitle(app: App, context: string): Promise<string | null> {
	return new Promise((resolve) => {
		new TitleModal(app, context, resolve).open();
	});
}
