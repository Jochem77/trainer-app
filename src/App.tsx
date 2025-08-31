import type { User as SupabaseUser } from '@supabase/supabase-js';
import schema from "../schema.json";
type Program = {
	id: number;
	name: string;
};

type ProgramSelectorProps = {
	userId: string;
};

const ProgramSelector: React.FC<ProgramSelectorProps> = ({ userId }) => {
	const [programs, setPrograms] = useState<Program[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		const fetchPrograms = async () => {
			setLoading(true);
			setError("");
			const { data, error } = await supabase.from("programs").select("id, name");
			if (error) setError(error.message);
			else setPrograms(data || []);
			setLoading(false);
		};
		fetchPrograms();
	}, []);

	const handleSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
		const id = Number(e.target.value);
		setSelectedId(id);
		setMessage("");
		setError("");
		setLoading(true);
		// Sla keuze op in user_program_state
		const { error } = await supabase.from("user_program_state").upsert({
			user_id: userId,
			program_id: id,
		});
		setLoading(false);
		if (error) setError(error.message);
		else setMessage("Keuze opgeslagen!");
	};

	return (
		<div style={{ maxWidth: 400, margin: "40px auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 }}>
			<h2>Kies een programma</h2>
			{loading && <div>Laden...</div>}
			{error && <div style={{ color: "red" }}>{error}</div>}
			<select value={selectedId ?? ""} onChange={handleSelect} style={{ width: "100%", padding: 8 }}>
				<option value="" disabled>Kies een programma</option>
				{programs.map(p => (
					<option key={p.id} value={p.id}>{p.name}</option>
				))}
			</select>
			{message && <div style={{ color: "green", marginTop: 8 }}>{message}</div>}
		</div>
	);
};

type Step =
	| {
			type: "steady";
			duration_min: number;
			speed_kmh: number;
			label: string;
			repeats: number;
		}
	| {
			type: "interval_pair";
			hard: { duration_min: number; speed_kmh: number; label: string };
			rest: { duration_min: number; speed_kmh: number; label: string };
			repeats: number;
		};

type DayProgram = {
	date: string;
	week: number;
	dayName: string;
	steps: Step[];
};

const allPrograms: DayProgram[] = schema as any;

function getAdjacentDates(date: string) {
	const idx = allPrograms.findIndex(p => p.date === date);
	const prev = idx > 0 ? allPrograms[idx - 1].date : null;
	const next = idx >= 0 && idx < allPrograms.length - 1 ? allPrograms[idx + 1].date : null;
	return { prev, next };
}

function flattenSteps(steps: Step[]) {
	const result: Array<{
		label: string;
		duration_min: number;
		speed_kmh: number | null;
		start_min: number;
		type: string;
	}> = [];
	let currentMin = 0;
	for (const step of steps) {
		if (step.type === "steady") {
			for (let i = 0; i < step.repeats; i++) {
				result.push({
					label: step.label,
					duration_min: step.duration_min,
					speed_kmh: step.speed_kmh,
					start_min: currentMin,
					type: "steady",
				});
				currentMin += step.duration_min;
			}
		} else if (step.type === "interval_pair") {
			for (let i = 0; i < step.repeats; i++) {
				result.push({
					label: step.hard.label,
					duration_min: step.hard.duration_min,
					speed_kmh: step.hard.speed_kmh,
					start_min: currentMin,
					type: "interval_hard",
				});
				currentMin += step.hard.duration_min;
				result.push({
					label: step.rest.label,
					duration_min: step.rest.duration_min,
					speed_kmh: step.rest.speed_kmh,
					start_min: currentMin,
					type: "interval_rest",
				});
				currentMin += step.rest.duration_min;
			}
		}
	}
	// Voeg een eindblok toe
	result.push({
		label: "Einde",
		duration_min: 0,
		speed_kmh: null,
		start_min: currentMin,
		type: "end"
	});
	return result;
}

const TrainingProgramDay: React.FC = () => {
	const todayStr = new Date().toISOString().slice(0, 10);
	const [date, setDate] = useState(todayStr);
	const program = allPrograms.find((p) => p.date === date);
	const { prev, next } = getAdjacentDates(date);
	const [timer, setTimer] = useState(0); // seconden
	const [running, setRunning] = useState(false);
	const timerRef = React.useRef<NodeJS.Timeout | null>(null);
	const stepsContainerRef = React.useRef<HTMLDivElement>(null);

		// Bepaal huidige stap
		const flatSteps = program ? flattenSteps(program.steps) : [];
		let currentIdx = 0;
		for (let i = 0; i < flatSteps.length; i++) {
			if (timer / 60 >= flatSteps[i].start_min) currentIdx = i;
			else break;
		}
		const currentStep = flatSteps[currentIdx] ?? { start_min: 0, duration_min: 0, speed_kmh: null, label: '', type: '' };
		const stepStartSec = Math.round(currentStep.start_min * 60);
		const stepEndSec = currentStep.duration_min > 0 ? stepStartSec + Math.round(currentStep.duration_min * 60) : stepStartSec;
		const stepTimeLeft = Math.max(0, stepEndSec - timer);

		// Piepjes in laatste 3 seconden
		useEffect(() => {
			if (running && stepTimeLeft > 0 && stepTimeLeft <= 3) {
				const beep = () => {
					const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
					const o = ctx.createOscillator();
					const g = ctx.createGain();
					o.type = 'sine';
					o.frequency.value = 1200;
					g.gain.value = 0.2;
					o.connect(g);
					g.connect(ctx.destination);
					o.start();
					o.stop(ctx.currentTime + 0.15);
					o.onended = () => ctx.close();
				};
				beep();
			}
		}, [stepTimeLeft, running]);

		// Wake Lock API: scherm actief houden
		useEffect(() => {
			let wakeLock: any;
			const requestWakeLock = async () => {
				try {
					// @ts-ignore
					if ('wakeLock' in navigator) {
						// @ts-ignore
						wakeLock = await navigator.wakeLock.request('screen');
					}
				} catch (err) {
					// Foutafhandeling optioneel
				}
			};
			requestWakeLock();
			return () => {
				if (wakeLock && wakeLock.release) wakeLock.release();
			};
		}, []);

	useEffect(() => {
		if (running) {
			timerRef.current = setInterval(() => {
				setTimer((t) => t + 1);
			}, 1000);
		} else if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [running]);

	useEffect(() => {
		setTimer(0);
		setRunning(false);
	}, [date]);

	useEffect(() => {
		if (stepsContainerRef.current) {
			const el = stepsContainerRef.current.querySelector(
				`[data-step-idx="${currentIdx}"]`
			) as HTMLDivElement | null;
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	}, [currentIdx]);

	// Timer display
	const timerMin = Math.floor(timer / 60);
	const timerSec = timer % 60;

	if (!program) {
		return (
			<div style={{ maxWidth: 700, margin: "40px auto", padding: 32, borderRadius: 16, background: "#fff3f3", textAlign: "center" }}>
				<h2>Geen programma voor deze dag</h2>
				<p>Er is geen trainingsprogramma gevonden voor deze dag.</p>
				<div style={{ marginTop: 24 }}>
					{prev && <button onClick={() => setDate(prev)} style={{ marginRight: 12, padding: '8px 18px', fontSize: 18, borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer' }}>← Vorige</button>}
					{next && <button onClick={() => setDate(next)} style={{ padding: '8px 18px', fontSize: 18, borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer' }}>Volgende →</button>}
				</div>
			</div>
		);
	}

	return (
		<div style={{ maxWidth: 700, margin: "40px auto", padding: 32, borderRadius: 16, background: "linear-gradient(135deg,#e0eafc,#cfdef3)", boxShadow: "0 4px 24px #0001", fontFamily: 'Inter, system-ui, sans-serif', position: 'relative' }}>
			{/* Timer, resterende tijd en knoppen sticky bovenaan */}
			<div style={{
				position: 'sticky',
				top: 0,
				zIndex: 10,
				background: 'rgba(255,255,255,0.95)',
				padding: '16px 0 12px 0',
				marginBottom: 16,
				display: 'flex',
				alignItems: 'center',
				gap: 24,
				borderBottom: '1px solid #e0e0e0',
			}}>
				<div style={{ fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: 2, minWidth: 120 }}>
					{String(timerMin).padStart(2, '0')}:{String(timerSec).padStart(2, '0')}
				</div>
				<div style={{ fontSize: 24, fontWeight: 600, color: stepTimeLeft <= 3 && running ? '#f44336' : '#1976d2', minWidth: 110 }}>
					{stepTimeLeft > 0 ? `Nog ${Math.floor(stepTimeLeft/60)}:${String(stepTimeLeft%60).padStart(2,'0')}` : 'Stap klaar'}
				</div>
				<button
					onClick={() => setRunning((r) => !r)}
					style={{ fontSize: 22, padding: '10px 32px', borderRadius: 8, border: 'none', background: running ? '#f44336' : '#4caf50', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: running ? '0 2px 8px #f4433622' : '0 2px 8px #4caf5022' }}
				>
					{running ? 'Stop' : 'Start'}
				</button>
				<button
					onClick={() => { setTimer(0); setRunning(false); }}
					style={{ fontSize: 22, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#1976d2', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px #1976d222' }}
				>
					Reset
				</button>
			</div>
			<h2 style={{ textAlign: "center", marginBottom: 8, fontFamily: 'inherit' }}>Programma voor {program.dayName} {program.date}</h2>
			<div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
				{prev && <button onClick={() => setDate(prev)} style={{ padding: '8px 18px', fontSize: 18, borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer' }}>← Vorige</button>}
				{next && <button onClick={() => setDate(next)} style={{ padding: '8px 18px', fontSize: 18, borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer' }}>Volgende →</button>}
			</div>
			<style>{`
				@keyframes blink-border {
					0% { box-shadow: 0 0 0 0 #43a047, 0 2px 8px #0001; }
					50% { box-shadow: 0 0 0 10px #43a04733, 0 2px 8px #0001; }
					100% { box-shadow: 0 0 0 0 #43a047, 0 2px 8px #0001; }
				}
			`}</style>
			<div ref={stepsContainerRef} style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 500, overflowY: 'auto', scrollBehavior: 'smooth' }}>
				{flatSteps.map((step, idx) => {
					// Voltooid, huidig, toekomst
					const isDone = idx < currentIdx;
					const isCurrent = idx === currentIdx;
					let background = '#f5f5f5';
					let borderLeft = '8px solid #888';
					let color = '#222';
					let styleExtra: React.CSSProperties = {};
					if (isDone) {
						background = '#e0e0e0';
						color = '#aaa';
					} else if (isCurrent) {
						background = step.type === 'steady' ? '#d0ffd0' : step.type === 'interval_hard' ? '#ffd0d0' : step.type === 'interval_rest' ? '#d0e6ff' : '#fffbe0';
						borderLeft = `12px solid #43a047`;
						styleExtra = {
							outline: '7px solid #43a047',
							outlineOffset: 0,
							animation: 'blink-border 1s infinite',
							zIndex: 2,
							color: '#111',
						};
					} else {
						background = step.type === 'steady' ? '#f0fff0' : step.type === 'interval_hard' ? '#ffe0e0' : step.type === 'interval_rest' ? '#e0f0ff' : '#f5f5f5';
						borderLeft = `8px solid ${step.type === 'steady' ? '#4caf50' : step.type === 'interval_hard' ? '#f44336' : step.type === 'interval_rest' ? '#2196f3' : '#888'}`;
					}
					return (
						<div
							key={idx}
							data-step-idx={idx}
							style={{
								display: "flex",
								alignItems: "center",
								background,
								borderLeft,
								borderRadius: 10,
								padding: 20,
								fontFamily: 'inherit',
								fontSize: 20,
								fontWeight: 500,
								transition: 'outline 0.2s, background 0.3s',
								color,
								...styleExtra,
							}}
						>
							<div style={{ width: 90, fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 22 }}>
								{String(Math.floor(step.start_min)).padStart(2, '0')}:{String(Math.round((step.start_min % 1) * 60)).padStart(2, '0')}
							</div>
							<div style={{ width: 90, textAlign: 'right', marginRight: 16 }}>
								{step.speed_kmh !== null ? `${step.speed_kmh} km/u` : ''}
							</div>
							<div style={{ width: 90, textAlign: 'right', marginRight: 16 }}>
								{step.duration_min > 0 ? `${step.duration_min} min` : ''}
							</div>
							<div style={{ flex: 1, fontWeight: 600 }}>{step.label}</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

type LoginFormProps = {
	user: SupabaseUser | null;
	setUser: React.Dispatch<React.SetStateAction<SupabaseUser | null>>;
};

const LoginForm: React.FC<LoginFormProps> = ({ user, setUser }) => {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);
		const { error } = await supabase.auth.signInWithOtp({ email });
		setLoading(false);
		if (error) {
			setError(error.message);
		} else {
			setMessage("Er is een login-link naar je e-mail gestuurd.");
		}
	};

	const handleLogout = async () => {
		await supabase.auth.signOut();
		setUser(null);
		setEmail("");
		setMessage("");
		setError("");
	};

	if (user) {
		return (
			<div style={{ maxWidth: 400, margin: "40px auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 }}>
				<h2>Ingelogd als {user.email}</h2>
				<button onClick={handleLogout} style={{ width: "100%", padding: 10 }}>Uitloggen</button>
			</div>
		);
	}

	return (
		<div style={{ maxWidth: 400, margin: "40px auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 }}>
			<h2>Magic Link Login</h2>
			<form onSubmit={handleLogin}>
				<div style={{ marginBottom: 16 }}>
					<label htmlFor="email">E-mail</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={e => setEmail(e.target.value)}
						style={{ width: "100%", padding: 8, marginTop: 4 }}
						required
						disabled={loading}
					/>
				</div>
				{error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
				{message && <div style={{ color: "green", marginBottom: 12 }}>{message}</div>}
				<button type="submit" style={{ width: "100%", padding: 10 }} disabled={loading}>
					{loading ? "Versturen..." : "Stuur login-link"}
				</button>
			</form>
		</div>
	);
};




const App: React.FC = () => {
	const [user, setUser] = useState<SupabaseUser | null>(null);

	useEffect(() => {
		const getUser = async () => {
			const { data } = await supabase.auth.getUser();
			setUser(data.user);
		};
		getUser();

		// Luister naar auth events
		const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});
		return () => {
			listener?.subscription.unsubscribe();
		};
	}, []);

	return (
		<>
			<LoginForm user={user} setUser={setUser} />
			{user && <ProgramSelector userId={user.id} />}
			<TrainingProgramDay />
		</>
	);
};

export default App;
