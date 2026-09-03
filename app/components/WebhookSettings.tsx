// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Input, Switch, Text, useKumoToastManager } from "@cloudflare/kumo";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { isWebhookEvent, WEBHOOK_EVENTS, type WebhookEvent } from "shared/webhooks";
import NativeSelect from "~/components/NativeSelect";
import {
	useCreateWebhook,
	useDeleteWebhook,
	useUpdateWebhook,
	useWebhooks,
} from "~/queries/webhooks";

export default function WebhookSettings() {
	const toastManager = useKumoToastManager();
	const { data: webhooks = [] } = useWebhooks();
	const createWebhook = useCreateWebhook();
	const updateWebhook = useUpdateWebhook();
	const deleteWebhook = useDeleteWebhook();

	const [event, setEvent] = useState<WebhookEvent>("email.received");
	const [url, setUrl] = useState("");
	const [secret, setSecret] = useState("");
	const [mailboxId, setMailboxId] = useState("");
	const [assignee, setAssignee] = useState("");
	const [formError, setFormError] = useState<string | null>(null);

	const handleAdd = async () => {
		setFormError(null);
		if (!url.trim() || !secret.trim()) {
			setFormError("URL and bearer token are required.");
			return;
		}
		try {
			await createWebhook.mutateAsync({
				event,
				url: url.trim(),
				secret: secret.trim(),
				mailbox_id: mailboxId.trim() || null,
				assignee: assignee.trim() || null,
			});
			setUrl("");
			setSecret("");
			setMailboxId("");
			setAssignee("");
		} catch {
			toastManager.add({ title: "Failed to add webhook", variant: "error" });
		}
	};

	return (
		<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
			<div className="text-sm font-medium text-kumo-default mb-4">Webhooks</div>

			{webhooks.length > 0 && (
				<div className="rounded-xl border border-kumo-line overflow-hidden mb-4">
					{webhooks.map((hook) => (
						<div
							key={hook.id}
							className="flex items-center gap-3 px-3 py-2 border-b border-kumo-line last:border-b-0"
						>
							<div className="min-w-0 flex-1">
								<div className="text-sm text-kumo-default truncate">{hook.event}</div>
								<div className="text-xs text-kumo-subtle truncate">{hook.url}</div>
								<div className="text-xs text-kumo-subtle font-mono">{hook.secret}</div>
							</div>
							<Switch
								aria-label={hook.enabled ? "Disable webhook" : "Enable webhook"}
								checked={hook.enabled}
								onCheckedChange={(checked) => {
									void updateWebhook.mutateAsync({ id: hook.id, enabled: checked }).catch(
										() => {
											toastManager.add({
												title: "Failed to update webhook",
												variant: "error",
											});
										},
									);
								}}
								size="sm"
							/>
							<Button
								variant="ghost"
								shape="square"
								size="sm"
								icon={<TrashIcon size={14} />}
								aria-label="Delete webhook"
								onClick={() => {
									void deleteWebhook.mutateAsync(hook.id).catch(() => {
										toastManager.add({
											title: "Failed to delete webhook",
											variant: "error",
										});
									});
								}}
							/>
						</div>
					))}
				</div>
			)}

			<div className="space-y-3">
				<NativeSelect
					label="Event"
					value={event}
					onChange={(value) => {
						if (isWebhookEvent(value)) setEvent(value);
					}}
				>
					{WEBHOOK_EVENTS.map((item) => (
						<option key={item} value={item}>
							{item}
						</option>
					))}
				</NativeSelect>
				<Input
					label="URL"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://"
				/>
				<Input
					label="Bearer token"
					type="password"
					value={secret}
					onChange={(e) => setSecret(e.target.value)}
					autoComplete="off"
				/>
				<Input
					label="Mailbox (optional)"
					value={mailboxId}
					onChange={(e) => setMailboxId(e.target.value)}
				/>
				<Input
					label="Assignee (optional)"
					value={assignee}
					onChange={(e) => setAssignee(e.target.value)}
				/>
				{formError && <Text variant="error">{formError}</Text>}
				<div className="flex justify-end">
					<Button
						variant="secondary"
						size="sm"
						icon={<PlusIcon size={14} />}
						onClick={() => void handleAdd()}
						loading={createWebhook.isPending}
					>
						Add
					</Button>
				</div>
			</div>
		</div>
	);
}
