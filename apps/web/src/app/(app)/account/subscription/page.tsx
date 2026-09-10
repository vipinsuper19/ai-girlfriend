export const metadata = { title: "Subscription" };

export default function SubscriptionPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">Subscription</h1>
      <p className="text-sm text-on-surface-variant">
        Plans are read-only. There is no checkout, and the current/usage
        endpoints are unguarded on the API, so this screen does not pretend to
        upgrade.
      </p>
      <article className="rounded-lg border-2 border-secondary p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Free</h2>
          <span className="rounded-xs bg-secondary-container px-2 py-0.5 text-[11px] font-semibold text-on-secondary-container">
            CURRENT
          </span>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          100 messages · 10 voice minutes · 5 images
        </p>
      </article>
      <article className="rounded-lg bg-surface-container-low p-4">
        <h2 className="font-semibold">Premium</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Unlimited messages · 300 voice minutes · 100 images
        </p>
      </article>
      <article className="rounded-lg bg-surface-container-low p-4">
        <h2 className="font-semibold">Premium Plus</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Everything in Premium, plus calls when they exist.
        </p>
      </article>
    </div>
  );
}
