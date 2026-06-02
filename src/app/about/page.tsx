export const metadata = {
  title: 'About movehome.org'
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto px-4 py-10 prose">
      <h1 className="text-3xl font-semibold mb-4">About movehome.org</h1>

      <p className="mb-4">
        movehome.org is a free, not-for-profit property listing aggregator. It exists to give
        renters and buyers a place to search for homes that doesn&apos;t charge agencies for
        visibility.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">How it works</h2>
      <p className="mb-4">
        Listings come from agencies that publish via the{' '}
        <a
          href="https://github.com/MoveHome/MoveHome.Org"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          RAIA Protocol
        </a>
        . Any agency can publish — there&apos;s no signup, no fee, no platform lock-in.
        They host an agent card on their own domain; we discover it and pull from their feed.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">Why open source</h2>
      <p className="mb-4">
        This whole site is on{' '}
        <a
          href="https://github.com/MoveHome/MoveHome.Org"
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>{' '}
        under MIT. Anyone can audit what we do with listing data — there isn&apos;t any magic.
        Anyone can fork it to build their own aggregator.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3">For agencies</h2>
      <p className="mb-4">
        If you&apos;d like to be on movehome.org, publish a RAIA Protocol agent card at{' '}
        <code>/.well-known/raia-agent.json</code> on your domain and email{' '}
        <a className="text-primary underline" href="mailto:admin@movehome.org">
          admin@movehome.org
        </a>{' '}
        with the URL. We&apos;ll review and add you to the registry.
      </p>
    </article>
  );
}
