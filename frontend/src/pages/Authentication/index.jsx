import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdOutlineHealthAndSafety,
  MdEmail,
  MdLock,
  MdVisibility,
  MdVisibilityOff,
  MdPerson,
  MdCloudUpload,
  MdArrowForward,
  MdCheckCircle,
  MdFavorite,
  MdMonitorHeart,
} from 'react-icons/md';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebase';

const API = 'http://127.0.0.1:5000';

const inputClass =
  'w-full rounded-xl border border-sky-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10';
const labelClass = 'mb-2 block text-sm font-semibold text-slate-700';

const Authentication = () => {
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [mailid, setMailid] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Patient');
  const [file, setFile] = useState(null);

  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [smoking, setSmoking] = useState('');
  const [alcohol, setAlcohol] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [healthGoals, setHealthGoals] = useState('');

  const [degree, setDegree] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [certifications, setCertifications] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [city, setCity] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');

  const finishLogin = (user) => {
    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', JSON.stringify(user));
    navigate('/');
    window.location.reload();
  };

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      event.target.value = '';
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError('Profile image must be smaller than 5 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setFile(selected);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const email = mailid.trim().toLowerCase();
    if (!email || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (isRegister && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (isRegister && password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = { mailid: email, password };
      if (isRegister) {
        payload.name = name.trim();
        payload.role = role;
      }

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || result.error || `Request failed (${response.status}).`);
      }
      if (!result.user) throw new Error('The server did not return user information.');

      localStorage.setItem('auth', 'true');
      localStorage.setItem('user', JSON.stringify(result.user));

      if (isRegister) {
        if (file) {
          const formData = new FormData();
          formData.append('profilePic', file);
          formData.append('mailid', email);
          const uploadResponse = await fetch(`${API}/uploadprofilepic`, {
            method: 'POST',
            body: formData,
          });
          if (!uploadResponse.ok) {
            setError('Account created, but profile image upload failed. You can continue.');
          }
        }
        setShowHealthForm(true);
        setSuccess('Account created! Complete your health profile.');
      } else {
        finishLogin(result.user);
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the server. Check that the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      const googleResult = await signInWithPopup(auth, googleProvider);
      const idToken = await googleResult.user.getIdToken();

      const response = await fetch(`${API}/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ idToken, role }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || result.error || `Google login failed (${response.status}).`);
      }
      if (!result.user) throw new Error('The server did not return user information.');
      finishLogin(result.user);
    } catch (err) {
      const message =
        err.code === 'auth/popup-closed-by-user'
          ? 'Google sign-in window was closed. Please try again.'
          : err.code === 'auth/unauthorized-domain'
            ? 'This domain is not authorized in Firebase Authentication settings.'
            : err.message || 'Google sign-in failed. Please try again.';
      setError(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleHealthInfo = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    let currentUser;
    try {
      currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      currentUser = null;
    }

    if (!currentUser?.mailid) {
      setError('Your session was not found. Please log in again.');
      return;
    }

    const healthData = {
      mailid: currentUser.mailid,
      dob,
      gender,
      height,
      weight,
      medications,
      allergies,
      smoking,
      alcohol,
      emergencyContact,
      healthGoals,
    };

    if (currentUser.role === 'Doctor') {
      Object.assign(healthData, {
        degree,
        specialization,
        yearsOfExperience,
        certifications,
        clinicAddress,
        consultationFee,
        city,
        portfolioUrl,
      });
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/healthinfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(healthData),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || result.error || `Could not save health information (${response.status}).`);
      }
      if (result.user) localStorage.setItem('user', JSON.stringify(result.user));
      setSuccess('Profile saved successfully!');
      navigate('/');
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not save your health information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister((previous) => !previous);
    setShowHealthForm(false);
    setShowPassword(false);
    setError('');
    setSuccess('');
    setName('');
    setMailid('');
    setPassword('');
    setFile(null);
  };

  const renderField = (label, value, setter, placeholder, type = 'text', required = false) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(event) => setter(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );

  const renderSelect = (label, value, setter, options, required = false) => (
    <div>
      <label className={labelClass}>{label}</label>
      <select className={inputClass} value={value} onChange={(event) => setter(event.target.value)} required={required}>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );

  const RolePicker = () => (
    <div>
      <label className={labelClass}>Continue as</label>
      <div className="grid grid-cols-2 gap-3">
        {['Patient', 'Doctor'].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRole(item)}
            className={`rounded-xl border px-4 py-3 font-semibold transition ${
              role === item
                ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-500/10'
                : 'border-slate-200 bg-white text-slate-500 hover:border-sky-300'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-sky-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-sky-300/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-blue-300/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.14),transparent_62%)]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/20">
            <MdOutlineHealthAndSafety size={29} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">Health<span className="text-sky-600">AI</span></p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Intelligent healthcare</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm sm:flex">
          <MdCheckCircle className="text-sky-600" size={17} />
          Your health, understood
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 px-5 pb-12 pt-4 sm:px-10 lg:grid-cols-2 lg:gap-20 lg:px-16">
        <div className="hidden text-slate-900 lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-4 py-2 text-sm font-medium text-sky-800 shadow-sm">
            <MdFavorite size={17} />
            Healthcare, powered by AI
          </div>
          <h1 className="max-w-xl text-5xl font-bold leading-[1.15] tracking-tight xl:text-6xl">
            Better insights.
            <span className="mt-2 block text-sky-600">Healthier decisions.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-600">
            Understand your medical reports, organize your health information, and explore healthcare insights through one intelligent platform.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-2xl border border-sky-100 bg-white/75 p-5 shadow-sm">
              <MdMonitorHeart className="mb-4 text-sky-600" size={28} />
              <p className="font-semibold text-slate-900">Health insights</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Make medical information easier to understand.</p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white/75 p-5 shadow-sm">
              <MdOutlineHealthAndSafety className="mb-4 text-sky-600" size={28} />
              <p className="font-semibold text-slate-900">One health profile</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Keep your profile and appointments organized.</p>
            </div>
          </div>
          <p className="mt-8 text-xs leading-6 text-slate-500">
            AI-generated explanations are informational and are not a substitute for professional medical advice.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-xl shadow-sky-900/10 sm:p-9">
            {showHealthForm ? (
              <>
                <div className="mb-7">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <MdOutlineHealthAndSafety size={28} />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Complete your profile</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Add health information to personalize your experience. Optional fields can be left blank.</p>
                </div>

                <form onSubmit={handleHealthInfo} className="space-y-4">
                  {renderField('Date of birth', dob, setDob, '', 'date')}
                  {renderSelect('Gender', gender, setGender, ['Male', 'Female', 'Other'])}
                  <div className="grid grid-cols-2 gap-3">
                    {renderField('Height (cm)', height, setHeight, 'e.g. 170', 'number')}
                    {renderField('Weight (kg)', weight, setWeight, 'e.g. 65', 'number')}
                  </div>
                  {renderField('Medications', medications, setMedications, 'Current medications')}
                  {renderField('Allergies', allergies, setAllergies, 'Known allergies')}
                  {renderSelect('Smoking', smoking, setSmoking, ['Yes', 'No'])}
                  {renderSelect('Alcohol consumption', alcohol, setAlcohol, ['Yes', 'No'])}
                  {renderField('Emergency contact', emergencyContact, setEmergencyContact, 'Phone number')}
                  {renderField('Health goals', healthGoals, setHealthGoals, 'Your health goals')}

                  {currentRoleIsDoctor() && (
                    <div className="space-y-4 rounded-2xl bg-sky-50 p-4">
                      <h3 className="font-bold text-slate-800">Professional details</h3>
                      {renderField('Degree', degree, setDegree, 'MBBS, MD...')}
                      {renderField('Specialization', specialization, setSpecialization, 'e.g. Cardiology')}
                      {renderField('Years of experience', yearsOfExperience, setYearsOfExperience, 'Years', 'number')}
                      {renderField('Certifications', certifications, setCertifications, 'Certifications')}
                      {renderField('Hospital / Clinic', clinicAddress, setClinicAddress, 'Clinic address')}
                      {renderField('City', city, setCity, 'City')}
                      {renderField('Consultation fee', consultationFee, setConsultationFee, 'Fee')}
                      {renderField('Portfolio URL', portfolioUrl, setPortfolioUrl, 'https://...')}
                    </div>
                  )}

                  {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                  {success && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">{success}</p>}
                  <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-4 font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:opacity-60">
                    {loading ? 'Saving profile...' : 'Save health profile'} {!loading && <MdArrowForward size={20} />}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    {isRegister ? <MdPerson size={28} /> : <MdOutlineHealthAndSafety size={28} />}
                  </div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">{isRegister ? 'Create your account' : 'Welcome back'}</p>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">{isRegister ? 'Join HealthAI' : 'Sign in'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {isRegister ? 'Create your account to get started with smarter healthcare.' : 'Sign in to access your health dashboard and reports.'}
                  </p>
                </div>

                <div className="space-y-5">
                  <RolePicker />

                  {!isRegister && (
                    <>
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || loading}
                        className="flex w-full items-center justify-center gap-3 rounded-xl border border-sky-200 bg-white px-5 py-3.5 font-semibold text-slate-700 shadow-sm transition hover:border-sky-400 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {googleLoading ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                        ) : (
                          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="20" height="20" />
                        )}
                        {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or use email</span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                    </>
                  )}

                  <form onSubmit={handleAuth} className="space-y-5">
                    {isRegister && (
                      <>
                        {renderField('Full name', name, setName, 'Enter your full name', 'text', true)}
                        <div>
                          <label className={labelClass}>Profile picture <span className="font-normal text-slate-400">(optional)</span></label>
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-sky-200 p-4 transition hover:border-sky-500 hover:bg-sky-50/50">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><MdCloudUpload size={25} /></div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-700">{file ? file.name : 'Upload profile image'}</p>
                              <p className="mt-1 text-xs text-slate-400">Image file, up to 5 MB</p>
                            </div>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                          </label>
                        </div>
                      </>
                    )}

                    <div>
                      <label className={labelClass}>Email address</label>
                      <div className="relative">
                        <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input className={`${inputClass} pl-12`} type="email" autoComplete="email" placeholder="you@example.com" value={mailid} onChange={(event) => setMailid(event.target.value)} required />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Password</label>
                      <div className="relative">
                        <MdLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                          className={`${inputClass} pl-12 pr-12`}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={isRegister ? 'new-password' : 'current-password'}
                          placeholder={isRegister ? 'Create a strong password' : 'Enter your password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          minLength={isRegister ? 6 : undefined}
                          required
                        />
                        <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                          {showPassword ? <MdVisibilityOff size={21} /> : <MdVisibility size={21} />}
                        </button>
                      </div>
                      {isRegister && <p className="mt-2 text-xs text-slate-400">Use at least 6 characters.</p>}
                    </div>

                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
                    {success && <p role="status" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800">{success}</p>}

                    <button type="submit" disabled={loading || googleLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-4 font-bold text-white shadow-lg shadow-sky-600/20 transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-sky-600/30 disabled:cursor-not-allowed disabled:opacity-60">
                      {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in to HealthAI'}
                      {!loading && <MdArrowForward size={20} />}
                    </button>
                  </form>
                </div>

                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs text-slate-400">HEALTHCARE, SIMPLIFIED</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                <p className="text-center text-sm text-slate-500">
                  {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button type="button" onClick={switchMode} className="font-bold text-sky-700 transition hover:text-sky-900">
                    {isRegister ? 'Sign in' : 'Create account'}
                  </button>
                </p>
              </>
            )}
          </div>

          <p className="mt-5 text-center text-xs leading-6 text-slate-500">
            By continuing, you agree to use HealthAI responsibly.<br />
            Protect your health information and keep your password private.
          </p>
        </div>
      </section>
    </main>
  );

  function currentRoleIsDoctor() {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
      return currentUser?.role === 'Doctor';
    } catch {
      return false;
    }
  }
};

export default Authentication;
