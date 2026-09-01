import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// Types voor grafiek
type FlattenedStep = {
	label: string;
	duration_min: number;
	duration_sec: number;
	speed_kmh: number | null;
	start_min: number;
	start_sec: number;
	type: string;
	repIndex?: number;
	incline_pct?: number;
};

export interface SimpleStep {
	type: 'steady' | 'interval_pair';
	repeats: number;
	// Voor steady type
	label?: string;
	speed_kmh?: number;
	duration_min?: number;
	speed_increase_kmh?: number;
	incline_pct?: number;
	// Voor interval_pair type
	hard?: {
		label: string;
		speed_kmh: number;
		duration_min: number;
		speed_increase_kmh?: number;
		incline_pct?: number;
		incline_increase_pct?: number;
	};
	rest?: {
		label: string;
		speed_kmh: number;
		duration_min: number;
		speed_increase_kmh?: number;
		incline_pct?: number;
		incline_increase_pct?: number;
	};
}

export interface WeekProgram {
	week: number;
	steps: SimpleStep[];
	cal: number;
}

interface LoadedStep {
	type?: string;
	label?: string;
	duration_min?: number;
	speed_kmh?: number;
	speed_increase_kmh?: number;
	incline_pct?: number;
	repeats?: number;
	hard?: {
		duration_min?: number;
		speed_kmh?: number;
		label?: string;
		speed_increase_kmh?: number;
		incline_pct?: number;
		incline_increase_pct?: number;
	};
	rest?: {
		duration_min?: number;
		speed_kmh?: number;
		label?: string;
		speed_increase_kmh?: number;
		incline_pct?: number;
		incline_increase_pct?: number;
	};
	tijd?: number;
	beschrijving?: string;
	cal?: number;
}

interface LoadedWeekProgram {
	week: number;
	steps: LoadedStep[];
	cal?: number;
}

interface SchemaEditorProps {
	userId: string | null | undefined;
	onBack: () => void;
}

