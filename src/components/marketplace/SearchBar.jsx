import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function SearchBar({ defaultValue = '', large = false, placeholder = 'Finn stæsj...', className = '' }) {
  const [q, setQ] = useState(defaultValue);
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    navigate(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <form onSubmit={submit} className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className={
            large
              ? 'h-14 w-full rounded-full border border-border bg-card pl-12 pr-28 text-base outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15 sm:h-16 sm:text-lg'
              : 'h-12 w-full rounded-full border border-border bg-card pl-12 pr-4 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20'
          }
        />
        {large && (
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 sm:px-6"
          >
            Søk
          </button>
        )}
      </div>
    </form>
  );
}