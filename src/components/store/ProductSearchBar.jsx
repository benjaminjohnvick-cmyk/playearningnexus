import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Upload, X, Zap, Mic, Camera, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import BestPriceBadge from '@/components/store/BestPriceBadge';

// Web Speech API (on-device voice-to-text) — present in Chrome/Edge/Android WebView; absent in the iOS WebView,
// where we fall back to recording a clip and transcribing it on the server (voiceSearchTranscribe / Whisper).
const SpeechRec = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function ProductSearchBar({ onSearchResults, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchImage, setSearchImage] = useState(null);
  const [searching, setSearching] = useState(false);
  const [aiPricingEnabled, setAiPricingEnabled] = useState(true);
  const [engineLoading, setEngineLoading] = useState(false);
  const [bestPrice, setBestPrice] = useState(null);
  const [bestVendor, setBestVendor] = useState(null);
  const [listening, setListening] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identifiedName, setIdentifiedName] = useState(null);
  const recRef = useRef(null);        // SpeechRecognition instance
  const mediaRef = useRef(null);      // { recorder, chunks, stream } for the server-STT fallback

  useEffect(() => () => { // cleanup any live capture on unmount
    try { recRef.current?.stop?.(); } catch { /* ignore */ }
    try { mediaRef.current?.stream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
  }, []);

  // ---- Image upload (also usable as a live camera on mobile via capture="environment") ----
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSearchImage(file_url);
      setIdentifiedName(null);
      toast.success('Image added — searching by photo');
    } catch {
      toast.error('Failed to upload image');
    }
  };

  // ---- Voice search: on-device where available, server transcription fallback otherwise ----
  const startVoice = async () => {
    if (listening) { stopVoice(); return; }
    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (ev) => {
          const said = Array.from(ev.results).map((r) => r[0]?.transcript || '').join(' ').trim();
          if (said) { setSearchQuery(said); setTimeout(() => handleSearch(said), 50); }
        };
        rec.onerror = () => { setListening(false); toast.error('Could not hear you — try again or type it.'); };
        rec.onend = () => setListening(false);
        recRef.current = rec;
        setListening(true);
        rec.start();
        return;
      } catch { /* fall through to recorder */ }
    }
    // Fallback: record a short clip and transcribe on the server (iOS WebView path).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob); });
        try {
          const r = await base44.functions.invoke('voiceSearchTranscribe', { audio_base64: b64, mime_type: recorder.mimeType || 'audio/webm' });
          const text = (r?.data?.text || r?.text || '').trim();
          if (text) { setSearchQuery(text); setTimeout(() => handleSearch(text), 50); }
          else toast.error('Could not transcribe — try again or type it.');
        } catch { toast.error('Voice search unavailable — please type it.'); }
      };
      mediaRef.current = { recorder, chunks, stream };
      recorder.start();
      setListening(true);
      // Auto-stop after 6s so the user doesn't have to.
      setTimeout(() => { try { recorder.state !== 'inactive' && recorder.stop(); } catch { /* ignore */ } setListening(false); }, 6000);
    } catch {
      toast.error('Microphone permission is needed for voice search.');
    }
  };

  const stopVoice = () => {
    try { recRef.current?.stop?.(); } catch { /* ignore */ }
    try { const m = mediaRef.current; if (m?.recorder && m.recorder.state !== 'inactive') m.recorder.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  const handleSearch = async (overrideQuery) => {
    const typed = (typeof overrideQuery === 'string' ? overrideQuery : searchQuery).trim();
    if (!typed && !searchImage) {
      toast.error('Speak, type a product name, or add a photo');
      return;
    }

    setSearching(true);
    setBestPrice(null);
    setBestVendor(null);

    // Image search: identify the product in the photo first, so an image (even with no text) becomes a query.
    let effectiveQuery = typed;
    if (searchImage) {
      setIdentifying(true);
      try {
        const idr = await base44.functions.invoke('imageProductSearch', { image_url: searchImage, query: typed || undefined, limit: 20 });
        const data = idr?.data || idr || {};
        const name = (data.query || data?.identity?.query || '').trim();
        if (name) {
          setIdentifiedName(name);
          if (!effectiveQuery) { effectiveQuery = name; setSearchQuery(name); }
        }
      } catch { /* non-fatal — the vision step below still sees the image */ }
      setIdentifying(false);
    }

    // Run AI pricing engine in parallel if enabled.
    let enginePromise = null;
    if (aiPricingEnabled) {
      setEngineLoading(true);
      enginePromise = base44.functions.invoke('aiPriceEngine', {
        product_name: effectiveQuery,
        image_url: searchImage || undefined
      }).catch(() => null);
    }

    try {
      const prompt = `You are a real-time price comparison engine. Search across the web for: "${effectiveQuery}".

Find this exact product listed at MULTIPLE different retailers/websites. Return every distinct retailer listing you can find, sorted from LOWEST price to HIGHEST price.

Include major retailers like Amazon, Walmart, Target, Best Buy, eBay, Newegg, B&H, Costco, GameStop, etc., plus any other relevant stores that carry this product.

For each listing return:
- product_name: the exact product title on that retailer
- description: brief product description (1-2 sentences)
- price: the current price as a number (no currency symbol). Use 0 if unavailable.
- vendor: the retailer/store name (e.g. "Amazon", "Walmart", "Best Buy")
- url: the direct product page URL on that retailer
- image_url: a product image URL if available, otherwise empty string
- in_stock: true/false whether it appears to be in stock
- shipping_note: brief shipping info (e.g. "Free shipping", "Ships in 2-3 days", "Free 2-day with Prime")

Return AT LEAST 6 listings if they exist. Sort the listings array from lowest price to highest price.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "gemini_3_flash",
        add_context_from_internet: true,
        file_urls: searchImage ? [searchImage] : undefined,
        response_json_schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "number" },
                  vendor: { type: "string" },
                  url: { type: "string" },
                  image_url: { type: "string" },
                  in_stock: { type: "boolean" },
                  shipping_note: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.products && result.products.length > 0) {
        const sorted = [...result.products].sort((a, b) => (a.price || 0) - (b.price || 0));

        // Wait for AI engine result and surface Best Price badge
        let engineData = null;
        if (enginePromise) {
          const engineRes = await enginePromise;
          engineData = engineRes?.data || null;
          if (engineData?.best_price_amount && engineData?.best_price_vendor) {
            setBestPrice(engineData.best_price_amount);
            setBestVendor(engineData.best_price_vendor);
          }
          setEngineLoading(false);
        }

        onSearchResults(sorted, effectiveQuery, searchImage, engineData);
      } else {
        toast.error('No products found');
      }
    } catch {
      toast.error('Search failed. Please try again.');
      setEngineLoading(false);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed top-20 right-6 z-50 bg-white rounded-xl shadow-2xl border-2 border-blue-200 p-4 w-96">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">Product Search</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* AI Pricing Engine toggle */}
      <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${aiPricingEnabled ? 'text-green-600' : 'text-gray-400'}`} />
          <div>
            <Label htmlFor="ai-pricing-toggle" className="text-xs font-semibold text-gray-800 cursor-pointer">
              AI Pricing Engine
            </Label>
            <p className="text-[10px] text-gray-500">Find lowest price across all retailers</p>
          </div>
        </div>
        <Switch
          id="ai-pricing-toggle"
          checked={aiPricingEnabled}
          onCheckedChange={setAiPricingEnabled}
          className="data-[state=checked]:bg-green-600"
        />
      </div>

      {/* Best Price badge — shows after results load */}
      {(engineLoading || bestPrice) && (
        <div className="mb-3">
          <BestPriceBadge loading={engineLoading} bestPrice={bestPrice} bestVendor={bestVendor} />
        </div>
      )}

      <p className="text-xs text-gray-600 mb-3">
        Don't have the product you want? Search by name, voice, or a photo.
      </p>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          {/* Voice search */}
          <Button
            type="button"
            variant={listening ? 'default' : 'outline'}
            size="icon"
            aria-label={listening ? 'Stop voice search' : 'Search by voice'}
            title="Search by voice"
            onClick={startVoice}
            className={listening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : ''}
          >
            <Mic className="w-4 h-4" />
          </Button>
        </div>

        {listening && (
          <p className="text-[11px] text-red-600 font-medium">Listening… say the product name.</p>
        )}
        {identifiedName && (
          <p className="text-[11px] text-blue-700">Identified from photo: <strong>{identifiedName}</strong></p>
        )}

        <div className="flex items-center gap-2">
          {/* Upload from library */}
          <label htmlFor="product-image-upload" aria-label="Upload image" className="flex-1">
            <Button variant="outline" className="w-full" asChild>
              <div>
                <Upload className="w-4 h-4 mr-2" />
                {searchImage ? 'Image added' : 'Upload image'}
              </div>
            </Button>
            <input
              id="product-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>

          {/* Take a photo (mobile camera) */}
          <label htmlFor="product-image-camera" aria-label="Take a photo">
            <Button variant="outline" size="icon" asChild>
              <div><Camera className="w-4 h-4" /></div>
            </Button>
            <input
              id="product-image-camera"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>

          {searchImage && (
            <Button variant="ghost" size="icon" onClick={() => { setSearchImage(null); setIdentifiedName(null); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {searchImage && (
          <img src={searchImage} alt="Search" className="w-full h-32 object-cover rounded-lg" />
        )}

        <Button
          className="w-full bg-blue-600"
          onClick={() => handleSearch()}
          disabled={searching}
        >
          {searching
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{identifying ? 'Identifying product…' : 'Comparing prices across the web…'}</>
            : <><Search className="w-4 h-4 mr-2" />Compare prices across all stores</>}
        </Button>
      </div>
    </div>
  );
}
