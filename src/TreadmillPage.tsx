import React, { useState, useRef, useCallback } from 'react';

// ─── FTMS UUIDs (full 128-bit form for matching) ──────────────────────────
const FTMS_SERVICE_SHORT = 0x1826;
const TREADMILL_DATA_UUID = '00002acd-0000-1000-8000-00805f9b34fb';
const CONTROL_POINT_UUID  = '00002ad9-0000-1000-8000-00805f9b34fb';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function toHex(dv: DataView): string {
  return Array.from({ length: dv.byteLength }, (_, i) =>
    dv.getUint8(i).toString(16).padStart(2, '0').toUpperCase()
  ).join(' ');
}

function parseTreadmillData(dv: DataView): Record<string, number | null> {
  const result: Record<string, number | null> = {
    speed: null, inclination: null, distance: null,
    elapsedTime: null, heartRate: null, calories: null,
  };
  if (dv.byteLength < 2) return result;
  const flags = dv.getUint16(0, true);
  let o = 2;
  const safe = (need: number) => o + need <= dv.byteLength;
  if ((flags & 0x01) === 0 && safe(2)) { result.speed = dv.getUint16(o, true) * 0.01; o += 2; }
  if ((flags & 0x02) && safe(2))       { o += 2; } // avg speed — skip
  if ((flags & 0x04) && safe(3))       { result.distance = dv.getUint16(o, true) | (dv.getUint8(o + 2) << 16); o += 3; }
  if ((flags & 0x08) && safe(4))       { result.inclination = dv.getInt16(o, true) * 0.1; o += 4; }
  if ((flags & 0x10) && safe(4))       { o += 4; }
  if ((flags & 0x20) && safe(2))       { o += 2; }
  if ((flags & 0x40) && safe(2))       { o += 2; }
  if ((flags & 0x80) && safe(6))       { result.calories = dv.getUint16(o, true); o += 6; }
  if ((flags & 0x100) && safe(1))      { result.heartRate = dv.getUint8(o); o += 1; }
  if ((flags & 0x200) && safe(1))      { o += 1; }
  if ((flags & 0x400) && safe(2))      { result.elapsedTime = dv.getUint16(o, true); o += 2; }
  return result;
}

// ─── Sub-components ────────────────────────────────────────────────────────

const Card: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 12px #0002' }}>
    {title && <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#333' }}>{title}</h3>}
    {children}
  </div>
);

const StatusDot: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const colors: Record<ConnectionStatus, string> = { disconnected: '#aaa', connecting: '#fd7e14', connected: '#28a745', error: '#dc3545' };
  const labels: Record<ConnectionStatus, string> = { disconnected: 'Niet verbonden', connecting: 'Verbinden…', connected: 'Verbonden', error: 'Fout' };
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[status], display: 'inline-block', boxShadow: status === 'connected' ? '0 0 6px #28a74588' : undefined }} />
      <span style={{ fontWeight: 700, color: colors[status], fontSize: 15 }}>{labels[status]}</span>
    </span>
  );
};

type AdjustRowProps = { value: number; unit: string; color: string; deltas: number[]; onSend: (v: number) => void };
const AdjustRow: React.FC<AdjustRowProps> = ({ value, unit, color, deltas, onSend }) => {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => { setLocal(value); }, [value]);
  const neg = deltas.filter(d => d < 0);
  const pos = deltas.filter(d => d > 0);
  const adjust = (d: number) => setLocal(v => Math.round((v + d) * 100) / 100);
  const btnBase: React.CSSProperties = { width: 50, height: 46, fontWeight: 700, fontSize: 13, background: '#f0f4ff', color, border: `2px solid ${color}55`, borderRadius: 8, cursor: 'pointer' };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
        {neg.map(d => <button key={d} onClick={() => adjust(d)} style={btnBase}>{d}</button>)}
        <div style={{ textAlign: 'center', minWidth: 76 }}>
          <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{local.toFixed(1)}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{unit}</div>
        </div>
        {pos.map(d => <button key={d} onClick={() => adjust(d)} style={btnBase}>+{d}</button>)}
      </div>
      <button
        onClick={() => onSend(local)}
        style={{ width: '100%', padding: '11px', fontWeight: 800, fontSize: 14, background: color, color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer' }}
      >
        Stuur {local.toFixed(1)} {unit} naar loopband
      </button>
    </>
  );
};

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' };
}

