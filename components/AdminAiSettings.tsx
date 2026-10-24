import React, { useEffect, useState } from 'react';
import { Cpu, Save, FlaskConical, ExternalLink, CircleCheck, TriangleAlert, Loader2 } from 'lucide-react';
import { AiProvider, AiSettings } from '../types';
import { getAiSettings, saveAiSettings, testAiSettings } from '../services/geminiService';
import { fieldClass, labelClass, primaryButtonClass, ghostButtonClass } from './formStyles';

const CUSTOM_MODEL = '__custom__';
const VERCEL_ENV_URL = 'https://vercel.com/jeromes-projects-f6d6a8ea/credittrack/settings/environment-variables';

const PROVIDERS: Record<AiProvider, { name: string; keyEnv: string; keyUrl: string; keySource: string; modelHint: string }> = {
  gemini: {
    name: 'Gemini API',
    keyEnv: 'GEMINI_API_KEY',
    keyUrl: 'https://aistudio.google.com/apikey',
    keySource: 'Google AI Studio',
    modelHint: 'A Gemini model ID, e.g. gemini-2.5-flash.',
  },
  openrouter: {
    name: 'OpenRouter API',
    keyEnv: 'OPENROUTER_API_KEY',
    keyUrl: 'https://openrouter.ai/keys',
    keySource: 'OpenRouter',
    modelHint: 'Any openrouter.ai/models ID that accepts PDF or image input, e.g. anthropic/claude-sonnet-5.5.',
  },
};

const PROVIDER_ORDER: AiProvider[] = ['gemini', 'openrouter'];

