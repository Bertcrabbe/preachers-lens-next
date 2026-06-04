import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("evaluationRules")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    prompt: v.string(),
    color: v.string(),
    userId: v.optional(v.string()), // for migration; normally comes from auth
  },
  handler: async (ctx, args) => {
    let userId = args.userId;
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Not authenticated");
      userId = identity.subject;
    }
    return await ctx.db.insert("evaluationRules", {
      userId,
      name: args.name,
      description: args.description,
      prompt: args.prompt,
      color: args.color,
    });
  },
});

export const remove = mutation({
  args: { ruleId: v.id("evaluationRules") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const rule = await ctx.db.get(args.ruleId);
    if (!rule || rule.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.delete(args.ruleId);
  },
});
