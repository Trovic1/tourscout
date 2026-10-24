"use client";

import { useState } from "react";
import { ActPicker, type PickedAct } from "./ActPicker";
import { RunLog } from "./RunLog";
import type { PlanInput, RunState, TraceStep } from "./useAgent";
import { EXAMPLES } from "@/lib/examples";
import { refList } from "@/lib/present";

const OFFERS = [
  ["A route with dates", "Opens at home, stays mostly within a drive or a short flight, 12 weeks out so rooms can be held."],
  ["Rooms that fit", "Music venues in each city whose crowd matches the fans of the acts you named."],
  ["Acts to open for, and peers", "Bigger acts with the same fans to ask for a support slot, and acts at your stage to share bills with."],
  ["Brands to pitch", "Local brands those fans already buy, with a small, realistic ask for each."],
  ["Emails ready to send", "A note to a venue booker and one to a brand, written from the data, never inflated."],
] as const;

interface Props {
  state: RunState;
  steps: TraceStep[];
  notes: string[];
  error: string | null;
  onPlan: (input: PlanInput) => void;
}

export function Intake({ state, steps, notes, error, onPlan }: Props) {
  const [artist, setArtist] = useState("");
  const [home, setHome] = useState("");
  const [refs, setRefs] = useState<PickedAct[]>([]);
  const [tried, setTried] = useState(false);
  const running = state === "running";

  const usable = refs.filter((r) => r.hasData !== false);
  const missing = !home.trim() ? "Add the city you're based in." : !usable.length ? "Add at least one act you sound like that Qloo has fan data for." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (missing || running) return;
    onPlan({ artist: artist.trim() || undefined, home: home.trim(), refs: usable.map(({ id, name }) => ({ id, name })) });
  };

  return (
    <main className="mx-auto w-full max-w-[1208px] px-4 pt-10 pb-16 sm:px-6 sm:pt-[72px]">
      <h1 className="font-serif text-[30px] leading-[1.1] font-semibold tracking-[-0.01em] sm:text-[48px]">
        Plan a first tour from who you sound like
      </h1>
      <p className="mt-4 max-w-[62ch] text-[16px] leading-6 text-muted">
        For artists Google hasn&apos;t heard of yet. Name up to three acts you sound like and where you&apos;re based. TourScout finds where
        their fans live and plans your first run around them.
      </p>

      <form onSubmit={submit} className="mt-10 rounded-[20px] bg-surface p-[22px]" noValidate>
        <div className="grid gap-[14px] md:grid-cols-12">
          <label className="flex flex-col gap-2 md:col-span-3">
            <span className="text-[14px] font-medium">
              Artist name <span className="font-normal text-faint">optional</span>
            </span>
            <input className="field" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Your stage name" autoComplete="off" />
          </label>
          <label className="flex flex-col gap-2 md:col-span-3">
            <span className="text-[14px] font-medium">Based in</span>
            <input
              className="field"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              placeholder="City, e.g. Lagos"
              autoComplete="address-level2"
              aria-invalid={tried && !home.trim()}
            />
          </label>
          <div className="flex flex-col gap-2 md:col-span-6">
            <label htmlFor="sounds-like" className="text-[14px] font-medium">
              Sounds like
            </label>
            <ActPicker value={refs} onChange={setRefs} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="submit" className="btn-primary" disabled={running}>
            {running ? "Planning…" : "Plan my first run"}
          </button>
          <p className={`text-[13px] ${tried && missing ? "text-negative" : "text-faint"}`}>
            {tried && missing ? missing : "Takes about a minute. Every city, room and act comes from Qloo's data."}
          </p>
        </div>
        {error && state === "error" && (
          <p role="alert" className="mt-4 rounded-xl bg-[#2c1a20] px-4 py-3 text-[14px] text-[#f3c3cb]">
            {error}
          </p>
        )}
      </form>

      {running || (state === "error" && steps.length) ? (
        <section className="mt-[14px] rounded-[20px] bg-surface p-[22px]" aria-labelledby="log-h">
          <h2 id="log-h" className="text-[16px] font-semibold">
            {running ? "Planning your run" : "What the agent did"}
          </h2>
          <div className="mt-2">
            <RunLog steps={steps} state={state} notes={notes} />
          </div>
        </section>
      ) : (
        <div className="mt-[14px] grid gap-[14px] md:grid-cols-12">
          <section className="rounded-[20px] bg-surface p-[22px] md:col-span-7" aria-labelledby="ex-h">
            <h2 id="ex-h" className="text-[16px] font-semibold">
              Or open an example run
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {EXAMPLES.map((x) => (
                <li key={x.home}>
                  <button
                    type="button"
                    onClick={() => onPlan({ home: x.home, refs: x.refs })}
                    className="group flex min-h-[63px] w-full items-center gap-4 rounded-[14px] bg-raised px-4 text-left transition-colors hover:bg-[#242424]"
                  >
                    <span className="flex flex-none -space-x-2.5" aria-hidden>
                      {x.refs.map((r) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={r.id}
                          src={`https://images.qloo.com/i/${r.id}-420x-auto.jpg`}
                          alt=""
                          loading="lazy"
                          className="size-9 rounded-full bg-nested object-cover ring-2 ring-raised"
                        />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {x.who} from {x.home}
                      </span>
                      <span className="block truncate text-[13px] text-faint">sounds like {refList(x.refs.map((r) => r.name))}</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="flex-none text-faint transition-transform group-hover:translate-x-0.5">
                      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[20px] bg-surface p-[22px] md:col-span-5" aria-labelledby="get-h">
            <h2 id="get-h" className="text-[16px] font-semibold">
              What you get
            </h2>
            <dl className="mt-4 flex flex-col">
              {OFFERS.map(([t, d]) => (
                <div key={t} className="py-[9px] first:pt-0">
                  <dt className="text-[14px] font-medium">{t}</dt>
                  <dd className="text-[13px] leading-5 text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </main>
  );
}
