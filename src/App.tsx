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

type WeekProgram = {
	week: number;
	steps: Step[];
	cal?: number;
};

const weekPrograms: WeekProgram[] = schema as WeekProgram[];

// Startdatum: 30 augustus 2025 is week 1
const PROGRAM_START_DATE = new Date('2025-08-30'); // Friday, start of week 1

function getCurrentWeek(): number {
	const today = new Date();
	const diffTime = today.getTime() - PROGRAM_START_DATE.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	const currentWeek = Math.floor(diffDays / 7) + 1;
	return Math.max(1, Math.min(currentWeek, 12)); // Begrensd tussen week 1-12
}

function getWeekDateRange(week: number): { start: Date; end: Date; } {
	const startDate = new Date(PROGRAM_START_DATE);
	startDate.setDate(startDate.getDate() + (week - 1) * 7);
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 6);
	return { start: startDate, end: endDate };
}

function getAdjacentWeeks(week: number) {
	const prev = week > 1 ? week - 1 : null;
	const next = week < 12 ? week + 1 : null;
	return { prev, next };
}

function formatWeekNL(week: number, calValue?: number): { date: string; calories?: string } {
	const { start, end } = getWeekDateRange(week);
	
	const formatDate = (date: Date) => {
		const parts = new Intl.DateTimeFormat('nl-NL', {
			day: 'numeric',
			month: 'short',
		}).formatToParts(date);
		const day = parts.find(p => p.type === 'day')?.value ?? '';
		let month = parts.find(p => p.type === 'month')?.value ?? '';
		month = month.replace('.', '').toLowerCase();
		return `${day} ${month}`;
	};
	
	const startFormatted = formatDate(start);
	const endFormatted = formatDate(end);
	const formattedDate = `Week ${week}: ${startFormatted} - ${endFormatted}`;
	
	if (calValue !== undefined) {
		return { date: formattedDate, calories: `cal ±${calValue}` };
	}
	
	return { date: formattedDate };
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

const TrainingProgramDay: React.FC<{ setMenuOpen: (open: boolean) => void }> = ({ setMenuOpen }) => {
	// Start met de huidige week
	const getInitialWeek = () => {
		return getCurrentWeek();
	};
	const [week, setWeek] = useState(getInitialWeek());
	const program = weekPrograms.find((p) => p.week === week);
	const { prev, next } = getAdjacentWeeks(week);
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
	}, [week]);

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
				<h2>Geen programma voor deze week</h2>
				<p>Er is geen trainingsprogramma gevonden voor week {week}.</p>
				<div style={{ marginTop: 24 }}>
					{prev && <button onClick={() => setWeek(prev)} style={{ marginRight: 12, padding: '8px 18px', fontSize: 18, borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer' }}>← Vorige week</button>}
					{next && <button onClick={() => setWeek(next)} style={{ padding: '8px 18px', fontSize: 18, borderRadius: 8, border: 'none', background: '#eee', cursor: 'pointer' }}>Volgende week →</button>}
				</div>
			</div>
		);
	}

		return (
			<div className="app-root" style={{ maxWidth: 720, height: '100dvh', margin: "0 auto", padding: 16, paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', borderRadius: 16, background: "linear-gradient(180deg,#dfe9ff,#eaf2ff)", boxShadow: "0 4px 24px #0001", fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
				<style>{`
				:root { --safe-bottom: env(safe-area-inset-bottom, 0px); }
				@supports(height: 100dvh){ .app-root{ height: 100dvh; } }
					@keyframes blink-border {
						0% { box-shadow: 0 0 0 0 #43a047, 0 2px 8px #0001; }
						50% { box-shadow: 0 0 0 10px #43a04733, 0 2px 8px #0001; }
						100% { box-shadow: 0 0 0 0 #43a047, 0 2px 8px #0001; }
					}
			.top-sticky { position: sticky; top: 0; z-index: 20; background: linear-gradient(180deg,#dfe9ff,#eaf2ff 80%, #eaf2ff); padding: 4px 0 2px; box-shadow: 0 2px 8px #0001; }
			.status-card { background:#fff; border-radius:12px; box-shadow:0 6px 24px #0002; padding:10px 14px; margin:1px auto 1px; max-width:560px; --statSize: 48px; }
			.graph-card { background:#fff; border-radius:12px; box-shadow:0 6px 24px #0002; padding:1px 4px 1px; margin:1px auto; max-width:560px; }
			.graph-card-mobile { margin: 0 auto 0; padding: 0 1px 0; }
			@media (max-width: 768px) {
				.app-root { padding: 12px !important; paddingTop: calc(16px + env(safe-area-inset-top, 0px)) !important; paddingBottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important; }
				.graph-card-mobile { margin: 0 auto 0; padding: 0 0 0; border-radius: 8px; }
			}
			}
			.hambtn-grid { background: #0d47a1; color: #fff; border: none; border-radius: 8px; padding: 8px 10px; font-size: 20px; box-shadow: 0 2px 8px #0003; cursor: pointer; }
			.hambtn-inline { background: #0d47a1; color: #fff; border: none; border-radius: 8px; padding: 8px 10px; font-size: 20px; box-shadow: 0 2px 8px #0003; cursor: pointer; }
			.topbar { display: grid; grid-template-columns: 60px 50px 1fr 50px; align-items: center; gap: 8px; padding: 4px 10px 0 10px; }
			.hamburger-col { justify-self: start; }
			.prev-col { justify-self: center; }
			.date-col { justify-self: center; }
			.next-col { justify-self: center; }
			.date-title { margin:0; text-align:center; font-family: inherit; text-shadow: 0 1px 0 #fff; }
			.date-line { font-size: 18px; font-weight: 800; line-height: 1.1; }
			.calories-line { font-size: 14px; font-weight: 600; color: #666; margin-top: 1px; }
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
					.steps { display:flex; flex-direction:column; gap:12px; flex:1; min-height:0; overflow:auto; padding:6px 4px 8px; }
					.card { display:flex; align-items:center; background:#f5f7fb; border-radius:14px; padding:14px 16px; box-shadow:0 2px 10px #0001; border-left:10px solid #999; transition: all 0.2s ease; }
					.card:hover { background:#e8f0ff; box-shadow:0 4px 16px #0002; transform: translateY(-1px); }
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
					.actions-row { display:flex; gap:10px; margin:1px auto 1px; max-width:560px; }
				.actions-row .btn { flex:1; }
					.btn { width:100%; font-size:22px; padding:12px 20px; border:none; border-radius:12px; color:#fff; font-weight:800; box-shadow:0 3px 10px #0002; cursor:pointer; }
					.btn-start { background:#2e7d32; }
					.btn-pause { background:#ff9800; }
			@media (max-width:520px){ .status-card{--statSize:36px} .k-time{width:60px} .k-speed{width:70px} .k-dur{width:64px} }
			@media (max-width: 768px) {
				.graph-svg { height: 100px !important; }
			}
			@media (max-width: 480px) {
				.graph-svg { height: 90px !important; }
			}
				`}</style>
								<div className="top-sticky">
									<div className="topbar">
										<div className="hamburger-col">
											<button className="hambtn-grid" aria-label="Menu" onClick={() => setMenuOpen(true)}>☰</button>
										</div>
										<div className="prev-col">
											<button
												className="nav-arrow"
												title="Vorige week"
												disabled={!prev}
												onClick={() => prev && setWeek(prev)}
											>
												←
											</button>
										</div>
										<div className="date-col">
											<div className="date-title">
												{(() => {
													const weekInfo = formatWeekNL(program.week, program.cal);
													return (
														<>
															<div className="date-line">{weekInfo.date}</div>
															{weekInfo.calories && <div className="calories-line">({weekInfo.calories})</div>}
														</>
													);
												})()}
											</div>
										</div>
										<div className="next-col">
											<button
												className="nav-arrow"
												title="Volgende week"
												disabled={!next}
												onClick={() => next && setWeek(next)}
											>
												→
											</button>
										</div>
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
																	className={`btn ${running ? 'btn-pause' : 'btn-start'}`}
																>
																	{running ? 'Pauze' : 'Start'}
																</button>
															</div>

																{/* Program graph: speed (y) over time (x) with live cursor */}
																{flatSteps.length > 1 && (
																	<div className="graph-card graph-card-mobile">
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
					
					const handleDoubleClick = () => {
						// Spring naar het begin van dit blok
						const targetTime = step.start_sec ?? Math.round(step.start_min * 60);
						setTimer(targetTime);
						// Update de timer referentie voor accurate tracking
						timerValRef.current = targetTime;
						if (running) {
							// Als de timer loopt, herstart de basis tijd
							baseTimeRef.current = Date.now() - targetTime * 1000;
						}
					};

					return (
									<div 
										key={idx} 
										data-step-idx={idx} 
										className={classNames}
										onDoubleClick={handleDoubleClick}
										style={{ cursor: 'pointer' }}
									>
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
	const minSpeed = 4; // Minimum y-axis value set to 4 km/u
	const maxSpeed = Math.max(minSpeed + 2, Math.ceil(maxSpeedRaw + 0.5)); // Ensure at least 2 km/u above minimum
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
	const vbH = 200;
	const padL = 80;
	const padR = 12;
	const padT = 2;
	const padB = 8;
	const plotW = vbW - padL - padR;
	const plotH = vbH - padT - padB;

	const x = (t: number) => padL + (t / totalSec) * plotW;
	const y = (v: number) => padT + (1 - (Math.max(minSpeed, Math.min(v, maxSpeed)) - minSpeed) / (maxSpeed - minSpeed)) * plotH;

	const pointsAttr = segments.map(p => `${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
	const cursorT = Math.max(0, Math.min(currentSec, totalSec));
	const cursorX = x(cursorT);

	const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

	// y gridlines are computed inline below

	return (
	<svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height="120" className="graph-svg" role="img" aria-label="Programma snelheid grafiek" style={{ display: 'block' }}>
			{/* axes */}
			<line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#e5e7eb" strokeWidth={1} />
			<line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#e5e7eb" strokeWidth={1} />

			{/* y grid and labels */}
			{/* gridlines: min, mid, max; labels for min and max */}
			{([minSpeed, Math.ceil((minSpeed + maxSpeed)/2), maxSpeed] as number[]).map((v, i) => (
				<g key={i}>
					<line x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)} stroke="#eef2f7" strokeWidth={1} />
					{(v === minSpeed || v === maxSpeed) && (
						<text x={padL - 8} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={14} fill="#111827" fontWeight={800}>{v}</text>
					)}
				</g>
			))}

			{/* x label (left only) */}
			<text x={padL} y={padT + plotH + 12} textAnchor="start" fontSize={12} fill="#111827" fontWeight={800}>{fmtTime(0)}</text>

			{/* program curve */}
			<polyline fill="none" stroke="#2563eb" strokeWidth={3} strokeLinejoin="miter" strokeLinecap="butt" points={pointsAttr} />

			{/* red origin marker and current time cursor */}
			<circle cx={padL} cy={padT + plotH} r={4} fill="#ef4444" />
			<line x1={cursorX} y1={padT} x2={cursorX} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" />
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
				.hambtn { display: none; /* Verbergen omdat we hambtn-grid gebruiken */ }
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

			<TrainingProgramDay setMenuOpen={setMenuOpen} />
		</>
	);
};

export default App;