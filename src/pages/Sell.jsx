import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Trash2, Save, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ImageUploader from '@/components/marketplace/ImageUploader';
import ListingAssistant from '@/components/marketplace/ListingAssistant';
import { Button } from '@/components/ui/button';
import { fetchCategories, CONDITION_LABELS } from '@/lib/marketplace';

const emptyForm = {
  title: '',
  description: '',
  listing_type: 'good',
  price: '',
  currency: 'NOK',
  category_id: '',
  category: '',
  subcategory: '',
  condition: 'not_applicable',
  location: '',
  images: [],
  tags: '',
};

export default function Sell() {
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const { data: existing } = useQuery({
    queryKey: ['listing', editId],
    queryFn: () => base44.entities.Listing.get(editId),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title || '',
        description: existing.description || '',
        listing_type: 'good',
        price: existing.price ?? '',
        currency: 'NOK',
        category_id: existing.category_id || '',
        category: existing.category || '',
        subcategory: existing.subcategory || '',
        condition: existing.condition || 'not_applicable',
        location: existing.location || '',
        images: existing.images || [],
        tags: (existing.tags || []).join(', '),
      });
    }
  }, [existing]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onCategoryChange = (id) => {
    const cat = categories.find((c) => c.id === id);
    update('category_id', id);
    update('category', cat?.name || '');
  };

  const buildPayload = (status) => ({
    title: form.title.trim(),
    description: form.description.trim(),
    listing_type: 'good',
    price: form.price === '' ? 0 : Number(form.price),
    currency: 'NOK',
    category_id: form.category_id || null,
    category: form.category || null,
    subcategory: form.subcategory.trim() || null,
    condition: form.condition,
    location: form.location.trim(),
    images: form.images,
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    status,
    seller_id: user.id,
    ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
  });

  const validate = (forPublish) => {
    if (!form.title.trim() || form.title.trim().length < 3) return 'Tittelen må være minst 3 tegn.';
    if (form.price === '' || Number(form.price) < 0) return 'Vennligst fyll inn gyldig pris.';
    if (forPublish && !form.description.trim()) return 'Legg til en beskrivelse før du publiserer.';
    if (forPublish && (!form.images || form.images.length === 0)) return 'Legg til minst ett bilde før du publiserer.';
    return '';
  };

  const save = async (status) => {
    const err = validate(status === 'published');
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await base44.entities.Listing.update(editId, buildPayload(status));
      } else {
        await base44.entities.Listing.create(buildPayload(status));
      }
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      qc.invalidateQueries({ queryKey: ['browse-listings'] });
      qc.invalidateQueries({ queryKey: ['recent-listings'] });
      navigate('/my-listings');
    } catch (e) {
      setError(e?.message || 'Noe gikk galt. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    if (!confirm('Slette denne annonsen permanent?')) return;
    setSaving(true);
    try {
      await base44.entities.Listing.delete(editId);
      qc.invalidateQueries({ queryKey: ['my-listings'] });
      navigate('/my-listings');
    } catch (e) {
      setError(e?.message || 'Kunne ikke slette annonsen.');
      setSaving(false);
    }
  };

  const applyDraft = (d) => {
    setForm((f) => ({ ...f, ...d }));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{editId ? 'Rediger annonse' : 'Selg noe'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{editId ? 'Oppdater annonsedetaljene dine.' : 'Opprett en annonse for produktet eller tjenesten din.'}</p>
      </div>

      {error && <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Images */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <label className="mb-3 block text-sm font-semibold">Bilder</label>
            <ImageUploader images={form.images} onChange={(imgs) => update('images', imgs)} />
          </div>

          {/* Title */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <label className="mb-1.5 block text-sm font-medium">Tittel *</label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} maxLength={140} placeholder="Hva selger du?" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
          </div>

          {/* Description */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <label className="mb-1.5 block text-sm font-medium">Beskrivelse</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={5} placeholder="Beskriv hva du tilbyr, tilstand, detaljer…" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring" />
          </div>

          {/* Price */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <label className="mb-1.5 block text-sm font-medium">Pris * (NOK)</label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="0,00" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
          </div>

          {/* Category + condition */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Kategori</label>
              <select value={form.category_id} onChange={(e) => onCategoryChange(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring">
                <option value="">Velg kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tilstand</label>
              <select value={form.condition} onChange={(e) => update('condition', e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring">
                {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Underkategori (valgfritt)</label>
              <input value={form.subcategory} onChange={(e) => update('subcategory', e.target.value)} placeholder="f.eks. Sedan, Smarttelefon" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Sted</label>
              <input value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="By, Land" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <label className="mb-1.5 block text-sm font-medium">Etiketter (valgfritt)</label>
            <input value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="kommaseparerte, etiketter" className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring" />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => save('published')} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Send className="mr-2 h-4 w-4" />{editId ? 'Publiser endringer' : 'Publiser annonse'}
            </Button>
            <Button onClick={() => save('draft')} disabled={saving} variant="outline">
              <Save className="mr-2 h-4 w-4" />Lagre utkast
            </Button>
            {editId && (
              <Button onClick={remove} disabled={saving} variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />Slett
              </Button>
            )}
            {editId && (
              <Button asChild variant="ghost">
                <Link to={`/listing/${editId}`}><Eye className="mr-2 h-4 w-4" />Forhåndsvis</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <ListingAssistant form={form} onApply={applyDraft} />
        </div>
      </div>
    </div>
  );
}