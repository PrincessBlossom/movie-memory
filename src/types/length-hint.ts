/** A character counter for a length-limited field. */
export type LengthHint = {
  /** e.g. "185 / 200 characters" or "215 / 200 characters (15 over the limit)" */
  text: string;
  /** Past the limit: show it as an error. */
  over: boolean;
};
