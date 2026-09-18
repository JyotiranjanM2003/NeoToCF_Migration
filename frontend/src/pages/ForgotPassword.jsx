import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as authApi from '../services/api/auth.api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'Too many reset requests. Please wait a few minutes and try again.'
          : err.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Forgot password</h1>
        <p>Enter your account email and we'll send you a reset link.</p>

        {error && <div className="error-banner">{error}</div>}

        {submitted ? (
          <div className="success-banner">
            If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="form-footer">
          <Link to="/login">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}