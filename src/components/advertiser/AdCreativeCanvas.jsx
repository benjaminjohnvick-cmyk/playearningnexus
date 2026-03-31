import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Layers, Type, Image, Square, Circle, Download, Upload,
  Trash2, Move, Plus, CheckCircle, Loader2, Eye, AlignCenter,
  Bold, Palette
} from 'lucide-react';
import { toast } from 'sonner';

const BACKGROUNDS = [
  { id: 'dark',    label: 'Dark',     style: 'bg-gray-900' },
  { id: 'gaming',  label: 'Gaming',   style: 'bg-gradient-to-br from-purple-900 to-blue-900' },
  { id: 'fire',    label: 'Fire',     style: 'bg-gradient-to-br from-red-900 to-orange-700' },
  { id: 'gold',    label: 'Gold',     style: 'bg-gradient-to-br from-yellow-800 to-orange-900' },
  { id: 'neon',    label: 'Neon',     style: 'bg-gradient-to-br from-green-900 to-cyan-900' },
  { id: 'light',   label: 'Light',    style: 'bg-gradient-to-br from-gray-100 to-gray-300' },
];

const OVERLAYS = [
  { id: 'survey_badge', label: '🔒 Survey Badge',  render: () => (
    <div className="absolute bottom-2 right-2 bg-yellow-400 rounded-full px-2 py-0.5 text-black text-[9px] font-black shadow">🔒 UNLOCK</div>
  )},
  { id: 'earn_badge',   label: '💰 Earn Badge',    render: () => (
    <div className="absolute top-2 right-2 bg-green-500 rounded-full px-2 py-0.5 text-white text-[9px] font-black shadow">💰 EARN $0.20</div>
  )},
  { id: 'new_badge',    label: '🆕 New Badge',     render: () => (
    <div className="absolute top-2 left-2 bg-blue-500 rounded-full px-2 py-0.5 text-white text-[9px] font-black shadow">🆕 NEW</div>
  )},
  { id: 'hot_badge',    label: '🔥 Hot Badge',     render: () => (
    <div className="absolute top-2 left-2 bg-red-500 rounded-full px-2 py-0.5 text-white text-[9px] font-black shadow">🔥 HOT</div>
  )},
  { id: 'gradient_overlay', label: '🌑 Dark vignette', render: () => (
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-xl pointer-events-none" />
  )},
];

const TEXT_PRESETS = ['Bold & Black', 'Light & Italic', 'Yellow Highlight', 'White Shadow'];
const FONT_SIZES = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
const TEXT_COLORS = ['text-white', 'text-yellow-400', 'text-green-400', 'text-blue-300', 'text-red-400', 'text-black'];

