/** A competitor price source (Vashi today; Amazon / Moglix next). Each site is
 *  one adapter implementing this interface — add a site by adding an adapter +
 *  a row in competitor_sources. */
export type CompetitorItem = {
  code: string;
  name: string;
  brand: string | null;
  listPrice: number | null; // public / MRP price
  netPrice: number | null; // logged-in B2B selling price (null when anonymous)
  url: string | null;
  inStock: boolean | null;
};

export type CompetitorAdapter = {
  key: string; // 'vashi'
  name: string; // 'Vashi'
  siteUrl: string;
  needsLogin: boolean; // net price requires auth?
  /** Free-text catalogue search (for the admin match picker + auto-mapper). */
  search(query: string, limit?: number): Promise<CompetitorItem[]>;
  /** One product's live price by its competitor code. Pass an auth token to get
   *  the net (logged-in) price where the site gates it. */
  fetchByCode(code: string, auth?: string | null): Promise<CompetitorItem | null>;
  /** Obtain an auth token from credentials (only for needsLogin sources). */
  login?(username: string, password: string): Promise<string | null>;
};
