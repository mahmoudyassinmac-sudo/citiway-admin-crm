import Letterhead from "@/components/documents/letterhead";
import letterheadCss from "@/components/documents/letterhead-styles";
import { DocumentHost } from "@/components/documents/host";
import { getSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { getLookups } from "@/lib/lookups";

export const metadata = { title: "Letters — Citiway CRM" };

type SP = { client?: string; developer?: string; agent?: string; template?: string; unit?: string };

export default async function LettersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [session, company, { clients, developers, agents }] = await Promise.all([
    getSession(),
    getCompany(),
    getLookups(),
  ]);
  // Logged-in agents get their own name + BRN pre-selected.
  const currentAgentId = agents.find((a) => a.user_id && a.user_id === session.userId)?.id ?? null;
  const template = sp.template === "commission" ? "commission" : undefined;

  return (
    <DocumentHost css={letterheadCss}>
      <Letterhead
        company={{ ...company, currentAgentId }}
        developers={developers}
        agents={agents}
        clients={clients}
        initial={{ client: sp.client, developer: sp.developer, agent: sp.agent, template, unit: sp.unit }}
      />
    </DocumentHost>
  );
}
