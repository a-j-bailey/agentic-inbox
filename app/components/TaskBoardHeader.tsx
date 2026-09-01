// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Popover, Switch, Tooltip } from "@cloudflare/kumo";
import {
	ArrowClockwiseIcon,
	FunnelIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import type { Agent } from "shared/tasks";
import NativeSelect from "./NativeSelect";

export const DEFAULT_ASSIGNEE_FILTER = "all";

export function taskFiltersActive(
	assigneeFilter: string,
	hideOldDone: boolean,
): boolean {
	return assigneeFilter !== DEFAULT_ASSIGNEE_FILTER || !hideOldDone;
}

export default function TaskBoardHeader({
	agents,
	assigneeFilter,
	hideOldDone,
	onAssigneeFilterChange,
	onHideOldDoneChange,
	onNewTask,
	onRefresh,
	refreshing,
}: {
	agents: Agent[];
	assigneeFilter: string;
	hideOldDone: boolean;
	onAssigneeFilterChange: (value: string) => void;
	onHideOldDoneChange: (value: boolean) => void;
	onNewTask: () => void;
	onRefresh: () => void;
	refreshing: boolean;
}) {
	const filtersActive = taskFiltersActive(assigneeFilter, hideOldDone);

	return (
		<div className="mb-8">
			<div className="flex items-center justify-between gap-3">
				<h1 className="text-2xl font-bold text-kumo-default">Tasks</h1>
				<div className="flex items-center gap-2 shrink-0">
					<Tooltip content="Refresh" side="bottom" asChild>
						<Button
							variant="ghost"
							shape="square"
							icon={<ArrowClockwiseIcon size={20} />}
							onClick={onRefresh}
							aria-label="Refresh"
							loading={refreshing}
							className="hidden md:inline-flex"
						/>
					</Tooltip>
					<Popover>
						<Popover.Trigger asChild>
							<Button
								variant="secondary"
								icon={<FunnelIcon size={16} />}
								data-filters-active={filtersActive ? "true" : "false"}
								aria-label="Filter"
							>
								Filter
								{filtersActive && (
									<span className="ml-1 inline-block size-1.5 rounded-full bg-kumo-brand" />
								)}
							</Button>
						</Popover.Trigger>
						<Popover.Content align="end" className="w-72 p-4">
							<Popover.Title className="text-sm font-medium text-kumo-default mb-3">
								Filter
							</Popover.Title>
							<div className="space-y-4">
								<NativeSelect
									label="Assignee"
									value={assigneeFilter}
									onChange={onAssigneeFilterChange}
								>
									<option value={DEFAULT_ASSIGNEE_FILTER}>All</option>
									{agents.map((agent) => (
										<option key={agent.id} value={agent.name}>
											{agent.name}
										</option>
									))}
								</NativeSelect>
								<Switch
									label="Hide old done"
									checked={hideOldDone}
									onCheckedChange={onHideOldDoneChange}
									size="sm"
								/>
							</div>
						</Popover.Content>
					</Popover>
					<Button
						variant="primary"
						icon={<PlusIcon size={16} />}
						onClick={onNewTask}
					>
						New task
					</Button>
				</div>
			</div>
			<p className="text-sm text-kumo-subtle mt-1">Shared across mailboxes</p>
		</div>
	);
}
