import type { CustomRates } from "~/market/rates.ts";
import { defaultStorePath } from "~/measure/store.ts";

export interface Options {
	/** `user` keeps only prompts you typed; `all` includes subagent sessions. */
	sessions: "user" | "all";
	/** Which mean the projection prices: the per-req mean, or one vote per conversation. */
	weight: "turn" | "session";
	keepTrivial: boolean;
	keywords: string[];
	minChars: number;
	minOutput: number;
	/** Epoch ms floor; 0 keeps everything. */
	since: number;
	project: string;
	model: string;
	limit: number;
	sort: "reqmo" | "cost" | "name";
	format: "text" | "json";
	explain: boolean;
	account: boolean;
	/** cac already printed --help or --version; there is nothing left to do. */
	handled: boolean;
	color: "auto" | "always" | "never";
	db: string;
	mpc: string;
	cmduse: string;
	custom: CustomRates | null;
}

/**
 * Prompts that ask for nothing worth modelling: acknowledgements, greetings,
 * and the one-word nudges an agentic loop hands back. Matched after punctuation
 * is stripped, so `Hi!` and `thanks.` land here too.
 */
export const DEFAULT_KEYWORDS = [
	"hi",
	"hi there",
	"hey",
	"hello",
	"hello there",
	"yo",
	"sup",
	"hiya",
	"howdy",
	"thanks",
	"thank you",
	"ty",
	"thx",
	"cheers",
	"nice",
	"great",
	"awesome",
	"perfect",
	"cool",
	"sweet",
	"lovely",
	"well done",
	"good job",
	"nice work",
	"ok",
	"okay",
	"k",
	"sure",
	"yes",
	"yeah",
	"yep",
	"y",
	"no",
	"nope",
	"nah",
	"n",
	"continue",
	"go",
	"go on",
	"go ahead",
	"proceed",
	"next",
	"carry on",
	"keep going",
	"resume",
	"done",
	"stop",
	"wait",
	"hold on",
	"hmm",
	"hm",
	"oh",
	"ah",
	"i see",
	"got it",
	"makes sense",
	"make sense",
	"sounds good",
	"looks good",
	"lgtm",
	"agreed",
	"right",
	"correct",
	"exactly",
	"indeed",
];

export function defaultOptions(): Options {
	return {
		sessions: "all",
		weight: "turn",
		keepTrivial: false,
		keywords: [...DEFAULT_KEYWORDS],
		minChars: 0,
		minOutput: 0,
		since: 0,
		project: "",
		model: "",
		limit: 0,
		sort: "reqmo",
		format: "text",
		explain: false,
		account: true,
		handled: false,
		color: "auto",
		db: defaultStorePath(),
		mpc: process.env.MPC_BIN ?? "mpc",
		cmduse: process.env.CMDUSE_BIN ?? "cmduse",
		custom: null,
	};
}
