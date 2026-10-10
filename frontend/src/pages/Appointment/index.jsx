import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";

const API_BASE = (
  process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000"
).replace(/\/$/, "");

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const SEARCH_RADIUS = 5000;

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getUserEmail(user) {
  return user?.mailid || user?.email || user?.mailId || "";
}

function getUserRole(user) {
  return String(user?.role || user?.userType || "").toLowerCase();
}

function getDoctorName(doctor) {
  return (
    doctor?.name ||
    doctor?.fullName ||
    doctor?.username ||
    doctor?.displayName ||
    doctor?.doctorName ||
    doctor?.mailid ||
    "Doctor"
  );
}

function getDoctorSpecialty(doctor) {
  return (
    doctor?.specialization ||
    doctor?.speciality ||
    doctor?.specialty ||
    doctor?.department ||
    "General consultation"
  );
}

function getAppointmentId(appointment) {
  return appointment?._id || appointment?.id || appointment?.appointmentId;
}

function getLocationFromOSM(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { lat: element.lat, lon: element.lon };
  }

  if (
    Number.isFinite(element.center?.lat) &&
    Number.isFinite(element.center?.lon)
  ) {
    return { lat: element.center.lat, lon: element.center.lon };
  }

  return null;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function getHealthcareType(tags = {}) {
  const amenity = tags.amenity;
  const healthcare = tags.healthcare;

  if (amenity === "hospital" || healthcare === "hospital") {
    return "Hospital";
  }

  if (amenity === "clinic" || healthcare === "clinic") {
    return "Clinic";
  }

  if (amenity === "doctors" || healthcare === "doctor") {
    return "Doctor / Medical practice";
  }

  if (healthcare === "centre" || healthcare === "health_centre") {
    return "Health centre";
  }

  return "Healthcare provider";
}

