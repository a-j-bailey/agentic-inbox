// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { taskStatusLabel, type Task, type TaskStatus } from "shared/tasks";
import TaskCard from "./TaskCard";
import TaskStatusBadge from "./TaskStatusBadge";

export default function TaskStatusSection({
	status,
	tasks,
	collapsed,
	onToggle,
	onDropTask,
	onSelectTask,
}: {
	status: TaskStatus;
	tasks: Task[];
	collapsed: boolean;
	onToggle: () => void;
	onDropTask: (taskId: string) => void;
	onSelectTask: (taskId: string) => void;
}) {
	const label = taskStatusLabel(status);

	return (
		<section
			className="rounded-xl border border-kumo-line bg-kumo-base"
			onDragOver={(event) => {
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
			}}
			onDrop={(event) => {
				event.preventDefault();
				const taskId = event.dataTransfer.getData("text/task-id");
				if (taskId) onDropTask(taskId);
			}}
		>
			<button
				type="button"
				className="w-full flex items-center gap-2 px-4 py-3 text-left"
				aria-expanded={!collapsed}
				aria-label={`${label} (${tasks.length})`}
				onClick={onToggle}
			>
				{collapsed ? (
					<CaretRightIcon size={16} className="text-kumo-subtle shrink-0" />
				) : (
					<CaretDownIcon size={16} className="text-kumo-subtle shrink-0" />
				)}
				<h2>
					<TaskStatusBadge status={status} />
				</h2>
				<span className="text-xs text-kumo-subtle">{tasks.length}</span>
			</button>
			{!collapsed && (
				<div className="px-3 pb-3 space-y-2">
					{tasks.map((task) => (
						<TaskCard
							key={task.id}
							task={task}
							onClick={() => onSelectTask(task.id)}
						/>
					))}
				</div>
			)}
		</section>
	);
}
