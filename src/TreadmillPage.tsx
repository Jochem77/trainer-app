import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── FTMS UUIDs ────────────────────────────────────────────────────────────
const FTMS_SERVICE = 0x1826;
const TREADMILL_DATA_UUID = 0x2acd;
const CONTROL_POINT_UUID = 0x2ad9;
const MACHINE_STATUS_UUID = 0x2ada;

// ─── FTMS Control Point Opcodes ────────────────────────────────────────────
const OP_SET_SPEED = 0x02;        // param: uint16 in 0.01 km/h
const OP_SET_INCLINATION = 0x03;  // param: int16 in 0.1%
const OP_START = 0x07;
const OP_STOP_PAUSE = 0x08;       // param: 0x01=stop, 0x02=pause

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type TreadmillData = {
  speed: number | null;       // km/h
  avgSpeed: number | null;    // km/h
  distance: number | null;    // m
  inclination: number | null; // %
  elapsedTime: number | null; // s
  heartRate: number | null;   // bpm
  calories: number | null;
};

function parseTreadmillData(buffer: DataView): TreadmillData {
  const data: TreadmillData = {
    speed: null,
    avgSpeed: null,
    distance: null,
    inclination: null,
    elapsedTime: null,
    heartRate: null,
    calories: null,
  };

  let offset = 0;
  const flags = buffer.getUint16(offset, true);
  offset += 2;

  // Bit 0: More Data flag — 0 means Instantaneous Speed is present
  if ((flags & 0x01) === 0) {
    data.speed = buffer.getUint16(offset, true) * 0.01;
    offset += 2;
  }

  // Bit 1: Average Speed
  if (flags & 0x02) {
    data.avgSpeed = buffer.getUint16(offset, true) * 0.01;
    offset += 2;
  }

  // Bit 2: Total Distance
  if (flags & 0x04) {
    data.distance = buffer.getUint16(offset, true) | (buffer.getUint8(offset + 2) << 16);
    offset += 3;
  }

  // Bit 3: Inclination and Ramp Angle
  if (flags & 0x08) {
    data.inclination = buffer.getInt16(offset, true) * 0.1;
    offset += 4; // inclination (2 bytes) + ramp angle (2 bytes)
  }

  // Bit 4: Elevation Gain
  if (flags & 0x10) {
    offset += 4; // Positive (2 bytes) + Negative (2 bytes)
  }

  // Bit 5: Instantaneous Pace
  if (flags & 0x20) {
    offset += 2;
  }

  // Bit 6: Average Pace
  if (flags & 0x40) {
    offset += 2;
  }

  // Bit 7: Expended Energy
  if (flags & 0x80) {
    data.calories = buffer.getUint16(offset, true);
    offset += 6; // Total Energy (2) + Energy per Hour (2) + Energy per Minute (1) + reserved (1)
  }

  // Bit 8: Heart Rate
  if (flags & 0x100) {
    data.heartRate = buffer.getUint8(offset);
    offset += 1;
  }

  // Bit 9: Metabolic Equivalent
  if (flags & 0x200) {
    offset += 1;
  }

  // Bit 10: Elapsed Time
  if (flags & 0x400) {
    data.elapsedTime = buffer.getUint16(offset, true);
    offset += 2;
  }

  return data;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type TreadmillPageProps = {
  onBack: () => void;
};

const TreadmillPage: React.FC<TreadmillPageProps> = ({ onBack }) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [treadmillData, setTreadmillData] = useState<TreadmillData>({
    speed: null, avgSpeed: null, distance: null,
    inclination: null, elapsedTime: null, heartRate: null, calories: null,
  });
  const [targetSpeed, setTargetSpeed] = useState(8.0);   // km/h
  const [targetInclination, setTargetInclination] = useState(0.0); // %
  const [machineRunning, setMachineRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const controlPointRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Handle disconnect event from device
  useEffect(() => {
    const device = deviceRef.current;
    if (!device) return;

    const onDisconnected = () => {
      setStatus('disconnected');
      setMachineRunning(false);
      controlPointRef.current = null;
      addLog('Loopband verbinding verbroken');
    };

    device.addEventListener('gattserverdisconnected', onDisconnected);
    return () => device.removeEventListener('gattserverdisconnected', onDisconnected);
  }, [status, addLog]);

  const connect = async () => {
    if (!('bluetooth' in navigator)) {
      setErrorMsg('Web Bluetooth wordt niet ondersteund in deze browser. Gebruik Chrome of Edge op desktop/Android.');
      setStatus('error');
      return;
    }

    try {
      setStatus('connecting');
      setErrorMsg('');
      addLog('Zoeken naar Bluetooth apparaten...');

      const device = await (navigator as Navigator & { bluetooth: { requestDevice: (opts: unknown) => Promise<BluetoothDevice> } }).bluetooth.requestDevice({
        filters: [{ services: [FTMS_SERVICE] }],
        optionalServices: [FTMS_SERVICE],
      });

      deviceRef.current = device;
      setDeviceName(device.name ?? 'Onbekend apparaat');
      addLog(`Gevonden: ${device.name ?? 'Onbekend'}`);

      const server = await device.gatt!.connect();
      addLog('GATT verbonden, services ophalen...');

      const service = await server.getPrimaryService(FTMS_SERVICE);

      // Treadmill Data notifications
      try {
        const treadmillChar = await service.getCharacteristic(TREADMILL_DATA_UUID);
        await treadmillChar.startNotifications();
        treadmillChar.addEventListener('characteristicvaluechanged', (event: Event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic;
          if (target.value) {
            const data = parseTreadmillData(target.value);
            setTreadmillData(data);
          }
        });
        addLog('Loopband data notificaties gestart');
      } catch {
        addLog('Waarschuwing: Treadmill Data karakteristiek niet beschikbaar');
      }

      // Machine Status notifications
      try {
        const statusChar = await service.getCharacteristic(MACHINE_STATUS_UUID);
        await statusChar.startNotifications();
        statusChar.addEventListener('characteristicvaluechanged', (event: Event) => {
          const target = event.target as BluetoothRemoteGATTCharacteristic;
          if (target.value) {
            const opCode = target.value.getUint8(0);
            if (opCode === 0x04) setMachineRunning(true);   // Started/Resumed
            if (opCode === 0x02 || opCode === 0x03) setMachineRunning(false); // Stopped/Paused
          }
        });
        addLog('Machine status notificaties gestart');
      } catch {
        addLog('Waarschuwing: Machine Status karakteristiek niet beschikbaar');
      }

      // Control Point
      try {
        const cpChar = await service.getCharacteristic(CONTROL_POINT_UUID);
        controlPointRef.current = cpChar;
        addLog('Control Point gereed');
      } catch {
        addLog('Waarschuwing: Control Point niet beschikbaar — bediening niet mogelijk');
      }

      setStatus('connected');
      addLog('✅ Verbonden met loopband!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('User cancelled')) {
        addLog('Verbinding geannuleerd');
        setStatus('disconnected');
      } else {
        setErrorMsg(message);
        setStatus('error');
        addLog(`Fout: ${message}`);
      }
    }
  };

  const disconnect = () => {
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    setStatus('disconnected');
    setMachineRunning(false);
    controlPointRef.current = null;
    addLog('Verbinding verbroken');
  };

  const sendCommand = async (bytes: number[]) => {
    if (!controlPointRef.current) {
      addLog('Geen control point verbinding');
      return;
    }
    try {
      await controlPointRef.current.writeValueWithResponse(new Uint8Array(bytes));
    } catch (err: unknown) {
      addLog(`Commando fout: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const startMachine = async () => {
    await sendCommand([OP_START]);
    setMachineRunning(true);
    addLog('Start commando gestuurd');
  };

  const pauseMachine = async () => {
    await sendCommand([OP_STOP_PAUSE, 0x02]);
    setMachineRunning(false);
    addLog('Pauze commando gestuurd');
  };

  const stopMachine = async () => {
    await sendCommand([OP_STOP_PAUSE, 0x01]);
    setMachineRunning(false);
    addLog('Stop commando gestuurd');
  };

  const setSpeed = async (speed: number) => {
    const clamped = Math.max(0, Math.min(30, speed));
    const val = Math.round(clamped * 100); // 0.01 km/h units
    await sendCommand([OP_SET_SPEED, val & 0xff, (val >> 8) & 0xff]);
    setTargetSpeed(clamped);
    addLog(`Snelheid ingesteld: ${clamped.toFixed(1)} km/u`);
  };

  const setInclination = async (incl: number) => {
    const clamped = Math.max(-3, Math.min(15, incl));
    const val = Math.round(clamped * 10); // 0.1% units, signed
    const lo = val & 0xff;
    const hi = (val >> 8) & 0xff;
    await sendCommand([OP_SET_INCLINATION, lo, hi]);
    setTargetInclination(clamped);
    addLog(`Helling ingesteld: ${clamped.toFixed(1)}%`);
  };

  const statusColor: Record<ConnectionStatus, string> = {
    disconnected: '#6c757d',
    connecting: '#fd7e14',
    connected: '#28a745',
    error: '#dc3545',
  };

  const statusLabel: Record<ConnectionStatus, string> = {
    disconnected: 'Niet verbonden',
    connecting: 'Verbinden...',
    connected: `Verbonden${deviceName ? ` — ${deviceName}` : ''}`,
    error: 'Fout',
  };

  return (
    <div style={{
      maxWidth: 560,
      margin: '0 auto',
      padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'linear-gradient(180deg,#dfe9ff,#eaf2ff)',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
        <button
          onClick={onBack}
          style={{ background: '#0d47a1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 20, cursor: 'pointer', boxShadow: '0 2px 8px #0003' }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0d47a1' }}>🏃 Loopband Bediening</h1>
      </div>

      {/* Connection Status */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 16,
        boxShadow: '0 2px 12px #0002',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColor[status],
              display: 'inline-block',
              boxShadow: status === 'connected' ? '0 0 6px #28a74588' : undefined,
            }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: statusColor[status] }}>{statusLabel[status]}</span>
          </div>
          {errorMsg && <div style={{ color: '#dc3545', fontSize: 13, marginTop: 4 }}>{errorMsg}</div>}
        </div>
        {status === 'disconnected' || status === 'error' ? (
          <button
            onClick={connect}
            style={{ background: '#0d47a1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            🔗 Verbinden
          </button>
        ) : status === 'connecting' ? (
          <span style={{ color: '#fd7e14', fontWeight: 600, fontSize: 14 }}>Bezig...</span>
        ) : (
          <button
            onClick={disconnect}
            style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            ✕ Verbreken
          </button>
        )}
      </div>

      {/* Live Data */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 16,
        boxShadow: '0 2px 12px #0002',
      }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>📊 Live Data</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'Snelheid', value: treadmillData.speed != null ? `${treadmillData.speed.toFixed(1)}` : '—', unit: 'km/u', color: '#1565c0' },
            { label: 'Helling', value: treadmillData.inclination != null ? `${treadmillData.inclination.toFixed(1)}` : '—', unit: '%', color: '#6a1b9a' },
            { label: 'Afstand', value: treadmillData.distance != null ? `${(treadmillData.distance / 1000).toFixed(2)}` : '—', unit: 'km', color: '#2e7d32' },
            { label: 'Tijd', value: treadmillData.elapsedTime != null ? formatTime(treadmillData.elapsedTime) : '—', unit: '', color: '#e65100' },
            { label: 'Hartslag', value: treadmillData.heartRate != null ? `${treadmillData.heartRate}` : '—', unit: 'bpm', color: '#c62828' },
            { label: 'Calorieën', value: treadmillData.calories != null ? `${treadmillData.calories}` : '—', unit: 'kcal', color: '#f57f17' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ textAlign: 'center', background: '#f8f9ff', borderRadius: 10, padding: '10px 6px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              {unit && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{unit}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Controls — only shown when connected */}
      {status === 'connected' && (
        <>
          {/* Start / Pause / Stop */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 16,
            boxShadow: '0 2px 12px #0002',
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>⚙️ Bediening</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={startMachine}
                disabled={machineRunning}
                style={{
                  flex: 1, padding: '14px 8px', fontWeight: 800, fontSize: 16,
                  background: machineRunning ? '#ccc' : '#2e7d32', color: '#fff',
                  border: 'none', borderRadius: 10, cursor: machineRunning ? 'default' : 'pointer',
                  boxShadow: '0 2px 8px #0002',
                }}
              >
                ▶ Start
              </button>
              <button
                onClick={pauseMachine}
                disabled={!machineRunning}
                style={{
                  flex: 1, padding: '14px 8px', fontWeight: 800, fontSize: 16,
                  background: !machineRunning ? '#ccc' : '#ff9800', color: '#fff',
                  border: 'none', borderRadius: 10, cursor: !machineRunning ? 'default' : 'pointer',
                  boxShadow: '0 2px 8px #0002',
                }}
              >
                ⏸ Pauze
              </button>
              <button
                onClick={stopMachine}
                style={{
                  flex: 1, padding: '14px 8px', fontWeight: 800, fontSize: 16,
                  background: '#dc3545', color: '#fff',
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                  boxShadow: '0 2px 8px #0002',
                }}
              >
                ■ Stop
              </button>
            </div>
          </div>

          {/* Speed Control */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 16,
            boxShadow: '0 2px 12px #0002',
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>💨 Snelheid</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              {[-1, -0.5, -0.1].map(delta => (
                <button key={delta}
                  onClick={() => setSpeed(targetSpeed + delta)}
                  style={{ width: 52, height: 52, fontWeight: 800, fontSize: 16, background: '#e3f0ff', color: '#1565c0', border: '2px solid #90caf9', borderRadius: 10, cursor: 'pointer' }}
                >
                  {delta}
                </button>
              ))}
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#1565c0', lineHeight: 1 }}>{targetSpeed.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: '#888' }}>km/u</div>
              </div>
              {[0.1, 0.5, 1].map(delta => (
                <button key={delta}
                  onClick={() => setSpeed(targetSpeed + delta)}
                  style={{ width: 52, height: 52, fontWeight: 800, fontSize: 16, background: '#e3f0ff', color: '#1565c0', border: '2px solid #90caf9', borderRadius: 10, cursor: 'pointer' }}
                >
                  +{delta}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSpeed(targetSpeed)}
              style={{ width: '100%', marginTop: 14, padding: '12px', fontWeight: 800, fontSize: 15, background: '#1565c0', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
            >
              Stuur snelheid naar loopband
            </button>
          </div>

          {/* Inclination Control */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: 16,
            boxShadow: '0 2px 12px #0002',
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#333' }}>📐 Helling</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              {[-2, -1, -0.5].map(delta => (
                <button key={delta}
                  onClick={() => setInclination(targetInclination + delta)}
                  style={{ width: 52, height: 52, fontWeight: 800, fontSize: 16, background: '#f3e5f5', color: '#6a1b9a', border: '2px solid #ce93d8', borderRadius: 10, cursor: 'pointer' }}
                >
                  {delta}
                </button>
              ))}
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#6a1b9a', lineHeight: 1 }}>{targetInclination.toFixed(1)}</div>
                <div style={{ fontSize: 12, color: '#888' }}>%</div>
              </div>
              {[0.5, 1, 2].map(delta => (
                <button key={delta}
                  onClick={() => setInclination(targetInclination + delta)}
                  style={{ width: 52, height: 52, fontWeight: 800, fontSize: 16, background: '#f3e5f5', color: '#6a1b9a', border: '2px solid #ce93d8', borderRadius: 10, cursor: 'pointer' }}
                >
                  +{delta}
                </button>
              ))}
            </div>
            <button
              onClick={() => setInclination(targetInclination)}
              style={{ width: '100%', marginTop: 14, padding: '12px', fontWeight: 800, fontSize: 15, background: '#6a1b9a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
            >
              Stuur helling naar loopband
            </button>
          </div>
        </>
      )}

      {/* Log */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 2px 12px #0002',
      }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#555' }}>📋 Log</h3>
        {log.length === 0 ? (
          <div style={{ fontSize: 13, color: '#aaa' }}>Geen berichten</div>
        ) : (
          <div style={{ maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
            {log.map((entry, i) => <div key={i}>{entry}</div>)}
          </div>
        )}
      </div>

      {/* Web Bluetooth note */}
      <div style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 1.5 }}>
        Vereist Chrome of Edge op Windows/Android.<br />
        Loopband moet FTMS (Fitness Machine Service) ondersteunen.
      </div>
    </div>
  );
};

export default TreadmillPage;
