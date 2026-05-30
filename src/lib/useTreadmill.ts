import { useState, useRef, useCallback } from 'react';

const FTMS_SERVICE_SHORT = 0x1826;
const CONTROL_POINT_UUID = '00002ad9-0000-1000-8000-00805f9b34fb';

export type TreadmillStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useTreadmill() {
  const [btStatus, setBtStatus] = useState<TreadmillStatus>('disconnected');
  const [btDeviceName, setBtDeviceName] = useState('');
  const cpRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const writeCp = useCallback(async (bytes: number[]) => {
    const cp = cpRef.current;
    if (!cp) return;
    try {
      try { await cp.writeValueWithResponse(new Uint8Array(bytes)); }
      catch { await cp.writeValueWithoutResponse(new Uint8Array(bytes)); }
    } catch { /* ignore write errors */ }
  }, []);

  const connect = useCallback(async () => {
    if (!('bluetooth' in navigator)) {
      setBtStatus('error');
      return;
    }
    try {
      setBtStatus('connecting');
      const nav = navigator as Navigator & {
        bluetooth: { requestDevice: (opts: unknown) => Promise<BluetoothDevice> };
      };
      let device: BluetoothDevice;
      try {
        device = await nav.bluetooth.requestDevice({
          filters: [{ services: [FTMS_SERVICE_SHORT] }],
          optionalServices: [FTMS_SERVICE_SHORT],
        });
      } catch (e1) {
        const m = e1 instanceof Error ? e1.message : String(e1);
        if (m.toLowerCase().includes('cancel') || m.toLowerCase().includes('chosen')) throw e1;
        // Fallback: show all devices
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [FTMS_SERVICE_SHORT],
        });
      }

      deviceRef.current = device;
      setBtDeviceName(device.name ?? 'Onbekend');

      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('disconnected');
        cpRef.current = null;
        setBtDeviceName('');
      });

      const server = await device.gatt!.connect();
      const ftms = await server.getPrimaryService(FTMS_SERVICE_SHORT);
      const cp = await ftms.getCharacteristic(CONTROL_POINT_UUID);

      if (cp.properties.indicate || cp.properties.notify) {
        try { await cp.startNotifications(); } catch { /* ignore */ }
      }
      cpRef.current = cp;

      // Request Control — required before sending any FTMS commands
      try { await cp.writeValueWithResponse(new Uint8Array([0x00])); }
      catch { try { await cp.writeValueWithoutResponse(new Uint8Array([0x00])); } catch { /* ignore */ } }

      setBtStatus('connected');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('chosen')) {
        setBtStatus('disconnected');
      } else {
        setBtStatus('error');
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    deviceRef.current?.gatt?.disconnect();
    setBtStatus('disconnected');
    cpRef.current = null;
    setBtDeviceName('');
  }, []);

  /** Send target speed (km/h) to the treadmill via FTMS opcode 0x02 */
  const sendSpeed = useCallback(async (speed: number) => {
    if (!cpRef.current) return;
    const v = Math.round(Math.max(0, Math.min(30, speed)) * 100); // units: 0.01 km/h
    await writeCp([0x02, v & 0xff, (v >> 8) & 0xff]);
  }, [writeCp]);

  /** Send target inclination (%) to the treadmill via FTMS opcode 0x03 */
  const sendInclination = useCallback(async (incl: number) => {
    if (!cpRef.current) return;
    const clamped = Math.max(-3, Math.min(15, incl));
    const v = Math.round(clamped * 10); // units: 0.1%
    const v16 = v < 0 ? (0x10000 + v) : v;
    await writeCp([0x03, v16 & 0xff, (v16 >> 8) & 0xff]);
  }, [writeCp]);

  return { btStatus, btDeviceName, connect, disconnect, sendSpeed, sendInclination, writeCp };
}
