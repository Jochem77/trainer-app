import React, { useState, useEffect } from 'react';
import schema from '../schema.json';
import { supabase } from './lib/supabase';

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

type SchemaEditorProps = {
	onBack: () => void;
	userId?: string;
};

const SchemaEditor: React.FC<SchemaEditorProps> = ({ onBack, userId }) => {
	const [weekPrograms, setWeekPrograms] = useState<WeekProgram[]>(schema as WeekProgram[]);
	const [selectedWeek, setSelectedWeek] = useState<number>(1);
	const [hasChanges, setHasChanges] = useState(false);
	const [loading, setLoading] = useState(false);
	const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | ''>('');
	const [lastError, setLastError] = useState<string>('');
	const [schemaName, setSchemaName] = useState<string>('Mijn Trainingsschema');

	// Debug log
	console.log('SchemaEditor received userId:', userId);

	const currentProgram = weekPrograms.find(p => p.week === selectedWeek);

	// Load user schema from Supabase
	useEffect(() => {
		const loadUserSchema = async () => {
			if (!userId) return;
			
			setLoading(true);
			try {
				console.log('Attempting to load schema for userId:', userId);
				
				// Try loading with schema_name column first
				let { data, error } = await supabase
					.from('user_schemas')
					.select('schema_data, schema_name')
					.eq('user_id', userId)
					.single();

				console.log('First load attempt result:', { data, error });

				// If schema_name column doesn't exist, fallback to old structure
				if (error && (error.message.includes('schema_name') || error.message.includes('column') || error.code === '42703')) {
					console.warn('schema_name column issue detected, using fallback load method');
					console.log('Original error:', error);
					
					({ data, error } = await supabase
						.from('user_schemas')
						.select('schema_data')
						.eq('user_id', userId)
						.single());
						
					console.log('Fallback load attempt result:', { data, error });
				}

				if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
					console.error('Final error loading schema:', error);
					setSaveStatus('error');
				} else if (data?.schema_data) {
					console.log('Schema loaded successfully');
					setWeekPrograms(data.schema_data);
					setSchemaName(data.schema_name || 'Mijn Trainingsschema');
					setSaveStatus('saved');
				} else {
					console.log('No existing schema found, using default');
				}
			} catch (err) {
				console.error('Exception while loading schema:', err);
				setSaveStatus('error');
			} finally {
				setLoading(false);
			}
		};

		loadUserSchema();
	}, [userId]);

	// Auto-save to Supabase when changes are made
	useEffect(() => {
		const saveUserSchema = async () => {
			if (!userId || !hasChanges) return;
			
			setSaveStatus('saving');
			try {
				console.log('Attempting to save schema with userId:', userId);
				console.log('Schema data length:', JSON.stringify(weekPrograms).length);
				console.log('Schema name:', schemaName);
				
				// First check if a record exists for this user
				const { data: existingData } = await supabase
					.from('user_schemas')
					.select('id')
					.eq('user_id', userId)
					.single();
				
				console.log('Existing record check:', existingData);
				
				let result;
				if (existingData) {
					// Update existing record
					console.log('Updating existing record...');
					result = await supabase
						.from('user_schemas')
						.update({
							schema_data: weekPrograms,
							schema_name: schemaName,
							updated_at: new Date().toISOString()
						})
						.eq('user_id', userId);
				} else {
					// Insert new record
					console.log('Inserting new record...');
					result = await supabase
						.from('user_schemas')
						.insert({
							user_id: userId,
							schema_data: weekPrograms,
							schema_name: schemaName
						});
				}

				console.log('Save result:', result);

				// Fallback for databases without schema_name column
				if (result.error && (result.error.message.includes('schema_name') || result.error.message.includes('column') || result.error.code === '42703')) {
					console.warn('schema_name column issue detected, using fallback save method');
					console.log('Original error:', result.error);
					
					if (existingData) {
						result = await supabase
							.from('user_schemas')
							.update({
								schema_data: weekPrograms,
								updated_at: new Date().toISOString()
							})
							.eq('user_id', userId);
					} else {
						result = await supabase
							.from('user_schemas')
							.insert({
								user_id: userId,
								schema_data: weekPrograms
							});
					}
					
					console.log('Fallback save result:', result);
				}

				if (result.error) {
					console.error('Final error saving schema:', result.error);
					setLastError(result.error.message || 'Unknown error');
					setSaveStatus('error');
				} else {
					console.log('Schema saved successfully');
					setLastError('');
					setSaveStatus('saved');
					setHasChanges(false);
				}
			} catch (err) {
				console.error('Exception while saving schema:', err);
				setLastError(err instanceof Error ? err.message : 'Unknown exception');
				setSaveStatus('error');
			}
		};

		// Debounce auto-save (wait 2 seconds after last change)
		const timeoutId = setTimeout(saveUserSchema, 2000);
		return () => clearTimeout(timeoutId);
	}, [weekPrograms, hasChanges, userId, schemaName]);

	const updateStep = (stepIndex: number, updatedStep: Step) => {
		if (!currentProgram) return;
		
		const updatedPrograms = weekPrograms.map(program => {
			if (program.week === selectedWeek) {
				const newSteps = [...program.steps];
				newSteps[stepIndex] = updatedStep;
				return { ...program, steps: newSteps };
			}
			return program;
		});
		
		setWeekPrograms(updatedPrograms);
		setHasChanges(true);
	};

	const addStep = () => {
		if (!currentProgram) return;
		
		const newStep: Step = {
			type: "steady",
			duration_min: 5,
			speed_kmh: 6.0,
			label: "Nieuwe stap",
			repeats: 1
		};

		const updatedPrograms = weekPrograms.map(program => {
			if (program.week === selectedWeek) {
				return { ...program, steps: [...program.steps, newStep] };
			}
			return program;
		});
		
		setWeekPrograms(updatedPrograms);
		setHasChanges(true);
	};

	const removeStep = (stepIndex: number) => {
		if (!currentProgram) return;
		
		const updatedPrograms = weekPrograms.map(program => {
			if (program.week === selectedWeek) {
				const newSteps = program.steps.filter((_, index) => index !== stepIndex);
				return { ...program, steps: newSteps };
			}
			return program;
		});
		
		setWeekPrograms(updatedPrograms);
		setHasChanges(true);
	};

	const updateCalories = (calories: number) => {
		const updatedPrograms = weekPrograms.map(program => {
			if (program.week === selectedWeek) {
				return { ...program, cal: calories };
			}
			return program;
		});
		
		setWeekPrograms(updatedPrograms);
		setHasChanges(true);
	};

	const calculateCalories = () => {
		if (!currentProgram) return 0;
		
		let totalCalories = 0;
		
		// Meer realistische calorieën berekening voor hardlopen/joggen
		// Gebaseerd op MET (Metabolic Equivalent of Task) waardes - verhoogd voor nauwkeurigheid
		const getCaloriesPerMinute = (speed: number) => {
			// Voor een gemiddelde persoon, calorieën per minuut bij verschillende snelheden
			if (speed <= 4) return 6;   // wandelen langzaam
			if (speed <= 6) return 10;  // wandelen stevig / joggen zeer langzaam
			if (speed <= 8) return 13;  // joggen langzaam
			if (speed <= 10) return 18; // joggen gemiddeld
			if (speed <= 12) return 21; // joggen snel / hardlopen langzaam
			if (speed <= 14) return 24; // hardlopen gemiddeld
			if (speed <= 16) return 27; // hardlopen snel
			return 30; // hardlopen zeer snel
		};
		
		for (const step of currentProgram.steps) {
			if (step.type === 'steady') {
				const totalDuration = step.duration_min * step.repeats;
				const caloriesPerMin = getCaloriesPerMinute(step.speed_kmh);
				const calories = totalDuration * caloriesPerMin;
				totalCalories += calories;
			} else if (step.type === 'interval_pair') {
				for (let i = 0; i < step.repeats; i++) {
					// Hard interval
					const hardCaloriesPerMin = getCaloriesPerMinute(step.hard.speed_kmh);
					const hardCalories = step.hard.duration_min * hardCaloriesPerMin;
					
					// Rest interval
					const restCaloriesPerMin = getCaloriesPerMinute(step.rest.speed_kmh);
					const restCalories = step.rest.duration_min * restCaloriesPerMin;
					
					totalCalories += hardCalories + restCalories;
				}
			}
		}
		
		return Math.round(totalCalories);
	};

	const handleCalculateCalories = () => {
		const calculated = calculateCalories();
		updateCalories(calculated);
	};

	const addWeek = () => {
		const maxWeek = Math.max(...weekPrograms.map(p => p.week));
		const newWeek: WeekProgram = {
			week: maxWeek + 1,
			steps: [
				{
					type: "steady",
					label: "Warming-up",
					duration_min: 5,
					speed_kmh: 6.0,
					repeats: 1
				},
				{
					type: "steady",
					label: "Cooling down",
					duration_min: 5,
					speed_kmh: 6.0,
					repeats: 1
				}
			],
			cal: 100
		};
		setWeekPrograms([...weekPrograms, newWeek]);
		setSelectedWeek(newWeek.week);
		setHasChanges(true);
	};

	const insertWeek = (afterWeek: number) => {
		const sortedPrograms = [...weekPrograms].sort((a, b) => a.week - b.week);
		const insertIndex = sortedPrograms.findIndex(p => p.week === afterWeek) + 1;
		
		// Verschuif alle volgende weken met 1
		const updatedPrograms = sortedPrograms.map(program => {
			if (program.week > afterWeek) {
				return { ...program, week: program.week + 1 };
			}
			return program;
		});

		const newWeek: WeekProgram = {
			week: afterWeek + 1,
			steps: [
				{
					type: "steady",
					label: "Warming-up",
					duration_min: 5,
					speed_kmh: 6.0,
					repeats: 1
				},
				{
					type: "steady",
					label: "Cooling down",
					duration_min: 5,
					speed_kmh: 6.0,
					repeats: 1
				}
			],
			cal: 100
		};

		updatedPrograms.splice(insertIndex, 0, newWeek);
		setWeekPrograms(updatedPrograms);
		setSelectedWeek(newWeek.week);
		setHasChanges(true);
	};

	const copyWeek = (weekToCopy: number) => {
		const sourceProg = weekPrograms.find(p => p.week === weekToCopy);
		if (!sourceProg) return;

		const maxWeek = Math.max(...weekPrograms.map(p => p.week));
		const newWeek: WeekProgram = {
			...sourceProg,
			week: maxWeek + 1
		};
		
		setWeekPrograms([...weekPrograms, newWeek]);
		setSelectedWeek(newWeek.week);
		setHasChanges(true);
	};

	const deleteWeek = (weekToDelete: number) => {
		if (weekPrograms.length <= 1) return; // Minimaal 1 week behouden
		
		const filteredPrograms = weekPrograms.filter(p => p.week !== weekToDelete);
		setWeekPrograms(filteredPrograms);
		
		// Selecteer een andere week als de huidige wordt verwijderd
		if (selectedWeek === weekToDelete) {
			const firstAvailable = filteredPrograms[0]?.week || 1;
			setSelectedWeek(firstAvailable);
		}
		setHasChanges(true);
	};

	const moveWeek = (fromWeek: number, toWeek: number) => {
		if (fromWeek === toWeek) return;
		
		const fromIndex = weekPrograms.findIndex(p => p.week === fromWeek);
		const toIndex = weekPrograms.findIndex(p => p.week === toWeek);
		
		if (fromIndex === -1 || toIndex === -1) return;
		
		const updatedPrograms = [...weekPrograms];
		// Wissel de week nummers
		updatedPrograms[fromIndex] = { ...updatedPrograms[fromIndex], week: toWeek };
		updatedPrograms[toIndex] = { ...updatedPrograms[toIndex], week: fromWeek };
		
		setWeekPrograms(updatedPrograms);
		setHasChanges(true);
	};

	const exportSchema = () => {
		const jsonString = JSON.stringify(weekPrograms, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'schema.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const renderStepEditor = (step: Step, index: number) => {
		if (step.type === 'steady') {
			return (
				<div key={index} style={{ 
					background: '#f8f9fa', 
					border: '1px solid #dee2e6', 
					borderRadius: '8px', 
					padding: '16px', 
					marginBottom: '12px' 
				}}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
						<h4 style={{ margin: 0, color: '#2e7d32' }}>Steady Step {index + 1}</h4>
						<button 
							onClick={() => removeStep(index)}
							style={{ 
								background: '#dc3545', 
								color: 'white', 
								border: 'none', 
								borderRadius: '4px', 
								padding: '4px 8px',
								cursor: 'pointer'
							}}
						>
							Verwijder
						</button>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600' }}>Label:</label>
							<input
								type="text"
								value={step.label}
								onChange={(e) => updateStep(index, { ...step, label: e.target.value })}
								style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
							/>
						</div>
						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600' }}>Herhalingen:</label>
							<input
								type="number"
								value={step.repeats}
								onChange={(e) => updateStep(index, { ...step, repeats: parseInt(e.target.value) || 1 })}
								style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
							/>
						</div>
						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600' }}>Duur (min):</label>
							<input
								type="number"
								step="0.1"
								value={step.duration_min}
								onChange={(e) => updateStep(index, { ...step, duration_min: parseFloat(e.target.value) || 0 })}
								style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
							/>
						</div>
						<div>
							<label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600' }}>Snelheid (km/u):</label>
							<input
								type="number"
								step="0.1"
								value={step.speed_kmh}
								onChange={(e) => updateStep(index, { ...step, speed_kmh: parseFloat(e.target.value) || 0 })}
								style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
							/>
						</div>
					</div>
				</div>
			);
		} else if (step.type === 'interval_pair') {
			return (
				<div key={index} style={{ 
					background: '#fff3cd', 
					border: '1px solid #ffeaa7', 
					borderRadius: '8px', 
					padding: '16px', 
					marginBottom: '12px' 
				}}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
						<h4 style={{ margin: 0, color: '#856404' }}>Interval Pair {index + 1}</h4>
						<button 
							onClick={() => removeStep(index)}
							style={{ 
								background: '#dc3545', 
								color: 'white', 
								border: 'none', 
								borderRadius: '4px', 
								padding: '4px 8px',
								cursor: 'pointer'
							}}
						>
							Verwijder
						</button>
					</div>
					<div style={{ marginBottom: '12px' }}>
						<label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600' }}>Herhalingen:</label>
						<input
							type="number"
							value={step.repeats}
							onChange={(e) => updateStep(index, { ...step, repeats: parseInt(e.target.value) || 1 })}
							style={{ width: '100px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
						/>
					</div>
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
						<div style={{ background: '#ffebee', padding: '12px', borderRadius: '6px' }}>
							<h5 style={{ margin: '0 0 8px 0', color: '#c62828' }}>Hard Interval</h5>
							<div style={{ marginBottom: '8px' }}>
								<label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>Label:</label>
								<input
									type="text"
									value={step.hard.label}
									onChange={(e) => updateStep(index, { 
										...step, 
										hard: { ...step.hard, label: e.target.value }
									})}
									style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
								/>
							</div>
							<div style={{ marginBottom: '8px' }}>
								<label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>Duur (min):</label>
								<input
									type="number"
									step="0.1"
									value={step.hard.duration_min}
									onChange={(e) => updateStep(index, { 
										...step, 
										hard: { ...step.hard, duration_min: parseFloat(e.target.value) || 0 }
									})}
									style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>Snelheid (km/u):</label>
								<input
									type="number"
									step="0.1"
									value={step.hard.speed_kmh}
									onChange={(e) => updateStep(index, { 
										...step, 
										hard: { ...step.hard, speed_kmh: parseFloat(e.target.value) || 0 }
									})}
									style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
								/>
							</div>
						</div>
						<div style={{ background: '#e3f2fd', padding: '12px', borderRadius: '6px' }}>
							<h5 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>Rest Interval</h5>
							<div style={{ marginBottom: '8px' }}>
								<label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>Label:</label>
								<input
									type="text"
									value={step.rest.label}
									onChange={(e) => updateStep(index, { 
										...step, 
										rest: { ...step.rest, label: e.target.value }
									})}
									style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
								/>
							</div>
							<div style={{ marginBottom: '8px' }}>
								<label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>Duur (min):</label>
								<input
									type="number"
									step="0.1"
									value={step.rest.duration_min}
									onChange={(e) => updateStep(index, { 
										...step, 
										rest: { ...step.rest, duration_min: parseFloat(e.target.value) || 0 }
									})}
									style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
								/>
							</div>
							<div>
								<label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600' }}>Snelheid (km/u):</label>
								<input
									type="number"
									step="0.1"
									value={step.rest.speed_kmh}
									onChange={(e) => updateStep(index, { 
										...step, 
										rest: { ...step.rest, speed_kmh: parseFloat(e.target.value) || 0 }
									})}
									style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px' }}
								/>
							</div>
						</div>
					</div>
				</div>
			);
		}
		return null;
	};

	if (!currentProgram) {
		return <div>Week {selectedWeek} niet gevonden</div>;
	}

	return (
		<div style={{ 
			maxWidth: '900px', 
			margin: '0 auto', 
			padding: '20px', 
			fontFamily: 'Inter, system-ui, sans-serif',
			background: '#ffffff',
			minHeight: '100vh',
			overflowY: 'auto',
			position: 'relative'
		}}>
			<div style={{ 
				display: 'flex', 
				justifyContent: 'space-between', 
				alignItems: 'center', 
				marginBottom: '24px',
				paddingBottom: '16px',
				borderBottom: '2px solid #e9ecef'
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
					<h1 style={{ margin: 0, color: '#2c3e50' }}>Trainingsschema Editor</h1>
					{userId && (
						<div style={{ 
							display: 'flex', 
							alignItems: 'center', 
							gap: '8px',
							padding: '6px 12px',
							borderRadius: '20px',
							fontSize: '14px',
							fontWeight: '600',
							background: saveStatus === 'saved' ? '#d4edda' : 
							           saveStatus === 'saving' ? '#fff3cd' : 
							           saveStatus === 'error' ? '#f8d7da' : '#f8f9fa',
							color: saveStatus === 'saved' ? '#155724' : 
							      saveStatus === 'saving' ? '#856404' : 
							      saveStatus === 'error' ? '#721c24' : '#6c757d'
						}}>
							{saveStatus === 'saved' && '✅ Opgeslagen'}
							{saveStatus === 'saving' && '⏳ Opslaan...'}
							{saveStatus === 'error' && (
								<span title={lastError}>❌ Fout bij opslaan{lastError && `: ${lastError.substring(0, 50)}${lastError.length > 50 ? '...' : ''}`}</span>
							)}
							{saveStatus === '' && '☁️ Cloud sync'}
						</div>
					)}
					{!userId && (
						<div style={{ 
							padding: '6px 12px',
							borderRadius: '20px',
							fontSize: '14px',
							fontWeight: '600',
							background: '#ffeaa7',
							color: '#d63031'
						}}>
							🔐 Login vereist
						</div>
					)}
					
					{/* Debug knop - alleen bij error */}
					{userId && saveStatus === 'error' && (
						<button
							onClick={() => {
								console.log('=== DEBUG INFO ===');
								console.log('User ID:', userId);
								console.log('Schema Name:', schemaName);
								console.log('Week Programs length:', weekPrograms.length);
								console.log('Last Error:', lastError);
								console.log('Has Changes:', hasChanges);
								alert(`Debug info:\nUser: ${userId}\nError: ${lastError}\nCheck console voor meer details`);
							}}
							style={{
								padding: '4px 8px',
								fontSize: '12px',
								background: '#dc3545',
								color: 'white',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer'
							}}
						>
							🔍 Debug
						</button>
					)}
				</div>
				{!userId && (
					<div style={{ 
						padding: '8px 16px',
						borderRadius: '8px',
						background: '#ffeaa7',
						color: '#2d3436',
						fontSize: '14px',
						marginBottom: '16px'
					}}>
						⚠️ Niet ingelogd - wijzigingen worden niet opgeslagen
					</div>
				)}
			</div>
				<button 
					onClick={onBack}
					style={{ 
						background: '#6c757d', 
						color: 'white', 
						border: 'none', 
						borderRadius: '8px', 
						padding: '10px 20px',
						cursor: 'pointer',
						fontWeight: '600'
					}}
				>
					← Terug naar App
				</button>
			</div>

			{/* Schema Naam */}
			<div style={{ marginBottom: '24px' }}>
				<label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>
					📝 Schema Naam:
				</label>
				<input
					type="text"
					value={schemaName}
					onChange={(e) => {
						setSchemaName(e.target.value);
						setHasChanges(true);
					}}
					placeholder="Geef je trainingsschema een naam..."
					style={{ 
						width: '100%',
						padding: '12px 16px', 
						border: '2px solid #dee2e6', 
						borderRadius: '8px', 
						fontSize: '16px',
						fontWeight: '600',
						maxWidth: '400px'
					}}
				/>
			</div>

			{/* Week Manager met drag-and-drop blokjes */}
			<div style={{ marginBottom: '32px' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
					<label style={{ fontSize: '18px', fontWeight: '700', color: '#2c3e50' }}>
						📅 Week Manager
					</label>
					<button
						onClick={addWeek}
						style={{
							background: '#28a745',
							color: 'white',
							border: 'none',
							borderRadius: '6px',
							padding: '8px 12px',
							cursor: 'pointer',
							fontSize: '14px',
							fontWeight: '600'
						}}
					>
						➕ Nieuwe Week
					</button>
				</div>
				
				<div style={{ 
					display: 'flex', 
					flexWrap: 'wrap', 
					gap: '8px', 
					padding: '16px',
					background: '#f8f9fa',
					borderRadius: '12px',
					border: '2px dashed #dee2e6',
					minHeight: '80px'
				}}>
					{weekPrograms
						.sort((a, b) => a.week - b.week)
						.map(program => (
						<div
							key={program.week}
							onClick={() => setSelectedWeek(program.week)}
							style={{
								position: 'relative',
								background: program.week === selectedWeek ? '#007bff' : '#ffffff',
								color: program.week === selectedWeek ? 'white' : '#333',
								border: `2px solid ${program.week === selectedWeek ? '#0056b3' : '#dee2e6'}`,
								borderRadius: '8px',
								padding: '12px 16px',
								cursor: 'pointer',
								minWidth: '80px',
								textAlign: 'center',
								fontWeight: '600',
								transition: 'all 0.2s ease',
								userSelect: 'none',
								boxShadow: program.week === selectedWeek ? '0 4px 12px rgba(0,123,255,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
							}}
							onMouseEnter={(e) => {
								if (program.week !== selectedWeek) {
									e.currentTarget.style.transform = 'translateY(-2px)';
									e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
								}
							}}
							onMouseLeave={(e) => {
								if (program.week !== selectedWeek) {
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
								}
							}}
						>
							<div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>
								Week {program.week}
							</div>
							<div style={{ fontSize: '12px', opacity: 0.8 }}>
								{program.cal ? `${program.cal} cal` : 'Geen cal'}
							</div>
							
							{/* Week acties dropdown */}
							<div style={{ 
								position: 'absolute', 
								top: '4px', 
								right: '4px',
								background: 'rgba(0,0,0,0.1)',
								borderRadius: '4px',
								padding: '2px',
								fontSize: '12px',
								cursor: 'pointer'
							}}
							onClick={(e) => {
								e.stopPropagation();
								// Toggle dropdown menu
								const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
								if (dropdown) {
									dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
								}
							}}>
								⋯
							</div>
							
							{/* Dropdown menu */}
							<div style={{
								position: 'absolute',
								top: '100%',
								right: '0',
								background: 'white',
								border: '1px solid #dee2e6',
								borderRadius: '6px',
								boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
								zIndex: 1000,
								minWidth: '120px',
								display: 'none'
							}}>
								<button
									onClick={(e) => {
										e.stopPropagation();
										insertWeek(program.week);
										(e.currentTarget.parentElement as HTMLElement).style.display = 'none';
									}}
									style={{
										width: '100%',
										padding: '8px 12px',
										border: 'none',
										background: 'transparent',
										textAlign: 'left',
										cursor: 'pointer',
										fontSize: '13px'
									}}
								>
									📄 Invoegen na
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										copyWeek(program.week);
										(e.currentTarget.parentElement as HTMLElement).style.display = 'none';
									}}
									style={{
										width: '100%',
										padding: '8px 12px',
										border: 'none',
										background: 'transparent',
										textAlign: 'left',
										cursor: 'pointer',
										fontSize: '13px'
									}}
								>
									📋 Kopiëren
								</button>
								{weekPrograms.length > 1 && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											if (confirm(`Week ${program.week} verwijderen?`)) {
												deleteWeek(program.week);
											}
											(e.currentTarget.parentElement as HTMLElement).style.display = 'none';
										}}
										style={{
											width: '100%',
											padding: '8px 12px',
											border: 'none',
											background: 'transparent',
											textAlign: 'left',
											cursor: 'pointer',
											fontSize: '13px',
											color: '#dc3545'
										}}
									>
										🗑️ Verwijderen
									</button>
								)}
							</div>
						</div>
					))}
				</div>
				
				<div style={{ marginTop: '12px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
					💡 Tip: Klik op een week om te bewerken. Gebruik ⋯ voor extra acties zoals kopiëren, invoegen of verwijderen.
				</div>
			</div>

			<div style={{ marginBottom: '24px' }}>
				<label style={{ display: 'block', marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>
					Geschatte Calorieën:
				</label>
				<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
					<input
						type="number"
						value={currentProgram.cal || 0}
						onChange={(e) => updateCalories(parseInt(e.target.value) || 0)}
						style={{ 
							padding: '10px', 
							border: '2px solid #dee2e6', 
							borderRadius: '8px', 
							fontSize: '16px',
							width: '150px'
						}}
					/>
					<button
						onClick={handleCalculateCalories}
						style={{
							background: '#17a2b8',
							color: 'white',
							border: 'none',
							borderRadius: '8px',
							padding: '10px 16px',
							cursor: 'pointer',
							fontSize: '14px',
							fontWeight: '600'
						}}
						title="Bereken calorieën op basis van de stappen"
					>
						🔢 Bereken
					</button>
				</div>
			</div>

			<div style={{ marginBottom: '24px' }}>
				<div style={{ 
					display: 'flex', 
					justifyContent: 'space-between', 
					alignItems: 'center', 
					marginBottom: '16px' 
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
						+ Stap Toevoegen
					</button>
				</div>
				
				{currentProgram.steps.map((step, index) => renderStepEditor(step, index))}
			</div>

			<div style={{ 
				display: 'flex', 
				gap: '12px', 
				paddingTop: '16px', 
				borderTop: '2px solid #e9ecef' 
			}}>
				<button 
					onClick={exportSchema}
					style={{ 
						background: '#007bff', 
						color: 'white', 
						border: 'none', 
						borderRadius: '8px', 
						padding: '12px 24px',
						cursor: 'pointer',
						fontWeight: '600',
						fontSize: '16px'
					}}
				>
					📥 Export Schema
				</button>
				{hasChanges && (
					<div style={{ 
						background: '#fff3cd', 
						border: '1px solid #ffeaa7', 
						borderRadius: '8px', 
						padding: '12px 16px', 
						color: '#856404',
						fontWeight: '600',
						display: 'flex',
						alignItems: 'center'
					}}>
						⚠️ Je hebt onopgeslagen wijzigingen
					</div>
				)}
			</div>
		</div>
	);
};

export default SchemaEditor;