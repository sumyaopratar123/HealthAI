import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdOutlineDone, MdPerson, MdEmail, MdCalendarMonth,
  MdMonitorHeart, MdHeight, MdFavorite, MdMedication,
  MdWarningAmber, MdLocalHospital, MdPhone, MdFlag,
  MdWork, MdLocationCity, MdVerifiedUser, MdRefresh,
  MdArrowForward, MdHealthAndSafety, MdEventAvailable,
  MdOutlineMedicalInformation
} from 'react-icons/md';
import './index.css';

const API = 'http://127.0.0.1:5000';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function valueOrNA(value, suffix = '') {
  return value !== undefined &&
    value !== null &&
    String(value).trim() !== ''
    ? `${value}${suffix}`
    : 'Not provided';
}

function dateText(value) {
  if (!value) return 'Not scheduled';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
}

function timeText(value) {
  if (!value || typeof value !== 'string') return 'Not set';

  const parts = value.split(':');

  if (parts.length < 2) return value;

  const date = new Date();
  date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function InfoRow({ icon: Icon, label, value, suffix = '' }) {
  return (
    <div className="hai-info-row">
      <span className="hai-info-icon">
        <Icon size={19} />
      </span>
      <span className="hai-info-label">{label}</span>
      <span className="hai-info-value">
        {valueOrNA(value, suffix)}
      </span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="hai-card">
      <div className="hai-card-heading">
        <span className="hai-card-icon">
          <Icon size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="hai-info-list">{children}</div>
    </section>
  );
}

export default function You() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const refreshUser = () => {
      setUser(getStoredUser());
    };

    window.addEventListener('storage', refreshUser);
    window.addEventListener('focus', refreshUser);

    return () => {
      window.removeEventListener('storage', refreshUser);
      window.removeEventListener('focus', refreshUser);
    };
  }, []);

  const health =
    user?.health_info && typeof user.health_info === 'object'
      ? user.health_info
      : {};

  const email = user?.mailid || user?.email || '';
  const name = user?.name || user?.displayName || 'HealthAI User';
  const role = user?.role || 'Member';
  const isDoctor = role.toLowerCase() === 'doctor';
  const picture = user?.profilePic || user?.photoURL || '';

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const fetchAppointments = useCallback(async () => {
    if (!email) {
      setAppointments([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const path = isDoctor
        ? `/appointments/${encodeURIComponent(email)}`
        : `/patient-appointments/${encodeURIComponent(email)}`;

      const response = await fetch(`${API}${path}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Request failed (${response.status})`
        );
      }

      setAppointments(
        Array.isArray(data.appointments)
          ? data.appointments
          : []
      );

      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err.message ||
        'Could not load appointments. Check that Flask is running.'
      );
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [email, isDoctor]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const upcoming = useMemo(() => {
    return appointments
      .filter((item) => item.booked)
      .filter((item) => {
        if (!item.appointmentDate) return true;

        const date = new Date(item.appointmentDate);

        return (
          Number.isNaN(date.getTime()) ||
          date >= new Date(new Date().toDateString())
        );
      })
      .sort(
        (a, b) =>
          new Date(a.appointmentDate || 0) -
          new Date(b.appointmentDate || 0)
      );
  }, [appointments]);

  if (!user || !email) {
    return (
      <main className="hai-page">
        <div className="hai-orb hai-orb-one" />
        <div className="hai-orb hai-orb-two" />

        <section className="hai-empty-state">
          <div className="hai-empty-icon">
            <MdHealthAndSafety size={34} />
          </div>

          <p className="hai-eyebrow">
            YOUR HEALTH, IN ONE PLACE
          </p>

          <h1>Sign in to view your profile</h1>

          <p>
            Your profile, health information and appointments
            will appear here after you sign in.
          </p>

          <button
            className="hai-primary-button"
            onClick={() => navigate('/auth')}
          >
            Go to sign in <MdArrowForward />
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="hai-page">
      <div className="hai-orb hai-orb-one" />
      <div className="hai-orb hai-orb-two" />

      <div className="hai-dashboard">
        <header className="hai-hero">
          <div className="hai-eyebrow">
            <MdVerifiedUser />
            HEALTHAI PERSONAL DASHBOARD
          </div>

          <h1>
            Your health, <span>understood.</span>
          </h1>

          <p>
            Review your profile, keep track of health details
            and stay on top of appointments.
          </p>

          <div className="hai-hero-art">
            <MdMonitorHeart size={58} />
          </div>
        </header>

        <section className="hai-profile-strip">
          <div className="hai-avatar-wrap">
            {picture ? (
              <img
                className="hai-avatar"
                src={
                  picture.startsWith('http')
                    ? picture
                    : `${API}/uploads/${picture}`
                }
                alt="Profile"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="hai-avatar hai-avatar-fallback">
                {initials || 'H'}
              </div>
            )}
          </div>

          <div className="hai-profile-main">
            <div className="hai-name-line">
              <h2>{name}</h2>
              <span className={`hai-role ${isDoctor ? 'doctor' : ''}`}>
                {role}
              </span>
            </div>

            <p>
              <MdEmail /> {email}
            </p>

            <span className="hai-profile-note">
              <MdVerifiedUser /> Your account overview
            </span>
          </div>

          <button
            className="hai-refresh-button"
            onClick={fetchAppointments}
            disabled={loading}
          >
            <MdRefresh className={loading ? 'hai-spin' : ''} />
            {loading ? 'Refreshing…' : 'Refresh appointments'}
          </button>
        </section>

        <div className="hai-section-title">
          <div>
            <p className="hai-eyebrow">PROFILE OVERVIEW</p>
            <h2>Your information</h2>
          </div>

          <span className="hai-private">
            <MdVerifiedUser /> Private profile
          </span>
        </div>

        <div className="hai-grid">
          <SectionCard
            icon={MdPerson}
            title="Personal information"
            subtitle="Basic account details"
          >
            <InfoRow icon={MdPerson} label="Full name" value={name} />
            <InfoRow icon={MdEmail} label="Email address" value={email} />
            <InfoRow
              icon={MdCalendarMonth}
              label="Date of birth"
              value={health.dob}
            />
            <InfoRow
              icon={MdVerifiedUser}
              label="Account role"
              value={role}
            />
          </SectionCard>

          <SectionCard
            icon={MdMonitorHeart}
            title="Health information"
            subtitle="Your health profile at a glance"
          >
            <InfoRow
              icon={MdPerson}
              label="Gender"
              value={health.gender}
            />
            <InfoRow
              icon={MdHeight}
              label="Height"
              value={health.height}
              suffix={health.height ? ' cm' : ''}
            />
            <InfoRow
              icon={MdMonitorHeart}
              label="Weight"
              value={health.weight}
              suffix={health.weight ? ' kg' : ''}
            />
            <InfoRow
              icon={MdMedication}
              label="Medications"
              value={health.medications}
            />
            <InfoRow
              icon={MdWarningAmber}
              label="Allergies"
              value={health.allergies}
            />
            <InfoRow
              icon={MdFavorite}
              label="Smoking"
              value={health.smoking}
            />
            <InfoRow
              icon={MdFavorite}
              label="Alcohol"
              value={health.alcohol}
            />
            <InfoRow
              icon={MdPhone}
              label="Emergency contact"
              value={health.emergencyContact}
            />
            <InfoRow
              icon={MdFlag}
              label="Health goals"
              value={health.healthGoals}
            />
          </SectionCard>

          {isDoctor && (
            <SectionCard
              icon={MdWork}
              title="Professional information"
              subtitle="Your clinical profile"
            >
              <InfoRow
                icon={MdOutlineMedicalInformation}
                label="Degree"
                value={health.degree}
              />
              <InfoRow
                icon={MdLocalHospital}
                label="Specialization"
                value={health.specialization}
              />
              <InfoRow
                icon={MdWork}
                label="Experience"
                value={health.yearsOfExperience}
                suffix={health.yearsOfExperience ? ' years' : ''}
              />
              <InfoRow
                icon={MdLocalHospital}
                label="Clinic / Hospital"
                value={health.clinicAddress}
              />
              <InfoRow
                icon={MdLocationCity}
                label="City"
                value={health.city}
              />
              <InfoRow
                icon={MdVerifiedUser}
                label="Certifications"
                value={health.certifications}
              />
              <InfoRow
                icon={MdFavorite}
                label="Consultation fee"
                value={health.consultationFee}
              />
              <InfoRow
                icon={MdArrowForward}
                label="Portfolio URL"
                value={health.portfolioUrl}
              />
            </SectionCard>
          )}
        </div>

        <section className="hai-appointments">
          <div className="hai-appointments-heading">
            <div>
              <p className="hai-eyebrow">YOUR SCHEDULE</p>
              <h2>Upcoming appointments</h2>
              <p>Your booked consultations in one place.</p>
            </div>

            <div className="hai-booked-count">
              <strong>{upcoming.length}</strong>
              <span>Booked</span>
            </div>
          </div>

          {error && (
            <div className="hai-error" role="alert">
              <span>{error}</span>
              <button onClick={fetchAppointments}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="hai-no-appointments">
              <span className="hai-loader" />
              Loading appointments…
            </div>
          ) : upcoming.length ? (
            <div className="hai-table-scroll">
              <table className="hai-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Duration</th>
                    <th>{isDoctor ? 'Patient email' : 'Account email'}</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {upcoming.map((item, index) => (
                    <tr
                      key={
                        item._id ||
                        `${item.appointmentDate || 'date'}-${index}`
                      }
                    >
                      <td>{dateText(item.appointmentDate)}</td>
                      <td>{timeText(item.appointmentTime)}</td>
                      <td>{valueOrNA(item.duration, ' minutes')}</td>
                      <td className="hai-email-cell">
                        {item.userMailid || item.patientMailid || email}
                      </td>
                      <td>
                        <span
                          className={`hai-status ${
                            item.approved ? 'approved' : 'pending'
                          }`}
                        >
                          <MdOutlineDone />
                          {item.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hai-no-appointments">
              <div className="hai-empty-icon small">
                <MdEventAvailable size={28} />
              </div>

              <h3>
                {error
                  ? 'Appointments unavailable'
                  : 'No upcoming appointments'}
              </h3>

              <p>
                {error
                  ? 'Check the backend and try again.'
                  : 'When you book a consultation, its details will appear here.'}
              </p>

              {!error && (
                <button
                  className="hai-secondary-button"
                  onClick={() => navigate('/appointment')}
                >
                  Explore appointments <MdArrowForward />
                </button>
              )}
            </div>
          )}

          {lastUpdated && (
            <p className="hai-updated">
              Last checked at{' '}
              {lastUpdated.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </section>

        <footer className="hai-footer">
          <MdHealthAndSafety />
          <span>HealthAI · Your information, organized with care.</span>
          <small>
            For informational purposes only; not a substitute for medical advice.
          </small>
        </footer>
      </div>
    </main>
  );
}