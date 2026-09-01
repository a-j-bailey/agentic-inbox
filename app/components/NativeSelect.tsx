// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { ChangeEvent, ReactNode } from "react";

const selectClassName =
	"w-full h-9 rounded-lg border border-kumo-line bg-kumo-base px-3 text-sm text-kumo-default";

export default function NativeSelect({
	label,
	value,
	onChange,
	children,
	"aria-label": ariaLabel,
}: {
	label?: string;
	value: string;
	onChange: (value: string) => void;
	children: ReactNode;
	"aria-label"?: string;
}) {
	const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
		onChange(event.target.value);
	};

	return (
		<label className="block">
			{label ? (
				<span className="text-sm font-medium text-kumo-default mb-1.5 block">
					{label}
				</span>
			) : null}
			<select
				aria-label={ariaLabel ?? label}
				value={value}
				onChange={handleChange}
				className={selectClassName}
			>
				{children}
			</select>
		</label>
	);
}
