'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  alertDanger,
  alertSuccess,
  btnPrimary,
  formGroup,
  formLabel,
  pageHeaderRow,
  pageHeaderSubtitle,
  pageHeaderTitle,
  panel,
  panelBody,
} from '@/lib/ui';

interface TestStep {
  step: string;
  ok: boolean;
  detail: string;
}

interface TestResult {
  success: boolean;
  steps: TestStep[];
  message: string;
}

export default function EtimetrackTestPage() {
  const { authedFetch } = useAuth();
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');

  async function handleTest(e: FormEvent) {
    e.preventDefault();
    setTesting(true);
    setResult(null);
    setError('');
    try {
      const data = await authedFetch<TestResult>('/api/admin/etimetrack/test', {
        method: 'POST',
        body: JSON.stringify({
          base_url: baseUrl,
          username: username || null,
          password: password || null,
          device_serial: deviceSerial || null,
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div className={pageHeaderRow}>
        <div>
          <h1 className={pageHeaderTitle}>eTimeTrack Connection Test</h1>
          <p className={pageHeaderSubtitle}>Enter the eTimeTrackLite WebAPIService details and test reachability before saving them to the backend .env.</p>
        </div>
      </div>

      <div className={panel}>
        <div className={panelBody}>
          <form onSubmit={handleTest}>
            <div className={formGroup}>
              <label className={formLabel} htmlFor="et-base-url">Base URL</label>
              <input
                id="et-base-url"
                type="text"
                required
                placeholder="http://10.0.0.21:3366/WebAPIService.asmx"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div className={formGroup}>
              <label className={formLabel} htmlFor="et-username">Username</label>
              <input id="et-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className={formGroup}>
              <label className={formLabel} htmlFor="et-password">Password</label>
              <input id="et-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className={formGroup}>
              <label className={formLabel} htmlFor="et-serial">Device Serial (optional)</label>
              <input id="et-serial" type="text" value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} />
            </div>
            <button type="submit" className={btnPrimary} disabled={testing}>
              <span className="material-icons-round">{testing ? 'hourglass_empty' : 'wifi_tethering'}</span>
              <span>{testing ? 'Testing…' : 'Test Connection'}</span>
            </button>
          </form>

          {error && <div className={`${alertDanger} mt-5`}>{error}</div>}

          {result && (
            <div className={`${result.success ? alertSuccess : alertDanger} mt-5`}>
              <p className="font-semibold mb-2">{result.message}</p>
              <ul className="text-sm space-y-1">
                {result.steps.map((s, i) => (
                  <li key={i}>
                    {s.ok ? '✓' : '✗'} {s.step}: {s.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
