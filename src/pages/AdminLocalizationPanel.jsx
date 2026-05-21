import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit, Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' }
];

const CATEGORIES = ['ui', 'content', 'marketing', 'support', 'email'];

export default function AdminLocalizationPanel() {
  const [selectedLang, setSelectedLang] = useState('en');
  const [selectedCategory, setSelectedCategory] = useState('ui');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ key: '', translated_value: '', context: '' });
  const queryClient = useQueryClient();

  const { data: translations = [], isLoading } = useQuery({
    queryKey: ['localizations', selectedLang, selectedCategory],
    queryFn: async () => {
      const result = await base44.asServiceRole.entities.LocalizationString.filter({
        language_code: selectedLang,
        category: selectedCategory
      });
      return result;
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.asServiceRole.entities.LocalizationString.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localizations'] });
      setFormData({ key: '', translated_value: '', context: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.asServiceRole.entities.LocalizationString.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localizations'] });
      setEditingId(null);
      setFormData({ key: '', translated_value: '', context: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.LocalizationString.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localizations'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      language_code: selectedLang,
      category: selectedCategory,
      is_active: true
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (trans) => {
    setEditingId(trans.id);
    setFormData({
      key: trans.key,
      translated_value: trans.translated_value,
      context: trans.context || ''
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Globe className="w-8 h-8" />
            Localization Management
          </h1>
          <p className="text-slate-600">Manage platform translations across languages and categories</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingId ? 'Edit Translation' : 'Add Translation'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Language</label>
                  <Select value={selectedLang} onValueChange={setSelectedLang}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Translation Key</label>
                  <Input
                    placeholder="e.g. dashboard.title"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    disabled={editingId !== null}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Translated Text</label>
                  <textarea
                    className="w-full border rounded-md p-2 text-sm"
                    placeholder="Enter translated text..."
                    value={formData.translated_value}
                    onChange={(e) => setFormData({ ...formData, translated_value: e.target.value })}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Context (Optional)</label>
                  <Input
                    placeholder="e.g. Title shown on main dashboard"
                    value={formData.context}
                    onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {editingId ? 'Update' : 'Add'} Translation
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setFormData({ key: '', translated_value: '', context: '' });
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Translations List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                Translations ({selectedLang.toUpperCase()} - {selectedCategory})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-slate-500 py-8">Loading translations...</div>
              ) : translations.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No translations yet. Add one to get started.</div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {translations.map(trans => (
                    <div key={trans.id} className="border rounded-lg p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-mono text-sm text-slate-600">{trans.key}</p>
                          <p className="text-sm mt-1">{trans.translated_value}</p>
                          {trans.context && (
                            <p className="text-xs text-slate-500 mt-1 italic">{trans.context}</p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(trans)}
                            className="p-1 hover:bg-blue-100 rounded"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(trans.id)}
                            className="p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Language Overview */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Language Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {LANGUAGES.map(lang => (
                <div
                  key={lang.code}
                  className="p-4 border rounded-lg text-center hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedLang(lang.code)}
                >
                  <p className="font-semibold">{lang.name}</p>
                  <p className="text-sm text-slate-600">{lang.code.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}