import type { AppSettings } from "./types";

/** Settings a new client starts with. */
export const DEFAULT_SETTINGS: AppSettings = {
  reportingCurrency: "USD",
  lowMarginThreshold: 0.15,
  defaultTaxTreatment: "On top of price",
  rates: {},
  ratesUpdatedAt: null,
};
