import type { User as SupabaseUser } from '@supabase/supabase-js';
import schema from "../schema.json";
type Program = {
	id: number;
	name: string;
};

type ProgramSelectorProps = {
	userId: string;
	compact?: boolean;
};

const ProgramSelector: React.FC<ProgramSelectorProps> = ({ userId, compact }) => {
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

	const boxStyle: React.CSSProperties = compact
		? { padding: 12 }
		: { maxWidth: 400, margin: "40px auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 } as React.CSSProperties;
	return (
		<div style={boxStyle}>
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

const allPrograms: DayProgram[] = schema as DayProgram[];

function getAdjacentDates(date: string) {
	const idx = allPrograms.findIndex(p => p.date === date);
	const prev = idx > 0 ? allPrograms[idx - 1].date : null;
	const next = idx >= 0 && idx < allPrograms.length - 1 ? allPrograms[idx + 1].date : null;
	return { prev, next };
}

function formatDateNL(isoDate: string): string {
	try {
		const d = new Date(`${isoDate}T00:00:00`);
		const parts = new Intl.DateTimeFormat('nl-NL', {
			weekday: 'long',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
		}).formatToParts(d);
		const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
		const day = parts.find(p => p.type === 'day')?.value ?? '';
		let month = parts.find(p => p.type === 'month')?.value ?? '';
		const year = parts.find(p => p.type === 'year')?.value ?? '';
		month = month.replace('.', '').toLowerCase();
		return `${weekday} ${day} ${month} ${year}`;
	} catch {
		return isoDate;
	}
}

function flattenSteps(steps: Step[]) {
	const result: Array<{
		label: string;
		duration_min: number;
		duration_sec: number;
		speed_kmh: number | null;
		start_min: number; // behoud voor UI weergave
		start_sec: number; // exacte start in seconden
		type: string;
		repIndex?: number; // 1-based nummer van herhaling voor interval stappen
	}> = [];
	let currentSec = 0;
	const toSec = (min: number) => Math.round(min * 60);
	for (const step of steps) {
		if (step.type === "steady") {
			for (let i = 0; i < step.repeats; i++) {
				const durSec = toSec(step.duration_min);
				result.push({
					label: step.label,
					duration_min: step.duration_min,
					duration_sec: durSec,
					speed_kmh: step.speed_kmh,
					start_min: currentSec / 60,
					start_sec: currentSec,
					type: "steady",
				});
				currentSec += durSec;
			}
		} else if (step.type === "interval_pair") {
			const showRep = step.repeats > 1;
			for (let i = 0; i < step.repeats; i++) {
				const repIndex = showRep ? i + 1 : undefined;
				const hardSec = toSec(step.hard.duration_min);
				result.push({
					label: step.hard.label,
					duration_min: step.hard.duration_min,
					duration_sec: hardSec,
					speed_kmh: step.hard.speed_kmh,
					start_min: currentSec / 60,
					start_sec: currentSec,
					type: "interval_hard",
					repIndex,
				});
				currentSec += hardSec;
				const restSec = toSec(step.rest.duration_min);
				result.push({
					label: step.rest.label,
					duration_min: step.rest.duration_min,
					duration_sec: restSec,
					speed_kmh: step.rest.speed_kmh,
					start_min: currentSec / 60,
					start_sec: currentSec,
					type: "interval_rest",
					repIndex,
				});
				currentSec += restSec;
			}
		}
	}
	// Voeg een eindblok toe
	result.push({
		label: "Einde",
		duration_min: 0,
		duration_sec: 0,
		speed_kmh: null,
		start_min: currentSec / 60,
		start_sec: currentSec,
		type: "end"
	});
	return result;
}

const TrainingProgramDay: React.FC = () => {
	const todayStr = new Date().toISOString().slice(0, 10);
	// Zoek eerst programma van vandaag, anders eerstvolgende na vandaag
	const getInitialDate = () => {
		const exact = allPrograms.find((p) => p.date === todayStr);
		if (exact) return exact.date;
		const future = allPrograms.find((p) => p.date > todayStr);
		if (future) return future.date;
		// fallback: laatste programma vóór vandaag
		if (allPrograms.length > 0) return allPrograms[allPrograms.length - 1].date;
		return todayStr;
	};
	const [date, setDate] = useState(getInitialDate());
	const program = allPrograms.find((p) => p.date === date);
	const { prev, next } = getAdjacentDates(date);
	const [timer, setTimer] = useState(0); // seconden (integer)
	const [running, setRunning] = useState(false);
	const timerRef = React.useRef<NodeJS.Timeout | null>(null);
	const baseTimeRef = React.useRef<number>(Date.now());
	const timerValRef = React.useRef<number>(0);
	const stepsContainerRef = React.useRef<HTMLDivElement>(null);
	const lastBeepKeyRef = React.useRef<string | null>(null);
	const prevLeftRef = React.useRef<{ idx: number; left: number }>({ idx: -1, left: Number.POSITIVE_INFINITY });
    

		// Bepaal huidige stap
		const flatSteps = program ? flattenSteps(program.steps) : [];
		let currentIdx = 0;
		for (let i = 0; i < flatSteps.length; i++) {
			if (timer / 60 >= flatSteps[i].start_min) currentIdx = i;
			else break;
		}
		const currentStep = flatSteps[currentIdx] ?? { start_min: 0, duration_min: 0, speed_kmh: null, label: '', type: '' };
	const stepStartSec = currentStep.start_sec ?? Math.round(currentStep.start_min * 60);
	const stepEndSec = currentStep.duration_sec && currentStep.duration_sec > 0 ? stepStartSec + currentStep.duration_sec : stepStartSec;
		const stepTimeLeft = Math.max(0, stepEndSec - timer);

		// Piepjes exact bij 5, 4, 3, 2 en 1 seconden resterend; triggert op thresholds om drift te opvangen
		useEffect(() => {
			if (!running) return;
			// Reset guards bij stapwissel
			if (prevLeftRef.current.idx !== currentIdx) {
				prevLeftRef.current = { idx: currentIdx, left: Number.POSITIVE_INFINITY };
				lastBeepKeyRef.current = null;
			}
			const prevLeft = prevLeftRef.current.left;
			let beepSec: 5 | 4 | 3 | 2 | 1 | null = null;
			if (prevLeft > 5 && stepTimeLeft <= 5 && stepTimeLeft > 0) beepSec = 5;
			else if (prevLeft > 4 && stepTimeLeft <= 4 && stepTimeLeft > 0) beepSec = 4;
			else if (prevLeft > 3 && stepTimeLeft <= 3 && stepTimeLeft > 0) beepSec = 3;
			else if (prevLeft > 2 && stepTimeLeft <= 2 && stepTimeLeft > 0) beepSec = 2;
			else if (prevLeft > 1 && stepTimeLeft <= 1 && stepTimeLeft > 0) beepSec = 1;

			if (beepSec !== null) {
				const key = `${currentIdx}:${beepSec}`;
				if (lastBeepKeyRef.current !== key) {
					lastBeepKeyRef.current = key;
					const AudioCtxCtor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
					if (AudioCtxCtor) {
						const ctx = new AudioCtxCtor();
						const o = ctx.createOscillator();
						const g = ctx.createGain();
						o.type = 'sine';
						o.frequency.value = 1200;
						// Maak 5s en 4s beeps stil (maar wel afgevuurd); 3/2/1 hoorbaar
						g.gain.value = (beepSec === 5 || beepSec === 4) ? 0 : 0.2;
						o.connect(g);
						g.connect(ctx.destination);
						o.start();
						o.stop(ctx.currentTime + 0.15);
						o.onended = () => ctx.close();
					}
				}
			}
			prevLeftRef.current = { idx: currentIdx, left: stepTimeLeft };
		}, [stepTimeLeft, running, currentIdx]);

		// Wake Lock API: scherm actief houden (her-acquire bij terugkeren naar app)
		useEffect(() => {
			let isMounted = true;
			let wakeLockRef: WakeLockSentinel | null = null;
			type NavigatorWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
			const hasWakeLock = (nav: Navigator): nav is NavigatorWakeLock =>
				'wakeLock' in nav && typeof (nav as NavigatorWakeLock).wakeLock?.request === 'function';
			const requestWakeLock = async () => {
				try {
					if (!isMounted) return;
					// Controleer ondersteuning en voorkom dubbele locks
					if (hasWakeLock(navigator) && !wakeLockRef) {
						const wl = await navigator.wakeLock!.request('screen');
						wakeLockRef = wl;
						wl.addEventListener('release', () => {
							// Bij release opnieuw proberen als we zichtbaar zijn
							wakeLockRef = null;
							if (document.visibilityState === 'visible') {
								requestWakeLock();
							}
						});
					}
				} catch {
					// Stil falen als Wake Lock niet beschikbaar is of geweigerd wordt
				}
			};

			const onVisibilityChange = () => {
				if (document.visibilityState === 'visible') {
					requestWakeLock();
				}
			};

			document.addEventListener('visibilitychange', onVisibilityChange);
			const onPageShow = () => onVisibilityChange();
			const onFocus = () => onVisibilityChange();
			window.addEventListener('pageshow', onPageShow);
			window.addEventListener('focus', onFocus);
			// Eerste aanvraag bij laden
			requestWakeLock();

			return () => {
				isMounted = false;
				document.removeEventListener('visibilitychange', onVisibilityChange);
				window.removeEventListener('pageshow', onPageShow);
				window.removeEventListener('focus', onFocus);
				if (wakeLockRef && 'release' in wakeLockRef) {
					wakeLockRef.release();
				}
			};
		}, []);

	useEffect(() => {
		if (running) {
			baseTimeRef.current = Date.now() - timerValRef.current * 1000;
			timerRef.current = setInterval(() => {
				const elapsed = Math.floor((Date.now() - baseTimeRef.current) / 1000);
				setTimer(elapsed);
			}, 200);
		} else if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [running]);

	// Sync state timer into ref to avoid adding it as a dependency
	useEffect(() => {
		timerValRef.current = timer;
	}, [timer]);

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
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}, [currentIdx]);

	// Timer display removed in favor of status card

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
			<div className="app-root" style={{ maxWidth: 720, height: '100vh', margin: "0 auto", padding: 16, paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', borderRadius: 16, background: "linear-gradient(180deg,#dfe9ff,#eaf2ff)", boxShadow: "0 4px 24px #0001", fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<style>{`
				:root { --safe-bottom: env(safe-area-inset-bottom, 0px); }
				@supports(height: 100dvh){ .app-root{ height: 100dvh; } }
					@keyframes blink-border {
						0% { box-shadow: 0 0 0 0 #43a047, 0 2px 8px #0001; }
						50% { box-shadow: 0 0 0 10px #43a04733, 0 2px 8px #0001; }
						100% { box-shadow: 0 0 0 0 #43a047, 0 2px 8px #0001; }
					}
			.top-sticky { position: sticky; top: 0; z-index: 20; background: linear-gradient(180deg,#dfe9ff,#eaf2ff 80%, #eaf2ff); padding: calc(4px + env(safe-area-inset-top, 0px)) 0 6px; box-shadow: 0 2px 8px #0001; }
			.status-card { background:#fff; border-radius:12px; box-shadow:0 6px 24px #0002; padding:10px 14px; margin:6px auto 4px; max-width:560px; --statSize: 48px; }
			.graph-card { background:#fff; border-radius:12px; box-shadow:0 6px 24px #0002; padding:8px 10px; margin:6px auto; max-width:560px; }
			.topbar { display:flex; align-items:center; justify-content:space-between; gap:8px; padding: 8px 10px 0 56px; }
			.date-title { margin:0; flex:1; text-align:center; font-family: inherit; text-shadow: 0 1px 0 #fff; font-size: 18px; font-weight: 800; }
			.nav-arrow { width:44px; height:36px; display:flex; align-items:center; justify-content:center; border:none; border-radius:12px; background:#2e7d32; color:#fff; font-size:20px; font-weight:800; cursor:pointer; box-shadow:0 3px 10px #0002; }
			.nav-arrow:disabled { opacity: .4; cursor: default; }
			.status-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
					.status-col { flex:1; text-align:center; }
			.status-col h4 { margin:0 0 2px; font-size:14px; font-weight:800; color:#111; }
			.status-col small { display:none; }
			.status-col .time { font-variant-numeric:tabular-nums; font-weight:900; font-size:var(--statSize); line-height:1; }
					.time-step { color:#2e7d32; }
					.time-total { color:#1565c0; }
			.speed { text-align:center; margin:6px 0 0; }
			.speed small { display:block; font-size:11px; color:#777; margin-bottom:0; }
			.speed .value { font-size:var(--statSize); font-weight:900; letter-spacing:1px; }
			.speed .value .next-speed { color:#2e7d32; font-weight:800; font-size: calc(var(--statSize) * 0.6); }
			.current-label { text-align:center; margin-top:4px; font-weight:800; font-size:18px; }
					.steps { display:flex; flex-direction:column; gap:12px; flex:1; min-height:0; overflow:auto; padding:8px 4px 12px; }
					.card { display:flex; align-items:center; background:#f5f7fb; border-radius:14px; padding:14px 16px; box-shadow:0 2px 10px #0001; border-left:10px solid #999; }
					.card { scroll-margin-top: 16px; }
					.done { opacity:.55; filter:grayscale(.2); }
					.cur { animation: blink-border 1s infinite; outline:6px solid #43a047; outline-offset:0; z-index:1; }
				.k-time { width:68px; font-variant-numeric:tabular-nums; font-weight:800; font-size:20px; }
				.k-speed { width:80px; text-align:right; margin-right:8px; color:#0d47a1; font-weight:600; }
				.k-dur { width:72px; text-align:right; margin-right:8px; color:#0d47a1; font-weight:600; }
				.k-label { flex:1; font-weight:700; min-width:0; }
					.b-steady { background:#e8f8ea; border-left-color:#2e7d32; }
					.b-hard { background:#fdecec; border-left-color:#c62828; }
					.b-rest { background:#e8f1ff; border-left-color:#1976d2; }
				/* bottom-actions removed (buttons moved under status card) */
				.actions-row { display:flex; gap:10px; margin:8px auto 6px; max-width:560px; }
				.actions-row .btn { flex:1; }
					.btn { width:100%; font-size:22px; padding:12px 20px; border:none; border-radius:12px; color:#fff; font-weight:800; box-shadow:0 3px 10px #0002; cursor:pointer; }
					.btn-start { background:#2e7d32; }
					.btn-stop { background:#c62828; }
					.btn-reset { background:#1976d2; }
			@media (max-width:520px){ .status-card{--statSize:36px} .k-time{width:60px} .k-speed{width:70px} .k-dur{width:64px} }
				`}</style>
								<div className="top-sticky">
									<div className="topbar">
										<button
											className="nav-arrow"
											title="Vorige dag"
											disabled={!prev}
											onClick={() => prev && setDate(prev)}
										>
											←
										</button>
										<h2 className="date-title">{formatDateNL(program.date)}</h2>
										<button
											className="nav-arrow"
											title="Volgende dag"
											disabled={!next}
											onClick={() => next && setDate(next)}
										>
											→
										</button>
									</div>
							{/* Status card */}
							{(() => {
					const totalDurationSec = flatSteps.length ? Math.round(flatSteps[flatSteps.length - 1].start_min * 60) : 0;
					const totalTimeLeft = Math.max(0, totalDurationSec - timer);
					const fmt = (s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
								const speedText = currentStep.speed_kmh != null ? `${currentStep.speed_kmh} km/u` : '-';
								const nextStep = flatSteps[currentIdx + 1];
								const nextSpeed = nextStep && nextStep.speed_kmh != null ? `${nextStep.speed_kmh} km/u` : null;
								const currentLabel = currentStep.label + (currentStep.repIndex ? ` ${currentStep.repIndex}` : '');
								return (
									<div className="status-card">
														<div className="status-top">
															<div className="status-col">
																<h4>stap</h4>
																<div className="time time-step">{fmt(stepTimeLeft)}</div>
															</div>
															<div className="status-col">
																<h4>totaal</h4>
																<div className="time time-total">{fmt(totalTimeLeft)}</div>
															</div>
														</div>
														<div className="speed">
															<div className="value">{speedText}{nextSpeed ? <span className="next-speed"> (→ {nextSpeed})</span> : null}</div>
														</div>
																		<div className="current-label">{currentLabel}</div>
									</div>
																);
							})()}
															{/* Actions directly under status card */}
															<div className="actions-row actions-under-card">
																<button
																	onClick={() => setRunning((r) => !r)}
																	className={`btn ${running ? 'btn-stop' : 'btn-start'}`}
																>
																	{running ? 'Stop' : 'Start'}
																</button>
																<button
																	onClick={() => { setTimer(0); setRunning(false); }}
																	className="btn btn-reset"
																>
																	Reset
																</button>
															</div>

																{/* Program graph: speed (y) over time (x) with live cursor */}
																{flatSteps.length > 1 && (
																	<div className="graph-card">
																		<ProgramGraph steps={flatSteps} currentSec={timer} />
																	</div>
																)}
						</div>

				{/* Navigatie verplaatst naar topbar */}

				<div ref={stepsContainerRef} className="steps">
				{flatSteps.map((step, idx) => {
					// Voltooid, huidig, toekomst
					const isDone = idx < currentIdx;
					const isCurrent = idx === currentIdx;
								let classNames = 'card';
								if (isDone) classNames += ' done';
								if (isCurrent) classNames += ' cur';
								if (step.type === 'steady') classNames += ' b-steady';
								else if (step.type === 'interval_hard') classNames += ' b-hard';
								else if (step.type === 'interval_rest') classNames += ' b-rest';
					return (
									<div key={idx} data-step-idx={idx} className={classNames}>
										<div className="k-time">
											{String(Math.floor((step.start_sec ?? Math.round(step.start_min * 60)) / 60)).padStart(2, '0')}:{String(((step.start_sec ?? Math.round(step.start_min * 60)) % 60)).padStart(2, '0')}
										</div>
										<div className="k-speed">
											{step.speed_kmh !== null ? `${step.speed_kmh} km/u` : ''}
										</div>
										<div className="k-dur">
											{step.duration_min > 0 ? `${step.duration_min} min` : ''}
										</div>
										  <div className="k-label">{step.label}{step.repIndex ? ` ${step.repIndex}` : ''}</div>
									</div>
					);
				})}
						</div>

						{/* Bottom sticky actions removed; buttons placed under status card */}
		</div>
	);
};

// Small SVG graph showing speed vs time as a step function with a moving cursor
type FlattenedStep = ReturnType<typeof flattenSteps>[number];

const ProgramGraph: React.FC<{ steps: FlattenedStep[]; currentSec: number }> = ({ steps, currentSec }) => {
	// Determine total seconds and max speed
	const totalSec = Math.max(
		0,
		...steps.map(s => (s.duration_sec && s.duration_sec > 0 ? (s.start_sec + s.duration_sec) : s.start_sec))
	);
	const speeds = steps.map(s => s.speed_kmh ?? 0);
	const maxSpeedRaw = Math.max(0, ...speeds);
	const maxSpeed = maxSpeedRaw > 0 ? Math.ceil(maxSpeedRaw + 0.5) : 10; // nice headroom
	if (totalSec <= 0) return null;

	// Build step-function points: for each step with speed and duration, add (start, speed) and (end, speed)
	const segments: Array<{ t: number; v: number }> = [];
	for (const s of steps) {
		if (s.speed_kmh == null || !s.duration_sec || s.duration_sec <= 0) continue;
		const start = s.start_sec;
		const end = s.start_sec + s.duration_sec;
		segments.push({ t: start, v: s.speed_kmh });
		segments.push({ t: end, v: s.speed_kmh });
	}
	if (segments.length === 0) return null;

	// SVG coordinate system
	const vbW = 1000;
	const vbH = 180;
	const padL = 60;
	const padR = 16;
	const padT = 10;
	const padB = 28;
	const plotW = vbW - padL - padR;
	const plotH = vbH - padT - padB;

	const x = (t: number) => padL + (t / totalSec) * plotW;
	const y = (v: number) => padT + (1 - Math.max(0, Math.min(v, maxSpeed)) / maxSpeed) * plotH;

	const pointsAttr = segments.map(p => `${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
	const cursorT = Math.max(0, Math.min(currentSec, totalSec));
	const cursorX = x(cursorT);

	const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

	// Choose a few y ticks
	const yTicks = [0, Math.ceil(maxSpeed/2), maxSpeed];

	return (
		<svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height="160" role="img" aria-label="Programma snelheid grafiek">
			{/* axes */}
			<line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#c7d2fe" strokeWidth={2} />
			<line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#c7d2fe" strokeWidth={2} />

			{/* y grid and labels */}
			{yTicks.map((v, i) => (
				<g key={i}>
					<line x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)} stroke="#e5e7eb" strokeWidth={1} />
					<text x={padL - 8} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={12} fill="#374151" fontWeight={700}>{v}</text>
				</g>
			))}

			{/* x labels: start and end */}
			<text x={padL} y={padT + plotH + 18} textAnchor="start" fontSize={12} fill="#374151" fontWeight={700}>{fmtTime(0)}</text>
			<text x={padL + plotW} y={padT + plotH + 18} textAnchor="end" fontSize={12} fill="#374151" fontWeight={700}>{fmtTime(totalSec)}</text>

			{/* program curve */}
			<polyline fill="none" stroke="#2563eb" strokeWidth={3} points={pointsAttr} />

			{/* current time cursor */}
			<line x1={cursorX} y1={padT} x2={cursorX} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" />
		</svg>
	);
};

import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

type LoginFormProps = {
	user: SupabaseUser | null;
	setUser: React.Dispatch<React.SetStateAction<SupabaseUser | null>>;
	compact?: boolean;
};

const LoginForm: React.FC<LoginFormProps> = ({ user, setUser, compact }) => {
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

	const boxStyle: React.CSSProperties = compact
		? { padding: 12 }
		: { maxWidth: 400, margin: "40px auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 } as React.CSSProperties;

	if (user) {
		return (
			<div style={boxStyle}>
				<h2>Ingelogd als {user.email}</h2>
				<button onClick={handleLogout} style={{ width: "100%", padding: 10 }}>Uitloggen</button>
			</div>
		);
	}

	return (
		<div style={boxStyle}>
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
	const [menuOpen, setMenuOpen] = useState(false);

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
			{/* Hamburger menu button */}
			<style>{`
				.hambtn { position: fixed; top: calc(10px + env(safe-area-inset-top, 0px)); left: 10px; z-index: 50; background: #0d47a1; color: #fff; border: none; border-radius: 8px; padding: 8px 10px; font-size: 20px; box-shadow: 0 2px 8px #0003; cursor: pointer; }
				.drawer-backdrop { position: fixed; inset: 0; background: #0006; z-index: 49; }
				.drawer { position: fixed; top: 0; right: 0; height: 100%; width: 340px; max-width: 90vw; background: #fff; z-index: 50; box-shadow: -4px 0 16px #0004; display: flex; flex-direction: column; }
				.drawer-header { padding: 14px 16px; border-bottom: 1px solid #eee; display:flex; align-items:center; justify-content:space-between; }
				.drawer-content { padding: 8px 16px 16px; overflow: auto; }
				.closebtn { background: #e0e0e0; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer; }
			`}</style>
			<button className="hambtn" aria-label="Menu" onClick={() => setMenuOpen(true)}>☰</button>

			{menuOpen && (
				<>
					<div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
					<aside className="drawer" role="dialog" aria-label="Menu">
						<div className="drawer-header">
							<strong>Menu</strong>
							<button className="closebtn" onClick={() => setMenuOpen(false)}>Sluiten</button>
						</div>
						<div className="drawer-content">
							<LoginForm user={user} setUser={setUser} compact />
							{user && <ProgramSelector userId={user.id} compact />}
						</div>
					</aside>
				</>
			)}

			<TrainingProgramDay />
		</>
	);
};

export default App;