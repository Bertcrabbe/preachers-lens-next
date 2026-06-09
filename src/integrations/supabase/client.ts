// Stub: AudioEditor still references Supabase but is not functional in this Convex build.
// This stub prevents build failures while AudioEditor migration to Convex is pending.
const notConfigured = new Error("Supabase not configured");
const storageChain = {
  upload: async (_path: string, _data: unknown, _opts?: unknown) => ({ error: notConfigured }),
  remove: async (_paths: string[]) => ({ error: notConfigured }),
};
const queryChain = {
  update: (_data: unknown) => ({
    eq: (_col: string, _val: unknown) => Promise.resolve({ error: notConfigured }),
  }),
  select: (_cols?: string) => ({
    eq: (_col: string, _val: unknown) => ({
      order: (_col2: string, _opts?: unknown) => Promise.resolve({ data: null, error: notConfigured }),
      then: (resolve: (v: { data: null; error: Error }) => unknown) => Promise.resolve({ data: null, error: notConfigured }).then(resolve),
    }),
    order: (_col: string, _opts?: unknown) => Promise.resolve({ data: null, error: notConfigured }),
  }),
  delete: () => ({
    eq: (_col: string, _val: unknown) => Promise.resolve({ error: notConfigured }),
  }),
  eq: (_col: string, _val: unknown) => ({
    select: async () => ({ data: null, error: notConfigured }),
  }),
};
export const supabase = {
  storage: {
    from: (_bucket: string) => storageChain,
  },
  from: (_table: string) => queryChain,
};
