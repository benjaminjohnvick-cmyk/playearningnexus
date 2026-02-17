import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Crop, Maximize2, Palette, RotateCw, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function ImageEditor({ imageUrl, onSave, onClose }) {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [filter, setFilter] = useState('none');
  const canvasRef = useRef(null);

  const filters = [
    { name: 'none', label: 'None' },
    { name: 'grayscale', label: 'Grayscale' },
    { name: 'sepia', label: 'Sepia' },
    { name: 'vintage', label: 'Vintage' },
    { name: 'cool', label: 'Cool' },
    { name: 'warm', label: 'Warm' }
  ];

  const getFilterStyle = () => {
    const filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    
    switch(filter) {
      case 'grayscale':
        return `${filterString} grayscale(100%)`;
      case 'sepia':
        return `${filterString} sepia(75%)`;
      case 'vintage':
        return `${filterString} sepia(50%) contrast(110%)`;
      case 'cool':
        return `${filterString} hue-rotate(180deg)`;
      case 'warm':
        return `${filterString} hue-rotate(-20deg) saturate(120%)`;
      default:
        return filterString;
    }
  };

  const handleSave = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Apply filters
        ctx.filter = getFilterStyle();
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          onSave(url);
          toast.success('Image edited successfully!');
        });
      };
      
      img.src = imageUrl;
    } catch (error) {
      toast.error('Failed to save edited image');
    }
  };

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setFilter('none');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Edit Image
          </CardTitle>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="relative bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt="Edit preview"
            className="w-full h-64 object-contain"
            style={{ filter: getFilterStyle() }}
          />
        </div>

        {/* Filters */}
        <div>
          <Label>Filters</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {filters.map((f) => (
              <Button
                key={f.name}
                size="sm"
                variant={filter === f.name ? "default" : "outline"}
                onClick={() => setFilter(f.name)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Adjustments */}
        <div className="space-y-3">
          <div>
            <Label>Brightness: {brightness}%</Label>
            <Slider
              value={[brightness]}
              onValueChange={(val) => setBrightness(val[0])}
              min={0}
              max={200}
              step={1}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label>Contrast: {contrast}%</Label>
            <Slider
              value={[contrast]}
              onValueChange={(val) => setContrast(val[0])}
              min={0}
              max={200}
              step={1}
              className="mt-2"
            />
          </div>
          
          <div>
            <Label>Saturation: {saturation}%</Label>
            <Slider
              value={[saturation]}
              onValueChange={(val) => setSaturation(val[0])}
              min={0}
              max={200}
              step={1}
              className="mt-2"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Save Edits
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}