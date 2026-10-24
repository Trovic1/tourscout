"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface PickedAct {
  id: string;
  name: string;
  /** undefined while Qloo is being checked */
  hasData?: boolean;
}

interface Hit {
  id: string;
  name: string;
  image?: string;
  reach?: number;
  about?: string;
}

const MAX = 3;

export function ActPicker({ value, onChange }: { value: PickedAct[]; onChange: (v: PickedAct[]) => void }) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // The value as of the last change, for async callbacks that outlive a render.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const update = (next: PickedAct[]) => {
    latest.current = next;
    onChange(next);
  };

  // Debounced search; a newer keystroke cancels the older request.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/acts?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        const j = (await r.json()) as { results?: Hit[]; error?: string };
        if (j.error) throw new Error(j.error);
        setHits((j.results ?? []).filter((h) => !latest.current.some((v) => v.id === h.id)));
        setSearchError(null);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setSearchError("Search didn't load. Keep typing to try again.");
      } finally {
        if (!ctl.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [term]);

  const pick = async (h: Hit) => {
    if (value.length >= MAX) return;
    update([...latest.current, { id: h.id, name: h.name }]);
    setTerm("");
    setHits([]);
    setOpen(false);
    inputRef.current?.focus();
    try {
      const r = await fetch(`/api/acts?check=${encodeURIComponent(h.id)}`);
      const j = (await r.json()) as { ok?: boolean };
      update(latest.current.map((v) => (v.id === h.id ? { ...v, hasData: !!j.ok } : v)));
    } catch {
      // Unknown is treated as usable; the planner re-checks every reference anyway.
      update(latest.current.map((v) => (v.id === h.id ? { ...v, hasData: true } : v)));
    }
  };

  const remove = (id: string) => update(latest.current.filter((v) => v.id !== id));
  const full = value.length >= MAX;
  const showList = open && term.trim().length >= 2;

  return (
    <div className="relative">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl bg-nested px-1.5 py-1.5 focus-within:outline focus-within:outline-1 focus-within:outline-[#6a6a6a]">
        {value.map((v) => (
          <span
            key={v.id}
            className={`flex h-8 flex-none items-center gap-1.5 rounded-full pr-1 pl-3 text-[13px] whitespace-nowrap ${
              v.hasData === false ? "bg-[#2c1a20] text-negative" : "bg-[#3a3a3a] text-ink"
            }`}
          >
            <span className={v.hasData === false ? "line-through" : ""}>{v.name}</span>
            {v.hasData === undefined && <span className="text-faint">checking</span>}
            <button
              type="button"
              onClick={() => remove(v.id)}
              aria-label={`Remove ${v.name}`}
              className="grid size-6 place-items-center rounded-full text-muted hover:bg-black/30 hover:text-ink"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        {!full && (
          <input
            ref={inputRef}
            id="sounds-like"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={term}
            onChange={(e) => {
              const v = e.target.value;
              setTerm(v);
              setOpen(true);
              // Short input clears the list; longer input shows "Searching" until the debounced fetch lands.
              if (v.trim().length < 2) {
                setHits([]);
                setSearching(false);
              } else setSearching(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                pick(hits[active]);
              } else if (e.key === "Backspace" && !term && value.length) {
                remove(value[value.length - 1].id);
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder={value.length ? "Add another (up to 3)" : "Start typing an artist, e.g. Tay Iwar"}
            className="h-8 min-w-[12rem] flex-1 bg-transparent px-2 text-[15px] text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
          />
        )}
      </div>

      {value.some((v) => v.hasData === false) && (
        <p className="mt-2 text-[13px] text-muted">
          Qloo lists {value.filter((v) => v.hasData === false).map((v) => v.name).join(" and ")} but has no fan data for them yet, so they
          won&apos;t shape the plan. Add a better-known act your sound is close to.
        </p>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          // taste-skill-ignore: a real floating menu, the one place a shadow belongs
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl bg-nested p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.6)]"
        >
          {searching && !hits.length && <li className="px-3 py-3 text-[14px] text-faint">Searching Qloo…</li>}
          {searchError && <li className="px-3 py-3 text-[14px] text-muted">{searchError}</li>}
          {!searching && !searchError && !hits.length && (
            <li className="px-3 py-3 text-[14px] text-muted">No artist called “{term.trim()}” in Qloo. Try another act you sound like.</li>
          )}
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${i === active ? "bg-[#3a3a3a]" : ""}`}
              >
                {h.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.image} alt="" className="size-9 flex-none rounded-full object-cover" loading="lazy" />
                ) : (
                  <span className="grid size-9 flex-none place-items-center rounded-full bg-[#3a3a3a] text-[13px] text-muted">{h.name[0]}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{h.name}</span>
                  {h.about && <span className="block truncate text-[12px] text-faint">{h.about}</span>}
                </span>
                {h.reach !== undefined && <span className="num flex-none text-[12px] text-faint">reach {h.reach}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
