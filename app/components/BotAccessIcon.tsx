// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { RobotIcon } from "@phosphor-icons/react";

export function BotAccessIcon({
	enabled,
	size = 14,
}: {
	enabled: boolean;
	size?: number;
}) {
	if (!enabled) return null;
	return (
		<span
			data-testid="bot-access-icon"
			aria-label="Bot access on"
			className="inline-flex shrink-0"
		>
			<RobotIcon size={size} weight="fill" className="text-kumo-subtle" aria-hidden />
		</span>
	);
}
