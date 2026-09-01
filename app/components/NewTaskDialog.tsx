// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Dialog, Input, Select, Textarea } from "@cloudflare/kumo";
import { type FormEvent, useState } from "react";
import type { Agent } from "shared/tasks";

export const DONNA_ASSIGNS_VALUE = "__donna_assigns__";

export function assigneeNameForCreate(selected: string): string {
	return selected === DONNA_ASSIGNS_VALUE ? "" : selected;
}

export default function NewTaskDialog({
	open,
	onOpenChange,
	agents,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	agents: Agent[];
	onCreate: (input: {
		title: string;
		description: string;
		assignee_name: string;
	}) => Promise<void>;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [assignee, setAssignee] = useState(DONNA_ASSIGNS_VALUE);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reset = () => {
		setTitle("");
		setDescription("");
		setAssignee(DONNA_ASSIGNS_VALUE);
		setError(null);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!title.trim()) {
			setError("Title is required");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await onCreate({
				title: title.trim(),
				description: description.trim(),
				assignee_name: assigneeNameForCreate(assignee),
			});
			reset();
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create task");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) reset();
			}}
		>
			<Dialog size="sm" className="p-6">
				<Dialog.Title className="text-base font-semibold mb-5">New task</Dialog.Title>
				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<p className="text-sm text-kumo-error" role="alert">
							{error}
						</p>
					)}
					<Input
						label="Title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						required
						autoFocus
					/>
					<Textarea
						label="Description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={4}
					/>
					<div>
						<span className="text-sm font-medium text-kumo-default mb-1.5 block">
							Assignee
						</span>
						<Select
							aria-label="Assignee"
							value={assignee}
							onValueChange={(value) => {
								if (value) setAssignee(value);
							}}
						>
							<Select.Option value={DONNA_ASSIGNS_VALUE}>Donna assigns</Select.Option>
							{agents.map((agent) => (
								<Select.Option key={agent.id} value={agent.name}>
									{agent.name}
								</Select.Option>
							))}
						</Select>
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									Cancel
								</Button>
							)}
						/>
						<Button type="submit" variant="primary" size="sm" loading={saving}>
							Create
						</Button>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
