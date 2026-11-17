import { CanIssueProvider } from "@/components/documents/crm-bridge";
import { SignoffChoice, SignoffProvider, type SignoffConfig } from "@/components/documents/signoff";

/**
 * Mounts one of the ported document tools. Its stylesheet is rendered inline, so it
 * exists only while that tool is on screen (the originals used global page CSS).
 * `id="root"` is kept because the tools' print rules target `#root > div`.
 * `canIssue` mirrors the user's can_create_finance permission.
 * `signoff` drives the company stamp: who may apply it and whether this tool has a stamp area.
 */
export function DocumentHost({
  css,
  canIssue = true,
  signoff,
  showSignoffBar = true,
  children,
}: {
  css: string;
  canIssue?: boolean;
  signoff: SignoffConfig;
  /** Tools with their own stamp controls (the letterhead) hide the shared bar. */
  showSignoffBar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SignoffProvider config={signoff}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {showSignoffBar && signoff.stampable && canIssue && <SignoffChoice />}
      <div id="root">
        <CanIssueProvider value={canIssue}>{children}</CanIssueProvider>
      </div>
    </SignoffProvider>
  );
}