// ─── Main component ────────────────────────────────────────────────────────

type TreadmillPageProps = { onBack: () => void };

const TreadmillPage: React.FC<TreadmillPageProps> = ({ onBack }) => {
  const [status, setStatus]           = useState<ConnectionStatus>('disconnected');
  const [deviceName, setDeviceName]   = useState('');
  const [log, setLog]                 = useState<string[]>([]);
  const [liveData, setLiveData]       = useState<Record<string, number | null>>({});
  const [targetSpeed, setTargetSpeed] = useState(8.0);
  const [targetIncl, setTargetIncl]   = useState(0.0);
  const [hexInput, setHexInput]       = useState('');
  const [discoveredChars, setDiscoveredChars] = useState<Array<{ uuid: string; props: string[] }>>([]);

  const cpRef     = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const addLog = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [`[${t}] ${msg}`, ...prev].slice(0, 120));
  }, []);

  // ── Connect ──────────────────────────────────────────────────────────────
  const connect = async () => {
    if (!('bluetooth' in navigator)) {
      addLog('❌ Web Bluetooth niet ondersteund — gebruik Chrome of Edge op PC/Android');
      setStatus('error');
      return;
    }
    try {
      setStatus('connecting');
      addLog('Bluetooth scan gestart…');

      const nav = navigator as Navigator & {
        bluetooth: { requestDevice: (opts: unknown) => Promise<BluetoothDevice> };
      };

      // Try FTMS filter first; fall back to acceptAllDevices if nothing found
      let device: BluetoothDevice;
      try {
        device = await nav.bluetooth.requestDevice({
          filters: [{ services: [FTMS_SERVICE_SHORT] }],
          optionalServices: [FTMS_SERVICE_SHORT],
        });
      } catch (e1) {
        const m = e1 instanceof Error ? e1.message : String(e1);
        if (m.toLowerCase().includes('cancel') || m.toLowerCase().includes('chosen')) throw e1;
        addLog('Geen FTMS filter treffer, probeer "alle apparaten"…');
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [FTMS_SERVICE_SHORT],
        });
      }

      deviceRef.current = device;
      setDeviceName(device.name ?? 'Onbekend');
      addLog(`Apparaat: ${device.name ?? 'Onbekend'}`);

      device.addEventListener('gattserverdisconnected', () => {
        setStatus('disconnected');
        cpRef.current = null;
        addLog('Verbinding verbroken');
      });

      const server = await device.gatt!.connect();
      addLog('GATT verbonden ✓');

      // ── Enumerate all primary services ──────────────────────────────────
      try {
        const services = await server.getPrimaryServices();
        addLog(`${services.length} service(s):`);
        for (const svc of services) addLog(`  • ${svc.uuid}`);
      } catch {
        addLog('(Services enumerate niet gelukt — ga verder met FTMS)');
      }

      // ── Get FTMS service ────────────────────────────────────────────────
      let ftms: BluetoothRemoteGATTService;
      try {
        ftms = await server.getPrimaryService(FTMS_SERVICE_SHORT);
        addLog('FTMS service (0x1826) ✓');
      } catch {
        addLog('❌ FTMS service niet gevonden');
        setStatus('error');
        return;
      }

      // ── Enumerate all characteristics ────────────────────────────────────
      let chars: BluetoothRemoteGATTCharacteristic[] = [];
      try {
        chars = await ftms.getCharacteristics();
        addLog(`${chars.length} karakteristiek(en) in FTMS:`);
        const disc: Array<{ uuid: string; props: string[] }> = [];
        for (const c of chars) {
          const props = Object.entries(c.properties).filter(([, v]) => v).map(([k]) => k);
          addLog(`  • ${c.uuid}  [${props.join(', ')}]`);
          disc.push({ uuid: c.uuid, props });
        }
        setDiscoveredChars(disc);
      } catch {
        addLog('Karakteristieken enumerate mislukt');
      }

      // ── Subscribe to ALL notifiable characteristics ───────────────────────
      for (const c of chars) {
        if (!c.properties.notify && !c.properties.indicate) continue;
        try {
          await c.startNotifications();
          c.addEventListener('characteristicvaluechanged', (e: Event) => {
            const tgt = e.target as BluetoothRemoteGATTCharacteristic;
            if (!tgt.value) return;
            const hex = toHex(tgt.value);
            const shortId = tgt.uuid.slice(4, 8).toUpperCase();
            addLog(`📡 ${shortId}: ${hex}`);
            if (tgt.uuid === TREADMILL_DATA_UUID) {
              setLiveData(parseTreadmillData(tgt.value));
            }
          });
          addLog(`Notificaties ✓ ${c.uuid.slice(4, 8).toUpperCase()}`);
        } catch { /* skip */ }
      }

      // ── Setup control point ──────────────────────────────────────────────
      try {
        const cp = chars.find(c => c.uuid === CONTROL_POINT_UUID)
          ?? await ftms.getCharacteristic(CONTROL_POINT_UUID);

        if (cp.properties.indicate || cp.properties.notify) {
          try { await cp.startNotifications(); } catch { /* already started */ }
          cp.addEventListener('characteristicvaluechanged', (e: Event) => {
            const tgt = e.target as BluetoothRemoteGATTCharacteristic;
            if (!tgt.value) return;
            const hex = toHex(tgt.value);
            addLog(`📨 CP respons: ${hex}`);
            if (tgt.value.byteLength >= 3 && tgt.value.getUint8(0) === 0x80) {
              const op  = tgt.value.getUint8(1);
              const res = tgt.value.getUint8(2);
              const txt = ['', 'Succes ✓', 'Niet ondersteund', 'Ongeldige param', 'Mislukt', 'Controle niet toegestaan'][res] ?? `0x${res.toString(16)}`;
              addLog(`  → opcode 0x${op.toString(16).padStart(2,'0')}: ${txt}`);
            }
          });
        }

        cpRef.current = cp;

        // Request Control (0x00) — mandatory before any other command
        try {
          await cp.writeValueWithResponse(new Uint8Array([0x00]));
          addLog('Request Control (0x00) ✓');
        } catch {
          try {
            await cp.writeValueWithoutResponse(new Uint8Array([0x00]));
            addLog('Request Control (0x00) ✓ (without-response)');
          } catch (e3) {
            addLog(`⚠️ Request Control mislukt: ${e3 instanceof Error ? e3.message : e3}`);
          }
        }
      } catch {
        addLog('⚠️ Control Point niet gevonden — alleen uitlezen mogelijk');
      }

      setStatus('connected');
      addLog('✅ Verbonden!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('chosen')) {
        addLog('Verbinding geannuleerd');
        setStatus('disconnected');
      } else {
        addLog(`❌ ${msg}`);
        setStatus('error');
      }
    }
  };

  const disconnect = () => {
    deviceRef.current?.gatt?.disconnect();
    setStatus('disconnected');
    cpRef.current = null;
    addLog('Verbroken');
  };

  // ── Write to control point ───────────────────────────────────────────────
  const writeCp = async (bytes: number[]) => {
    const cp = cpRef.current;
    if (!cp) { addLog('Geen Control Point beschikbaar'); return; }
    const hex = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    try {
      try {
        await cp.writeValueWithResponse(new Uint8Array(bytes));
      } catch {
        await cp.writeValueWithoutResponse(new Uint8Array(bytes));
      }
      addLog(`→ Gestuurd: ${hex}`);
    } catch (err: unknown) {
      addLog(`❌ Write fout: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const sendSpeed = async (speed: number) => {
    const clamped = Math.max(0, Math.min(30, speed));
    const v = Math.round(clamped * 100);
    setTargetSpeed(clamped);
    addLog(`Snelheid → ${clamped.toFixed(1)} km/u  (val=${v}  bytes=02 ${(v & 0xff).toString(16).padStart(2,'0').toUpperCase()} ${((v >> 8) & 0xff).toString(16).padStart(2,'0').toUpperCase()})`);
    await writeCp([0x02, v & 0xff, (v >> 8) & 0xff]);
  };

  const sendInclination = async (incl: number) => {
    const clamped = Math.max(-3, Math.min(15, incl));
    const v = Math.round(clamped * 10);
    const v16 = v < 0 ? (0x10000 + v) : v;
    setTargetIncl(clamped);
    addLog(`Helling → ${clamped.toFixed(1)}%  (val=${v}  bytes=03 ${(v16 & 0xff).toString(16).padStart(2,'0').toUpperCase()} ${((v16 >> 8) & 0xff).toString(16).padStart(2,'0').toUpperCase()})`);
    await writeCp([0x03, v16 & 0xff, (v16 >> 8) & 0xff]);
  };

  const sendHex = async () => {
    const bytes = hexInput.trim().split(/[\s,;]+/).map(h => parseInt(h, 16)).filter(n => !isNaN(n) && n >= 0 && n <= 255);
    if (bytes.length === 0) { addLog('Ongeldige hex invoer'); return; }
    await writeCp(bytes);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px', fontFamily: 'Inter, system-ui, sans-serif', background: 'linear-gradient(180deg,#dfe9ff,#eaf2ff)', minHeight: '100vh', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingTop: 'calc(12px + env(safe-area-inset-top,0px))' }}>
        <button onClick={onBack} style={{ background: '#0d47a1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 8px #0003' }}>←</button>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0d47a1' }}>🏃 Loopband Bediening</h1>
      </div>

      {/* Connection card */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <StatusDot status={status} />
            {deviceName && <div style={{ fontSize: 12, color: '#777', marginTop: 3 }}>{deviceName}</div>}
          </div>
          {status === 'connected'
            ? <button onClick={disconnect} style={btnStyle('#dc3545')}>✕ Verbreken</button>
            : <button onClick={connect} disabled={status === 'connecting'} style={btnStyle('#0d47a1')}>
                {status === 'connecting' ? '⏳ Bezig…' : '🔗 Verbinden'}
              </button>
          }
        </div>
      </Card>

      {/* Live Data */}
      <Card title="📊 Live Data">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { k: 'speed',       label: 'Snelheid',  unit: 'km/u', color: '#1565c0', fmt: (v: number) => v.toFixed(1) },
            { k: 'inclination', label: 'Helling',   unit: '%',    color: '#6a1b9a', fmt: (v: number) => v.toFixed(1) },
            { k: 'distance',    label: 'Afstand',   unit: 'km',   color: '#2e7d32', fmt: (v: number) => (v / 1000).toFixed(2) },
            { k: 'elapsedTime', label: 'Tijd',      unit: '',     color: '#e65100', fmt: (v: number) => `${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}` },
            { k: 'heartRate',   label: 'Hartslag',  unit: 'bpm',  color: '#c62828', fmt: (v: number) => String(v) },
            { k: 'calories',    label: 'Calorieën', unit: 'kcal', color: '#f57f17', fmt: (v: number) => String(v) },
          ].map(({ k, label, unit, color, fmt }) => {
            const val = liveData[k];
            return (
              <div key={k} style={{ textAlign: 'center', background: '#f8f9ff', borderRadius: 10, padding: '10px 4px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>{val != null ? fmt(val) : '—'}</div>
                {unit && <div style={{ fontSize: 10, color: '#aaa' }}>{unit}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {status === 'connected' && (
        <>
          {/* Machine control */}
          <Card title="⚙️ Bediening">
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '▶ Start',  color: '#2e7d32', bytes: [0x07] },
                { label: '⏸ Pauze', color: '#ff9800', bytes: [0x08, 0x02] },
                { label: '■ Stop',   color: '#dc3545', bytes: [0x08, 0x01] },
              ].map(({ label, color, bytes }) => (
                <button key={label} onClick={() => writeCp(bytes)}
                  style={{ flex: 1, padding: '13px 4px', fontWeight: 800, fontSize: 15, background: color, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </Card>

          {/* Speed */}
          <Card title="💨 Snelheid">
            <AdjustRow value={targetSpeed} unit="km/u" color="#1565c0"
              deltas={[-1, -0.5, -0.1, 0.1, 0.5, 1]} onSend={sendSpeed} />
          </Card>

          {/* Inclination */}
          <Card title="📐 Helling">
            <AdjustRow value={targetIncl} unit="%" color="#6a1b9a"
              deltas={[-2, -1, -0.5, 0.5, 1, 2]} onSend={sendInclination} />
          </Card>

          {/* Raw hex command panel */}
          <Card title="🔧 Handmatig commando (hex bytes)">
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
              Bytes gescheiden door spaties, bijv. <code style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 4 }}>02 E8 03</code> = snelheid 10.0 km/u
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={hexInput} onChange={e => setHexInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendHex()}
                placeholder="00  02 DC 05  …"
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'monospace', fontSize: 14 }} />
              <button onClick={sendHex} style={btnStyle('#333')}>Stuur</button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: 'Req Control', bytes: '00' },
                { label: 'Reset',       bytes: '01' },
                { label: 'Start',       bytes: '07' },
                { label: 'Stop',        bytes: '08 01' },
                { label: '6 km/u',      bytes: '02 58 02' },
                { label: '8 km/u',      bytes: '02 20 03' },
                { label: '10 km/u',     bytes: '02 E8 03' },
                { label: '12 km/u',     bytes: '02 B0 04' },
                { label: 'Helling 0%',  bytes: '03 00 00' },
                { label: 'Helling 1%',  bytes: '03 0A 00' },
                { label: 'Helling 2%',  bytes: '03 14 00' },
              ].map(({ label, bytes }) => (
                <button key={label}
                  onClick={() => {
                    setHexInput(bytes);
                    const parsed = bytes.split(' ').map(h => parseInt(h, 16));
                    writeCp(parsed);
                  }}
                  style={{ padding: '5px 10px', fontSize: 11, background: '#f0f4ff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace' }}>
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Discovered characteristics */}
      {discoveredChars.length > 0 && (
        <Card title="🔍 Gevonden karakteristieken">
          {discoveredChars.map(c => (
            <div key={c.uuid} style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#1565c0', wordBreak: 'break-all' }}>{c.uuid}</span>
              <span style={{ color: '#888', whiteSpace: 'nowrap' }}>[{c.props.join(', ')}]</span>
            </div>
          ))}
        </Card>
      )}

      {/* Log */}
      <Card title="📋 Log">
        {log.length === 0
          ? <div style={{ fontSize: 13, color: '#aaa' }}>Geen berichten</div>
          : <>
              <button onClick={() => setLog([])} style={{ float: 'right', fontSize: 11, padding: '2px 8px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', marginTop: -4 }}>Wissen</button>
              <div style={{ maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, clear: 'both' }}>
                {log.map((entry, i) => (
                  <div key={i} style={{
                    color: entry.includes('❌') ? '#c62828'
                      : entry.includes('✅') || entry.includes('✓') ? '#2e7d32'
                      : entry.includes('📡') || entry.includes('📨') ? '#999'
                      : '#444'
                  }}>
                    {entry}
                  </div>
                ))}
              </div>
            </>
        }
      </Card>

      <div style={{ marginTop: 12, fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 1.5 }}>
        Vereist Chrome of Edge op Windows/Android.<br />
        Loopband moet Bluetooth FTMS (service 0x1826) ondersteunen.
      </div>
    </div>
  );
};

export default TreadmillPage;
