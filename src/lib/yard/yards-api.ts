import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { dbSource, getSql } from "@/lib/db";
import type { YardProject } from "./types";

export type RemoteYardCard = {
  id: string;
  name: string;
  prompt: string;
  kind: string;
  savedAt: string;
};

type YardRow = {
  id: string;
  name: string;
  prompt: string;
  kind: string;
  saved_at: string;
  project?: unknown;
};

export const listRemoteYards = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (dbSource === "none") return [] as RemoteYardCard[];
    const sql = await getSql();
    const rows = await sql<YardRow>`
      select id, name, prompt, kind, saved_at
      from yards
      where user_id = ${context.userId}
      order by saved_at desc
      limit 40
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      prompt: r.prompt,
      kind: r.kind,
      savedAt: r.saved_at,
    }));
  });

export const saveRemoteYard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((project: YardProject) => project)
  .handler(async ({ context, data }) => {
    if (dbSource === "none") return { ok: false as const, reason: "no-db" };
    const sql = await getSql();
    await sql.query(
      `insert into yards (id, user_id, name, prompt, kind, project, saved_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, now())
       on conflict (id) do update
         set name = excluded.name,
             prompt = excluded.prompt,
             kind = excluded.kind,
             project = excluded.project,
             saved_at = now()
       where yards.user_id = $2`,
      [data.id, context.userId, data.name, data.prompt, data.kind, JSON.stringify(data)],
    );
    return { ok: true as const };
  });

export const loadRemoteYard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    if (dbSource === "none") return null;
    const sql = await getSql();
    const rows = await sql<YardRow>`
      select id, name, prompt, kind, saved_at, project
      from yards
      where id = ${id} and user_id = ${context.userId}
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return row.project as YardProject;
  });

export const deleteRemoteYard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    if (dbSource === "none") return { ok: false as const };
    const sql = await getSql();
    await sql`delete from yards where id = ${id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });
