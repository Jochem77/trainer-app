import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export interface SimpleStep {
	type: 'steady' | 'interval_pair';
	repeats: number;
	// Voor steady type
	label?: string;
	speed_kmh?: number;
	duration_min?: number;
	// Voor interval_pair type
	hard?: {
		label: string;
		speed_kmh: number;
		duration_min: number;
	};
	rest?: {
		label: string;
		speed_kmh: number;
		duration_min: number;
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
	repeats?: number;
	hard?: {
		duration_min?: number;
		speed_kmh?: number;
		label?: string;
	};
	rest?: {
		duration_min?: number;
		speed_kmh?: number;
		label?: string;
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
	userId: string | null;
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
	const [hasChanges, setHasChanges] = useState(false);
	const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | ''>('');
	const [saveError, setSaveError] = useState<string>('');

	const currentProgram = weekPrograms.find(p => p.week === selectedWeek);

	// Load user schema when component mounts
	useEffect(() => {
		const loadUserSchema = async () => {
			if (!userId) return;
			
			try {
				console.log('Loading schema for user:', userId);
				
				let { data, error } = await supabase
					.from('user_schemas')
					.select('schema_data, schema_name')
					.eq('user_id', userId)
					.single();

				if (error && (error.message.includes('schema_name') || error.message.includes('column') || error.code === '42703')) {
					console.warn('schema_name column issue, using fallback');
					const fallbackResult = await supabase
						.from('user_schemas')
						.select('schema_data')
						.eq('user_id', userId)
						.single();
					
					data = fallbackResult.data ? { ...fallbackResult.data, schema_name: null } : null;
					error = fallbackResult.error;
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
					console.log('Loaded schema data:', data.schema_data);
					
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
										duration_min: step.hard.duration_min || 1
									},
									rest: {
										label: step.rest.label || 'Rest',
										speed_kmh: step.rest.speed_kmh || 6,
										duration_min: step.rest.duration_min || 1
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
					
					console.log('Converted schema data:', convertedData);
					console.log('First week after conversion:', convertedData[0]);
					setWeekPrograms(convertedData);
					if (data.schema_name) {
						setSchemaName(data.schema_name);
					}
				}
			} catch (err) {
				console.error('Error in loadUserSchema:', err);
			}
		};

		loadUserSchema();
	}, [userId]);

	// Save changes effect
	useEffect(() => {
		if (!hasChanges || !userId) return;

		const timeoutId = setTimeout(async () => {
			try {
				setSaveStatus('saving');
				setSaveError('');
				
				const { error } = await supabase
					.from('user_schemas')
					.upsert({
						user_id: userId,
						schema_data: weekPrograms
					});

				if (error) {
					console.error('Save error:', error);
					console.error('Error details:', {
						message: error.message,
						code: error.code,
						details: error.details,
						hint: error.hint
					});
					setSaveError(`Database fout: ${error.message}`);
					throw error;
				}

				console.log('Schema saved successfully');
				setSaveStatus('saved');
				setHasChanges(false);
			} catch (err) {
				console.error('Error saving schema:', err);
				console.error('Save attempt details:', {
					userId,
					weekProgramsLength: weekPrograms?.length,
					weekPrograms: weekPrograms
				});
				setSaveError(err instanceof Error ? err.message : 'Onbekende fout');
				setSaveStatus('error');
			}
		}, 2000);

		return () => clearTimeout(timeoutId);
	}, [weekPrograms, hasChanges, userId]);

	const updateStep = (stepIndex: number, updatedStep: SimpleStep) => {
		setWeekPrograms(prev => prev.map(program => 
			program.week === selectedWeek 
				? { ...program, steps: program.steps.map((step, i) => i === stepIndex ? updatedStep : step) }
				: program
		));
		setHasChanges(true);
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
				border: '2px solid #e9ecef', 
				borderRadius: '12px', 
				padding: '20px', 
				marginBottom: '16px',
				background: '#ffffff',
				boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
				transition: 'all 0.2s ease'
			}}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
					<h4 style={{ margin: 0, color: '#495057', fontSize: '16px', fontWeight: '600' }}>
						🏃‍♂️ Stap {index + 1} - {step.type === 'interval_pair' ? 'Interval' : 'Steady'}
					</h4>
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
				
				{/* Type selector */}
				<div style={{ marginBottom: '16px' }}>
					<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
						🏷️ Type
					</label>
					<select
						value={step.type}
						onChange={(e) => handleTypeChange(e.target.value as 'steady' | 'interval_pair')}
						style={{ 
							width: '200px', 
							padding: '10px 12px', 
							border: '2px solid #dee2e6', 
							borderRadius: '8px',
							fontSize: '14px',
							fontWeight: '500',
							background: 'white'
						}}
					>
						<option value="steady">Steady</option>
						<option value="interval_pair">Interval Pair</option>
					</select>
				</div>

				{/* Steady type fields */}
				{step.type === 'steady' && (
					<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
						<div>
							<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
								📝 Label
							</label>
							<input
								type="text"
								value={step.label || ''}
								onChange={(e) => updateStep(index, { ...step, label: e.target.value })}
								style={{ 
									width: '100%', 
									padding: '10px 12px', 
									border: '2px solid #dee2e6', 
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '500'
								}}
							/>
						</div>
						<div>
							<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
								🏃 Snelheid (km/u)
							</label>
							<input
								type="number"
								step="0.1"
								value={step.speed_kmh || 0}
								onChange={(e) => updateStep(index, { ...step, speed_kmh: parseFloat(e.target.value) || 0 })}
								style={{ 
									width: '100%', 
									padding: '10px 12px', 
									border: '2px solid #dee2e6', 
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '500'
								}}
							/>
						</div>
						<div>
							<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
								⏱️ Duur (min)
							</label>
							<input
								type="number"
								value={step.duration_min || 0}
								onChange={(e) => updateStep(index, { ...step, duration_min: parseInt(e.target.value) || 0 })}
								style={{ 
									width: '100%', 
									padding: '10px 12px', 
									border: '2px solid #dee2e6', 
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '500'
								}}
							/>
						</div>
						<div>
							<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
								🔄 Herhalingen
							</label>
							<input
								type="number"
								value={step.repeats || 1}
								onChange={(e) => updateStep(index, { ...step, repeats: parseInt(e.target.value) || 1 })}
								style={{ 
									width: '100%', 
									padding: '10px 12px', 
									border: '2px solid #dee2e6', 
									borderRadius: '8px',
									fontSize: '14px',
									fontWeight: '500'
								}}
							/>
						</div>
					</div>
				)}

				{/* Interval pair type fields */}
				{step.type === 'interval_pair' && step.hard && step.rest && (
					<>
						{/* Hard section */}
						<div style={{ marginBottom: '16px', padding: '16px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
							<h5 style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '14px', fontWeight: '600' }}>
								🔥 Hard Phase
							</h5>
							<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
								<div>
									<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
										📝 Label
									</label>
									<input
										type="text"
										value={step.hard.label || ''}
										onChange={(e) => updateStep(index, { 
											...step, 
											hard: { ...step.hard!, label: e.target.value }
										})}
										style={{ 
											width: '100%', 
											padding: '10px 12px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
										🏃 Snelheid (km/u)
									</label>
									<input
										type="number"
										step="0.1"
										value={step.hard.speed_kmh || 0}
										onChange={(e) => updateStep(index, { 
											...step, 
											hard: { ...step.hard!, speed_kmh: parseFloat(e.target.value) || 0 }
										})}
										style={{ 
											width: '100%', 
											padding: '10px 12px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
										⏱️ Duur (min)
									</label>
									<input
										type="number"
										step="0.1"
										value={step.hard.duration_min || 0}
										onChange={(e) => updateStep(index, { 
											...step, 
											hard: { ...step.hard!, duration_min: parseFloat(e.target.value) || 0 }
										})}
										style={{ 
											width: '100%', 
											padding: '10px 12px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
							</div>
						</div>

						{/* Rest section */}
						<div style={{ marginBottom: '16px', padding: '16px', background: '#d1ecf1', borderRadius: '8px', border: '1px solid #bee5eb' }}>
							<h5 style={{ margin: '0 0 12px 0', color: '#0c5460', fontSize: '14px', fontWeight: '600' }}>
								💤 Rest Phase
							</h5>
							<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
								<div>
									<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
										📝 Label
									</label>
									<input
										type="text"
										value={step.rest.label || ''}
										onChange={(e) => updateStep(index, { 
											...step, 
											rest: { ...step.rest!, label: e.target.value }
										})}
										style={{ 
											width: '100%', 
											padding: '10px 12px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
										🏃 Snelheid (km/u)
									</label>
									<input
										type="number"
										step="0.1"
										value={step.rest.speed_kmh || 0}
										onChange={(e) => updateStep(index, { 
											...step, 
											rest: { ...step.rest!, speed_kmh: parseFloat(e.target.value) || 0 }
										})}
										style={{ 
											width: '100%', 
											padding: '10px 12px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
										⏱️ Duur (min)
									</label>
									<input
										type="number"
										step="0.1"
										value={step.rest.duration_min || 0}
										onChange={(e) => updateStep(index, { 
											...step, 
											rest: { ...step.rest!, duration_min: parseFloat(e.target.value) || 0 }
										})}
										style={{ 
											width: '100%', 
											padding: '10px 12px', 
											border: '2px solid #dee2e6', 
											borderRadius: '8px',
											fontSize: '14px',
											fontWeight: '500'
										}}
									/>
								</div>
							</div>
						</div>

						{/* Repeats for interval_pair */}
						<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', alignItems: 'end', maxWidth: '200px' }}>
							<div>
								<label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
									🔄 Herhalingen
								</label>
								<input
									type="number"
									value={step.repeats || 1}
									onChange={(e) => updateStep(index, { ...step, repeats: parseInt(e.target.value) || 1 })}
									style={{ 
										width: '100%', 
										padding: '10px 12px', 
										border: '2px solid #dee2e6', 
										borderRadius: '8px',
										fontSize: '14px',
										fontWeight: '500'
									}}
								/>
							</div>
						</div>
					</>
				)}
			</div>
		);
	};

	return (
		<div style={{ 
			maxWidth: '900px', 
			margin: '0 auto', 
			padding: '20px', 
			fontFamily: 'Inter, system-ui, sans-serif',
			background: '#ffffff',
			minHeight: '100vh'
		}}>
			{/* Header */}
			<div style={{ 
				display: 'flex', 
				justifyContent: 'space-between', 
				alignItems: 'center', 
				marginBottom: '32px',
				paddingBottom: '16px',
				borderBottom: '2px solid #e9ecef'
			}}>
				<div>
					<h1 style={{ margin: 0, color: '#495057', fontSize: '28px', fontWeight: '700' }}>
						📋 Schema Editor
					</h1>
					<p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '16px' }}>
						Bewerk je 12-weken trainingsschema
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
							<button 
								onClick={() => setHasChanges(true)}
								style={{ 
									fontSize: '12px', 
									padding: '4px 8px', 
									marginTop: '4px',
									background: '#dc3545',
									color: 'white',
									border: 'none',
									borderRadius: '4px',
									cursor: 'pointer'
								}}
							>
								Opnieuw proberen
							</button>
						</div>
					)}
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

			{/* Schema Name */}
			<div style={{ marginBottom: '32px' }}>
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
						padding: '12px 16px', 
						border: '2px solid #dee2e6', 
						borderRadius: '8px',
						fontSize: '16px',
						fontWeight: '500'
					}}
				/>
			</div>

			{/* Week Manager */}
			<div style={{ marginBottom: '32px' }}>
				<h2 style={{ margin: '0 0 16px 0', color: '#495057', fontSize: '20px', fontWeight: '600' }}>
					📅 Week Manager
				</h2>
				<div style={{ 
					display: 'grid', 
					gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))', 
					gap: '8px',
					padding: '16px',
					background: '#f8f9fa',
					borderRadius: '12px',
					border: '1px solid #dee2e6'
				}}>
					{weekPrograms.map((program) => (
						<button
							key={program.week}
							onClick={() => setSelectedWeek(program.week)}
							style={{
								padding: '12px 8px',
								background: selectedWeek === program.week ? '#007bff' : '#ffffff',
								color: selectedWeek === program.week ? 'white' : '#495057',
								border: selectedWeek === program.week ? '2px solid #0056b3' : '2px solid #dee2e6',
								borderRadius: '8px',
								cursor: 'pointer',
								fontSize: '14px',
								fontWeight: '600',
								transition: 'all 0.2s ease',
								textAlign: 'center'
							}}
						>
							Week {program.week}
						</button>
					))}
				</div>
			</div>

			{/* Training Steps */}
			{currentProgram ? (
				<div style={{ marginBottom: '32px' }}>
					<div style={{ 
						display: 'flex', 
						justifyContent: 'space-between', 
						alignItems: 'center', 
						marginBottom: '20px' 
					}}>
						<h2 style={{ margin: 0, color: '#495057' }}>Trainingsstappen - Week {selectedWeek}</h2>
						<button
							onClick={addStep}
							style={{
								background: '#28a745',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								padding: '10px 16px',
								cursor: 'pointer',
								fontWeight: '600'
							}}
						>
							➕ Stap Toevoegen
						</button>
					</div>

					{currentProgram.steps && currentProgram.steps.length > 0 ? (
						<div>
							{currentProgram.steps.map((step, index) => {
								console.log(`Mapping step ${index} for week ${selectedWeek}:`, step);
								return renderStepEditor(step, index);
							})}
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
							<p>Klik op "➕ Stap Toevoegen" om een nieuwe stap toe te voegen.</p>
						</div>
					)}
				</div>
			) : (
				<div style={{ 
					textAlign: 'center', 
					padding: '40px', 
					color: '#6c757d',
					background: '#f8f9fa',
					borderRadius: '8px',
					border: '2px dashed #dee2e6'
				}}>
					<h3>Selecteer een week om te bewerken</h3>
					<p>Klik op een week in de Week Manager om de trainingsstappen te bewerken.</p>
				</div>
			)}
		</div>
	);
};

export default SchemaEditor;