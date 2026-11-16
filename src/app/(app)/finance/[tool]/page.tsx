import { notFound, redirect } from "next/navigation";
import { DocumentHost } from "@/components/documents/host";
import { getSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { DOCUMENT_TOOLS, findTool, toolsFor } from "@/lib/documents";
import { getLookups } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";

export function generateStaticParams() {
  return DOCUMENT_TOOLS.map((t) => ({ tool: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }) {
  const tool = findTool((await params).tool);
  return { title: tool ? `${tool.title} — Citiway CRM` : "Citiway CRM" };
}

type SP = { client?: string; developer?: string; deal?: string };

export default async function DocumentToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ tool: string }>;
  searchParams: Promise<SP>;
}) {
  const tool = findTool((await params).tool);
  if (!tool) notFound();
  const sp = await searchParams;
  const session = await getSession();
  if (!toolsFor(session.permissions).some((t) => t.slug === tool.slug)) redirect("/");
  const loadDeal = async () => {
    if (!sp.deal || !session.configured || !session.permissions.modules.deals || !/^[0-9a-f-]{36}$/i.test(sp.deal)) return null;
    const { data } = await (await createClient())
      .from("deals")
      .select("project_name, unit_no, sale_price_aed, commission_pct")
      .eq("id", sp.deal)
      .maybeSingle();
    return data;
  };
  const [company, { clients, developers }, deal] = await Promise.all([getCompany(), getLookups(), loadDeal()]);

  const { Component } = tool;
  return (
    <DocumentHost css={tool.css} canIssue={session.permissions.can_create_finance}>
      <Component
        company={company}
        clients={clients}
        developers={developers}
        initial={{ client: sp.client, developer: sp.developer, deal }}
      />
    </DocumentHost>
  );
}
