import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PasswordInput from '../components/common/PasswordInput.jsx';
import * as authApi from '../services/api/auth.api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { valid } = await authApi.validateResetToken(token);
        if (!cancelled) setTokenValid(valid);
      } catch {
        if (!cancelled) setTokenValid(false);
      } finally {
        if (!cancelled) setCheckingToken(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Reset password</h1>

        {checkingToken ? (
          <p>Checking your reset link…</p>
        ) : !tokenValid ? (
          <>
            <div className="error-banner">This reset link is invalid or has expired.</div>
            <div className="form-footer">
              <Link to="/forgot-password">Request a new link</Link>
            </div>
          </>
        ) : done ? (
          <div className="success-banner">Your password has been updated. Redirecting to log in…</div>
        ) : (
          <>
            <p>Choose a new password for your account.</p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <PasswordInput
                  id="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="helper-text">At least 8 characters.</div>
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <PasswordInput
                  id="confirmPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {!done && tokenValid && (
          <div className="form-footer">
            <Link to="/login">Back to log in</Link>
          </div>
        )}
      </div>
    </div>
  );
}