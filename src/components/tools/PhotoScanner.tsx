import React, { useRef, useState } from 'react';
import { Camera, Loader2, X, UtensilsCrossed, Lightbulb, Languages } from 'lucide-react';
import { useContextEngine } from '../../contexts/ContextEngineContext';
import { analyzeImage, type ImageAnalysis } from '../../services/visionService';

const PhotoScanner: React.FC = () => {
  const { moment } = useContextEngine();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ImageAnalysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    setPreviewUrl(URL.createObjectURL(file));
    setIsAnalyzing(true);
    setResult(null);

    try {
      const dest = moment.currentDestination;
      const analysis = await analyzeImage(
        file,
        dest?.name,
        dest?.languages?.[0],
      );
      setResult(analysis);
    } catch {
      setResult({ summary: 'Failed to analyze image. Please try again.' });
    } finally {
      setIsAnalyzing(false);
    }

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClear = () => {
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Camera size={16} style={{ color: 'var(--accent)' }} />
        <span className="text-[13px] font-bold">Photo Scanner</span>
        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Translate signs, menus, and more
        </span>
      </div>

      {/* Capture button or preview */}
      {!previewUrl ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-6 rounded-2xl transition-transform active:scale-[0.98]"
          style={{ border: '2px dashed var(--outline)', background: 'var(--surface-container)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-container)', color: 'var(--accent)' }}
          >
            <Camera size={22} />
          </div>
          <div className="text-left">
            <div className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Take a photo
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Point at a menu, sign, or anything you want to understand
            </div>
          </div>
        </button>
      ) : (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Captured"
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: '200px' }}
          />
          {!isAnalyzing && (
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              <X size={16} />
            </button>
          )}
          {isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'var(--surface-container)' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-[13px] font-semibold">Analyzing...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analysis result */}
      {result && (
        <div className="card p-4 space-y-3">
          {/* Summary */}
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {result.summary}
          </p>

          {/* Translation */}
          {result.translation && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'var(--accent-container)' }}>
              <Languages size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="text-[13px] leading-relaxed" style={{ color: 'var(--on-accent-container)' }}>
                {result.translation}
              </div>
            </div>
          )}

          {/* Cultural context */}
          {result.culturalContext && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: 'var(--surface-container-high)' }}>
              <Lightbulb size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {result.culturalContext}
              </div>
            </div>
          )}

          {/* Menu items */}
          {result.menuItems && result.menuItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'var(--accent)' }}>
                <UtensilsCrossed size={12} />
                Menu Items
              </div>
              {result.menuItems.map((item, i) => (
                <div key={i} className="flex items-start justify-between p-2.5 rounded-xl" style={{ background: 'var(--surface-container)' }}>
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-[13px] font-semibold">{item.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{item.description}</div>
                  </div>
                  {item.price && (
                    <span className="text-[12px] font-bold flex-shrink-0" style={{ color: 'var(--accent)' }}>{item.price}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-bold mt-px" style={{ color: 'var(--accent)' }}>{i + 1}.</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {/* Scan another */}
          <button
            onClick={() => { handleClear(); fileInputRef.current?.click(); }}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'var(--surface-container)', color: 'var(--accent)' }}
          >
            Scan another photo
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />
    </div>
  );
};

export default PhotoScanner;
