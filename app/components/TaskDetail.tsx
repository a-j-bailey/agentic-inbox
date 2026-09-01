// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Input } from "@cloudflare/kumo";
import { TrashIcon, XIcon } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { formatRelativeDate } from "shared/dates";
import {
	TASK_STATUSES,
	assertNever,
	buildTaskTimeline,
	isTaskStatus,
	taskStatusLabel,
	type Agent,
	type Task,
	type TaskStatus,
	type TaskTimelineItem,
	type TaskUpdate,
} from "shared/tasks";
import NativeSelect from "./NativeSelect";

function timelineCopy(item: TaskTimelineItem): string {
	const time = formatRelativeDate(item.at);
	switch (item.kind) {
		case "created":
			return `Created by ${item.actor_name} · ${time}`;
		case "started":
			return `In progress · ${time}`;
		case "blocked":
			return `${item.text} · ${time}`;
		case "completed":
			return `Done · ${time}`;
		case "update":
			return `${item.actor_name} · ${item.text} · ${time}`;
		default:
			return assertNever(item.kind);
	}
}

export default function TaskDetail({
	task,
	updates,
	agents,
	onClose,
	onSave,
	onDelete,
	onAddUpdate,
}: {
	task: Task;
	updates: TaskUpdate[];
	agents: Agent[];
	onClose: () => void;
	onSave: (patch: {
		title?: string;
		description?: string;
		status?: TaskStatus;
		assignee_name?: string;
		blocked_reason?: string;
	}) => Promise<void>;
	onDelete: () => Promise<void>;
	onAddUpdate: (body: string) => Promise<void>;
}) {
	const [title, setTitle] = useState(task.title);
	const [description, setDescription] = useState(task.description);
	const [status, setStatus] = useState<TaskStatus>(task.status);
	const [assignee, setAssignee] = useState(task.assignee_name);
	const [blockedReason, setBlockedReason] = useState(task.blocked_reason ?? "");
	const [note, setNote] = useState("");

	const changeAssignee = (value: string) => {
		setAssignee(value);
		void onSave({ assignee_name: value });
	};

	const changeStatus = (value: string) => {
		if (!isTaskStatus(value)) return;
		setStatus(value);
		if (value === "blocked" && !blockedReason.trim()) return;
		void onSave({
			status: value,
			blocked_reason: value === "blocked" ? blockedReason : undefined,
		});
	};

	const submitNote = async (event: FormEvent) => {
		event.preventDefault();
		const body = note.trim();
		if (!body) return;
		await onAddUpdate(body);
		setNote("");
	};

	const timeline = buildTaskTimeline(task, updates);

	return (
		<div className="fixed inset-0 z-20 flex justify-end pointer-events-none">
			<button
				type="button"
				className="absolute inset-0 bg-black/30 pointer-events-auto"
				aria-label="Close task"
				onClick={onClose}
			/>
			<aside className="relative z-10 w-full max-w-md bg-kumo-base border-l border-kumo-line h-full overflow-y-auto p-5 flex flex-col gap-5 pointer-events-auto">
				<div className="flex items-start gap-2">
					<h2 className="text-base font-semibold text-kumo-default flex-1">Task</h2>
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						icon={<XIcon size={16} />}
						onClick={onClose}
						aria-label="Close"
					/>
				</div>
				<Input
					label="Title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					onBlur={() => {
						const next = title.trim();
						if (!next || next === task.title) return;
						void onSave({ title: next });
					}}
				/>
				<div className="grid grid-cols-2 gap-3">
					<NativeSelect
						label="Assignee"
						value={assignee}
						onChange={changeAssignee}
					>
						{agents.map((agent) => (
							<option key={agent.id} value={agent.name}>
								{agent.name}
							</option>
						))}
					</NativeSelect>
					<NativeSelect label="Status" value={status} onChange={changeStatus}>
						{TASK_STATUSES.map((value) => (
							<option key={value} value={value}>
								{taskStatusLabel(value)}
							</option>
						))}
					</NativeSelect>
				</div>
				{status === "blocked" && (
					<Input
						label="Blocked reason"
						value={blockedReason}
						onChange={(e) => setBlockedReason(e.target.value)}
						onBlur={() => {
							const reason = blockedReason.trim();
							if (!reason) return;
							void onSave({ status: "blocked", blocked_reason: reason });
						}}
					/>
				)}
				{description.trim() || task.description ? (
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						onBlur={() => {
							if (description === task.description) return;
							void onSave({ description });
						}}
						rows={3}
						aria-label="Description"
						className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring"
					/>
				) : null}
				<ol className="space-y-2.5">
					{timeline.map((item) => (
						<li key={item.id} className="text-sm text-kumo-default">
							{timelineCopy(item)}
						</li>
					))}
				</ol>
				<form onSubmit={(event) => void submitNote(event)} className="flex gap-2">
					<div className="flex-1">
						<Input
							aria-label="Add an update"
							placeholder="Add an update"
							value={note}
							onChange={(e) => setNote(e.target.value)}
						/>
					</div>
					<Button type="submit" variant="secondary" size="sm" disabled={!note.trim()}>
						Post
					</Button>
				</form>
				<div className="mt-auto pt-2">
					<Button
						variant="destructive"
						size="sm"
						icon={<TrashIcon size={14} />}
						onClick={() => void onDelete()}
					>
						Delete
					</Button>
				</div>
			</aside>
		</div>
	);
}
