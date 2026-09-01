// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { formatRelativeDate } from "shared/dates";
import type { Task } from "shared/tasks";

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
			className="w-full text-left rounded-lg border border-kumo-line bg-kumo-base p-3 hover:bg-kumo-tint transition-colors cursor-grab"
		>
			<div className="text-sm font-medium text-kumo-default">{task.title}</div>
			<div className="mt-1 text-xs text-kumo-subtle">
				{task.assignee_name} · {formatRelativeDate(task.updated_at)}
			</div>
			{task.status === "blocked" && task.blocked_reason && (
				<div className="mt-1 text-xs text-kumo-subtle truncate">
					{task.blocked_reason}
				</div>
			)}
		</button>
	);
}
