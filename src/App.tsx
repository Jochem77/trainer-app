import React, { useState } from "react";

const App: React.FC = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !password) {
			setError("Vul zowel e-mail als wachtwoord in.");
			return;
		}
		setError("");
		// Hier kun je de loginlogica toevoegen
		alert(`Ingelogd als: ${email}`);
	};

	return (
		<div style={{ maxWidth: 400, margin: "40px auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 }}>
			<h2>Login</h2>
			<form onSubmit={handleSubmit}>
				<div style={{ marginBottom: 16 }}>
					<label htmlFor="email">E-mail</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={e => setEmail(e.target.value)}
						style={{ width: "100%", padding: 8, marginTop: 4 }}
						required
					/>
				</div>
				<div style={{ marginBottom: 16 }}>
					<label htmlFor="password">Wachtwoord</label>
					<input
						id="password"
						type="password"
						value={password}
						onChange={e => setPassword(e.target.value)}
						style={{ width: "100%", padding: 8, marginTop: 4 }}
						required
					/>
				</div>
				{error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
				<button type="submit" style={{ width: "100%", padding: 10 }}>Login</button>
			</form>
		</div>
	);
};

export default App;
