import React, { useState, useEffect } from 'react';

const DEFAULT_RATES = {
  youtube: 60.0,
  tiktok: 60.0,
  twitter: 45.0,
  instagram: 40.0,
};

export default function RatesModal({ isOpen, rates, onClose, onSave }) {
  const [formData, setFormData] = useState({
    youtube: 60,
    tiktok: 60,
    twitter: 45,
    instagram: 40,
  });
  const [originalRates, setOriginalRates] = useState({
    youtube: 60,
    tiktok: 60,
    twitter: 45,
    instagram: 40,
  });
  const [previewPreset, setPreviewPreset] = useState('25K'); // '10K' | '25K' | '50K' | '100K' | 'custom'
  const [customViews, setCustomViews] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rates && Object.keys(rates).length > 0) {
      const initial = {
        youtube: rates.youtube ?? 60,
        tiktok: rates.tiktok ?? 60,
        twitter: rates.twitter ?? 45,
        instagram: rates.instagram ?? 40,
      };
      setFormData(initial);
      setOriginalRates(initial);
    }
  }, [rates, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate current effective preview views
  let currentViews = 25000;
  let previewLabel = '25K';

  if (previewPreset === 'custom') {
    const parsed = parseInt(customViews, 10);
    currentViews = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    previewLabel = currentViews >= 1000 && currentViews % 1000 === 0
      ? `${currentViews / 1000}K`
      : currentViews.toLocaleString();
  } else if (previewPreset === '10K') {
    currentViews = 10000;
    previewLabel = '10K';
  } else if (previewPreset === '25K') {
    currentViews = 25000;
    previewLabel = '25K';
  } else if (previewPreset === '50K') {
    currentViews = 50000;
    previewLabel = '50K';
  } else if (previewPreset === '100K') {
    currentViews = 100000;
    previewLabel = '100K';
  }

  const handleChange = (platform, val) => {
    setFormData((prev) => ({
      ...prev,
      [platform]: val === '' ? '' : parseFloat(val) || 0,
    }));
  };

  const handleReset = () => {
    setFormData({ ...DEFAULT_RATES });
  };

  // Count unsaved changes
  const unsavedKeys = Object.keys(formData).filter((k) => {
    const cur = parseFloat(formData[k]) || 0;
    const orig = parseFloat(originalRates[k]) || 0;
    return cur !== orig;
  });
  const unsavedCount = unsavedKeys.length;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        youtube: parseFloat(formData.youtube) || 0,
        tiktok: parseFloat(formData.tiktok) || 0,
        twitter: parseFloat(formData.twitter) || 0,
        instagram: parseFloat(formData.instagram) || 0,
      };
      await onSave(payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const platforms = [
    {
      id: 'youtube',
      name: 'YouTube',
      icon: (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#ff0000]">
          <svg className="text-[14px] text-default-font" width="1em" height="1em" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" fill="rgb(255 255 255)" />
          </svg>
        </div>
      ),
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-neutral-900">
          <span className="text-body-bold font-body-bold text-neutral-0">♪</span>
        </div>
      ),
    },
    {
      id: 'twitter',
      name: 'Twitter / X',
      icon: (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-neutral-900">
          <span className="text-body-bold font-body-bold text-neutral-0">𝕏</span>
        </div>
      ),
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#e1306c]">
          <svg className="text-[16px] text-default-font" width="1em" height="1em" viewBox="0 0 24 24">
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="5"
              ry="5"
              fill="none"
              stroke="rgb(255 255 255)"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <ellipse
              cx="12"
              cy="12"
              rx="4"
              ry="4"
              fill="none"
              stroke="rgb(255 255 255)"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <ellipse
              cx="17.5"
              cy="6.5"
              rx="1.2"
              ry="1.2"
              fill="rgb(255 255 255)"
            />
          </svg>
        </div>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[560px] flex-col items-start overflow-hidden rounded-lg bg-default-background shadow-md border border-neutral-border animate-fade-in">
        {/* Header */}
        <div className="flex w-full items-start gap-3 px-6 pt-5 pb-4">
          <div className="flex flex-col items-start gap-1 grow">
            <span className="w-full text-heading-3 font-heading-3 text-default-font">
              Pricing rates
            </span>
            <span className="w-full text-body font-body text-subtext-color">
              What clippers earn per 1,000 approved views, by platform.
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-sm hover:bg-neutral-100 transition cursor-pointer"
            title="Close"
          >
            <svg
              className="text-[16px] text-default-font"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                d="M18 6 6 18M6 6l12 12"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="miter"
              />
            </svg>
          </button>
        </div>

        {/* Preview Payout Toolbar */}
        <div className="flex w-full items-center justify-between border-y border-solid border-neutral-border bg-neutral-50 px-6 py-3">
          <span className="text-caption-bold font-caption-bold text-neutral-700">
            Preview payout at
          </span>
          <div className="flex items-center gap-1 rounded-md bg-neutral-100 px-1 py-1">
            {['10K', '25K', '50K', '100K'].map((preset) => {
              const isActive = previewPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setPreviewPreset(preset);
                    setCustomViews('');
                  }}
                  className={`flex items-start rounded-sm px-2.5 py-1 transition cursor-pointer ${
                    isActive ? 'bg-default-background shadow-sm' : 'hover:bg-neutral-200/60'
                  }`}
                >
                  <span
                    className={`self-stretch ${
                      isActive
                        ? 'text-caption-bold font-caption-bold text-default-font'
                        : 'text-caption font-caption text-subtext-color'
                    }`}
                  >
                    {preset}
                  </span>
                </button>
              );
            })}
            <input
              className={`w-20 flex-none rounded-sm border border-solid border-neutral-border bg-default-background px-2 py-0.5 text-caption font-caption text-default-font outline-none placeholder:text-neutral-400 ${
                previewPreset === 'custom' ? 'ring-1 ring-brand-primary border-brand-primary' : ''
              }`}
              placeholder="Custom"
              value={customViews}
              onChange={(e) => {
                setCustomViews(e.target.value);
                setPreviewPreset('custom');
              }}
              type="number"
            />
          </div>
        </div>

        {/* Platform Rates Table */}
        <div className="flex w-full flex-col items-start px-6 py-2">
          {/* Table Header */}
          <div className="w-full items-center gap-4 py-2 grid grid-cols-[1fr_168px_120px]">
            <span className="text-overline font-overline text-subtext-color uppercase">
              Platform
            </span>
            <span className="text-overline font-overline text-subtext-color uppercase">
              Rate per 1K views
            </span>
            <span className="text-overline font-overline text-subtext-color text-right uppercase">
              At {previewLabel} views
            </span>
          </div>

          {/* Platform Rows */}
          {platforms.map((plat) => {
            const currentRate = parseFloat(formData[plat.id]) || 0;
            const originalRate = parseFloat(originalRates[plat.id]) || 0;
            const isChanged = currentRate !== originalRate;

            const ratePerSingleView = (currentRate / 1000).toFixed(3);
            const payoutAmount = (currentViews / 1000) * currentRate;
            const originalPayoutAmount = (currentViews / 1000) * originalRate;

            return (
              <div
                key={plat.id}
                className="w-full items-center gap-4 border-t border-solid border-neutral-border py-3 grid grid-cols-[1fr_168px_120px]"
              >
                {/* Platform info */}
                <div className="flex items-center gap-3">
                  {plat.icon}
                  <div className="flex flex-col items-start">
                    <span className="w-full text-body-bold font-body-bold text-default-font">
                      {plat.name}
                    </span>
                    <span className="w-full text-monospace-caption font-monospace-caption text-subtext-color">
                      {ratePerSingleView} ETB / view
                    </span>
                  </div>
                </div>

                {/* Rate input */}
                <div
                  className={`flex grow shrink-0 basis-0 items-center overflow-hidden rounded-sm border border-solid bg-default-background transition ${
                    isChanged
                      ? 'border-brand-primary shadow-[0px_0px_0px_3px_#d6eefa]'
                      : 'border-neutral-300 focus-within:border-brand-primary focus-within:shadow-[0px_0px_0px_3px_#d6eefa]'
                  }`}
                >
                  <input
                    className="w-0 flex-none px-3 py-2 text-monospace-body font-monospace-body text-default-font outline-none placeholder:text-[#a3a3a3] min-w-0 grow shrink basis-0 bg-transparent"
                    placeholder="0"
                    value={formData[plat.id]}
                    onChange={(e) => handleChange(plat.id, e.target.value)}
                    type="number"
                    step="0.5"
                    min="0"
                  />
                  <span className="text-caption font-caption text-subtext-color pr-3 select-none">
                    ETB
                  </span>
                </div>

                {/* Calculated payout with diff */}
                {isChanged ? (
                  <div className="flex flex-col items-end">
                    <span className="text-monospace-body font-monospace-body text-default-font text-right">
                      {payoutAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ETB
                    </span>
                    <span className="text-caption font-caption text-warning-800">
                      was{' '}
                      {originalPayoutAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ) : (
                  <span className="text-monospace-body font-monospace-body text-default-font text-right">
                    {payoutAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ETB
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Notice Info Banner */}
        <div className="flex items-start gap-2 rounded-md bg-brand-50 px-3 py-2.5 self-stretch mx-6 mb-4">
          <svg
            className="text-[14px] text-default-font mt-0.5 shrink-0"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
          >
            <ellipse
              cx="12"
              cy="12"
              rx="9"
              ry="9"
              fill="none"
              stroke="rgb(20 121 168)"
              strokeWidth="2"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <path
              d="M12 11v5m0-8h.01"
              fill="none"
              stroke="rgb(20 121 168)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          </svg>
          <span className="text-caption font-caption text-brand-800 grow">
            New rates apply to future submissions only. Payouts you&#39;ve already approved won&#39;t change.
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex w-full items-center gap-2 border-t border-solid border-neutral-border bg-neutral-50 px-6 py-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 hover:bg-neutral-100 transition cursor-pointer text-subtext-color hover:text-default-font"
            title="Reset to default rates (60 ETB YouTube/TikTok, 45 ETB Twitter, 40 ETB Instagram)"
          >
            <svg
              className="text-[13px] text-default-font"
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"
                fill="none"
                stroke="rgb(107 114 128)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-body font-body text-subtext-color">
              Reset to defaults
            </span>
          </button>

          <div className="flex items-start grow" />

          {unsavedCount > 0 && (
            <span className="text-caption font-caption text-warning-800 pr-2">
              {unsavedCount} unsaved change{unsavedCount > 1 ? 's' : ''}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex items-center rounded-sm border border-solid border-neutral-border bg-default-background px-3 py-1.5 hover:bg-neutral-50 transition cursor-pointer"
          >
            <span className="text-body font-body text-neutral-700">Cancel</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center rounded-sm bg-brand-primary px-3 py-1.5 hover:bg-brand-600 transition cursor-pointer disabled:opacity-50"
          >
            <span className="text-body-bold font-body-bold text-neutral-0">
              {loading ? 'Saving...' : 'Save rates'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
