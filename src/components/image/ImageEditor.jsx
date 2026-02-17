import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Crop, Maximize2, Palette, RotateCw, Download, Type, Save } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function ImageEditor({ imageUrl, onSave, onClose, imageId }) {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [filter, setFilter] = useState('none');
  const [textOverlay, setTextOverlay] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(48);
  const canvasRef = useRef(null);
  const queryClient = useQueryClient();

  const filters = [
    { name: 'none', label: 'None' },
    { name: 'grayscale', label: 'Grayscale' },
    { name: 'sepia', label: 'Sepia' },
    { name: 'vintage', label: 'Vintage' },
    { name: 'cool', label: 'Cool' },
    { name: 'warm', label: 'Warm' },
    { name: 'vibrant', label: 'Vibrant' },
    { name: 'dramatic', label: 'Dramatic' }
  ];

  const getFilterStyle = () => {
    const filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
    
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
      case 'vibrant':
        return `${filterString} saturate(150%) contrast(110%)`;
      case 'dramatic':
        return `${filterString} contrast(130%) brightness(90%)`;
      default:
        return filterString;
    }
  };

  const saveToGalleryMutation = useMutation({
    mutationFn: async (editedImageUrl) => {
      if (imageId) {
        await base44.entities.GeneratedImage.update(imageId, {
          edited_image_url: editedImageUrl
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userGeneratedImages']);
      queryClient.invalidateQueries(['generatedImages']);
      toast.success('Image saved to gallery!');
    }
  });

  const handleSave = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Save current state
        ctx.save();
        
        // Apply rotation
        if (rotation !== 0) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
        }
        
        // Apply filters
        ctx.filter = getFilterStyle();
        ctx.drawImage(img, 0, 0);
        
        // Apply text overlay
        if (textOverlay) {
          ctx.filter = 'none';
          ctx.fillStyle = textColor;
          ctx.font = `bold ${textSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Add text shadow for better visibility
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          ctx.fillText(textOverlay, canvas.width / 2, canvas.height / 2);
        }
        
        ctx.restore();
        
        canvas.toBlob(async (blob) => {
          // Upload edited image
          const file = new File([blob], 'edited-image.png', { type: 'image/png' });
          const result = await base44.integrations.Core.UploadFile({ file });
          
          // Save to gallery
          if (imageId) {
            await saveToGalleryMutation.mutateAsync(result.file_url);
          }
          
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
    setBlur(0);
    setRotation(0);
    setFilter('none');
    setTextOverlay('');
    setTextColor('#ffffff');
    setTextSize(48);
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
          <div className="relative">
            <img
              src={imageUrl}
              alt="Edit preview"
              className="w-full h-64 object-contain"
              style={{ 
                filter: getFilterStyle(),
                transform: `rotate(${rotation}deg)`
              }}
            />
            {textOverlay && (
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  color: textColor,
                  fontSize: `${textSize}px`,
                  fontWeight: 'bold',
                  textShadow: '2px 2px 10px rgba(0,0,0,0.8)'
                }}
              >
                {textOverlay}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div>
          <Label>Filters</Label>
          <div className="grid grid-cols-4 gap-2 mt-2">
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

          <div>
            <Label>Blur: {blur}px</Label>
            <Slider
              value={[blur]}
              onValueChange={(val) => setBlur(val[0])}
              min={0}
              max={10}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Rotation: {rotation}°</Label>
            <Slider
              value={[rotation]}
              onValueChange={(val) => setRotation(val[0])}
              min={-180}
              max={180}
              step={15}
              className="mt-2"
            />
          </div>
        </div>

        {/* Text Overlay */}
        <div className="border-t pt-4 space-y-3">
          <Label className="flex items-center gap-2">
            <Type className="w-4 h-4" />
            Text Overlay
          </Label>
          
          <Input
            placeholder="Add text to image..."
            value={textOverlay}
            onChange={(e) => setTextOverlay(e.target.value)}
          />
          
          {textOverlay && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Text Color</Label>
                  <Input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs">Text Size: {textSize}px</Label>
                  <Slider
                    value={[textSize]}
                    onValueChange={(val) => setTextSize(val[0])}
                    min={20}
                    max={100}
                    step={2}
                    className="mt-2"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saveToGalleryMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 mr-2" />
            {imageId ? 'Save to Gallery' : 'Save Edits'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}