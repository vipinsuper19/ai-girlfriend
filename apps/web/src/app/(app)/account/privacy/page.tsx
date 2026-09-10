export const metadata = { title: "Privacy and data" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-8">
      <h1 className="text-2xl font-semibold">Privacy and data</h1>
      <p className="text-sm text-on-surface-variant">
        Conversations are stored so she can reply with context. Memories are a
        smaller extracted set you can edit. Voice files currently sit on a
        public /uploads path — that is a backend gap, not a UI one.
      </p>
      <p className="text-sm text-on-surface-variant opacity-[0.55]">
        Export my data — no endpoint yet
      </p>
    </div>
  );
}