const KeyChip: React.FC<{ ready: boolean }> = ({ ready }) => (
  <span
    className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 border whitespace-nowrap ${
      ready ? 'text-success border-success/50 bg-success/10' : 'text-danger border-danger/40'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-success' : 'bg-danger'}`} />
    {ready ? 'Key connected' : 'Key missing'}
  </span>
);

const KeyGuide: React.FC<{ provider: AiProvider }> = ({ provider }) => {
  const p = PROVIDERS[provider];
  return (
    <div className="p-4 border border-danger/40 bg-danger/5 text-sm text-ink-soft space-y-3">
      <p className="text-ink flex items-center gap-2">
        <TriangleAlert className="w-4 h-4 text-danger shrink-0" strokeWidth={1.5} />
        {p.name} is not linked. Add <code className="font-mono text-brass-300">{p.keyEnv}</code> on Vercel:
      </p>
      <ol className="list-decimal pl-5 space-y-1.5">
        <li>
          Create a key in{' '}
          <a href={p.keyUrl} target="_blank" rel="noreferrer" className="text-brass-400 hover:text-brass-300 underline">
            {p.keySource}
          </a>.
        </li>
        <li>
          Open{' '}
          <a href={VERCEL_ENV_URL} target="_blank" rel="noreferrer" className="text-brass-400 hover:text-brass-300 underline inline-flex items-center gap-1">
            Vercel → credittrack → Settings → Environment Variables
            <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
          </a>.
        </li>
        <li>
          Add <code className="font-mono text-brass-300">{p.keyEnv}</code> for Production. Do not prefix it with{' '}
          <code className="font-mono">VITE_</code>; that would publish it in the browser.
        </li>
        <li>Redeploy the latest production deployment, then reload this page. The chip turns green when the server sees the key.</li>
      </ol>
    </div>
  );
};

export const AdminAiSettings: React.FC = () => {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [model, setModel] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const applySettings = (s: AiSettings) => {
    setSettings(s);
    setProvider(s.config.provider);
    setModel(s.config.model);
    setCustomMode(!s.suggestions[s.config.provider].includes(s.config.model));
  };

  useEffect(() => {
    getAiSettings()
      .then(applySettings)
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  if (loadError) {
    return <div className="p-4 border border-danger/40 text-danger text-sm">Could not load AI settings: {loadError}</div>;
  }
  if (!settings) {
    return <div className="p-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">Loading AI settings</div>;
  }

  const keyReady = settings.keys[provider];
  const trimmedModel = model.trim();
  const dirty = provider !== settings.config.provider || trimmedModel !== settings.config.model;
  const fallingBack =
    settings.active.provider !== settings.config.provider || settings.active.model !== settings.config.model;

  const selectProvider = (next: AiProvider) => {
    setNotice(null);
    setProvider(next);
    if (next === settings.config.provider) {
      setModel(settings.config.model);
      setCustomMode(!settings.suggestions[next].includes(settings.config.model));
    } else {
      setModel(settings.suggestions[next][0] ?? '');
      setCustomMode(false);
    }
  };

  const selectModel = (value: string) => {
    setNotice(null);
    if (value === CUSTOM_MODEL) {
      setCustomMode(true);
      setModel('');
    } else {
      setCustomMode(false);
      setModel(value);
    }
  };

  const run = async (action: 'save' | 'test') => {
    setBusy(action);
    setNotice(null);
    try {
      if (action === 'test') {
        const result = await testAiSettings({ provider, model: trimmedModel });
        setNotice(
          result.ok
            ? { ok: true, text: `${trimmedModel} responded in ${((result.latencyMs ?? 0) / 1000).toFixed(1)}s.` }
            : { ok: false, text: `Test failed: ${result.error}` }
        );
      } else {
        applySettings(await saveAiSettings({ provider, model: trimmedModel }));
        setNotice({ ok: true, text: 'Saved. New uploads and insights use this model within about 30 seconds.' });
      }
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-marine-900 border border-brass-500/15 p-6">
        <h2 className="text-base font-medium text-ink mb-1 flex items-center gap-2.5">
          <Cpu className="w-4 h-4 text-brass-400" strokeWidth={1.5} />
          OCR and insights model
        </h2>
        <p className="text-xs text-ink-mute mb-4">
          Used to read uploaded statements and to write spending insights. Keys stay on the server.
        </p>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">In use now</span>
          <span className="font-mono text-brass-300">
            {PROVIDERS[settings.active.provider].name} · {settings.active.model}
          </span>
        </div>
        {fallingBack && (
          <p className="mt-3 text-xs text-warning">
            Saved choice is {PROVIDERS[settings.config.provider].name} · {settings.config.model}, but{' '}
            {PROVIDERS[settings.config.provider].keyEnv} is missing, so the default Gemini model is used until it is added.
          </p>
        )}
      </div>

      <div className="bg-marine-900 border border-brass-500/15 p-6 space-y-5">
        <div>
          <span className={labelClass}>Provider</span>
          <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="AI provider">
            {PROVIDER_ORDER.map(id => {
              const selected = provider === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectProvider(id)}
                  className={`text-left p-4 border min-h-[48px] transition-colors duration-150 ${
                    selected ? 'border-brass-500 bg-marine-800' : 'border-brass-500/20 hover:border-brass-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm ${selected ? 'text-ink' : 'text-ink-soft'}`}>{PROVIDERS[id].name}</span>
                    <KeyChip ready={settings.keys[id]} />
                  </div>
                  {settings.defaults.provider === id && (
                    <p className="text-xs text-ink-mute mt-1">Default · {settings.defaults.model}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {!keyReady && <KeyGuide provider={provider} />}

        <div>
          <label htmlFor="ai-model" className={labelClass}>Model</label>
          <select
            id="ai-model"
            className={fieldClass}
            value={customMode ? CUSTOM_MODEL : model}
            onChange={e => selectModel(e.target.value)}
          >
            {settings.suggestions[provider].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value={CUSTOM_MODEL}>Custom model ID…</option>
          </select>
          {customMode && (
            <input
              type="text"
              aria-label="Custom model ID"
              className={fieldClass + ' mt-2 font-mono'}
              placeholder={provider === 'openrouter' ? 'vendor/model-name' : 'gemini-model-name'}
              value={model}
              onChange={e => { setNotice(null); setModel(e.target.value); }}
              autoComplete="off"
              spellCheck={false}
            />
          )}
          <p className="text-xs text-ink-mute mt-2">{PROVIDERS[provider].modelHint}</p>
        </div>

        {notice && (
          <div
            className={`p-3 border text-sm flex items-start gap-2 ${
              notice.ok ? 'border-success/50 bg-success/10 text-success' : 'border-danger/40 text-danger'
            }`}
          >
            {notice.ok
              ? <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
              : <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />}
            <span className="break-words min-w-0">{notice.text}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => run('test')}
            disabled={!keyReady || !trimmedModel || busy !== null}
            className={`${ghostButtonClass} border border-brass-500/25 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {busy === 'test'
              ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              : <FlaskConical className="w-4 h-4" strokeWidth={1.5} />}
            Test model
          </button>
          <button
            type="button"
            onClick={() => run('save')}
            disabled={!keyReady || !trimmedModel || !dirty || busy !== null}
            className={`${primaryButtonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {busy === 'save'
              ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              : <Save className="w-4 h-4" strokeWidth={1.5} />}
            Save model
          </button>
        </div>
      </div>
    </div>
  );
};
