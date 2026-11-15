// Curated settings for the test page (3A). No numbers here: they all come from the API.

/**
 * What the "What happened" block shows.
 * - "researcher": the researcher comment from the NASA test sheet, verbatim, with its source.
 * - "ai": an SI-generated summary (when one is available), labelled as derived; falls back to
 *   the researcher comment when there is no summary for the test.
 * The team has not decided yet; switch here, nowhere else.
 */
export const WHAT_HAPPENED_MODE: "researcher" | "ai" = "researcher";
