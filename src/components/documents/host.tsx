/**
 * Mounts one of the ported document tools. Its stylesheet is rendered inline, so it
 * exists only while that tool is on screen (the originals used global page CSS).
 * `id="root"` is kept because the tools' print rules target `#root > div`.
 */
export function DocumentHost({ css, children }: { css: string; children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="root">{children}</div>
    </>
  );
}
