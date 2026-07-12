import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import { Save, Upload, X, LayoutDashboard } from 'lucide-react';

const PRESET_COLORS = [
  '#000000', '#1F2937', '#374151', '#4B5563',
  '#DC2626', '#EA580C', '#D97706', '#CA8A04',
  '#65A30D', '#16A34A', '#059669', '#0D9488',
  '#0891B2', '#0284C7', '#2563EB', '#4F46E5',
  '#7C3AED', '#9333EA', '#C026D3', '#DB2777'
];

const TEXT_COLOR_PRESETS = [
  '#FFFFFF', '#F9FAFB', '#F3F4F6', '#E5E7EB',
  '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563',
  '#374151', '#1F2937', '#111827', '#000000'
];

export default function Branding() {
  const { activeCompany, refreshCompanies } = useAuth();
  const [primaryColor, setPrimaryColor] = useState(activeCompany?.primary_color || '#000000');
  const [secondaryColor, setSecondaryColor] = useState(activeCompany?.secondary_color || '#6B7280');
  const [sidebarTextColor, setSidebarTextColor] = useState(activeCompany?.sidebar_text_color || '#FFFFFF');
  const [logoUrl, setLogoUrl] = useState(activeCompany?.logo_url || '');
  const [loginLogoSize, setLoginLogoSize] = useState(activeCompany?.login_logo_size ?? 100);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrimaryColor(activeCompany?.primary_color || '#000000');
    setSecondaryColor(activeCompany?.secondary_color || '#6B7280');
    setSidebarTextColor(activeCompany?.sidebar_text_color || '#FFFFFF');
    setLogoUrl(activeCompany?.logo_url || '');
    setLoginLogoSize(activeCompany?.login_logo_size ?? 100);
  }, [activeCompany]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCompany) return;

    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${activeCompany.id}-logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);

    setLogoUrl(`${publicUrl}?t=${Date.now()}`);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!activeCompany) return;

    setSaving(true);
    setSuccess(false);

    const { error } = await supabase
      .from('companies')
      .update({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        sidebar_text_color: sidebarTextColor,
        logo_url: logoUrl || null,
        login_logo_size: Math.min(300, Math.max(32, loginLogoSize)),
        updated_at: new Date().toISOString()
      })
      .eq('id', activeCompany.id);

    setSaving(false);

    if (!error) {
      setSuccess(true);
      await refreshCompanies();
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Company Logo</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload your company logo to display in the sidebar
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-600">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <LayoutDashboard className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  <Upload className="w-4 h-4" />
                  Upload Logo
                </Button>
                {logoUrl && (
                  <Button variant="ghost" onClick={() => setLogoUrl('')}>
                    <X className="w-4 h-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Recommended: Square image, at least 200x200 pixels. PNG or SVG for best quality.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Login Page Logo Size</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control the logo height on the login screen (32–300px)
          </p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 max-w-xs">
            <input
              type="number"
              min={32}
              max={300}
              value={loginLogoSize}
              onChange={(e) => setLoginLogoSize(Number(e.target.value))}
              className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">px</span>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Preview"
                style={{ height: `${Math.min(300, Math.max(32, loginLogoSize))}px`, width: 'auto', maxWidth: '200px' }}
                className="object-contain rounded-lg border border-gray-200 dark:border-gray-600"
              />
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Range: 32–300px. Does not affect the sidebar.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Brand Colors</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Customize the colors used throughout the dashboard
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Primary Color
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: primaryColor }}
              >
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.slice(0, 10).map((color) => (
                  <button
                    key={color}
                    onClick={() => setPrimaryColor(color)}
                    className={`w-8 h-8 rounded-md transition-transform hover:scale-110 ${
                      primaryColor === color ? 'ring-2 ring-offset-2 ring-black' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Secondary Color
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: secondaryColor }}
              >
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.slice(10).map((color) => (
                  <button
                    key={color}
                    onClick={() => setSecondaryColor(color)}
                    className={`w-8 h-8 rounded-md transition-transform hover:scale-110 ${
                      secondaryColor === color ? 'ring-2 ring-offset-2 ring-black' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Sidebar Text Color
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer relative overflow-hidden"
                style={{ backgroundColor: sidebarTextColor }}
              >
                <input
                  type="color"
                  value={sidebarTextColor}
                  onChange={(e) => setSidebarTextColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={sidebarTextColor}
                onChange={(e) => setSidebarTextColor(e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent uppercase bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex gap-1 flex-wrap">
                {TEXT_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSidebarTextColor(color)}
                    className={`w-8 h-8 rounded-md transition-transform hover:scale-110 border border-gray-300 ${
                      sidebarTextColor === color ? 'ring-2 ring-offset-2 ring-black' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            See how your branding will look
          </p>
        </div>

        <div className="p-6">
          <div className="flex gap-6">
            <div className="w-64 bg-black rounded-lg p-4" style={{ backgroundColor: primaryColor }}>
              <div className="flex items-center gap-3 mb-6">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5" style={{ color: primaryColor }} />
                  </div>
                )}
                <span className="font-bold" style={{ color: sidebarTextColor }}>{activeCompany?.name}</span>
              </div>
              <div className="space-y-2">
                <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: `${sidebarTextColor}20`, color: sidebarTextColor }}>Home</div>
                <div className="px-3 py-2 text-sm" style={{ color: sidebarTextColor, opacity: 0.6 }}>Projects</div>
                <div className="px-3 py-2 text-sm" style={{ color: sidebarTextColor, opacity: 0.6 }}>Settings</div>
              </div>
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sample Dashboard</h3>
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-2 rounded-md text-white text-sm font-medium"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Secondary Button
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} loading={saving}>
          <Save className="w-4 h-4" />
          Save Branding
        </Button>
        {success && (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            Changes saved successfully
          </span>
        )}
      </div>
    </div>
  );
}