function getOSMAddress(tags = {}) {
  const streetLine = [
    tags["addr:housenumber"],
    tags["addr:street"],
  ]
    .filter(Boolean)
    .join(" ");

  return [
    streetLine,
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:postcode"],
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return "Distance unavailable";

  if (distance < 1) {
    return `${Math.max(1, Math.round(distance * 1000))} m away`;
  }

  return `${distance.toFixed(1)} km away`;
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "Not set";

  const [hours, minutes] = String(value).split(":");

  if (hours === undefined || minutes === undefined) return value;

  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function makeDirectionsUrl(place, userLocation) {
  const destination = `${place.lat},${place.lon}`;
  const origin = userLocation
    ? `&origin=${userLocation.lat},${userLocation.lon}`
    : "";

  return (
    "https://www.google.com/maps/dir/?api=1" +
    `&destination=${encodeURIComponent(destination)}` +
    origin +
    "&travelmode=driving"
  );
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed with status ${response.status}`
    );
  }

  return data;
}

function getOverpassQuery(latitude, longitude) {
  return `
[out:json][timeout:25];
(
  nwr(around:${SEARCH_RADIUS},${latitude},${longitude})["amenity"~"^(doctors|clinic|hospital)$"];
  nwr(around:${SEARCH_RADIUS},${latitude},${longitude})["healthcare"~"^(doctor|clinic|hospital|centre|health_centre|health_post)$"];
);
out center tags;
`;
}

async function searchOverpass(latitude, longitude) {
  const query = getOverpassQuery(latitude, longitude);
  let lastError = null;

  for (const server of OVERPASS_SERVERS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(server, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "The map service is busy. Please try again shortly."
            : `Map service returned ${response.status}.`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.elements)) {
        throw new Error("The map service returned an unexpected response.");
      }

      return data.elements
        .map((element) => {
          const tags = element.tags || {};
          const point = getLocationFromOSM(element);

          if (!point) return null;

          const distance = haversineDistance(
            latitude,
            longitude,
            point.lat,
            point.lon
          );

          const name =
            tags.name ||
            tags["name:en"] ||
            tags["official_name"] ||
            getHealthcareType(tags);

          const phone =
            tags.phone ||
            tags["contact:phone"] ||
            tags["phone:mobile"] ||
            "";

          return {
            id: `${element.type}-${element.id}`,
            name,
            type: getHealthcareType(tags),
            address:
              getOSMAddress(tags) ||
              tags["addr:full"] ||
              tags["description"] ||
              "Address not listed in OpenStreetMap",
            phone: String(phone).trim(),
            lat: point.lat,
            lon: point.lon,
            distance,
            website: tags.website || tags["contact:website"] || "",
            osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError?.name === "AbortError") {
    throw new Error("Map search timed out. Please try again.");
  }

  throw new Error(
    lastError?.message ||
      "Could not load nearby healthcare locations. Please retry."
  );
}

function NearbyPlaceCard({ place, userLocation }) {
  const mapsUrl = makeDirectionsUrl(place, userLocation);
  const phoneNumber = place.phone.replace(/[^\d+]/g, "");

  return (
    <article className="hai-appt-place-card">
      <div className="hai-appt-place-top">
        <div className="hai-appt-place-symbol" aria-hidden="true">
          {place.type === "Hospital" ? "✚" : "⚕"}
        </div>

        <div className="hai-appt-place-title">
          <span className="hai-appt-type">{place.type}</span>
          <h3>{place.name}</h3>
          <p className="hai-appt-distance">{formatDistance(place.distance)}</p>
        </div>
      </div>

      <div className="hai-appt-place-address">
        <span aria-hidden="true">⌖</span>
        <span>{place.address}</span>
      </div>

      {place.phone ? (
        <p className="hai-appt-place-phone">
          <span aria-hidden="true">☎</span>
          {place.phone}
        </p>
      ) : (
        <p className="hai-appt-muted">Phone number not listed</p>
      )}

      <div className="hai-appt-place-actions">
        {phoneNumber ? (
          <a className="hai-appt-button hai-appt-button-secondary" href={`tel:${phoneNumber}`}>
            Call
          </a>
        ) : (
          <button
            className="hai-appt-button hai-appt-button-secondary"
            type="button"
            disabled
            title="No phone number is available in the map data"
          >
            Call unavailable
          </button>
        )}

        <a
          className="hai-appt-button hai-appt-button-primary"
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
        >
          Get directions ↗
        </a>
      </div>

      <a
        className="hai-appt-osm-link"
        href={place.osmUrl}
        target="_blank"
        rel="noreferrer"
      >
        View OpenStreetMap details
      </a>
    </article>
  );
}

export default function Appointment() {
  const [user, setUser] = useState(getStoredUser);

  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyError, setNearbyError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [radius, setRadius] = useState("5000");
  const [searchText, setSearchText] = useState("");

  const [doctors, setDoctors] = useState([]);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorSlots, setDoctorSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [notice, setNotice] = useState("");

  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotDuration, setSlotDuration] = useState("30");
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const email = getUserEmail(user);
  const role = getUserRole(user);
  const isDoctor = role === "doctor";
  const isPatient = role === "patient" || role === "user" || !isDoctor;

  useEffect(() => {
    const refreshUser = () => setUser(getStoredUser());

    window.addEventListener("storage", refreshUser);
    window.addEventListener("focus", refreshUser);

    return () => {
      window.removeEventListener("storage", refreshUser);
      window.removeEventListener("focus", refreshUser);
    };
  }, []);

  const fetchNearby = useCallback(
    async (coords, requestedRadius = SEARCH_RADIUS) => {
      setNearbyLoading(true);
      setNearbyError("");
      setNearbyPlaces([]);

      try {
        const results = await searchOverpass(coords.lat, coords.lon);
        const radiusKm = requestedRadius / 1000;

        const filtered = results
          .filter((place) => place.distance <= radiusKm)
          .map((place) => ({
            ...place,
            distance: Number(place.distance.toFixed(3)),
          }));

        setNearbyPlaces(filtered);
      } catch (error) {
        setNearbyError(
          error.message ||
            "Unable to search nearby healthcare locations. Please try again."
        );
      } finally {
        setNearbyLoading(false);
      }
    },
    []
  );

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(
        "Your browser does not support location services. Open the app in a modern browser."
      );
      return;
    }

    setLocationLoading(true);
    setLocationError("");
    setNearbyError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };

        setLocation(coords);
        setLocationLoading(false);
        await fetchNearby(coords, Number(radius));
      },
      (error) => {
        setLocationLoading(false);

        const messages = {
          1: "Location permission was denied. Allow location access in your browser settings and try again.",
          2: "Your current location could not be detected. Check your device location settings and retry.",
          3: "Location request timed out. Please try again.",
        };

        setLocationError(
          messages[error.code] ||
            "Could not access your location. Please try again."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }, [fetchNearby, radius]);

  useEffect(() => {
    if (location) {
      fetchNearby(location, Number(radius));
    }
  }, [radius, location, fetchNearby]);

  const loadDoctors = useCallback(async () => {
    setDoctorLoading(true);
    setDoctorError("");

    try {
      const data = await apiRequest("/doctors");
      setDoctors(Array.isArray(data.doctors) ? data.doctors : []);
    } catch (error) {
      setDoctorError(
        `${error.message}. Check that your Flask backend is running.`
      );
    } finally {
      setDoctorLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    if (!email) {
      setAppointments([]);
      return;
    }

    setAppointmentsLoading(true);
    setAppointmentError("");

    try {
      const path = isDoctor
        ? `/appointments/${encodeURIComponent(email)}`
        : `/patient-appointments/${encodeURIComponent(email)}`;

      const data = await apiRequest(path);

      setAppointments(
        Array.isArray(data.appointments) ? data.appointments : []
      );
    } catch (error) {
      // The backend returns 404 when no appointments exist.
      if (error.message.toLowerCase().includes("no appointments")) {
        setAppointments([]);
      } else {
        setAppointmentError(error.message);
      }
    } finally {
      setAppointmentsLoading(false);
    }
  }, [email, isDoctor]);

  useEffect(() => {
    loadDoctors();
    loadAppointments();
  }, [loadDoctors, loadAppointments]);

  const openDoctorSlots = async (doctor) => {
    const doctorEmail = getUserEmail(doctor);

    if (!doctorEmail) {
      setNotice("This doctor's account does not have a listed email.");
      return;
    }

    setSelectedDoctor(doctor);
    setDoctorSlots([]);
    setSlotsLoading(true);
    setNotice("");

    try {
      const data = await apiRequest(
        `/appointments/${encodeURIComponent(doctorEmail)}`
      );

      const slots = Array.isArray(data.appointments)
        ? data.appointments
        : [];

      setDoctorSlots(slots.filter((slot) => !slot.booked));
    } catch (error) {
      if (error.message.toLowerCase().includes("no appointments")) {
        setDoctorSlots([]);
      } else {
        setNotice(`Could not load availability: ${error.message}`);
      }
    } finally {
      setSlotsLoading(false);
    }
  };

  const bookSlot = async (slot) => {
    if (!email) {
      setNotice("Please sign in before booking an appointment.");
      return;
    }

    const id = getAppointmentId(slot);

    if (!id) {
      setNotice("This appointment slot does not have a valid ID.");
      return;
    }

    setBookingId(id);
    setNotice("");

    try {
      const data = await apiRequest(
        `/appointments/book/${encodeURIComponent(id)}`,
        {
          method: "POST",
          body: JSON.stringify({ mailid: email }),
        }
      );

      setNotice(data.message || "Appointment request submitted.");
      await openDoctorSlots(selectedDoctor);
      await loadAppointments();
    } catch (error) {
      setNotice(`Booking failed: ${error.message}`);
    } finally {
      setBookingId("");
    }
  };

  const createDoctorSlot = async (event) => {
    event.preventDefault();

    if (!email) {
      setNotice("Your account email was not found. Please sign in again.");
      return;
    }

    if (!slotDate || !slotTime || !slotDuration) {
      setNotice("Please fill in the date, time and duration.");
      return;
    }

    setSlotSubmitting(true);
    setNotice("");

    try {
      const data = await apiRequest("/create-appointment", {
        method: "POST",
        body: JSON.stringify({
          mailid: email,
          appointmentDate: slotDate,
          appointmentTime: slotTime,
          duration: Number(slotDuration),
        }),
      });

      setNotice(data.message || "Availability added successfully.");
      setSlotDate("");
      setSlotTime("");
      await loadAppointments();
    } catch (error) {
      setNotice(`Could not create availability: ${error.message}`);
    } finally {
      setSlotSubmitting(false);
    }
  };

  const updateAppointmentStatus = async (appointment, approved) => {
    const id = getAppointmentId(appointment);

    if (!id) {
      setNotice("This appointment does not have a valid ID.");
      return;
    }

    setUpdatingId(id);
    setNotice("");

    try {
      const data = await apiRequest(
        `/appointments/not-approved/${encodeURIComponent(id)}`,
        {
          method: "POST",
          body: JSON.stringify({ approved }),
        }
      );

      setNotice(
        data.message ||
          (approved ? "Appointment approved." : "Appointment declined.")
      );

      await loadAppointments();
    } catch (error) {
      setNotice(`Could not update appointment: ${error.message}`);
    } finally {
      setUpdatingId("");
    }
  };

  const visiblePlaces = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) return nearbyPlaces;

    return nearbyPlaces.filter((place) =>
      [
        place.name,
        place.type,
        place.address,
      ].some((value) => String(value || "").toLowerCase().includes(search))
    );
  }, [nearbyPlaces, searchText]);

  const mapUrl = location
    ? `https://www.google.com/maps/@${location.lat},${location.lon},14z`
    : "https://www.openstreetmap.org/";

  return (
    <main className="hai-appt">
      <section className="hai-appt-hero">
        <div className="hai-appt-hero-content">
          <span className="hai-appt-eyebrow">HEALTHCARE LOCATOR</span>
          <h1>Find healthcare near you</h1>
          <p>
            Discover nearby doctors, clinics and hospitals using OpenStreetMap.
            Call a listed provider or open directions in Google Maps.
          </p>

          <div className="hai-appt-hero-actions">
            <button
              className="hai-appt-button hai-appt-button-primary hai-appt-location-button"
              type="button"
              onClick={requestLocation}
              disabled={locationLoading || nearbyLoading}
            >
              {locationLoading || nearbyLoading ? (
                <>
                  <span className="hai-appt-spinner" />
                  Finding nearby places...
                </>
              ) : location ? (
                "↻ Refresh my location"
              ) : (
                "⌖ Turn on live location"
              )}
            </button>

            {location && (
              <a
                className="hai-appt-button hai-appt-button-secondary"
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                View area on map ↗
              </a>
            )}
          </div>

          {locationError && (
            <div className="hai-appt-alert hai-appt-alert-error" role="alert">
              {locationError}
            </div>
          )}

          {nearbyError && (
            <div className="hai-appt-alert hai-appt-alert-error" role="alert">
              <span>{nearbyError}</span>
              {location && (
                <button
                  type="button"
                  className="hai-appt-inline-button"
                  onClick={() => fetchNearby(location, Number(radius))}
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <div className="hai-appt-hero-mark" aria-hidden="true">
          ✚
        </div>
      </section>

      <section className="hai-appt-location-status">
        <div>
          <strong>
            {location ? "Your current location is detected" : "Your location is not set yet"}
          </strong>
          <p>
            {location
              ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)} · Distances are approximate straight-line distances.`
              : "Turn on live location to search for healthcare providers near you."}
          </p>
        </div>

        <label className="hai-appt-radius">
          Search radius
          <select
            value={radius}
            onChange={(event) => setRadius(event.target.value)}
            disabled={nearbyLoading}
          >
            <option value="1000">1 km</option>
            <option value="3000">3 km</option>
            <option value="5000">5 km</option>
            <option value="10000">10 km</option>
          </select>
        </label>
      </section>

      <section className="hai-appt-section">
        <div className="hai-appt-section-heading">
          <div>
            <span className="hai-appt-eyebrow">NEARBY PROVIDERS</span>
            <h2>Doctors, clinics & hospitals</h2>
            <p>
              Healthcare locations mapped by OpenStreetMap contributors.
            </p>
          </div>

          <span className="hai-appt-result-count">
            {nearbyPlaces.length} found
          </span>
        </div>

        <div className="hai-appt-search-row">
          <label className="hai-appt-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search by name, type or address..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </label>
        </div>

        {nearbyLoading && (
          <div className="hai-appt-state">
            <span className="hai-appt-spinner hai-appt-spinner-large" />
            <strong>Searching nearby healthcare locations...</strong>
            <p>This can take a few seconds.</p>
          </div>
        )}

        {!nearbyLoading && !location && (
          <div className="hai-appt-state">
            <div className="hai-appt-state-icon">⌖</div>
            <strong>Turn on live location to get started</strong>
            <p>
              Your browser will ask permission to access your location.
            </p>
            <button
              type="button"
              className="hai-appt-button hai-appt-button-primary"
              onClick={requestLocation}
            >
              Turn on live location
            </button>
          </div>
        )}

        {!nearbyLoading && location && !nearbyError && visiblePlaces.length === 0 && (
          <div className="hai-appt-state">
            <div className="hai-appt-state-icon">⌕</div>
            <strong>No matching places found</strong>
            <p>
              Try a larger search radius or a different search term. Some
              providers may not be listed in OpenStreetMap.
            </p>
          </div>
        )}

        {!nearbyLoading && visiblePlaces.length > 0 && (
          <div className="hai-appt-place-grid">
            {visiblePlaces.map((place) => (
              <NearbyPlaceCard
                key={place.id}
                place={place}
                userLocation={location}
              />
            ))}
          </div>
        )}

        <p className="hai-appt-attribution">
          Map data ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap contributors
          </a>
          . Provider details and phone numbers depend on community-maintained
          map data.
        </p>
      </section>

      {notice && (
        <div className="hai-appt-alert hai-appt-alert-info" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="hai-appt-inline-button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
      )}

      {isDoctor && (
        <section className="hai-appt-section hai-appt-management">
          <div className="hai-appt-section-heading">
            <div>
              <span className="hai-appt-eyebrow">DOCTOR WORKSPACE</span>
              <h2>Manage your availability</h2>
              <p>Create appointment slots that patients can book.</p>
            </div>
          </div>

          <form className="hai-appt-slot-form" onSubmit={createDoctorSlot}>
            <label>
              Appointment date
              <input
                type="date"
                value={slotDate}
                min={new Date().toLocaleDateString("en-CA")}
                onChange={(event) => setSlotDate(event.target.value)}
                required
              />
            </label>

            <label>
              Start time
              <input
                type="time"
                value={slotTime}
                onChange={(event) => setSlotTime(event.target.value)}
                required
              />
            </label>

            <label>
              Duration
              <select
                value={slotDuration}
                onChange={(event) => setSlotDuration(event.target.value)}
                required
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </label>

            <button
              className="hai-appt-button hai-appt-button-primary"
              type="submit"
              disabled={slotSubmitting}
            >
              {slotSubmitting ? "Adding..." : "+ Add availability"}
            </button>
          </form>
        </section>
      )}

      {isPatient && (
        <section className="hai-appt-section hai-appt-management">
          <div className="hai-appt-section-heading">
            <div>
              <span className="hai-appt-eyebrow">BOOK AN APPOINTMENT</span>
              <h2>Available doctors</h2>
              <p>
                View a doctor's available time slots and submit a booking
                request.
              </p>
            </div>

            <button
              type="button"
              className="hai-appt-button hai-appt-button-secondary"
              onClick={loadDoctors}
              disabled={doctorLoading}
            >
              ↻ Refresh
            </button>
          </div>

          {doctorError && (
            <div className="hai-appt-alert hai-appt-alert-error">
              {doctorError}
            </div>
          )}

          {doctorLoading ? (
            <div className="hai-appt-state">
              <span className="hai-appt-spinner hai-appt-spinner-large" />
              <strong>Loading doctors...</strong>
            </div>
          ) : doctors.length === 0 ? (
            <div className="hai-appt-state">
              <strong>No doctors are available in the directory yet.</strong>
              <p>Try again after the backend has loaded doctor accounts.</p>
            </div>
          ) : (
            <div className="hai-appt-doctor-grid">
              {doctors.map((doctor, index) => (
                <article
                  className="hai-appt-doctor-card"
                  key={getUserEmail(doctor) || doctor._id || index}
                >
                  <div className="hai-appt-doctor-avatar" aria-hidden="true">
                    {getDoctorName(doctor).charAt(0).toUpperCase()}
                  </div>

                  <div className="hai-appt-doctor-info">
                    <h3>{getDoctorName(doctor)}</h3>
                    <p>{getDoctorSpecialty(doctor)}</p>
                    {doctor.hospital && <p>{doctor.hospital}</p>}
                    {doctor.phone && <p>☎ {doctor.phone}</p>}
                  </div>

                  <button
                    type="button"
                    className="hai-appt-button hai-appt-button-primary"
                    onClick={() => openDoctorSlots(doctor)}
                  >
                    View availability
                  </button>
                </article>
              ))}
            </div>
          )}

          {selectedDoctor && (
            <div className="hai-appt-slots-panel">
              <div className="hai-appt-slots-heading">
                <div>
                  <span className="hai-appt-eyebrow">AVAILABLE SLOTS</span>
                  <h3>{getDoctorName(selectedDoctor)}</h3>
                </div>
                <button
                  className="hai-appt-close"
                  type="button"
                  onClick={() => {
                    setSelectedDoctor(null);
                    setDoctorSlots([]);
                  }}
                  aria-label="Close availability"
                >
                  ×
                </button>
              </div>

              {slotsLoading ? (
                <p className="hai-appt-muted">Loading available slots...</p>
              ) : doctorSlots.length === 0 ? (
                <p className="hai-appt-muted">
                  No unbooked slots were found for this doctor.
                </p>
              ) : (
                <div className="hai-appt-slot-grid">
                  {doctorSlots.map((slot, index) => {
                    const id = getAppointmentId(slot);

                    return (
                      <article
                        className="hai-appt-slot-card"
                        key={id || index}
                      >
                        <div>
                          <strong>{formatDate(slot.appointmentDate)}</strong>
                          <p>{formatTime(slot.appointmentTime)}</p>
                          <span>
                            {slot.duration || 30} minutes
                          </span>
                        </div>

                        <button
                          type="button"
                          className="hai-appt-button hai-appt-button-primary"
                          onClick={() => bookSlot(slot)}
                          disabled={!id || bookingId === id}
                        >
                          {bookingId === id ? "Booking..." : "Request booking"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="hai-appt-section hai-appt-management">
        <div className="hai-appt-section-heading">
          <div>
            <span className="hai-appt-eyebrow">
              {isDoctor ? "PATIENT REQUESTS" : "YOUR HEALTHCARE"}
            </span>
            <h2>{isDoctor ? "Appointment requests" : "My appointments"}</h2>
            <p>
              {isDoctor
                ? "Review and approve or decline patient booking requests."
                : "Check the status of your appointment requests."}
            </p>
          </div>

          <button
            type="button"
            className="hai-appt-button hai-appt-button-secondary"
            onClick={loadAppointments}
            disabled={appointmentsLoading}
          >
            ↻ Refresh
          </button>
        </div>

        {appointmentError && (
          <div className="hai-appt-alert hai-appt-alert-error">
            {appointmentError}
          </div>
        )}

        {appointmentsLoading ? (
          <div className="hai-appt-state">
            <span className="hai-appt-spinner hai-appt-spinner-large" />
            <strong>Loading appointments...</strong>
          </div>
        ) : appointments.length === 0 ? (
          <div className="hai-appt-state hai-appt-state-compact">
            <strong>No appointments to display</strong>
            <p>
              {isDoctor
                ? "Your availability and patient requests will appear here."
                : "Your booked appointments will appear here."}
            </p>
          </div>
        ) : (
          <div className="hai-appt-appointments-list">
            {appointments.map((appointment, index) => {
              const id = getAppointmentId(appointment);
              const booked = Boolean(appointment.booked);
              const approved = appointment.approved;
              const patientName =
                appointment.patientName ||
                appointment.userName ||
                appointment.userMailid ||
                "Patient";

              return (
                <article
                  className="hai-appt-appointment-row"
                  key={id || index}
                >
                  <div className="hai-appt-appointment-date">
                    <span aria-hidden="true">▦</span>
                    <div>
                      <strong>{formatDate(appointment.appointmentDate)}</strong>
                      <p>{formatTime(appointment.appointmentTime)}</p>
                    </div>
                  </div>

                  <div className="hai-appt-appointment-detail">
                    <strong>
                      {isDoctor
                        ? booked
                          ? patientName
                          : "Available slot"
                        : appointment.doctorName ||
                          appointment.mailid ||
                          "Doctor appointment"}
                    </strong>
                    <p>
                      {appointment.duration || 30} minutes
                      {appointment.userMailid && isDoctor
                        ? ` · ${appointment.userMailid}`
                        : ""}
                    </p>
                  </div>

                  <span
                    className={`hai-appt-status ${
                      !booked
                        ? "is-available"
                        : approved === true
                        ? "is-approved"
                        : approved === false
                        ? "is-declined"
                        : "is-pending"
                    }`}
                  >
                    {!booked
                      ? "Available"
                      : approved === true
                      ? "Approved"
                      : approved === false
                      ? "Declined"
                      : "Pending"}
                  </span>

                  {isDoctor && booked && approved !== true && approved !== false && (
                    <div className="hai-appt-approval-actions">
                      <button
                        type="button"
                        className="hai-appt-button hai-appt-button-primary"
                        onClick={() =>
                          updateAppointmentStatus(appointment, true)
                        }
                        disabled={updatingId === id}
                      >
                        {updatingId === id ? "Updating..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        className="hai-appt-button hai-appt-button-danger"
                        onClick={() =>
                          updateAppointmentStatus(appointment, false)
                        }
                        disabled={updatingId === id}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}