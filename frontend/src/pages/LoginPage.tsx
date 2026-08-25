import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Zap, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import './LoginPage.css';

export default function LoginPage() {
  const { login, setup, isAuthenticated } = useAuth();
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
      return;
    }

    authAPI.checkSetup()
      .then((res) => {
        setIsSetup(res.data.setupRequired);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isSetup) {
        if (!name.trim()) {
          toast.error('Name is required');
          setSubmitting(false);
          return;
        }
        await setup(email, password, name);
        toast.success('Account created! Welcome to ProSource.');
      } else {
        await login(email, password);
        toast.success('Welcome back!');
      }
      window.location.href = '/dashboard';
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-bg" />
        <div className="loading-container">
          <div className="spinner spinner-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-bg" />

      {/* Floating orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      <div className="login-container slide-up">
        <div className="login-card glass-card">
          {/* Logo */}
          <div className="login-header">
            <div className="login-logo">
              <Zap size={28} />
            </div>
            <h1 className="login-title">ProSource</h1>
            <p className="login-subtitle">powered by Protype</p>
          </div>

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            <p className="login-description">
              {isSetup
                ? 'Create your admin account to get started'
                : 'Sign in to your dashboard'}
            </p>

            {isSetup && (
              <div className="form-group">
                <label className="form-label" htmlFor="login-name">Full Name</label>
                <input
                  id="login-name"
                  type="text"
                  className="form-input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={submitting}
            >
              {submitting ? (
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              ) : isSetup ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>Outreach & Campaign Management</p>
          </div>
        </div>
      </div>
    </div>
  );
}