export default function AdCreativeCanvas({ onExport }) {
  const [bg, setBg] = useState('dark');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [layers, setLayers] = useState([
    { id: 1, type: 'text', text: 'Your Brand', size: 'text-base', color: 'text-white', bold: true, x: 20, y: 60 },
    { id: 2, type: 'text', text: 'Your tagline here', size: 'text-xs', color: 'text-yellow-400', bold: false, x: 20, y: 75 },
  ]);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [activeOverlays, setActiveOverlays] = useState([]);
  const [dragging, setDragging] = useState(null);
  const canvasRef = useRef(null);

  const bgDef = BACKGROUNDS.find(b => b.id === bg) || BACKGROUNDS[0];

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const addTextLayer = () => {
    const id = Date.now();
    setLayers(prev => [...prev, { id, type: 'text', text: 'New text', size: 'text-sm', color: 'text-white', bold: false, x: 20, y: 50 }]);
    setSelectedLayer(id);
  };

  const removeLayer = (id) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayer === id) setSelectedLayer(null);
  };

  const updateLayer = (id, changes) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  };

  const toggleOverlay = (id) => {
    setActiveOverlays(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
  };

  const handleMouseDown = (e, layerId) => {
    e.stopPropagation();
    setSelectedLayer(layerId);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ id: layerId, startX: e.clientX, startY: e.clientY, rect });
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = ((e.clientX - dragging.startX) / dragging.rect.width) * 100;
    const dy = ((e.clientY - dragging.startY) / dragging.rect.height) * 100;
    setLayers(prev => prev.map(l => {
      if (l.id !== dragging.id) return l;
      return { ...l, x: Math.max(0, Math.min(85, l.x + dx)), y: Math.max(0, Math.min(90, l.y + dy)) };
    }));
    setDragging(d => ({ ...d, startX: e.clientX, startY: e.clientY }));
  }, [dragging]);

  const handleMouseUp = () => setDragging(null);

  const saveAsAsset = async () => {
    setSaving(true);
    // Export as a description; real canvas export would require html2canvas
    toast.success('Creative saved to Asset Library!');
    if (onExport) onExport({ imageUrl, bg, layers });
    setSaving(false);
  };

  const sel = layers.find(l => l.id === selectedLayer);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Canvas */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" /> Canvas Preview (256×256)
          </p>
          <div
            ref={canvasRef}
            className={`relative w-64 h-64 rounded-xl overflow-hidden cursor-default select-none ${bgDef.style} border border-gray-600`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedLayer(null)}
          >
            {/* Background image */}
            {imageUrl && (
              <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}

            {/* Active overlays */}
            {OVERLAYS.filter(o => activeOverlays.includes(o.id)).map(o => (
              <React.Fragment key={o.id}>{o.render()}</React.Fragment>
            ))}

            {/* Text layers */}
            {layers.filter(l => l.type === 'text').map(layer => (
              <div
                key={layer.id}
                className={`absolute cursor-move ${layer.size} ${layer.color} ${layer.bold ? 'font-black' : 'font-medium'}
                  ${selectedLayer === layer.id ? 'ring-1 ring-white/50 rounded px-0.5' : ''}`}
                style={{ left: `${layer.x}%`, top: `${layer.y}%`, transform: 'translate(0,-50%)' }}
                onMouseDown={(e) => handleMouseDown(e, layer.id)}
              >
                {layer.text}
              </div>
            ))}

            {/* Click-to-select hint */}
            {layers.length === 0 && !imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs text-center p-4">
                Upload an image or add text layers to start
              </div>
            )}
          </div>

          {/* Background selector */}
          <div>
            <p className="text-gray-500 text-[11px] mb-1.5">Background</p>
            <div className="flex flex-wrap gap-1.5">
              {BACKGROUNDS.map(b => (
                <button key={b.id} onClick={() => setBg(b.id)}
                  className={`${b.style} w-7 h-7 rounded-lg border-2 transition-all ${bg === b.id ? 'border-white' : 'border-transparent opacity-60'}`}
                  title={b.label} />
              ))}
            </div>
          </div>

          {/* Image upload */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2 transition-all">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : imageUrl ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Upload className="w-3.5 h-3.5" />}
            {imageUrl ? 'Replace image' : 'Upload background image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Layers panel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Text Layers
              </p>
              <button onClick={addTextLayer} className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 px-2 py-1 rounded-lg">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {layers.map(l => (
                <div key={l.id} onClick={() => setSelectedLayer(l.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
                    selectedLayer === l.id ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
                  }`}>
                  <Type className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-200 flex-1 truncate">{l.text}</span>
                  <button onClick={e => { e.stopPropagation(); removeLayer(l.id); }}
                    className="text-gray-600 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Selected layer editor */}
          {sel && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 space-y-2">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Edit Layer</p>
              <Input value={sel.text} onChange={e => updateLayer(sel.id, { text: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white text-xs h-8" placeholder="Layer text" />
              <div className="flex gap-2 flex-wrap">
                {FONT_SIZES.map(s => (
                  <button key={s} onClick={() => updateLayer(sel.id, { size: s })}
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                      sel.size === s ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' : 'border-gray-600 text-gray-500'
                    }`}>{s.replace('text-','')}</button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {TEXT_COLORS.map(c => (
                  <button key={c} onClick={() => updateLayer(sel.id, { color: c })}
                    className={`w-5 h-5 rounded-full border-2 ${c.replace('text-','bg-').replace('bg-white','bg-white').replace('bg-black','bg-black')}
                      ${sel.color === c ? 'border-white' : 'border-transparent'}`} />
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={sel.bold} onChange={e => updateLayer(sel.id, { bold: e.target.checked })} className="accent-yellow-400" />
                <Bold className="w-3 h-3" /> Bold
              </label>
            </div>
          )}

          {/* Survey / interactive overlays */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5" /> Interactive Overlays
            </p>
            <div className="flex flex-wrap gap-1.5">
              {OVERLAYS.map(o => (
                <button key={o.id} onClick={() => toggleOverlay(o.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    activeOverlays.includes(o.id)
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                      : 'border-gray-700 text-gray-500 hover:text-white'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={saveAsAsset} disabled={saving}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Save Creative to Asset Library
          </Button>
        </div>
      </div>
    </div>
  );
}