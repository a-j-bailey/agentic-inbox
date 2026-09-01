// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Dialog, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { useMemo, useState } from "react";
import {
	TASK_STATUSES,
	UI_ACTOR_NAME,
	type Task,
	type TaskStatus,
} from "shared/tasks";
import Header from "~/components/Header";
import NewTaskDialog from "~/components/NewTaskDialog";
import TaskBoardHeader from "~/components/TaskBoardHeader";
import TaskDetail from "~/components/TaskDetail";
import TaskStatusSection from "~/components/TaskStatusSection";
import { usePullToRefresh } from "~/hooks/usePullToRefresh";
import {
	useAddTaskUpdate,
	useAgents,
	useCreateTask,
	useDeleteTask,
	useTask,
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
	const addUpdate = useAddTaskUpdate();
	const detail = useTask(selectedId);

	const refresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};
	const pull = usePullToRefresh(refresh);

	const selected =
		detail.data ?? tasks.find((task) => task.id === selectedId) ?? null;
	const updates = detail.data?.updates ?? [];

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
				<TaskDetail
					key={selected.id}
					task={selected}
					updates={updates}
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
					onAddUpdate={async (body) => {
						try {
							await addUpdate.mutateAsync({
								id: selected.id,
								body,
								actor_name: UI_ACTOR_NAME,
							});
						} catch (error) {
							toastManager.add({
								title: error instanceof Error ? error.message : "Could not post update",
								variant: "error",
							});
						}
					}}
				/>
			)}
		</div>
	);
}
