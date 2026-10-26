import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Wand2, ArrowDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// AI-assistent for STÆSJ. Brukeren skriver fritt om hva de selger; assistenten
// returnerer et komplett annonseutkast (tittel, beskrivelse, type, tilstand) og
// et anbefalt prisforslag. «Bruk i annonse» fyller skjemaet direkte.

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Kort, selgende annonsetittel (maks 90 tegn)' },
    description: { type: 'string', description: 'Beskrivelse med detaljer, tilstand og salgsargumenter' },
    listing_type: { type: 'string', enum: ['good', 'service'] },
    condition: { type: 'string', enum: ['new', 'like_new', 'used', 'refurbished', 'not_applicable'] },
    suggested_price: { type: 'number', description: 'Anbefalt pris i valgt valuta' },
    price_reasoning: { type: 'string', description: 'Kort forklaring på hvorfor prisen er satt slik' },
  },
  required: ['title', 'description', 'listing_type', 'condition', 'suggested_price', 'price_reasoning'],
};

/** @typedef {{ title: string; description: string; listing_type: 'good' | 'service'; condition: string; suggested_price: number; price_reasoning: string }} ListingDraft */

const SUGGESTIONS = [
  'Bruk iPhone 13 Pro 256GB, god stand',
  'Sykkelverksted – hjul og gir-justering',
  'Vintage møbeltrafikk i eik, litt slitasje',
];

export default function ListingAssistant({ form, onApply }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hei! Jeg er STÆSJ-assistenten. Fortell meg hva du selger, så lager jeg et annonseutkast og priser det riktig for deg.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(/** @type {ListingDraft | null} */ (null));
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const prompt = (text || '').trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: prompt }]);
    setLoading(true);
    setDraft(null);
    try {
      const context = `Brukeren selger på STÆSJ, et norsk markedsplass. Valuta: ${form.currency || 'USD'}. Kategori hvis oppgitt: ${form.category || 'ikke oppgitt'}.`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `${context}\n\nBrukeren sier: "${prompt}"\n\nLag et komplett annonseutkast for markedsplassen. Skriv tittel og beskrivelse på norsk. Velg listing_type (good/service) og condition. Sett en realistisk og konkurransedyktig anbefalt pris (${form.currency || 'USD'}) med kort forklaring.`,
        response_json_schema: RESPONSE_SCHEMA,
      });
      const result = typeof res === 'string' ? JSON.parse(res) : res;
      if (!result || typeof result !== 'object' || typeof result.title !== 'string' || typeof result.suggested_price !== 'number') {
        throw new Error('AI returned an invalid listing draft');
      }
      /** @type {ListingDraft} */
      const listingDraft = result;
      setDraft(listingDraft);
      setMessages((m) => [...m, { role: 'assistant', content: `Forslag klart! Tittel: «${listingDraft.title}». Prisforslag: ${Number(listingDraft.suggested_price).toLocaleString()} ${form.currency || 'USD'}. Se kortet under for å bruke det i annonsen.` }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Beklager, noe gikk galt. Prøv igjen.' }]);
    } finally {
      setLoading(false);
    }
  };

  const applyDraft = () => {
    if (!draft) return;
    onApply({
      title: draft.title || form.title,
      description: draft.description || form.description,
      listing_type: draft.listing_type || form.listing_type,
      condition: draft.condition || form.condition,
      price: draft.suggested_price != null ? String(draft.suggested_price) : form.price,
    });
    setDraft(null);
    setMessages((m) => [...m, { role: 'assistant', content: 'Fylt inn i skjemaet! Justér gjerne detaljene før du publiserer.' }]);
  };

  return (
    <div className="relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-border bg-card p-3.5">
      <div className="absolute left-3.5 right-3.5 top-0 h-0.5 rounded-b-[3px] bg-accent" />
      <div className="flex items-center gap-2 pt-1">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent">
          <Sparkles className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold tracking-tight">STÆSJ-assistenten</p>
      </div>

      <div ref={scrollRef} className="flex max-h-72 min-h-[9rem] flex-col gap-2.5 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] whitespace-pre-line rounded-2xl border border-border/70 px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === 'user' ? 'self-end rounded-br-sm bg-accent/15 text-foreground' : 'self-start rounded-bl-sm bg-muted/40 text-muted-foreground'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 self-start rounded-2xl rounded-bl-sm border border-border/70 bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
          </div>
        )}
      </div>

      {draft && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Wand2 className="h-3.5 w-3.5" /> Utkast
            </div>
            <span className="text-xs text-muted-foreground">{form.currency || 'USD'}</span>
          </div>
          <p className="text-sm font-semibold leading-snug">{draft.title}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{draft.description}</p>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2.5">
            <div>
              <p className="font-display text-lg font-bold text-accent">{Number(draft.suggested_price).toLocaleString()} {form.currency || 'USD'}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{draft.price_reasoning}</p>
            </div>
            <button
              onClick={applyDraft}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground transition hover:bg-accent/90 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowDown className="h-3.5 w-3.5" /> Bruk i annonse
            </button>
          </div>
        </div>
      )}

      {!loading && messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-accent hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 rounded-lg border border-border bg-background p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hva selger du?"
          className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground transition hover:bg-accent/90 active:scale-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}