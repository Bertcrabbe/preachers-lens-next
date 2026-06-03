import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("communicators")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db.insert("communicators", {
      userId: identity.subject,
      name: args.name.trim(),
    });
  },
});

export const updateName = mutation({
  args: { communicatorId: v.id("communicators"), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const c = await ctx.db.get(args.communicatorId);
    if (!c || c.userId !== identity.subject) throw new Error("Not found");
    await ctx.db.patch(args.communicatorId, { name: args.name.trim() });
  },
});

export const remove = mutation({
  args: { communicatorId: v.id("communicators") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const c = await ctx.db.get(args.communicatorId);
    if (!c || c.userId !== identity.subject) throw new Error("Not found");

    // Unassign sermons in this communicator
    const sermons = await ctx.db
      .query("sermons")
      .withIndex("by_communicator", (q) => q.eq("communicatorId", args.communicatorId))
      .collect();
    for (const s of sermons) {
      await ctx.db.patch(s._id, { communicatorId: undefined });
    }

    // Delete links
    const links = await ctx.db
      .query("communicatorLinks")
      .withIndex("by_communicator", (q) => q.eq("communicatorId", args.communicatorId))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

    await ctx.db.delete(args.communicatorId);
  },
});
