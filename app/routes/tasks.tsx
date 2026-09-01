// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Dialog, Input, Loader, Select, useKumoToastManager } from "@cloudflare/kumo";
import { TrashIcon, XIcon } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { formatDetailDate } from "shared/dates";
import {
	TASK_STATUSES,
	UI_ACTOR_NAME,
	isTaskStatus,
	taskStatusLabel,
	type Task,
	type TaskStatus,
} from "shared/tasks";
import Header from "~/components/Header";
import NewTaskDialog from "~/components/NewTaskDialog";
import TaskBoardHeader from "~/components/TaskBoardHeader";
import TaskStatusSection from "~/components/TaskStatusSection";
import { usePullToRefresh } from "~/hooks/usePullToRefresh";
import {
	useAgents,
	useCreateTask,
	useDeleteTask,
	useTasks,
	useUpdateTask,
} from "~/queries/tasks";

export function meta() {
	return [{ title: "Tasks · Agentic Inbox" }];
}

export default function TasksRoute() {
	const toastManager = useKumoToastManager();
	const [assigneeFilter, setAssigneeFilter] = useState("all");
	const [hideOldDone, setHideOldDone] = useState(true);
	const [createOpen, setCreateOpen] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [blockedPrompt, setBlockedPrompt] = useState<{
		taskId: string;
		reason: string;
	} | null>(null);

	const [collapsed, setCollapsed] = useState<Partial<Record<TaskStatus, boolean>>>(
		{},
	);
	const [refreshing, setRefreshing] = useState(false);

	const { data: agents = [] } = useAgents();
	const { data: tasks = [], isFetched, refetch } = useTasks({
		assignee: assigneeFilter === "all" ? undefined : assigneeFilter,
		include_done_old: !hideOldDone,
	});
	const createTask = useCreateTask();
	const updateTask = useUpdateTask();
	const deleteTask = useDeleteTask();

	const refresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};
	const pull = usePullToRefresh(refresh);

	const selected = tasks.find((task) => task.id === selectedId) ?? null;

	const columns = useMemo(() => {
		const grouped: Record<TaskStatus, Task[]> = {
			pending: [],
			blocked: [],
			in_progress: [],
			done: [],
		};
		for (const task of tasks) {
			grouped[task.status].push(task);
		}
		return grouped;
	}, [tasks]);

	const moveTask = async (taskId: string, status: TaskStatus) => {
		const task = tasks.find((item) => item.id === taskId);
		if (!task || task.status === status) return;
		if (status === "blocked") {
			setBlockedPrompt({ taskId, reason: "" });
			return;
		}
		try {
			await updateTask.mutateAsync({
				id: taskId,
				status,
				actor_name: UI_ACTOR_NAME,
			});
		} catch (error) {
			toastManager.add({
				title: error instanceof Error ? error.message : "Could not update task",
				variant: "error",
			});
		}
	};

	const confirmBlocked = async () => {
		if (!blockedPrompt) return;
		const reason = blockedPrompt.reason.trim();
		if (!reason) return;
		try {
			await updateTask.mutateAsync({
				id: blockedPrompt.taskId,
				status: "blocked",
				blocked_reason: reason,
				actor_name: UI_ACTOR_NAME,
			});
			setBlockedPrompt(null);
		} catch (error) {
			toastManager.add({
				title: error instanceof Error ? error.message : "Could not block task",
				variant: "error",
			});
		}
	};

	return (
		<div className="h-screen flex flex-col bg-kumo-recessed">
			<Header />
			<div
				className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-8 md:px-6 md:py-16"
				onTouchStart={pull.onTouchStart}
				onTouchMove={pull.onTouchMove}
				onTouchEnd={pull.onTouchEnd}
			>
				{(pull.offset > 0 || pull.refreshing) && (
					<div
						className="flex justify-center items-start overflow-hidden"
						style={{
							height: Math.max(pull.offset, pull.refreshing ? 40 : 0),
						}}
					>
						<Loader size="sm" />
					</div>
				)}
				<TaskBoardHeader
					agents={agents}
					assigneeFilter={assigneeFilter}
					hideOldDone={hideOldDone}
					onAssigneeFilterChange={setAssigneeFilter}
					onHideOldDoneChange={setHideOldDone}
					onNewTask={() => setCreateOpen(true)}
					onRefresh={() => void refresh()}
					refreshing={refreshing}
				/>
				{!isFetched ? (
					<div className="flex justify-center py-20">
						<Loader size="lg" />
					</div>
				) : (
					<div className="space-y-3">
						{TASK_STATUSES.map((status) => (
							<TaskStatusSection
								key={status}
								status={status}
								tasks={columns[status]}
								collapsed={Boolean(collapsed[status])}
								onToggle={() =>
									setCollapsed((current) => ({
										...current,
										[status]: !current[status],
									}))
								}
								onDropTask={(taskId) => void moveTask(taskId, status)}
								onSelectTask={setSelectedId}
							/>
						))}
					</div>
				)}
			</div>

			<NewTaskDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				agents={agents}
				onCreate={async (input) => {
					await createTask.mutateAsync({
						title: input.title,
						description: input.description,
						assignee_name: input.assignee_name,
						actor_name: UI_ACTOR_NAME,
					});
					toastManager.add({ title: "Task created" });
				}}
			/>

			<Dialog.Root
				open={Boolean(blockedPrompt)}
				onOpenChange={(open) => {
					if (!open) setBlockedPrompt(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						Blocked reason
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-4">
						Required when a task moves to Blocked.
					</Dialog.Description>
					<Input
						label="Reason"
						value={blockedPrompt?.reason ?? ""}
						onChange={(e) =>
							setBlockedPrompt((current) =>
								current ? { ...current, reason: e.target.value } : current,
							)
						}
					/>
					<div className="flex justify-end gap-2 mt-4">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									Cancel
								</Button>
							)}
						/>
						<Button
							variant="primary"
							size="sm"
							disabled={!blockedPrompt?.reason.trim()}
							onClick={() => void confirmBlocked()}
						>
							Block
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>

			{selected && (
				<TaskDrawer
					key={selected.id}
					task={selected}
					agents={agents}
					onClose={() => setSelectedId(null)}
					onSave={async (patch) => {
						try {
							await updateTask.mutateAsync({
								id: selected.id,
								...patch,
								actor_name: UI_ACTOR_NAME,
							});
						} catch (error) {
							toastManager.add({
								title: error instanceof Error ? error.message : "Could not save task",
								variant: "error",
							});
							throw error;
						}
					}}
					onDelete={async () => {
						try {
							await deleteTask.mutateAsync(selected.id);
							setSelectedId(null);
							toastManager.add({ title: "Task deleted" });
						} catch {
							toastManager.add({ title: "Could not delete task", variant: "error" });
						}
					}}
				/>
			)}
		</div>
	);
}

