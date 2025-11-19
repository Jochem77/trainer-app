import React, { useState, useEffect } from "react";
import type { User as SupabaseUser } from '@supabase/supabase-js';
import schema from "../schema.json";
import SchemaEditor from './SchemaEditor';
import { supabase } from './lib/supabase';

type UserSchema = {
	id: number;
	schema_name: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
};

type SchemaSelectorProps = {
	userId: string;
};

const SchemaSelector: React.FC<SchemaSelectorProps> = ({ userId }) => {
	const [schemas, setSchemas] = useState<UserSchema[]>([]);
	const [selectedSchemaId, setSelectedSchemaId] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");

	useEffect(() => {
		const fetchSchemas = async () => {
			setLoading(true);
			setError("");
			
			// Try new format first (with is_active and schema_name)
			let { data, error } = await supabase
				.from("user_schemas")
				.select("id, schema_name, is_active, created_at, updated_at")
				.eq("user_id", userId)
				.order("updated_at", { ascending: false });
			
			// If new columns don't exist, fall back to legacy format
			if (error && (error.message.includes('is_active') || error.message.includes('schema_name') || error.message.includes('column') || error.code === '42703')) {
				console.warn('New columns not available, using legacy format for schema list');
				const legacyResult = await supabase
					.from("user_schemas")
					.select("id, schema_data, created_at, updated_at")
					.eq("user_id", userId)
					.order("updated_at", { ascending: false });
				
				if (legacyResult.data) {
					// Convert legacy format to new format for UI compatibility
					data = legacyResult.data.map((schema: { id: number; schema_data: unknown; schema_name?: string; created_at: string; updated_at: string; }) => ({
						...schema,
						schema_name: schema.schema_name || 'Mijn Trainingsschema',
						is_active: true // In legacy mode, assume single active schema
					}));
				}
				error = legacyResult.error;
			}
			
			if (error) {
				setError(error.message);
				console.error("Error fetching user schemas:", error);
			} else {
				setSchemas(data || []);
				// Set active schema as selected
				const activeSchema = data?.find(s => s.is_active) || data?.[0];
				if (activeSchema) {
					setSelectedSchemaId(activeSchema.id);
				}
			}
			setLoading(false);
		};
		fetchSchemas();
	}, [userId]);

	const handleSchemaSelect = async (schemaId: number) => {
		setSelectedSchemaId(schemaId);
		setMessage("");
		setError("");
		setLoading(true);

		try {
			// Try new format first (with is_active column)
			const deactivateResult = await supabase
				.from("user_schemas")
				.update({ is_active: false })
				.eq("user_id", userId);

			// If is_active column doesn't exist, skip this step (legacy mode)
			if (deactivateResult.error && (deactivateResult.error.message.includes('is_active') || deactivateResult.error.message.includes('column') || deactivateResult.error.code === '42703')) {
				console.warn('is_active column not available, skipping deactivation in legacy mode');
			} else if (deactivateResult.error) {
				throw deactivateResult.error;
			}

			// Try to activate selected schema (only if is_active column exists)
			const { error } = await supabase
				.from("user_schemas")
				.update({ is_active: true })
				.eq("id", schemaId);

			if (error && (error.message.includes('is_active') || error.message.includes('column') || error.code === '42703')) {
				console.warn('is_active column not available for activation, using legacy mode');
				setMessage("Schema geselecteerd! (legacy mode)");
			} else if (error) {
				setError(error.message);
			} else {
				setMessage("Schema geselecteerd!");
				// Refresh schemas to update UI
				const { data } = await supabase
					.from("user_schemas")
					.select("id, schema_name, is_active, created_at, updated_at")
					.eq("user_id", userId)
					.order("updated_at", { ascending: false });
				setSchemas(data || []);
			}
		} catch {
			setError("Fout bij selecteren van schema");
		}
		setLoading(false);
	};

	const createNewSchema = async () => {
		const schemaName = prompt("Naam voor het nieuwe schema:", `Schema ${schemas.length + 1}`);
		if (!schemaName) return;

		setLoading(true);
		try {
			// Try new format first (with schema_name and is_active)
			let { error } = await supabase
				.from("user_schemas")
				.insert({
					user_id: userId,
					schema_name: schemaName,
					schema_data: schema, // Use default schema from schema.json
					is_active: false
				})
				.select()
				.single();

			// If new columns don't exist, fall back to legacy format with embedded name
			if (error && (error.message.includes('schema_name') || error.message.includes('is_active') || error.message.includes('column') || error.code === '42703')) {
				console.warn('New columns not available, using legacy insert format with embedded name');
				
				// Store schema name inside the schema_data as metadata
				const dataWithName = {
					schema_name: schemaName,
					weeks: schema
				};
				
				const legacyResult = await supabase
					.from("user_schemas")
					.insert({
						user_id: userId,
						schema_data: dataWithName
					})
					.select()
					.single();
				error = legacyResult.error;
			}

			if (error) {
				setError(error.message);
			} else {
				setMessage(`Schema "${schemaName}" aangemaakt!`);
				// Refresh schemas with proper fallback
				const refreshResult = await supabase
					.from("user_schemas")
					.select("id, schema_name, is_active, created_at, updated_at")
					.eq("user_id", userId)
					.order("updated_at", { ascending: false });
				
				if (refreshResult.error && (refreshResult.error.message.includes('schema_name') || refreshResult.error.message.includes('is_active'))) {
					console.warn('Using legacy refresh after create');
					const legacyRefresh = await supabase
						.from("user_schemas")
						.select("id, schema_data, created_at, updated_at")
						.eq("user_id", userId)
						.order("updated_at", { ascending: false });
					
					if (legacyRefresh.data) {
						const convertedData = legacyRefresh.data.map((schema: { id: number; schema_data: unknown; schema_name?: string; created_at: string; updated_at: string; }) => ({
							...schema,
							schema_name: schema.schema_name || 'Mijn Trainingsschema',
							is_active: true
						}));
						setSchemas(convertedData);
					}
				} else if (refreshResult.data) {
					setSchemas(refreshResult.data);
				}
			}
		} catch {
			setError("Fout bij aanmaken van schema");
		}
		setLoading(false);
	};

	return (
		<div>
			{loading && <div style={{ color: '#6c757d', marginBottom: '8px' }}>Laden...</div>}
			{error && <div style={{ color: '#dc3545', marginBottom: '8px', fontSize: '14px' }}>{error}</div>}
			{message && <div style={{ color: '#28a745', marginBottom: '8px', fontSize: '14px' }}>{message}</div>}
			
			{schemas.length > 0 ? (
				<>
					<select 
						value={selectedSchemaId || ""} 
						onChange={(e) => handleSchemaSelect(Number(e.target.value))}
						style={{ 
							width: "100%", 
							padding: '10px 12px', 
							border: '1px solid #dee2e6',
							borderRadius: '6px',
							marginBottom: '12px',
							fontSize: '14px'
						}}
						disabled={loading}
					>
						<option value="" disabled>Kies een schema</option>
						{schemas.map(s => (
							<option key={s.id} value={s.id}>
								{s.schema_name} {s.is_active ? '(actief)' : ''}
							</option>
						))}
					</select>
					
					<button 
						onClick={createNewSchema}
						disabled={loading}
						style={{
							width: '100%',
							padding: '8px 12px',
							background: '#28a745',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							fontSize: '14px',
							cursor: 'pointer'
						}}
					>
						➕ Nieuw Schema
					</button>
				</>
			) : (
				<div style={{ 
					padding: '16px', 
					background: '#f8f9fa', 
					borderRadius: '8px', 
					textAlign: 'center',
					marginBottom: '12px'
				}}>
					<div style={{ marginBottom: '12px', color: '#6c757d' }}>Nog geen schema's</div>
					<button 
						onClick={createNewSchema}
						disabled={loading}
						style={{
							padding: '10px 16px',
							background: '#007bff',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							fontSize: '14px',
							cursor: 'pointer'
						}}
					>
						🎯 Eerste Schema Aanmaken
					</button>
				</div>
			)}
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

// weekPrograms will be managed as state in TrainingProgramDay component

// Startdatum: 30 augustus 2025 is week 1
const PROGRAM_START_DATE = new Date('2025-08-30'); // Friday, start of week 1

function getCurrentWeek(maxWeek: number = 12): number {
	const today = new Date();
	const diffTime = today.getTime() - PROGRAM_START_DATE.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	const currentWeek = Math.floor(diffDays / 7) + 1;
	return Math.max(1, Math.min(currentWeek, maxWeek)); // Begrensd tussen week 1 en maxWeek
}

function getWeekDateRange(week: number): { start: Date; end: Date; } {
	const startDate = new Date(PROGRAM_START_DATE);
	startDate.setDate(startDate.getDate() + (week - 1) * 7);
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 6);
	return { start: startDate, end: endDate };
}

function getAdjacentWeeks(week: number, maxWeek: number = 12) {
	const prev = week > 1 ? week - 1 : null;
	const next = week < maxWeek ? week + 1 : null;
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

const TrainingProgramDay: React.FC<{ setMenuOpen: (open: boolean) => void; user: SupabaseUser | null }> = ({ setMenuOpen, user }) => {
	// Week programs state with cloud sync
	const [weekPrograms, setWeekPrograms] = useState<WeekProgram[]>(schema as WeekProgram[]);
	const [schemaLoading, setSchemaLoading] = useState(false);

	// Load user schema from cloud
	useEffect(() => {
		const loadUserSchema = async () => {
			if (!user?.id) return;
			
			setSchemaLoading(true);
			try {
				const { data, error } = await supabase
					.from('user_schemas')
					.select('schema_data')
					.eq('user_id', user.id)
					.single();

				if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
					console.error('Error loading schema in main app:', error);
				} else if (data?.schema_data) {
					// Check if this is the new embedded format with schema_name
					let weekData = data.schema_data;
					
					// If schema_data has schema_name and weeks properties, it's the embedded format
					if (data.schema_data.schema_name && data.schema_data.weeks) {
						weekData = data.schema_data.weeks;
						console.log('Loaded user schema in main app (embedded format)');
					} else {
						console.log('Loaded user schema in main app (direct format)');
					}
					
					setWeekPrograms(weekData);
				}
			} catch (err) {
				console.error('Error loading schema in main app:', err);
			} finally {
				setSchemaLoading(false);
			}
		};

		loadUserSchema();
	}, [user?.id]);

	// Start met de huidige week
	const getInitialWeek = () => {
		return getCurrentWeek();
	};
	const [week, setWeek] = useState(getInitialWeek());
	
	// Update week wanneer schema is geladen en de huidige week buiten bereik valt
	useEffect(() => {
		if (weekPrograms.length > 0) {
			const maxWeek = Math.max(...weekPrograms.map(p => p.week));
			const calculatedWeek = getCurrentWeek(maxWeek);
			
			// Als de huidige week niet bestaat in het schema, ga naar de berekende week
			const weekExists = weekPrograms.some(p => p.week === week);
			if (!weekExists && calculatedWeek !== week) {
				setWeek(calculatedWeek);
			}
		}
	}, [weekPrograms, week]);
	
	const program = weekPrograms.find((p) => p.week === week);
	const maxWeek = weekPrograms.length > 0 ? Math.max(...weekPrograms.map(p => p.week)) : 12;
	const { prev, next } = getAdjacentWeeks(week, maxWeek);
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

	// Show loading while schema is being loaded
	if (schemaLoading) {
		return (
			<div style={{ maxWidth: 700, margin: "40px auto", padding: 32, borderRadius: 16, background: "#fff3f3", textAlign: "center" }}>
				<h2>Schema laden...</h2>
				<p>Persoonlijk trainingsschema ophalen...</p>
			</div>
		);
	}

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
			.top-sticky { position: sticky; top: 0; z-index: 20; background: linear-gradient(180deg,#dfe9ff,#eaf2ff 80%, #eaf2ff); padding: 12px 0 2px; box-shadow: 0 2px 8px #0001; }
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
			.topbar { display: grid; grid-template-columns: 60px 50px 1fr 50px; align-items: center; gap: 8px; padding: 8px 10px 0 10px; }
			.hamburger-col { justify-self: start; }
			.prev-col { justify-self: center; }
			.date-col { justify-self: center; }
			.next-col { justify-self: center; }
			.date-title { margin:0; text-align:center; font-family: inherit; text-shadow: 0 1px 0 #fff; }
			.date-line { font-size: 18px; font-weight: 800; line-height: 1.1; }
			.calories-line { font-size: 14px; font-weight: 600; color: #666; margin-top: 1px; }
			.nav-arrow { width:44px; height:48px; display:flex; align-items:center; justify-content:center; border:none; border-radius:12px; background:#2e7d32; color:#fff; font-size:20px; font-weight:800; cursor:pointer; box-shadow:0 3px 10px #0002; }
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

type LoginFormProps = {
	user: SupabaseUser | null;
};

const LoginForm: React.FC<LoginFormProps> = ({ user }) => {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setMessage("");
		setLoading(true);
		
		// Gebruik de correcte redirect URL voor GitHub Pages
		const redirectTo = window.location.hostname === 'localhost' 
			? window.location.origin 
			: 'https://jochem77.github.io/trainer-app/';
		
		const { error } = await supabase.auth.signInWithOtp({ 
			email,
			options: {
				emailRedirectTo: redirectTo
			}
		});
		setLoading(false);
		if (error) {
			setError(error.message);
		} else {
			setMessage("Er is een login-link naar je e-mail gestuurd.");
		}
	};

	if (user) {
		return null; // User info wordt nu getoond in de Account section
	}

	return (
		<div>
			<form onSubmit={handleLogin}>
				<div style={{ marginBottom: 12 }}>
					<input
						type="email"
						placeholder="Jouw e-mailadres"
						value={email}
						onChange={e => setEmail(e.target.value)}
						style={{ 
							width: '100%', 
							padding: '12px 16px', 
							border: '1px solid #e9ecef', 
							borderRadius: '8px',
							fontSize: '14px',
							boxSizing: 'border-box'
						}}
						required
						disabled={loading}
					/>
				</div>
				{error && <p className="error-text">{error}</p>}
				{message && <div style={{ color: '#28a745', fontSize: '13px', marginBottom: '12px', padding: '8px', background: '#d4edda', borderRadius: '6px' }}>{message}</div>}
				<button 
					type="submit" 
					className="menu-button primary"
					disabled={loading}
					style={{ margin: 0 }}
				>
					{loading ? "🔄 Versturen..." : "🔐 Stuur login-link"}
				</button>
			</form>
		</div>
	);
};




const App: React.FC = () => {
	const [user, setUser] = useState<SupabaseUser | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentPage, setCurrentPage] = useState<'training' | 'editor'>('training');

	// Debug user state
	console.log('App user state:', user);

	useEffect(() => {
		const getUser = async () => {
			const { data } = await supabase.auth.getUser();
			setUser(data.user);
		};
		getUser();

		// Luister naar auth events
		const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('Auth event:', event, 'Session:', session);
			setUser(session?.user ?? null);
			
			// Als we net zijn ingelogd via Magic Link, redirect naar dezelfde pagina maar zonder hash
			if (event === 'SIGNED_IN' && window.location.hash) {
				window.history.replaceState({}, document.title, window.location.pathname);
			}
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
				.drawer { position: fixed; top: 0; right: 0; height: 100%; width: 400px; max-width: 90vw; background: #fff; z-index: 50; box-shadow: -4px 0 24px #0004; display: flex; flex-direction: column; }
				.drawer-header { padding: 20px 24px; border-bottom: 2px solid #f0f2f5; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
				.drawer-content { padding: 0; overflow: auto; flex: 1; }
				.closebtn { background: rgba(255,255,255,0.2); border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; color: white; font-weight: 600; }
				.closebtn:hover { background: rgba(255,255,255,0.3); }
				.menu-section { padding: 20px 24px; border-bottom: 1px solid #f0f2f5; }
				.menu-section h3 { margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #2c3e50; display: flex; align-items: center; gap: 8px; }
				.menu-button { width: 100%; padding: 12px 16px; margin-bottom: 8px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; text-align: left; cursor: pointer; transition: all 0.2s; font-weight: 600; }
				.menu-button:hover { background: #e9ecef; transform: translateY(-1px); }
				.menu-button.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; }
				.menu-button.primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }
				.menu-button.danger { background: #dc3545; color: white; border: none; }
				.menu-button.danger:hover { background: #c82333; }
				.menu-button.success { background: #28a745; color: white; border: none; }
				.menu-button.success:hover { background: #218838; }
				.user-info { background: #f8f9fa; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
				.user-email { font-size: 13px; color: #6c757d; margin: 0; }
				.error-text { color: #dc3545; font-size: 13px; margin: 8px 0; }
			`}</style>
			<button className="hambtn" aria-label="Menu" onClick={() => setMenuOpen(true)}>☰</button>

			{menuOpen && (
				<>
					<div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />
					<aside className="drawer" role="dialog" aria-label="Menu">
						<div className="drawer-header">
							<div>
								<h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>🏃‍♂️ Trainer App</h2>
								<p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>Training Management</p>
							</div>
							<button className="closebtn" onClick={() => setMenuOpen(false)}>✕</button>
						</div>
						<div className="drawer-content">
							{/* Trainingsschema Selectie & Beheer - Bovenaan */}
							{user && (
								<div className="menu-section">
									<h3>🎯 Trainingsschema's</h3>
									<SchemaSelector userId={user.id} />
									
									{/* Schema Beheer knoppen direct onder selectie */}
									<div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f2f5' }}>
										<h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#6c757d' }}>Beheer:</h4>
										<button 
											className="menu-button primary"
											onClick={() => {
												setCurrentPage('editor');
												setMenuOpen(false);
											}}
										>
											📝 Bewerken
										</button>
										<button 
											className="menu-button success"
											onClick={() => {
												// TODO: Implement create new schema
												alert('Nieuw schema functie wordt binnenkort toegevoegd!');
											}}
										>
											➕ Nieuw
										</button>
										<button 
											className="menu-button"
											onClick={() => {
												// TODO: Implement copy schema
												alert('Schema kopiëren functie wordt binnenkort toegevoegd!');
											}}
										>
											📋 Kopiëren
										</button>
										<button 
											className="menu-button danger"
											onClick={() => {
												if (confirm('Weet je zeker dat je dit schema wilt verwijderen?')) {
													// TODO: Implement delete schema
													alert('Schema verwijderen functie wordt binnenkort toegevoegd!');
												}
											}}
										>
											🗑️ Verwijderen
										</button>
									</div>
								</div>
							)}

							{/* Account Section - Onderaan */}
							<div className="menu-section">
								<h3>👤 Account</h3>
								{user ? (
									<div>
										<div className="user-info">
											<p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#2c3e50' }}>Ingelogd</p>
											<p className="user-email">{user.email}</p>
										</div>
										<button 
											className="menu-button danger"
											onClick={async () => {
												await supabase.auth.signOut();
												setUser(null);
												setMenuOpen(false);
											}}
										>
											🚪 Uitloggen
										</button>
									</div>
								) : (
									<LoginForm user={user} />
								)}
							</div>

							{/* App Info */}
							<div className="menu-section">
								<h3>ℹ️ Informatie</h3>
								<div style={{ fontSize: '13px', color: '#6c757d', lineHeight: '1.5' }}>
									<p style={{ margin: '0 0 8px 0' }}>Versie: 2.0</p>
									<p style={{ margin: '0 0 8px 0' }}>Cloud Sync: {user ? '✅ Actief' : '❌ Login vereist'}</p>
									<p style={{ margin: '0' }}>Made with ❤️ for training</p>
								</div>
							</div>
						</div>
					</aside>
				</>
			)}

			{currentPage === 'training' ? (
				<TrainingProgramDay setMenuOpen={setMenuOpen} user={user} />
			) : (
				<div style={{ 
					width: '100vw', 
					height: '100vh', 
					overflow: 'auto', 
					background: 'linear-gradient(180deg,#dfe9ff,#eaf2ff)',
					position: 'fixed',
					top: 0,
					left: 0,
					zIndex: 1
				}}>
					<SchemaEditor onBack={() => setCurrentPage('training')} userId={user?.id} />
				</div>
			)}
		</>
	);
};

export default App;