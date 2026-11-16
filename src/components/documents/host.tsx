import { CanIssueProvider } from "@/components/documents/crm-bridge";

/**
 * Mounts one of the ported document tools. Its stylesheet is rendered inline, so it
 * exists only while that tool is on screen (the originals used global page CSS).
 * `id="root"` is kept because the tools' print rules target `#root > div`.
 * `canIssue` mirrors the user's can_create_finance permission.
 */
export function DocumentHost({
  css,
  canIssue = true,
  children,
}: {
  css: string;
  canIssue?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="root">
        <CanIssueProvider value={canIssue}>{children}</CanIssueProvider>
      </div>
    </>
  );
}