function TaskDrawer({
	task,
	agents,
	onClose,
	onSave,
	onDelete,
}: {
	task: Task;
	agents: { id: string; name: string }[];
	onClose: () => void;
	onSave: (patch: {
		title?: string;
		description?: string;
		status?: TaskStatus;
		assignee_name?: string;
		blocked_reason?: string;
	}) => Promise<void>;
	onDelete: () => Promise<void>;
}) {
	const [title, setTitle] = useState(task.title);
	const [description, setDescription] = useState(task.description);
	const [status, setStatus] = useState<TaskStatus>(task.status);
	const [assignee, setAssignee] = useState(task.assignee_name);
	const [blockedReason, setBlockedReason] = useState(task.blocked_reason ?? "");
	const [saving, setSaving] = useState(false);

	const persist = async (patch: Parameters<typeof onSave>[0]) => {
		setSaving(true);
		try {
			await onSave(patch);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-20 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 bg-black/30"
				aria-label="Close task"
				onClick={onClose}
			/>
			<aside className="relative w-full max-w-md bg-kumo-base border-l border-kumo-line h-full overflow-y-auto p-5 flex flex-col gap-4">
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
				<Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
				<textarea
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					rows={6}
					aria-label="Description"
					className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring"
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
						{agents.map((agent) => (
							<Select.Option key={agent.id} value={agent.name}>
								{agent.name}
							</Select.Option>
						))}
					</Select>
				</div>
				<div>
					<span className="text-sm font-medium text-kumo-default mb-1.5 block">
						Status
					</span>
					<Select
						aria-label="Status"
						value={status}
						onValueChange={(value) => {
							if (value && isTaskStatus(value)) {
								setStatus(value);
							}
						}}
					>
						{TASK_STATUSES.map((value) => (
							<Select.Option key={value} value={value}>
								{taskStatusLabel(value)}
							</Select.Option>
						))}
					</Select>
				</div>
				{(status === "blocked" || task.status === "blocked") && (
					<Input
						label="Blocked reason"
						value={blockedReason}
						onChange={(e) => setBlockedReason(e.target.value)}
					/>
				)}
				<div className="text-xs text-kumo-subtle space-y-1">
					<div>Created by {task.created_by}</div>
					<div>Updated by {task.updated_by}</div>
					<div>Created {formatDetailDate(task.created_at)}</div>
					<div>Updated {formatDetailDate(task.updated_at)}</div>
					{task.started_at && <div>Started {formatDetailDate(task.started_at)}</div>}
					{task.blocked_at && <div>Blocked {formatDetailDate(task.blocked_at)}</div>}
					{task.completed_at && <div>Completed {formatDetailDate(task.completed_at)}</div>}
				</div>
				<div className="mt-auto flex justify-between pt-2">
					<Button
						variant="destructive"
						size="sm"
						icon={<TrashIcon size={14} />}
						onClick={() => void onDelete()}
					>
						Delete
					</Button>
					<Button
						variant="primary"
						size="sm"
						loading={saving}
						onClick={() =>
							void persist({
								title,
								description,
								status,
								assignee_name: assignee,
								blocked_reason: status === "blocked" ? blockedReason : undefined,
							})
						}
					>
						Save
					</Button>
				</div>
			</aside>
		</div>
	);
}
