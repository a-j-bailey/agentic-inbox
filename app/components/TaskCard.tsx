// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, type BadgeVariant } from "@cloudflare/kumo";
import { formatRelativeDate } from "shared/dates";
import {
	assertNever,
	taskStatusLabel,
	type Task,
	type TaskStatus,
} from "shared/tasks";

function statusBadgeVariant(status: TaskStatus): BadgeVariant {
	switch (status) {
		case "pending":
			return "outline";
		case "blocked":
			return "destructive";
		case "in_progress":
			return "primary";
		case "done":
			return "secondary";
		default:
			return assertNever(status);
	}
}

export default function TaskCard({
	task,
	onClick,
}: {
	task: Task;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			draggable
			onDragStart={(event) => {
				event.dataTransfer.setData("text/task-id", task.id);
				event.dataTransfer.effectAllowed = "move";
			}}
			onClick={onClick}
			className="w-full text-left rounded-lg border border-kumo-line bg-kumo-recessed p-3 hover:bg-kumo-tint transition-colors cursor-grab"
		>
			<div className="text-sm font-medium text-kumo-default">{task.title}</div>
			<div className="mt-2 flex items-center gap-1.5 flex-wrap">
				<Badge variant={statusBadgeVariant(task.status)}>
					{taskStatusLabel(task.status)}
				</Badge>
				<Badge variant="outline">{task.assignee_name}</Badge>
				<span className="text-xs text-kumo-subtle ml-auto">
					{formatRelativeDate(task.updated_at)}
				</span>
			</div>
			{task.status === "blocked" && task.blocked_reason && (
				<div className="mt-1 text-xs text-kumo-subtle truncate">
					{task.blocked_reason}
				</div>
			)}
		</button>
	);
}