const SchemaEditor = ({ userId, onBack }: SchemaEditorProps) => {
	const [weekPrograms, setWeekPrograms] = useState<WeekProgram[]>([
		{ 
			week: 1, 
			cal: 350,
			steps: [
				{ type: "steady", label: "Warming-up", speed_kmh: 6, duration_min: 5, repeats: 1 },
				{ type: "interval_pair", hard: { label: "Interval hard", speed_kmh: 10, duration_min: 1 }, rest: { label: "Interval rust", speed_kmh: 6, duration_min: 2 }, repeats: 8 },
				{ type: "steady", label: "Extra blok", speed_kmh: 6.5, duration_min: 10, repeats: 1 },
				{ type: "steady", label: "Cooling down", speed_kmh: 6, duration_min: 5, repeats: 1 }
			]
		},
		{ 
			week: 2, 
			cal: 500,
			steps: [
				{ type: "steady", label: "Warming-up", speed_kmh: 6, duration_min: 6, repeats: 1 },
				{ type: "interval_pair", hard: { label: "Interval hard", speed_kmh: 10, duration_min: 1 }, rest: { label: "Interval rust", speed_kmh: 6, duration_min: 1.5 }, repeats: 10 },
				{ type: "steady", label: "Extra blok", speed_kmh: 6.5, duration_min: 8, repeats: 1 },
				{ type: "steady", label: "Cooling down", speed_kmh: 6, duration_min: 5, repeats: 1 }
			]
		},
		{ week: 3, steps: [{ type: "steady", label: "Endurance run", speed_kmh: 10, duration_min: 45, repeats: 1 }], cal: 120 },
		{ week: 4, steps: [{ type: "steady", label: "Recovery", speed_kmh: 7, duration_min: 30, repeats: 1 }], cal: 60 },
		{ week: 5, steps: [{ type: "steady", label: "Long run", speed_kmh: 9, duration_min: 60, repeats: 1 }], cal: 150 },
		{ week: 6, steps: [{ type: "steady", label: "Tempo run", speed_kmh: 11, duration_min: 40, repeats: 1 }], cal: 180 },
		{ week: 7, steps: [{ type: "interval_pair", hard: { label: "Hill Hard", speed_kmh: 10, duration_min: 1 }, rest: { label: "Hill Rest", speed_kmh: 6, duration_min: 2 }, repeats: 6 }], cal: 140 },
		{ week: 8, steps: [{ type: "interval_pair", hard: { label: "Speed Hard", speed_kmh: 14, duration_min: 1 }, rest: { label: "Speed Rest", speed_kmh: 6, duration_min: 1 }, repeats: 8 }], cal: 100 },
		{ week: 9, steps: [{ type: "steady", label: "Long steady", speed_kmh: 9, duration_min: 70, repeats: 1 }], cal: 200 },
		{ week: 10, steps: [{ type: "interval_pair", hard: { label: "Race Hard", speed_kmh: 13, duration_min: 2 }, rest: { label: "Race Rest", speed_kmh: 7, duration_min: 1 }, repeats: 3 }], cal: 160 },
		{ week: 11, steps: [{ type: "steady", label: "Taper", speed_kmh: 8, duration_min: 30, repeats: 1 }], cal: 110 },
		{ week: 12, steps: [{ type: "steady", label: "Peak week", speed_kmh: 12, duration_min: 50, repeats: 1 }], cal: 220 }
	]);
	const [selectedWeek, setSelectedWeek] = useState<number>(1);
	const [schemaName, setSchemaName] = useState<string>('Mijn Trainingsschema');
	const [startDate, setStartDate] = useState<string>('2025-08-31');
	const [weightKg, setWeightKg] = useState<number>(75);
	const [hasChanges, setHasChanges] = useState(false);
	const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | ''>('');
	const [saveError, setSaveError] = useState<string>('');

	const currentProgram = weekPrograms.find(p => p.week === selectedWeek);

	// Load user schema when component mounts
	useEffect(() => {
		const loadUserSchema = async () => {
			if (!userId) return;
			
			try {
				console.log('Loading active schema for user:', userId);
				
				// First try to get the active schema with new columns
				let { data, error } = await supabase
					.from('user_schemas')
					.select('schema_data, schema_name, start_date, weight_kg')
					.eq('user_id', userId)
					.eq('is_active', true)
					.single();

				// If weight_kg column doesn't exist yet, retry without it
				if (error && (error.message.includes('weight_kg') || error.code === '42703')) {
					console.warn('weight_kg column not found, retrying without it');
					const retryResult = await supabase
						.from('user_schemas')
						.select('schema_data, schema_name, start_date')
						.eq('user_id', userId)
						.eq('is_active', true)
						.single();
					data = retryResult.data ? { ...retryResult.data, weight_kg: null } : null;
					error = retryResult.error;
				}

				// If is_active column doesn't exist, fall back to old approach
				if (error && (error.message.includes('is_active') || error.message.includes('column') || error.code === '42703')) {
					console.warn('is_active column not found, falling back to single schema approach');
					// Just get any schema for this user (old single-schema approach)
					const fallbackResult = await supabase
						.from('user_schemas')
						.select('schema_data, schema_name, start_date')
						.eq('user_id', userId)
						.single();
					
					data = fallbackResult.data ? { ...fallbackResult.data, weight_kg: null } : null;
					error = fallbackResult.error;
				}

				// If schema_name column doesn't exist either, use even older format
				if (error && (error.message.includes('schema_name') || error.message.includes('column') || error.code === '42703')) {
					console.warn('schema_name column issue, using oldest format');
					const oldFormatResult = await supabase
						.from('user_schemas')
						.select('schema_data')
						.eq('user_id', userId)
						.single();

					data = oldFormatResult.data ? { ...oldFormatResult.data, schema_name: 'Mijn Trainingsschema', start_date: '2025-08-31', weight_kg: null } : null;
					error = oldFormatResult.error;
				}

				if (error) {
					if (error.code === 'PGRST116') {
						console.log('No existing schema found, using defaults');
					} else {
						console.error('Error loading user schema:', error);
					}
					return;
				}

				if (data?.schema_data) {
					// Convert the loaded data to the expected format
					const convertedData = data.schema_data.map((week: LoadedWeekProgram) => ({
						week: week.week,
						cal: week.cal || 0,
						steps: week.steps.map((step: LoadedStep) => {
							// Handle interval_pair format
							if (step.type === 'interval_pair' && step.hard && step.rest) {
								return {
									type: 'interval_pair' as const,
									hard: {
										label: step.hard.label || 'Hard',
										speed_kmh: step.hard.speed_kmh || 10,
										duration_min: step.hard.duration_min || 1,
										speed_increase_kmh: step.hard.speed_increase_kmh || 0,
										incline_pct: step.hard.incline_pct ?? 0,
										incline_increase_pct: step.hard.incline_increase_pct ?? 0
									},
									rest: {
										label: step.rest.label || 'Rest',
										speed_kmh: step.rest.speed_kmh || 6,
										duration_min: step.rest.duration_min || 1,
										speed_increase_kmh: step.rest.speed_increase_kmh || 0,
										incline_pct: step.rest.incline_pct ?? 0,
										incline_increase_pct: step.rest.incline_increase_pct ?? 0
									},
									repeats: step.repeats || 1
								};
							}
							// Handle steady format (new and old)
							else if (step.type === 'steady' || step.label) {
								return {
									type: 'steady' as const,
									label: step.label || 'Training',
									speed_kmh: step.speed_kmh || 10,
									duration_min: step.duration_min || 30,
									speed_increase_kmh: step.speed_increase_kmh || 0,
									incline_pct: step.incline_pct ?? 0,
									repeats: step.repeats || 1
								};
							}
							// Handle old tijd/beschrijving format
							else if (step.tijd !== undefined) {
								return {
									type: 'steady' as const,
									label: step.beschrijving || 'Training',
									speed_kmh: 10,
									duration_min: Math.round((step.tijd || 0) / 60),
									repeats: 1
								};
							}
							// Fallback
							else {
								return {
									type: 'steady' as const,
									label: 'Default training',
									speed_kmh: 10,
									duration_min: 30,
									repeats: 1
								};
							}
						})
					}));
					
					setWeekPrograms(convertedData);
					// Set schema name from database column
					if (data.schema_name) {
						setSchemaName(data.schema_name);
					}
					// Set start date from database column
					if (data.start_date) {
						setStartDate(data.start_date);
					}
					// Set body weight from database column (used for calorie estimates)
					if (data.weight_kg) {
						setWeightKg(data.weight_kg);
					}
				}
			} catch (err) {
				console.error('Error in loadUserSchema:', err);
			}
		};

		loadUserSchema();
	}, [userId]);

	// Save changes effect
	// Manual save function
	const handleSave = async () => {
		if (!userId) return;

		try {
			setSaveStatus('saving');
			setSaveError('');
			
			// Validate data before saving
			const validationErrors: string[] = [];
			weekPrograms.forEach((week, weekIndex) => {
				if (!week.week || !Array.isArray(week.steps)) {
					validationErrors.push(`Week ${weekIndex}: Invalid week structure`);
				}
				week.steps.forEach((step, stepIndex) => {
					if (!step.type || !['steady', 'interval_pair'].includes(step.type)) {
						validationErrors.push(`Week ${week.week}, Step ${stepIndex}: Invalid type '${step.type}'`);
					}
					if (step.type === 'steady') {
						if (!step.label || typeof step.speed_kmh !== 'number' || typeof step.duration_min !== 'number') {
							validationErrors.push(`Week ${week.week}, Step ${stepIndex}: Missing steady fields`);
						}
					}
					if (step.type === 'interval_pair') {
						if (!step.hard || !step.rest) {
							validationErrors.push(`Week ${week.week}, Step ${stepIndex}: Missing hard/rest in interval_pair`);
						}
					}
				});
			});
			
			if (validationErrors.length > 0) {
				console.error('Validation errors:', validationErrors);
				setSaveError(`Validatie fout: ${validationErrors[0]}`);
				setSaveStatus('error');
				return;
			}
			
			// Try to save with new format (with schema_name and is_active)
			let { error } = await supabase
				.from('user_schemas')
				.upsert({
					user_id: userId,
					schema_data: weekPrograms,
					schema_name: schemaName,
					is_active: true,
					start_date: startDate,
					weight_kg: weightKg
				}, {
					onConflict: 'user_id,schema_name'
				});

			// If constraint doesn't exist yet, try user_id only
			if (error && error.code === '42P10') {
				console.warn('Constraint not available, trying user_id only conflict');
				const legacyResult = await supabase
					.from('user_schemas')
					.upsert({
						user_id: userId,
						schema_data: weekPrograms,
						schema_name: schemaName,
						is_active: true,
						start_date: startDate,
						weight_kg: weightKg
					}, {
						onConflict: 'user_id'
					});
				error = legacyResult.error;
			}

			if (error) {
				console.error('Save error:', error);
				console.error('Error details:', {
					message: error.message,
					code: error.code,
					details: error.details,
					hint: error.hint
				});
				
				// Try alternative approach for conflicts
				if (error.code === '23505' || error.message.includes('conflict') || error.message.includes('duplicate')) {
					console.log('Conflict error detected, trying UPDATE instead...');
					
					// Try update with schema_name
					const { error: updateError } = await supabase
						.from('user_schemas')
						.update({
							schema_data: weekPrograms,
							schema_name: schemaName,
							start_date: startDate,
							weight_kg: weightKg,
							updated_at: new Date().toISOString()
						})
						.eq('user_id', userId);
						
					if (updateError) {
						console.error('Update also failed:', updateError);
						setSaveError(`Database conflict: ${updateError.message}`);
						throw updateError;
					} else {
						console.log('Update successful after conflict');
					}
				} else {
					setSaveError(`Database fout: ${error.message}`);
					throw error;
				}
			}

			console.log('Schema saved successfully');
			setSaveStatus('saved');
			setHasChanges(false);
		} catch (err) {
			console.error('Error saving schema:', err);
			setSaveError(err instanceof Error ? err.message : 'Onbekende fout');
			setSaveStatus('error');
		}
	};

	// Auto-save disabled - only manual save now
	
	const updateStep = (stepIndex: number, updatedStep: SimpleStep) => {
		setWeekPrograms(prev => prev.map(program => 
			program.week === selectedWeek 
				? { ...program, steps: program.steps.map((step, i) => i === stepIndex ? updatedStep : step) }
				: program
		));
		setHasChanges(true);
	};

	const updateWeekCalories = (calories: number) => {
		setWeekPrograms(prev => prev.map(program => 
			program.week === selectedWeek 
				? { ...program, cal: calories }
				: program
		));
		setHasChanges(true);
	};

	// Geschat energieverbruik (kcal/min) op basis van de ACSM-metabole vergelijkingen.
	// Deze houden — anders dan de oude vaste-snelheidsformule — rekening met zowel
	// de helling als het lichaamsgewicht van de gebruiker.
	const metabolicKcalPerMin = (speedKmh: number, inclinePct: number) => {
		if (speedKmh <= 0) return 0;
		const speedMPerMin = speedKmh * 1000 / 60;
		const grade = inclinePct / 100;
		// ACSM-omslagpunt tussen wandelen en rennen ligt rond 6,5 km/u
		const isRunning = speedKmh >= 6.5;
		const vo2 = isRunning
			? 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade + 3.5
			: 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade + 3.5;
		// Nooit onder het ruststofwisselingsniveau (1 MET ≈ 3.5 ml/kg/min)
		const vo2Clamped = Math.max(3.5, vo2);
		// ~5 kcal per liter verbruikte zuurstof
		return (vo2Clamped * weightKg / 1000) * 5;
	};

	// Functie om calorieën te berekenen op basis van training intensiteit
	const calculateExpectedCalories = () => {
		const currentProgram = weekPrograms.find(p => p.week === selectedWeek);
		if (!currentProgram) return 0;

		let totalCalories = 0;

		currentProgram.steps.forEach(step => {
			if (step.type === 'steady') {
				const duration = step.duration_min || 0;
				const speed = step.speed_kmh || 0;
				const incline = step.incline_pct || 0;
				const repeats = step.repeats || 1;
				totalCalories += metabolicKcalPerMin(speed, incline) * duration * repeats;
			} else if (step.type === 'interval_pair') {
				const hardDuration = step.hard?.duration_min || 0;
				const hardSpeed = step.hard?.speed_kmh || 0;
				const hardIncline = step.hard?.incline_pct || 0;
				const restDuration = step.rest?.duration_min || 0;
				const restSpeed = step.rest?.speed_kmh || 0;
				const restIncline = step.rest?.incline_pct || 0;
				const repeats = step.repeats || 1;

				const hardCalories = metabolicKcalPerMin(hardSpeed, hardIncline) * hardDuration;
				const restCalories = metabolicKcalPerMin(restSpeed, restIncline) * restDuration;
				totalCalories += (hardCalories + restCalories) * repeats;
			}
		});

		// Rond af naar hele getallen
		return Math.round(totalCalories);
	};

	const applyCalculatedCalories = () => {
		const calculated = calculateExpectedCalories();
		updateWeekCalories(calculated);
	};

	// Functie om totale trainingsduur te berekenen
	const calculateTotalDuration = () => {
		const currentProgram = weekPrograms.find(p => p.week === selectedWeek);
		if (!currentProgram) return 0;

		let totalMinutes = 0;

		currentProgram.steps.forEach(step => {
			if (step.type === 'steady') {
				const duration = step.duration_min || 0;
				const repeats = step.repeats || 1;
				totalMinutes += duration * repeats;
			} else if (step.type === 'interval_pair') {
				const hardDuration = step.hard?.duration_min || 0;
				const restDuration = step.rest?.duration_min || 0;
				const repeats = step.repeats || 1;
				totalMinutes += (hardDuration + restDuration) * repeats;
			}
		});

		return totalMinutes;
	};

	// Functie om minuten om te zetten naar uren en minuten
	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		
		if (hours > 0) {
			return `${hours}u ${mins.toFixed(1)}min`;
		} else {
			return `${mins.toFixed(1)}min`;
		}
	};

	// Functie om stappen om te zetten voor grafiek (gekopieerd van App.tsx)
	const flattenSteps = (steps: SimpleStep[]): FlattenedStep[] => {
		const result: FlattenedStep[] = [];
		let currentSec = 0;
		const toSec = (min: number) => Math.round(min * 60);
		
		for (const step of steps) {
			if (step.type === "steady") {
				for (let i = 0; i < (step.repeats || 1); i++) {
					const durSec = toSec(step.duration_min || 0);
					const speedIncrease = (step.speed_increase_kmh || 0) * i;
					result.push({
						label: step.label || 'Steady',
						duration_min: step.duration_min || 0,
						duration_sec: durSec,
						speed_kmh: (step.speed_kmh || 0) + speedIncrease,
						start_min: currentSec / 60,
						start_sec: currentSec,
						type: "steady",
						incline_pct: step.incline_pct ?? 0,
					});
					currentSec += durSec;
				}
			} else if (step.type === "interval_pair" && step.hard && step.rest) {
				const showRep = (step.repeats || 1) > 1;
				for (let i = 0; i < (step.repeats || 1); i++) {
					const repIndex = showRep ? i + 1 : undefined;
					const hardSec = toSec(step.hard.duration_min || 0);
					const hardSpeedIncrease = (step.hard.speed_increase_kmh || 0) * i;
					const hardInclineIncrease = (step.hard.incline_increase_pct || 0) * i;
					result.push({
						label: step.hard.label || 'Hard',
						duration_min: step.hard.duration_min || 0,
						duration_sec: hardSec,
						speed_kmh: (step.hard.speed_kmh || 0) + hardSpeedIncrease,
						start_min: currentSec / 60,
						start_sec: currentSec,
						type: "interval_hard",
						repIndex,
						incline_pct: (step.hard.incline_pct ?? 0) + hardInclineIncrease,
					});
					currentSec += hardSec;
					const restSec = toSec(step.rest.duration_min || 0);
					const restSpeedIncrease = (step.rest.speed_increase_kmh || 0) * i;
					const restInclineIncrease = (step.rest.incline_increase_pct || 0) * i;
					result.push({
						label: step.rest.label || 'Rest',
						duration_min: step.rest.duration_min || 0,
						duration_sec: restSec,
						speed_kmh: (step.rest.speed_kmh || 0) + restSpeedIncrease,
						start_min: currentSec / 60,
						start_sec: currentSec,
						type: "interval_rest",
						repIndex,
						incline_pct: (step.rest.incline_pct ?? 0) + restInclineIncrease,
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
	};

	// Grafiek component (gekopieerd van App.tsx)
	const ProgramGraph: React.FC<{ steps: FlattenedStep[] }> = ({ steps }) => {
		// Determine total seconds and max speed
		const totalSec = Math.max(
			0,
			...steps.map(s => (s.duration_sec && s.duration_sec > 0 ? (s.start_sec + s.duration_sec) : s.start_sec))
		);
		const speeds = steps.map(s => s.speed_kmh ?? 0).filter(v => v > 0);
		const maxSpeedRaw = Math.max(0, ...speeds);
		const minSpeedRaw = speeds.length ? Math.min(...speeds) : 4;
		const minSpeed = Math.floor(minSpeedRaw);
		const maxSpeed = Math.ceil(maxSpeedRaw);
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

		// Build incline step-function points (same approach as the training view's graph)
		const inclSegments: Array<{ t: number; v: number }> = [];
		for (const s of steps) {
			if (!s.duration_sec || s.duration_sec <= 0) continue;
			inclSegments.push({ t: s.start_sec, v: s.incline_pct ?? 0 });
			inclSegments.push({ t: s.start_sec + s.duration_sec, v: s.incline_pct ?? 0 });
		}
		const inclValues = steps.filter(s => s.duration_sec && s.duration_sec > 0).map(s => s.incline_pct ?? 0);
		const hasIncline = inclValues.some(v => v !== 0);
		const maxIncl = 12;
		const minIncl = Math.min(0, ...inclValues);

		// SVG coordinate system
		const vbW = 1000;
		const vbH = 200;
		const padL = 34;
		const padR = hasIncline ? 36 : 12;
		const padT = 2;
		const padB = 8;
		const plotW = vbW - padL - padR;
		const plotH = vbH - padT - padB;

		const x = (t: number) => padL + (t / totalSec) * plotW;
		const y = (v: number) => padT + (1 - (Math.max(minSpeed, Math.min(v, maxSpeed)) - minSpeed) / (maxSpeed - minSpeed)) * plotH;
		const yIncl = (v: number) => padT + (1 - (Math.max(minIncl, Math.min(v, maxIncl)) - minIncl) / (maxIncl - minIncl)) * plotH;

		const pointsAttr = segments.map(p => `${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
		const inclPointsAttr = inclSegments.map(p => `${x(p.t).toFixed(2)},${yIncl(p.v).toFixed(2)}`).join(' ');

		return (
			<svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height="130" className="graph-svg" role="img" aria-label="Programma snelheid en helling grafiek" style={{ display: 'block' }}>
				<defs>
					<linearGradient id="se-c3-full" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#a8ff78" stopOpacity={0.35} />
						<stop offset="100%" stopColor="#a8ff78" stopOpacity={0} />
					</linearGradient>
				</defs>
				{/* y grid + labels */}
				{([minSpeed, Math.ceil((minSpeed + maxSpeed)/2), maxSpeed] as number[]).map((v, i) => (
					<g key={i}>
						<line x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)} stroke="#2a2750" strokeWidth={1} />
						<text x={padL - 4} y={y(v) + (i === 2 ? -3 : 5)} textAnchor="end" fontSize={18} fill="#4a4870" fontFamily="system-ui">{v}</text>
					</g>
				))}
				{/* filled area + curve */}
				<polygon fill="url(#se-c3-full)" points={`${padL},${padT + plotH} ${pointsAttr} ${padL + plotW},${padT + plotH}`} />
				<polyline fill="none" stroke="#a8ff78" strokeWidth={3} strokeLinejoin="miter" strokeLinecap="butt" points={pointsAttr} />
				{/* Incline overlay line (amber, dashed) — only when at least one step has non-zero incline */}
				{hasIncline && (
					<>
						<polyline fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="8 5" strokeLinejoin="miter" strokeLinecap="butt" points={inclPointsAttr} opacity={0.85} />
						{/* Right y-axis: incline labels */}
						{([minIncl, Math.round((minIncl + maxIncl) / 2), maxIncl] as number[]).map((v, i) => (
							<text key={i} x={padL + plotW + 4} y={yIncl(v) + (i === 2 ? -3 : 5)} textAnchor="start" fontSize={18} fill="#92610a" fontFamily="system-ui">{v}%</text>
						))}
					</>
				)}
			</svg>
		);
	};

	const addStep = () => {
		const newStep: SimpleStep = { type: "steady", label: "Nieuwe stap", speed_kmh: 10, duration_min: 30, repeats: 1 };
		setWeekPrograms(prev => prev.map(program => 
			program.week === selectedWeek 
				? { ...program, steps: [...program.steps, newStep] }
				: program
		));
		setHasChanges(true);
	};

	const removeStep = (stepIndex: number) => {
		setWeekPrograms(prev => prev.map(program => 
			program.week === selectedWeek 
				? { ...program, steps: program.steps.filter((_, i) => i !== stepIndex) }
				: program
		));
		setHasChanges(true);
	};

	const insertStep = (afterIndex: number) => {
		const newStep: SimpleStep = { type: "steady", label: "Nieuwe stap", speed_kmh: 10, duration_min: 30, repeats: 1 };
		setWeekPrograms(prev => prev.map(program => 
			program.week === selectedWeek 
				? { 
					...program, 
					steps: [
						...program.steps.slice(0, afterIndex + 1),
						newStep,
						...program.steps.slice(afterIndex + 1)
					]
				}
				: program
		));
		setHasChanges(true);
	};

	const addWeek = () => {
		const maxWeek = Math.max(...weekPrograms.map(p => p.week));
		const newWeek: WeekProgram = {
			week: maxWeek + 1,
			cal: 300,
			steps: [
				{ type: "steady", label: "Warming-up", speed_kmh: 6, duration_min: 5, repeats: 1 },
				{ type: "steady", label: "Hoofdtraining", speed_kmh: 8, duration_min: 20, repeats: 1 },
				{ type: "steady", label: "Cooling down", speed_kmh: 6, duration_min: 5, repeats: 1 }
			]
		};
		setWeekPrograms(prev => [...prev, newWeek].sort((a, b) => a.week - b.week));
		setSelectedWeek(newWeek.week);
		setHasChanges(true);
	};

	const removeWeek = (weekNumber: number) => {
		if (weekPrograms.length <= 1) {
			alert('Je moet minimaal één week behouden.');
			return;
		}
		
		if (confirm(`Weet je zeker dat je week ${weekNumber} wilt verwijderen?`)) {
			setWeekPrograms(prev => prev.filter(p => p.week !== weekNumber));
			
			// Als de huidige week wordt verwijderd, selecteer een andere week
			if (selectedWeek === weekNumber) {
				const remainingWeeks = weekPrograms.filter(p => p.week !== weekNumber);
				if (remainingWeeks.length > 0) {
					setSelectedWeek(remainingWeeks[0].week);
				}
			}
			setHasChanges(true);
		}
	};

	const copyWeek = (weekNumber: number) => {
		const weekToCopy = weekPrograms.find(p => p.week === weekNumber);
		if (!weekToCopy) return;

		const maxWeek = Math.max(...weekPrograms.map(p => p.week));
		const newWeek: WeekProgram = {
			week: maxWeek + 1,
			cal: weekToCopy.cal,
			steps: weekToCopy.steps.map(step => ({ ...step })) // Deep copy van steps
		};
		
		setWeekPrograms(prev => [...prev, newWeek].sort((a, b) => a.week - b.week));
		setSelectedWeek(newWeek.week);
		setHasChanges(true);
	};



	const renderStepEditor = (step: SimpleStep, index: number) => {
		const handleTypeChange = (newType: 'steady' | 'interval_pair') => {
			if (newType === 'steady') {
				const newStep: SimpleStep = {
					type: 'steady',
					label: step.type === 'interval_pair' ? 'Steady run' : step.label || 'Steady run',
					speed_kmh: step.type === 'interval_pair' ? (step.hard?.speed_kmh || 10) : (step.speed_kmh || 10),
					duration_min: step.type === 'interval_pair' ? (step.hard?.duration_min || 10) : (step.duration_min || 30),
					repeats: step.repeats || 1
				};
				updateStep(index, newStep);
			} else if (newType === 'interval_pair') {
				const newStep: SimpleStep = {
					type: 'interval_pair',
					hard: {
						label: 'Hard',
						speed_kmh: step.type === 'steady' ? (step.speed_kmh || 10) : 10,
						duration_min: step.type === 'steady' ? Math.round((step.duration_min || 30) / 3) : 1
					},
					rest: {
						label: 'Rest',
						speed_kmh: 6,
						duration_min: step.type === 'steady' ? Math.round((step.duration_min || 30) / 3) : 1
					},
					repeats: step.repeats || 1
				};
				updateStep(index, newStep);
			}
		};

		return (
			<div key={`${selectedWeek}-${index}`} style={{ 
				border: '1px solid #2a2750', 
				borderRadius: '12px', 
				padding: '20px', 
				marginBottom: '16px',
				background: '#1a1835',
				boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
				transition: 'all 0.2s ease'
			}}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<h4 style={{ margin: 0, color: '#495057', fontSize: '16px', fontWeight: '600' }}>
							🏃‍♂️ Stap {index + 1}
						</h4>
						<select
							value={step.type}
							onChange={(e) => handleTypeChange(e.target.value as 'steady' | 'interval_pair')}
							style={{ 
								padding: '12px 8px 12px 4px', 
								border: '2px solid #dee2e6', 
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500',
								background: 'white',
								cursor: 'pointer'
							}}
						>
							<option value="steady">Steady</option>
							<option value="interval_pair">Interval</option>
						</select>
						{step.type === 'interval_pair' && (
							<div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
								<label style={{ fontSize: '14px', fontWeight: '600', color: '#495057', margin: 0 }}>
									🔄 Herh
								</label>
								<input
									type="number"
									value={step.repeats || 1}
									onChange={(e) => updateStep(index, { ...step, repeats: parseInt(e.target.value) || 1 })}
									   style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
										   border: '2px solid #dee2e6', 
										   borderRadius: '8px',
										   fontSize: '14px',
										   fontWeight: '500',
										   appearance: 'textfield',
										   MozAppearance: 'textfield',
										   WebkitAppearance: 'none'
									   }}
								/>
							</div>
						)}
					</div>
					<button 
						onClick={() => removeStep(index)}
						style={{ 
							background: '#dc3545', 
							color: 'white', 
							border: 'none', 
							borderRadius: '6px', 
							padding: '8px 12px',
							cursor: 'pointer',
							fontSize: '12px',
							fontWeight: '600'
						}}
					>
						🗑️ Verwijder
					</button>
				</div>

				{/* Steady type fields */}
				{step.type === 'steady' && (
				<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '8px', width: '100%' }}>
					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
							Label
						</label>
						<input
							type="text"
							value={step.label || ''}
							onChange={(e) => updateStep(index, { ...step, label: e.target.value })}
							style={{ 
								width: 'auto',
								maxWidth: '200px', 
								padding: '12px 8px 12px 4px', 
								border: '2px solid #dee2e6', 
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500'
							}}
						/>
					</div>
					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
							tijd
						</label>
						<input
							type="text"
							key={`${selectedWeek}-${index}-sdur`}
							defaultValue={minToMmss(step.duration_min || 0)}
							placeholder="0:00"
							onBlur={e => {
								updateStep(index, {
									...step,
									duration_min: mmssToMin(e.target.value),
								});
							}}
							style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
								border: '2px solid #dee2e6',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500'
							}}
						/>
					</div>
					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
							km/u
						</label>
						<input
							type="text"
							key={`${selectedWeek}-${index}-sspeed`}
							defaultValue={step.speed_kmh?.toString().replace('.', ',') || ''}
							onBlur={e => {
								const filtered = filterNumericInput(e.target.value);
								updateStep(index, { ...step, speed_kmh: parseNumberInput(filtered) });
							}}
							style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
								border: '2px solid #dee2e6',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500',
								appearance: 'textfield',
								MozAppearance: 'textfield',
								WebkitAppearance: 'none'
							}}
						/>
					</div>
					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
							km
						</label>
						<input
							type="text"
							value={minToKm(step.duration_min || 0, step.speed_kmh || 0).toFixed(3).replace('.', ',')}
							onChange={e => {
								const filtered = filterNumericInput(e.target.value);
								updateStep(index, {
									...step,
									duration_min: kmToMin(parseNumberInput(filtered), step.speed_kmh || 0),
								});
							}}
							style={{ width: '60px', padding: '12px 8px 12px 4px', textAlign: 'left',
								border: '2px solid #dee2e6',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500',
								appearance: 'textfield',
								MozAppearance: 'textfield',
								WebkitAppearance: 'none'
							}}
						/>
					</div>
					<div>
						<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
							%
						</label>
						<input
							type="text"
							value={step.incline_pct?.toString().replace('.', ',') ?? '0'}
							onChange={e => {
								const filtered = filterNumericInput(e.target.value);
								updateStep(index, { ...step, incline_pct: parseNumberInput(filtered) });
							}}
							style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
								border: '2px solid #dee2e6',
								borderRadius: '8px',
								fontSize: '14px',
								fontWeight: '500',
								appearance: 'textfield',
								MozAppearance: 'textfield',
								WebkitAppearance: 'none'
							}}
						/>
					</div>
				</div>
				)}
				{/* Interval pair type fields */}
				{step.type === 'interval_pair' && step.hard && step.rest && (
					<div style={{ width: '100%' }}>
						{/* Hard section */}
						<div>
							<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
								🔥 Hard
							</label>
							<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '8px' }}>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
										Label
									</label>
									<input
										type="text"
										value={step.hard!.label || ''}
										onChange={(e) => updateStep(index, { ...step, hard: { ...step.hard!, label: e.target.value } })}
										style={{ 
											width: 'auto',
											maxWidth: '200px', 
											padding: '12px 8px 12px 4px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
										tijd
									</label>
									<input
										type="text"
										key={`${selectedWeek}-${index}-hdur`}
										defaultValue={minToMmss(step.hard!.duration_min || 0)}
										placeholder="0:00"
										onBlur={e => {
											updateStep(index, { ...step, hard: { ...step.hard!, duration_min: mmssToMin(e.target.value) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
										km/u
									</label>
									<input
										type="text"
										key={`${selectedWeek}-${index}-hspeed`}
										defaultValue={step.hard!.speed_kmh?.toString().replace('.', ',') || ''}
										onBlur={e => {
											const filtered = filterNumericInput(e.target.value);
											updateStep(index, { ...step, hard: { ...step.hard!, speed_kmh: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
										+km/u
									</label>
									<input
										type="text"
										key={`${selectedWeek}-${index}-hspeedinc`}
										defaultValue={step.hard!.speed_increase_kmh?.toString().replace('.', ',') ?? '0'}
										onBlur={e => {
											const filtered = filterSignedNumericInput(e.target.value);
											updateStep(index, { ...step, hard: { ...step.hard!, speed_increase_kmh: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
										%
									</label>
									<input
										type="text"
										value={step.hard!.incline_pct?.toString().replace('.', ',') ?? '0'}
										onChange={e => {
											const filtered = filterNumericInput(e.target.value);
											updateStep(index, { ...step, hard: { ...step.hard!, incline_pct: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#856404' }}>
										+%
									</label>
									<input
										type="text"
										value={step.hard!.incline_increase_pct?.toString().replace('.', ',') ?? '0'}
										onChange={e => {
											const filtered = filterSignedNumericInput(e.target.value);
											updateStep(index, { ...step, hard: { ...step.hard!, incline_increase_pct: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
							</div>
						</div>
												{/* Rest section direct onder hard */}
						<div style={{ marginTop: '16px' }}>
							<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
								💤 Rust
							</label>
							<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '8px' }}>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
										Label
									</label>
									<input
										type="text"
										value={step.rest!.label || ''}
										onChange={(e) => updateStep(index, { ...step, rest: { ...step.rest!, label: e.target.value } })}
										style={{ 
											width: 'auto',
											maxWidth: '200px', 
											padding: '12px 8px 12px 4px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
										tijd
									</label>
									<input
										type="text"
										key={`${selectedWeek}-${index}-rdur`}
										defaultValue={minToMmss(step.rest!.duration_min || 0)}
										placeholder="0:00"
										onBlur={e => {
											updateStep(index, { ...step, rest: { ...step.rest!, duration_min: mmssToMin(e.target.value) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
										km/u
									</label>
									<input
										type="text"
										key={`${selectedWeek}-${index}-rspeed`}
										defaultValue={step.rest!.speed_kmh?.toString().replace('.', ',') || ''}
										onBlur={e => {
											const filtered = filterNumericInput(e.target.value);
											updateStep(index, { ...step, rest: { ...step.rest!, speed_kmh: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
										+km/u
									</label>
									<input
										type="text"
										key={`${selectedWeek}-${index}-rspeedinc`}
										defaultValue={step.rest!.speed_increase_kmh?.toString().replace('.', ',') ?? '0'}
										onBlur={e => {
											const filtered = filterSignedNumericInput(e.target.value);
											updateStep(index, { ...step, rest: { ...step.rest!, speed_increase_kmh: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
										%
									</label>
									<input
										type="text"
										value={step.rest!.incline_pct?.toString().replace('.', ',') ?? '0'}
										onChange={e => {
											const filtered = filterNumericInput(e.target.value);
											updateStep(index, { ...step, rest: { ...step.rest!, incline_pct: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
										+%
									</label>
									<input
										type="text"
										value={step.rest!.incline_increase_pct?.toString().replace('.', ',') ?? '0'}
										onChange={e => {
											const filtered = filterSignedNumericInput(e.target.value);
											updateStep(index, { ...step, rest: { ...step.rest!, incline_increase_pct: parseNumberInput(filtered) } });
										}}
										style={{ width: '50px', padding: '12px 8px 12px 4px', textAlign: 'left',
											border: '2px solid #dee2e6',
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500',
											appearance: 'textfield',
											MozAppearance: 'textfield',
											WebkitAppearance: 'none'
										}}
									/>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		);
	};

	// Globale CSS om number input spinners te verbergen
	const style = document.createElement('style');
	style.innerHTML = `
	  /* Chrome, Safari, Edge, Opera */
	  input[type=number]::-webkit-inner-spin-button, 
	  input[type=number]::-webkit-outer-spin-button {
	    -webkit-appearance: none;
	    margin: 0;
	  }
	  /* Firefox */
	  input[type=number] {
	    -moz-appearance: textfield;
	  }
	`;
	document.head.appendChild(style);

	return (
		<div style={{ 
			maxWidth: '900px', 
			margin: '0 auto', 
			padding: '20px',
			fontFamily: 'Inter, system-ui, sans-serif',
			background: '#0f0c29',
			minHeight: '100%',
			color: '#ccc'
		}}>
			<style>{`
				.se-root label { color: #9090b8 !important; }
				.se-root input, .se-root select {
					background: #1a1835 !important;
					border-color: #2a2750 !important;
					color: #e0e0ff !important;
				}
				.se-root input:focus, .se-root select:focus {
					border-color: #667eea !important;
					outline: none;
				}
				.se-root input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
				.se-root h1, .se-root h2, .se-root h3, .se-root h4 { color: #e8e8ff !important; }
				.se-root p { color: #7070a0 !important; }
			`}</style>
			<div className="se-root">
			{/* Header */}
			<div style={{ 
				display: 'flex', 
				justifyContent: 'space-between', 
				alignItems: 'center', 
				marginBottom: '32px',
				paddingBottom: '16px',
				borderBottom: '2px solid #2a2750'
			}}>
				<div>
					<h1 style={{ margin: 0, color: '#495057', fontSize: '28px', fontWeight: '700' }}>
						📋 Schema Editor
					</h1>
					<p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '16px' }}>
						Bewerk je trainingsschema
					</p>
				</div>
				<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
					{saveStatus === 'saving' && (
						<span style={{ color: '#007bff', fontSize: '14px', fontWeight: '500' }}>
							💾 Opslaan...
						</span>
					)}
					{saveStatus === 'saved' && (
						<span style={{ color: '#28a745', fontSize: '14px', fontWeight: '500' }}>
							✅ Opgeslagen
						</span>
					)}
					{saveStatus === 'error' && (
						<div style={{ color: '#dc3545', fontSize: '14px', fontWeight: '500' }}>
							<div>❌ Fout bij opslaan</div>
							{saveError && (
								<div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '4px', maxWidth: '200px' }}>
									{saveError}
								</div>
							)}
						</div>
					)}
					{hasChanges && (
						<span style={{ color: '#ffc107', fontSize: '14px', fontWeight: '500' }}>
							⚠️ Niet opgeslagen wijzigingen
						</span>
					)}
					<button
						onClick={handleSave}
						disabled={!hasChanges || saveStatus === 'saving'}
						style={{
							background: hasChanges ? '#28a745' : '#6c757d',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							padding: '10px 16px',
							cursor: hasChanges && saveStatus !== 'saving' ? 'pointer' : 'not-allowed',
							fontSize: '14px',
							fontWeight: '600',
							opacity: hasChanges && saveStatus !== 'saving' ? 1 : 0.6
						}}
					>
						💾 Opslaan
					</button>
					<button
						onClick={onBack}
						style={{
							background: '#6c757d',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							padding: '10px 16px',
							cursor: 'pointer',
							fontSize: '14px',
							fontWeight: '600'
						}}
					>
						← Terug
					</button>
				</div>
			</div>

			{/* Schema Name and Start Date */}
			<div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px', alignItems: 'flex-end' }}>
				<div style={{ flex: '0 0 400px' }}>
					<label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
						📝 Schema Naam
					</label>
					<input
						type="text"
						value={schemaName}
						onChange={(e) => {
							setSchemaName(e.target.value);
							setHasChanges(true);
						}}
						style={{ 
							width: '100%', 
							padding: '12px 8px 12px 4px', 
							border: '2px solid #dee2e6', 
							borderRadius: '8px',
							fontSize: '16px',
							fontWeight: '500'
						}}
					/>
				</div>

				<div style={{ flex: '0 0 auto' }}>
					<label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
						Startdatum Programma
					</label>
					<input
						type="date"
						value={startDate}
						onChange={(e) => {
							setStartDate(e.target.value);
							setHasChanges(true);
						}}
						style={{
							width: '100%',
							padding: '12px 8px 12px 4px',
							border: '2px solid #dee2e6',
							borderRadius: '8px',
							fontSize: '16px',
							fontWeight: '500'
						}}
					/>
				</div>

				<div style={{ flex: '0 0 140px' }}>
					<label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
						Lichaamsgewicht (kg)
					</label>
					<input
						type="text"
						defaultValue={weightKg.toString().replace('.', ',')}
						onBlur={(e) => {
							const filtered = filterNumericInput(e.target.value);
							const parsed = parseNumberInput(filtered);
							setWeightKg(parsed > 0 ? parsed : 75);
							setHasChanges(true);
						}}
						style={{
							width: '100%',
							padding: '12px 8px 12px 4px',
							border: '2px solid #dee2e6',
							borderRadius: '8px',
							fontSize: '16px',
							fontWeight: '500'
						}}
					/>
					<p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#7070a0' }}>
						Gebruikt voor de calorieschatting
					</p>
				</div>
			</div>

			{/* Week Manager */}
			<div style={{ marginBottom: '32px' }}>
				<div style={{ 
					display: 'flex', 
					justifyContent: 'space-between', 
					alignItems: 'center', 
					marginBottom: '16px' 
				}}>
					<h2 style={{ margin: 0, color: '#495057', fontSize: '20px', fontWeight: '600' }}>
						📅 Week Manager
					</h2>
					<button
						onClick={addWeek}
						style={{
							background: '#28a745',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							padding: '10px 16px',
							cursor: 'pointer',
							fontSize: '14px',
							fontWeight: '600'
						}}
					>
						➕ Week Toevoegen
					</button>
				</div>
				<div style={{ 
					display: 'grid', 
					gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
					gap: '16px',
					padding: '16px',
					background: '#110e2a',
					borderRadius: '12px',
					border: '1px solid #2a2750'
				}}>
					{weekPrograms.map((program) => (
						<div 
							key={program.week} 
							style={{ 
								position: 'relative',
								transition: 'transform 0.2s ease, box-shadow 0.2s ease'
							}}
							draggable
							onDragStart={(e) => {
								e.dataTransfer.setData('text/plain', program.week.toString());
								e.dataTransfer.effectAllowed = 'move';
								e.currentTarget.style.opacity = '0.5';
							}}
							onDragEnd={(e) => {
								e.currentTarget.style.opacity = '1';
							}}
							onDragOver={(e) => {
								e.preventDefault();
								e.dataTransfer.dropEffect = 'move';
								// Voeg een border-left toe om te tonen waar de week wordt ingevoegd
								e.currentTarget.style.borderLeft = '4px solid #007bff';
								e.currentTarget.style.transform = 'translateX(4px)';
								e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,123,255,0.3)';
							}}
							onDragLeave={(e) => {
								e.currentTarget.style.borderLeft = 'none';
								e.currentTarget.style.transform = 'translateX(0)';
								e.currentTarget.style.boxShadow = 'none';
							}}
							onDrop={(e) => {
								e.preventDefault();
								e.currentTarget.style.borderLeft = 'none';
								e.currentTarget.style.transform = 'translateX(0)';
								e.currentTarget.style.boxShadow = 'none';
								
								const draggedWeekNumber = parseInt(e.dataTransfer.getData('text/plain'));
								const targetWeekNumber = program.week;
								
								if (draggedWeekNumber !== targetWeekNumber) {
									const draggedProgram = weekPrograms.find(p => p.week === draggedWeekNumber);
									const targetIndex = weekPrograms.findIndex(p => p.week === targetWeekNumber);
									
									if (draggedProgram && targetIndex !== -1) {
										// Verwijder de gesleepte week uit de lijst
										const otherPrograms = weekPrograms.filter(p => p.week !== draggedWeekNumber);
										
										// Voeg de gesleepte week in voor de target week
										const newPrograms = [
											...otherPrograms.slice(0, targetIndex),
											draggedProgram,
											...otherPrograms.slice(targetIndex)
										];
										
										// Hernummer alle weken
										newPrograms.forEach((prog, idx) => {
											prog.week = idx + 1;
										});
										
										setWeekPrograms(newPrograms);
										setHasChanges(true);
									}
								}
							}}
						>
							<button
								onClick={() => setSelectedWeek(program.week)}
								style={{
									width: '100%',
									padding: '12px 8px',
									background: selectedWeek === program.week ? '#007bff' : '#ffffff',
									color: selectedWeek === program.week ? 'white' : '#495057',
									border: selectedWeek === program.week ? '2px solid #0056b3' : '2px solid #dee2e6',
									borderRadius: '8px',
									cursor: 'grab',
									fontSize: '14px',
									fontWeight: '600',
									transition: 'all 0.2s ease',
									textAlign: 'center',
									position: 'relative'
								}}
								onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
								onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
							>
								<span style={{ marginRight: '4px' }}>⋮⋮</span>
								Week {program.week}
							</button>
							
							{/* Week management knoppen - alleen kopiëren en verwijderen */}
							<div style={{
								position: 'absolute',
								top: '-8px',
								right: '-8px',
								display: 'flex',
								flexDirection: 'row',
								gap: '2px'
							}}>
								{/* Verwijder knop */}
								{weekPrograms.length > 1 && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											removeWeek(program.week);
										}}
										style={{
											width: '20px',
											height: '20px',
											background: '#dc3545',
											color: 'white',
											border: 'none',
											borderRadius: '50%',
											cursor: 'pointer',
											fontSize: '12px',
											fontWeight: '600',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											lineHeight: '1'
										}}
										title={`Week ${program.week} verwijderen`}
									>
										×
									</button>
								)}
								
								{/* Kopieer knop */}
								<button
									onClick={(e) => {
										e.stopPropagation();
										copyWeek(program.week);
									}}
									style={{
										width: '20px',
										height: '20px',
										background: '#28a745',
										color: 'white',
										border: 'none',
										borderRadius: '50%',
										cursor: 'pointer',
										fontSize: '11px',
										fontWeight: '600',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										lineHeight: '1'
									}}
									title={`Week ${program.week} kopiëren`}
								>
									📄
								</button>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Week Duration Overview */}
			{currentProgram && (
				<div style={{ marginBottom: '32px' }}>
					<h2 style={{ margin: '0 0 16px 0', color: '#495057', fontSize: '20px', fontWeight: '600' }}>
						⏱️ Training Overzicht - Week {selectedWeek}
					</h2>
					<div style={{ 
						display: 'grid', 
						gridTemplateColumns: '1fr 1fr 1fr', 
						gap: '16px',
						marginBottom: '20px'
					}}>
						<div style={{ 
							padding: '20px',
							background: '#e7f3ff',
							borderRadius: '12px',
							border: '1px solid #b3d9ff',
							textAlign: 'center'
						}}>
							<div style={{ fontSize: '24px', fontWeight: '700', color: '#0066cc', marginBottom: '4px' }}>
								{formatDuration(calculateTotalDuration())}
							</div>
							<div style={{ fontSize: '14px', color: '#0066cc', fontWeight: '600' }}>
								Totale Duur
							</div>
						</div>
						<div style={{ 
							padding: '20px',
							background: '#fff2e7',
							borderRadius: '12px',
							border: '1px solid #ffcc99',
							textAlign: 'center'
						}}>
							<div style={{ fontSize: '24px', fontWeight: '700', color: '#cc6600', marginBottom: '4px' }}>
								{currentProgram.steps.length}
							</div>
							<div style={{ fontSize: '14px', color: '#cc6600', fontWeight: '600' }}>
								Aantal Stappen
							</div>
						</div>
						<div style={{ 
							padding: '20px',
							background: '#f0fff0',
							borderRadius: '12px',
							border: '1px solid #99cc99',
							textAlign: 'center'
						}}>
							<div style={{ fontSize: '24px', fontWeight: '700', color: '#006600', marginBottom: '4px' }}>
								{currentProgram.cal || 0} kcal
							</div>
							<div style={{ fontSize: '14px', color: '#006600', fontWeight: '600' }}>
								Verwacht Verbruik
							</div>
						</div>
					</div>

					{/* Training Graph */}
					<div style={{ 
						marginTop: '20px',
						padding: '8px',
						background: '#1a1835',
						borderRadius: '12px',
						border: '1px solid #2a2750'
					}}>
						<ProgramGraph steps={flattenSteps(currentProgram.steps)} />
					</div>
				</div>
			)}

			{/* Week Calories */}
			{currentProgram && (
				<div style={{ marginBottom: '32px' }}>
					<h2 style={{ margin: '0 0 16px 0', color: '#495057', fontSize: '20px', fontWeight: '600' }}>
						🔥 Calorieën - Week {selectedWeek}
					</h2>
					<div style={{ 
						display: 'grid', 
						gridTemplateColumns: '1fr auto auto', 
						gap: '16px', 
						alignItems: 'center',
						padding: '20px',
						background: '#f8f9fa',
						borderRadius: '12px',
						border: '1px solid #dee2e6'
					}}>
						<div>
							<label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
								🎯 Verwachte calorieën (kcal)
							</label>
							<input
								type="number"
								value={currentProgram.cal || 0}
								onChange={(e) => updateWeekCalories(parseInt(e.target.value) || 0)}
								style={{ 
									width: '150px', 
									padding: '12px 8px 12px 4px', 
									border: '2px solid #dee2e6', 
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '500'
								}}
							/>
						</div>
						<div style={{ textAlign: 'center' }}>
							<div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px' }}>
								Berekend
							</div>
							<div style={{ 
								fontSize: '18px', 
								fontWeight: '600', 
								color: '#28a745',
								padding: '8px 16px',
								background: '#d4edda',
								borderRadius: '6px',
								border: '1px solid #c3e6cb'
							}}>
								{calculateExpectedCalories()} kcal
							</div>
						</div>
						<button
							onClick={applyCalculatedCalories}
							style={{
								background: '#17a2b8',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								padding: '12px 8px 12px 4px',
								cursor: 'pointer',
								fontSize: '14px',
								fontWeight: '600',
								whiteSpace: 'nowrap'
							}}
						>
							🧮 Pas Berekening Toe
						</button>
					</div>
				</div>
			)}

			{/* Training Steps */}
			{currentProgram ? (
				<div style={{ marginBottom: '32px' }}>
					<h2 style={{ margin: '0 0 20px 0', color: '#e8e8ff' }}>Trainingsstappen - Week {selectedWeek}</h2>

					{currentProgram.steps && currentProgram.steps.length > 0 ? (
						<div>
							{currentProgram.steps.map((step, index) => (
								<div key={`step-${selectedWeek}-${index}`} style={{ marginBottom: '16px' }}>
									<div>
										{renderStepEditor(step, index)}
									</div>
									<button 
										onClick={() => insertStep(index)}
										style={{ 
											background: '#007bff', 
											color: 'white', 
											border: 'none', 
											borderRadius: '6px', 
											padding: '6px 12px',
											cursor: 'pointer',
											fontSize: '12px',
											fontWeight: '600',
											marginTop: '8px'
										}}
									>
										➕ Toevoegen
									</button>
								</div>
							))}
						</div>
					) : (
						<div style={{ 
							textAlign: 'center', 
							padding: '20px', 
							color: '#6c757d',
							background: '#f8f9fa',
							borderRadius: '8px',
							border: '1px dashed #dee2e6'
						}}>
							<p>Geen stappen gevonden voor week {selectedWeek}</p>
							<button
								onClick={addStep}
								style={{
									background: '#007bff',
									color: 'white',
									border: 'none',
									borderRadius: '6px',
									padding: '6px 12px',
									cursor: 'pointer',
									fontSize: '12px',
									fontWeight: '600'
								}}
							>
								➕ Toevoegen
							</button>
						</div>
					)}
				</div>
			) : (
				<div style={{ 
					textAlign: 'center', 
					padding: '40px', 
					color: '#7070a0',
					background: '#1a1835',
					borderRadius: '8px',
					border: '2px dashed #2a2750'
				}}>
					<h3>Selecteer een week om te bewerken</h3>
					<p>Klik op een week in de Week Manager om de trainingsstappen te bewerken.</p>
				</div>
			)}
		</div>{/* closes se-root */}
		</div>
	);
};

export default SchemaEditor;

// Helper: km naar min
function kmToMin(km: number, speed: number) {
  if (!speed) return 0;
  return (km / speed) * 60;
}
// Helper: min naar mm:ss string
function minToMmss(min: number): string {
  const totalSec = Math.round(min * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
// Helper: mm:ss string naar min
function mmssToMin(val: string): number {
  const parts = val.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0]) || 0;
    const s = parseInt(parts[1]) || 0;
    return m + s / 60;
  }
  return parseFloat(val.replace(',', '.')) || 0;
}
// Helper: min naar km
function minToKm(min: number, speed: number) {
  if (!speed) return 0;
  return (min * speed) / 60;
}
// Helper: formatteer minuten op 1 decimaal

// Helper: alleen getallen, punt of komma
function filterNumericInput(value: string) {
  return value.replace(/[^0-9.,]/g, '');
}
function filterSignedNumericInput(value: string) {
  return value.replace(/[^0-9.,-]/g, '').replace(/(?!^)-/g, '');
}
function parseNumberInput(value: string) {
  return parseFloat(value.replace(',', '.')) || 0;
}
