/**
 * One model call. This is the same unit the opencode sidebar counts as a
 * "req": a single `type = 'assistant'` row in opencode's store, i.e. one
 * round trip to a provider.
 */
export interface Req {
	/** Provider model id as the store recorded it, e.g. `deepseek/deepseek-v4.1-flash`. */
	model: string;
	tokensIn: number;
	output: number;
	reasoning: number;
	cacheRead: number;
	cacheWrite: number;
	/** Provider-reported spend; 0 for subscription models the harness did not price. */
	cost: number;
	/** 1-based position of this req within its session — the axis context grows along. */
	position: number;
}

/** What opened an ask. Only `user` is a prompt a person typed. */
export type AskKind =
	| "user"
	| "synthetic"
	| "compaction"
	| "shell"
	| "system"
	| "orphan";

/**
 * One prompt and the reqs it drove. An agentic ask is many reqs: the model
 * calls a tool, is handed the result, and is called again until it stops.
 */
export interface Ask {
	sessionID: string;
	directory: string;
	/** Subagent session (`session.parent_id` is set). */
	child: boolean;
	kind: AskKind;
	/** The prompt that opened it; empty for non-user kinds. */
	text: string;
	/** Epoch ms of the opening prompt. */
	time: number;
	reqs: Req[];
}

/** A distribution in five numbers. */
export interface Stats {
	mean: number;
	p10: number;
	p50: number;
	p90: number;
	max: number;
}

/** A per-req token vector — what one request costs to serve. */
export interface Profile {
	input: number;
	output: number;
	reasoning: number;
	cacheRead: number;
	cacheWrite: number;
}

/** Reqs grouped by how far into their session they sit. */
export interface Bucket {
	label: string;
	reqs: number;
	input: number;
	output: number;
	cacheRead: number;
}

export interface DropCount {
	reason: string;
	asks: number;
	reqs: number;
}

/** The measured profile, ready to be priced. */
export interface Shape {
	/** Reqs behind the profile, after filtering. */
	reqs: number;
	asks: number;
	sessions: number;
	projects: number;
	/** Epoch ms span of the kept reqs. */
	first: number;
	last: number;
	stats: Record<keyof Profile | "cost", Stats>;
	/** Every req weighted equally — the default. */
	perReq: Profile;
	/** Mean of per-ask means, so one vast session cannot set the profile. */
	perSession: Profile;
	buckets: Bucket[];
	models: Array<{ name: string; reqs: number }>;
}
