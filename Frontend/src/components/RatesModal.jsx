import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Calculator, Coins, TrendingUp } from 'lucide-react';

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
  const [calcViews, setCalcViews] = useState(25000);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rates && Object.keys(rates).length > 0) {
      setFormData({
        youtube: rates.youtube ?? 60,
        tiktok: rates.tiktok ?? 60,
        twitter: rates.twitter ?? 45,
        instagram: rates.instagram ?? 40,
      });
    }
  }, [rates, isOpen]);

  if (!isOpen) return null;

  const handleChange = (platform, val) => {
    setFormData((prev) => ({
      ...prev,
      [platform]: val === '' ? '' : parseFloat(val) || 0,
    }));
  };

  const handleReset = () => {
    if (window.confirm('Reset all platform payout rates to default settings?')) {
      setFormData({ ...DEFAULT_RATES });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      icon: <i className="fa-brands fa-youtube text-red-600 text-lg"></i>,
      accentBg: 'bg-red-50 border-red-200',
      badgeColor: 'bg-red-100 text-red-800 border-red-200',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: <i className="fa-brands fa-tiktok text-neutral-900 text-lg"></i>,
      accentBg: 'bg-neutral-100 border-neutral-300',
      badgeColor: 'bg-neutral-200 text-neutral-900 border-neutral-300',
    },
    {
      id: 'twitter',
      name: 'Twitter / X',
      icon: <i className="fa-brands fa-x-twitter text-neutral-900 text-lg"></i>,
      accentBg: 'bg-neutral-100 border-neutral-300',
      badgeColor: 'bg-neutral-200 text-neutral-900 border-neutral-300',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <i className="fa-brands fa-instagram text-pink-600 text-lg"></i>,
      accentBg: 'bg-pink-50 border-pink-200',
      badgeColor: 'bg-pink-100 text-pink-800 border-pink-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Campaign Pricing Rates</h3>
              <p className="text-xs text-neutral-500">Configure ETB payout rate per 1,000 views for each platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 border border-neutral-200 transition flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Platform Rate Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {platforms.map((plat) => {
              const currentRate = parseFloat(formData[plat.id]) || 0;
              const perView = (currentRate / 1000).toFixed(4);

              return (
                <div
                  key={plat.id}
                  className="p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-brand-300 transition shadow-xs flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${plat.accentBg} flex items-center justify-center border shrink-0`}>
                        {plat.icon}
                      </div>
                      <div>
                        <span className="font-semibold text-neutral-900 text-sm block">{plat.name}</span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {perView} ETB / view
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-600 block">
                      Payout per 1,000 Views
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        required
                        value={formData[plat.id]}
                        onChange={(e) => handleChange(plat.id, e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-3.5 pr-14 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-mono text-neutral-900 font-semibold focus:outline-none focus:border-brand-500 focus:bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 select-none">
                        ETB
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Real-Time Simulator */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                <Calculator className="w-4 h-4 text-brand-600" />
                <span>Real-Time Payout Calculator</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[10000, 25000, 50000, 100000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCalcViews(v)}
                    className={`text-[10px] px-2 py-0.5 rounded font-medium transition ${
                      calcViews === v
                        ? 'bg-brand-500 text-white font-bold'
                        : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    {(v / 1000)}k
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-neutral-500 shrink-0">Sample Views:</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={calcViews}
                onChange={(e) => setCalcViews(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono font-semibold text-neutral-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
              {platforms.map((p) => {
                const rate = parseFloat(formData[p.id]) || 0;
                const payout = ((calcViews / 1000) * rate).toFixed(2);
                return (
                  <div key={p.id} className="p-2 rounded-lg bg-white border border-neutral-200 text-xs">
                    <span className="text-[11px] text-neutral-500 block truncate">{p.name}</span>
                    <span className="font-bold text-neutral-900 font-mono text-xs text-brand-700">
                      {Number(payout).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-3 rounded-xl bg-brand-50/60 border border-brand-200 text-xs text-neutral-600 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Updated rates apply to all future submissions and can be used to auto-calculate payouts when editing submissions. Existing approved payouts remain untouched.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-medium border border-neutral-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Platform Rates</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
