import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Plus, X, Check, Loader2 } from "lucide-react";
import { useCreateListing, useUpdateListing, useListing, useMe } from "@/lib/hooks";
import { CATEGORIES, CONDITIONS, AGE_RANGES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Avatar, mediaUrl } from "@/components/common";

type Uploading = { id: string; preview: string };

export default function Sell() {
  const params = useParams<{ id?: string }>();
  const editingId = params.id ?? null;
  const isEditing = editingId != null;
  const create = useCreateListing();
  const update = useUpdateListing(editingId);
  const listing = useListing(editingId);
  const me = useMe();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const populated = useRef(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [ageRange, setAgeRange] = useState(AGE_RANGES[0]);
  const [size, setSize] = useState("");
  const [condition, setCondition] = useState(CONDITIONS[2]);
  const [brand, setBrand] = useState("");
  const [location, setLocation] = useState("Costessey, Norfolk");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [busy, setBusy] = useState(false);

  // When editing, pre-fill the form once the listing has loaded.
  useEffect(() => {
    if (isEditing && listing.data && !populated.current) {
      const l = listing.data as any;
      populated.current = true;
      setTitle(l.title ?? "");
      setDescription(l.description ?? "");
      setPrice(l.price != null ? String(l.price) : "");
      setCategory(l.category ?? CATEGORIES[0]);
      setAgeRange(l.ageRange ?? AGE_RANGES[0]);
      setSize(l.size && l.size !== "-" ? l.size : "");
      setCondition(l.condition ?? CONDITIONS[2]);
      setBrand(l.brand ?? "");
      setLocation(l.location ?? "Costessey, Norfolk");
      setImages(Array.isArray(l.imageList) ? [...l.imageList] : []);
    }
  }, [isEditing, listing.data]);

  const notOwner =
    isEditing && listing.data && me.data && listing.data.sellerId !== me.data.id;

  // Redirect to login if not authenticated
  if (me.data === null && !me.isLoading) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        You need to log in to list an item.
      </div>
    );
  }

  // Loading an existing listing for editing
  if (isEditing && listing.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-5 md:pb-12">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-5 space-y-4">
          <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Listing not found, or belongs to someone else
  if (isEditing && !listing.isLoading && (!listing.data || notOwner)) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-24 pt-16 text-center text-sm text-muted-foreground">
        {notOwner ? "You can only edit your own listings." : "This listing could not be found."}
      </div>
    );
  }

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 6 - images.length - uploading.length);
    if (list.length === 0) {
      toast({ title: "Up to 6 photos", description: "You can add up to 6 photos per listing." });
      return;
    }
    // previews while uploading
    const previews: Uploading[] = list.map((f) => ({
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(f),
    }));
    setUploading((u) => [...u, ...previews]);

    const fd = new FormData();
    list.forEach((f) => fd.append("images", f));

    try {
      setBusy(true);
      const { API_BASE } = await import("@/lib/queryClient");
      const response = await fetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!response.ok) throw new Error(await response.text());
      const data: { urls: string[] } = await response.json();
      setImages((imgs) => [...imgs, ...data.urls]);
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message });
    } finally {
      previews.forEach((p) => URL.revokeObjectURL(p.preview));
      setUploading((u) => u.filter((p) => !previews.find((np) => np.id === p.id)));
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (!title.trim() || !description.trim() || Number.isNaN(priceNum) || priceNum <= 0) {
      toast({ title: "Please check the form", description: "Title, description and a valid price are required." });
      return;
    }
    if (images.length === 0) {
      toast({ title: "Add at least one photo", description: "Photos help your item sell faster." });
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: priceNum,
      category,
      ageRange,
      size: size.trim() || "-",
      condition,
      brand: brand.trim() || "Unbranded",
      location: location.trim(),
      images: JSON.stringify(images),
    };
    if (isEditing) {
      update.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Listing updated", description: "Your changes are live on TinyTrove." });
          navigate(`/listing/${editingId}`);
        },
        onError: (err: Error) => toast({ title: "Couldn't save", description: err.message }),
      });
    } else {
      create.mutate(payload, {
        onSuccess: (listing) => {
          toast({ title: "Listing published", description: "Your item is now live on TinyTrove." });
          navigate(`/listing/${listing.id}`);
        },
        onError: (err: Error) => toast({ title: "Couldn't publish", description: err.message }),
      });
    }
  };

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-5 md:pb-12">
      <h1 className="font-serif text-xl font-700">{isEditing ? "Edit listing" : "List an item"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isEditing
          ? "Update the details, photos or price of your listing."
          : "Sell the outgrown baby & kids' things your little one no longer needs."}
      </p>

      {/* Seller chip */}
      {me.data && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Avatar name={me.data.displayName} color={me.data.avatarColor} size={28} />
          <span className="text-sm font-500">Selling as {me.data.displayName}</span>
        </div>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4">
        {/* Photos */}
        <div>
          <label className="text-xs font-600 text-muted-foreground">Photos</label>
          <p className="text-xs text-muted-foreground">Upload up to 6 photos. JPG or PNG, max 8MB each.</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                <img src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90"
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {uploading.map((u) => (
              <div key={u.id} className="relative grid aspect-square place-items-center rounded-lg border border-dashed border-border bg-muted/50">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ))}
            {images.length + uploading.length < 6 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted"
                aria-label="Upload photos"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div>
          <label className="text-xs font-600 text-muted-foreground">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bundle of newborn vests" className={`mt-1 ${field}`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-600 text-muted-foreground">Price (£)</label>
            <input type="number" min="0" step="0.50" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={`mt-1 ${field}`} />
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground">Brand</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Next" className={`mt-1 ${field}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-600 text-muted-foreground">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1 ${field}`}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className={`mt-1 ${field}`}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-600 text-muted-foreground">Age range</label>
            <select value={ageRange} onChange={(e) => setAgeRange(e.target.value)} className={`mt-1 ${field}`}>
              {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground">Size (optional)</label>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 3-6m" className={`mt-1 ${field}`} />
          </div>
        </div>

        <div>
          <label className="text-xs font-600 text-muted-foreground">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the item, how worn, any marks, smoke-free home etc." className={`mt-1 ${field} resize-none`} />
        </div>

        <div>
          <label className="text-xs font-600 text-muted-foreground">Collection / location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={`mt-1 ${field}`} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={(isEditing ? update.isPending : create.isPending) || busy || uploading.length > 0}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Check size={16} /> {isEditing ? (update.isPending ? "Saving…" : "Save changes") : create.isPending ? "Publishing…" : "Publish listing"}
          </button>
        </div>
      </form>
    </div>
  );
}
