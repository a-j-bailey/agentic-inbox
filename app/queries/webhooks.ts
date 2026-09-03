// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WebhookEvent } from "shared/webhooks";
import api from "~/services/api";
import { queryKeys } from "./keys";

export function useWebhooks() {
	return useQuery({
		queryKey: queryKeys.webhooks.all,
		queryFn: ({ signal }) => api.listWebhooks({ signal }),
		select: (data) => data.webhooks,
	});
}

export function useCreateWebhook() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: {
			event: WebhookEvent;
			url: string;
			secret: string;
			mailbox_id?: string | null;
			assignee?: string | null;
		}) => api.createWebhook(input),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.webhooks.all });
		},
	});
}

export function useUpdateWebhook() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...input
		}: {
			id: string;
			enabled?: boolean;
			url?: string;
			secret?: string;
			mailbox_id?: string | null;
			assignee?: string | null;
		}) => api.updateWebhook(id, input),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.webhooks.all });
		},
	});
}

export function useDeleteWebhook() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.deleteWebhook(id),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: queryKeys.webhooks.all });
		},
	});
}
