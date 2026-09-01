// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UI_ACTOR_NAME, type TaskStatus } from "shared/tasks";
import api from "~/services/api";
import { queryKeys } from "./keys";

export function useTasks(filters: {
	status?: TaskStatus;
	assignee?: string;
	include_done_old?: boolean;
} = {}) {
	return useQuery({
		queryKey: queryKeys.tasks.list(filters),
		queryFn: ({ signal }) => api.listTasks(filters, { signal }),
		select: (data) => data.tasks,
		refetchInterval: 5_000,
	});
}

export function useAgents() {
	return useQuery({
		queryKey: queryKeys.agents.all,
		queryFn: ({ signal }) => api.listAgents({ signal }),
		select: (data) => data.agents,
		staleTime: 60_000,
	});
}

export function useCreateTask() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			title: string;
			description?: string;
			assignee_name?: string;
			actor_name: string;
		}) => api.createTask(input),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.tasks.root });
			void qc.invalidateQueries({ queryKey: queryKeys.agents.all });
		},
	});
}

export function useUpdateTask() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...input
		}: {
			id: string;
			title?: string;
			description?: string;
			status?: TaskStatus;
			assignee_name?: string;
			blocked_reason?: string;
			actor_name: string;
		}) => api.updateTask(id, input),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.tasks.root });
			void qc.invalidateQueries({ queryKey: queryKeys.agents.all });
		},
	});
}

export function useTask(id: string | null) {
	return useQuery({
		queryKey: queryKeys.tasks.detail(id ?? ""),
		queryFn: ({ signal }) => api.getTask(id ?? "", { signal }),
		enabled: Boolean(id),
		refetchInterval: 5_000,
	});
}

export function useDeleteTask() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.deleteTask(id, UI_ACTOR_NAME),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.tasks.root });
		},
	});
}
