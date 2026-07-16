import type { ReactNode } from "react";

type TrustPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  updated?: string;
  children: ReactNode;
};

export function TrustPage({ eyebrow, title, description, updated, children }: TrustPageProps) {
  return (
    <main id="main-content" className="gl-trust-page">
      <header className="gl-trust-hero">
        <p className="gl-trust-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {updated ? <span>Last updated {updated}</span> : null}
      </header>

      <article className="gl-trust-content">{children}</article>
    </main>
  );
}

export function TrustSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
