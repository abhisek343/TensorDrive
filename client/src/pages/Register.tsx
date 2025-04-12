// client/src/pages/Register.tsx
import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom'; // Import Link

// Define API base URL
const API_BASE_URL = 'http://localhost:5000';

const Register: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // ... (handleSubmit logic remains the same as before) ...
        event.preventDefault(); setMessage(''); setIsLoading(true);
        if (!username.trim()) { setMessage('Username cannot be empty.'); setIsLoading(false); return; }
        if (password.length < 6) { setMessage('Password must be at least 6 characters long.'); setIsLoading(false); return; }
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ username, password }), });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message || `HTTP error! Status: ${response.status}`); }
            setMessage(`Registration successful for ${data.user?.username}! You can now log in.`);
            setUsername(''); setPassword('');
        } catch (error) { console.error("Registration error:", error); setMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
        } finally { setIsLoading(false); }
    };

    // ... (Styles remain the same) ...
    const formStyle: React.CSSProperties = { /* ... */ };
    const inputStyle: React.CSSProperties = { /* ... */ };
    const buttonStyle: React.CSSProperties = { /* ... */ };
    const messageStyle: React.CSSProperties = { /* ... */ };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <form onSubmit={handleSubmit} style={formStyle}>
                <h2>Register New User</h2>
                {/* ... (Username and Password inputs remain the same) ... */}
                 <label htmlFor="username">Username:</label>
                 <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required style={inputStyle} disabled={isLoading} />
                 <label htmlFor="password">Password:</label>
                 <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={inputStyle} disabled={isLoading} />

                <button type="submit" disabled={isLoading} style={buttonStyle}>
                    {isLoading ? 'Registering...' : 'Register'}
                </button>

                {message && ( <div style={messageStyle}> {message} </div> )}

                {/* Link to Login page */}
                <p style={{marginTop: '15px', textAlign: 'center'}}>
                    Already have an account? <Link to="/login">Login here</Link>
                </p>
            </form>
        </div>
    );
};

export default Register;