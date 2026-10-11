import os
import re
import logging
import json

from datetime import datetime

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename as werkzeug_secure_filename
from bson.objectid import ObjectId

from chatbot.Gemini import gemini
from report.explanation import get_summary


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024

# MongoDB configuration
app.config["MONGO_URI"] = os.getenv(
    "MONGO_URI=mongodb+srv://sumitade324_db_user:ircpiqO4slGN1bB8@cluster0.uos4i4s.mongodb.net/?appName=Cluster0",
    "mongodb://localhost:27017/HCAI"
)

# Upload folder
app.config["UPLOAD_FOLDER"] = os.path.join(BASE_DIR, "uploads")

# CORS configuration
allowed_origins = [
    "http://localhost:3000",
    "https://health-ai-psi-eight.vercel.app",
]

frontend_url = os.getenv("FRONTEND_URL", "")

allowed_origins.extend(
    origin.strip().rstrip("/")
    for origin in frontend_url.split(",")
    if origin.strip()
)

CORS(
    app,
    resources={
        r"/*": {
            "origins": list(dict.fromkeys(allowed_origins))
        }
    }
)

logging.basicConfig(level=logging.INFO)

db = PyMongo(app).db


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def serialize_document(doc):
    if doc is not None and "_id" in doc:
        doc["_id"] = str(doc["_id"])

    return doc


def make_upload_filename(filename):
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    safe_name = werkzeug_secure_filename(filename)
    _, extension = os.path.splitext(safe_name)

    return f"{timestamp}{extension}"


# --------------------------------------------------
# FIREBASE ADMIN CONFIGURATION
# --------------------------------------------------

firebase_service_account = os.path.join(
    BASE_DIR,
    "firebase-service-account.json"
)

# Production: use FIREBASE_SERVICE_ACCOUNT_JSON.
# Local development: use firebase-service-account.json.
if not firebase_admin._apps:
    firebase_service_account_json = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_JSON"
    )

    try:
        if firebase_service_account_json:
            firebase_credential = credentials.Certificate(
                json.loads(firebase_service_account_json)
            )

            firebase_admin.initialize_app(firebase_credential)

        elif os.path.isfile(firebase_service_account):
            firebase_credential = credentials.Certificate(
                firebase_service_account
            )

            firebase_admin.initialize_app(firebase_credential)

        else:
            logging.warning(
                "Firebase Admin is not configured. "
                "Google login will be unavailable."
            )

    except Exception:
        logging.exception("Firebase Admin initialization failed")


# --------------------------------------------------
# REGISTER
# --------------------------------------------------

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = data.get("name")
    mailid = data.get("mailid")
    password = data.get("password")
    role = data.get("role", "Patient")

    if not name or not mailid or not password:
        return jsonify({
            "message": "Please provide name, mailid, and password"
        }), 400

    if role not in ["Patient", "Doctor"]:
        return jsonify({"message": "Invalid role"}), 400

    mailid = mailid.strip().lower()

    if db.users.find_one({"mailid": mailid}):
        return jsonify({
            "message": "Mailid already exists"
        }), 400

    hashed_password = generate_password_hash(
        password,
        method="pbkdf2:sha256"
    )

    result = db.users.insert_one({
        "name": name,
        "mailid": mailid,
        "password": hashed_password,
        "role": role
    })

    user = serialize_document(
        db.users.find_one({"_id": result.inserted_id})
    )

    return jsonify({
        "message": "User registered",
        "user": user
    }), 200


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    mailid = data.get("mailid")
    password = data.get("password")

    if not mailid or not password:
        return jsonify({
            "message": "Please provide mailid and password"
        }), 400

    mailid = mailid.strip().lower()

    user = db.users.find_one({"mailid": mailid})

    if (
        not user
        or not user.get("password")
        or not check_password_hash(user["password"], password)
    ):
        return jsonify({
            "message": "Invalid credentials"
        }), 401

    user = serialize_document(user)

    return jsonify({
        "message": "User logged in",
        "user": user
    }), 200


# --------------------------------------------------
# GOOGLE LOGIN
# --------------------------------------------------

@app.route("/google-login", methods=["POST"])
def google_login():
    if not firebase_admin._apps:
        return jsonify({
            "message": (
                "Firebase Admin is not configured. "
                "Configure FIREBASE_SERVICE_ACCOUNT_JSON "
                "in the deployment environment."
            )
        }), 503

    data = request.get_json(silent=True) or {}

    id_token = data.get("idToken")
    requested_role = data.get("role", "Patient")

    if not id_token:
        return jsonify({
            "message": "Firebase ID token is required"
        }), 400

    if requested_role not in ["Patient", "Doctor"]:
        return jsonify({
            "message": "Invalid role"
        }), 400

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)

        mailid = (
            decoded_token.get("email") or ""
        ).strip().lower()

        name = decoded_token.get("name") or "HealthAI User"
        firebase_uid = decoded_token.get("uid")

        if not mailid or not decoded_token.get("email_verified"):
            return jsonify({
                "message": "A verified Google email is required"
            }), 401

        user = db.users.find_one({"mailid": mailid})

        if user is None:
            user = db.users.find_one({
                "mailid": {
                    "$regex": f"^{re.escape(mailid)}$",
                    "$options": "i"
                }
            })

        if user:
            updates = {
                "firebase_uid": firebase_uid
            }

            if not user.get("name") and name:
                updates["name"] = name

            db.users.update_one(
                {"_id": user["_id"]},
                {"$set": updates}
            )

            user = db.users.find_one({
                "_id": user["_id"]
            })

        else:
            result = db.users.insert_one({
                "name": name,
                "mailid": mailid,
                "role": requested_role,
                "firebase_uid": firebase_uid,
                "auth_provider": "google",
                "profilePic": decoded_token.get("picture", ""),
                "health_info": {}
            })

            user = db.users.find_one({
                "_id": result.inserted_id
            })

        user = serialize_document(user)

        return jsonify({
            "message": "Google login successful",
            "user": user
        }), 200

    except Exception:
        app.logger.exception("Google login failed")

        return jsonify({
            "message": "Google authentication failed"
        }), 401


# --------------------------------------------------
# YOUTUBE RESOURCE FINDER
# --------------------------------------------------

@app.route("/resource", methods=["POST"])
def resource():
    data = request.get_json(silent=True) or {}
    user_input = str(data.get("input", "")).strip()

    if not user_input:
        return jsonify({
            "recommendations": []
        }), 200

    if not YOUTUBE_API_KEY:
        app.logger.error(
            "YOUTUBE_API_KEY is missing from backend/.env"
        )

        return jsonify({
            "error": "YouTube API key is not configured"
        }), 500

    try:
        youtube = build(
            "youtube",
            "v3",
            developerKey=YOUTUBE_API_KEY,
            cache_discovery=False
        )

        result = youtube.search().list(
            part="snippet",
            q=user_input + " health education",
            type="video",
            maxResults=9,
            order="relevance",
            safeSearch="strict",
            regionCode="IN",
            relevanceLanguage="en",
            videoEmbeddable="true"
        ).execute()

        recommendations = []

        for item in result.get("items", []):
            video_id = item.get("id", {}).get("videoId")
            snippet = item.get("snippet", {})

            if not video_id:
                continue

            recommendations.append({
                "title": snippet.get(
                    "title",
                    "Healthcare Resource"
                ),
                "url": (
                    f"https://www.youtube.com/embed/{video_id}"
                )
            })

        return jsonify({
            "input": user_input,
            "recommendations": recommendations
        }), 200

    except HttpError:
        app.logger.exception(
            "YouTube API request failed"
        )

        return jsonify({
            "error": (
                "YouTube API request failed. Check API key, "
                "API access, restrictions and quota."
            )
        }), 502

    except Exception:
        app.logger.exception(
            "YouTube Resource Finder failed"
        )

        return jsonify({
            "error": "Unable to fetch YouTube resources"
        }), 502


# --------------------------------------------------
# AI CHATBOT - GEMINI
# --------------------------------------------------

@app.route("/chatbot", methods=["POST"])
def handle_prompt():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Request body must be valid JSON."
        }), 400

    prompt = data.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify({
            "error": "Please enter a message."
        }), 400

    prompt = prompt.strip()

    if len(prompt) > 10000:
        return jsonify({
            "error": "Message is too long. Please shorten it."
        }), 400

    try:
        response = gemini(prompt)

        if not isinstance(response, str) or not response.strip():
            app.logger.error(
                "Gemini returned an empty response"
            )

            return jsonify({
                "error": (
                    "The AI assistant returned an empty response."
                )
            }), 502

        fallback_messages = (
            "AI service configuration is missing",
            "I couldn't generate a response",
            "Sorry, the AI service is temporarily unavailable",
            "Unable to connect to the AI service"
        )

        if any(
            response.startswith(message)
            for message in fallback_messages
        ):
            return jsonify({
                "error": response
            }), 502

        return jsonify({
            "prompt": prompt,
            "output": response
        }), 200

    except Exception:
        app.logger.exception("Chatbot request failed")

        return jsonify({
            "error": (
                "Unable to process chatbot request. "
                "Please try again."
            )
        }), 500
    # --------------------------------------------------
# HEALTH INFORMATION
# --------------------------------------------------

@app.route("/healthinfo", methods=["POST"])
def health_info():
    data = request.get_json(silent=True) or {}
    mailid = data.get("mailid")

    if not mailid:
        return jsonify({
            "message": "Please provide mailid"
        }), 400

    user = db.users.find_one({"mailid": mailid})

    if not user:
        return jsonify({
            "message": "User not found"
        }), 404

    health_info_data = {
        "dob": data.get("dob"),
        "gender": data.get("gender"),
        "height": data.get("height"),
        "weight": data.get("weight"),
        "medications": data.get("medications"),
        "allergies": data.get("allergies"),
        "smoking": data.get("smoking"),
        "alcohol": data.get("alcohol"),
        "emergencyContact": data.get("emergencyContact"),
        "healthGoals": data.get("healthGoals")
    }

    if user.get("role") == "Doctor":
        health_info_data.update({
            "degree": data.get("degree", ""),
            "specialization": data.get("specialization", ""),
            "yearsOfExperience": data.get(
                "yearsOfExperience", ""
            ),
            "certifications": data.get("certifications", ""),
            "consultationFee": data.get("consultationFee", ""),
            "clinicAddress": data.get("clinicAddress", ""),
            "city": data.get("city", ""),
            "portfolioUrl": data.get("portfolioUrl", "")
        })

    db.users.update_one(
        {"mailid": mailid},
        {"$set": {"health_info": health_info_data}}
    )

    user = serialize_document(
        db.users.find_one({"mailid": mailid})
    )

    return jsonify({
        "message": "Health information updated",
        "user": user
    }), 200


# --------------------------------------------------
# PROFILE PICTURE UPLOAD
# --------------------------------------------------

@app.route("/uploadprofilepic", methods=["POST"])
def upload_profile_pic():
    if "profilePic" not in request.files:
        return jsonify({
            "message": "No file part"
        }), 400

    file = request.files["profilePic"]
    mailid = request.form.get("mailid")

    if file.filename == "":
        return jsonify({
            "message": "No selected file"
        }), 400

    if not mailid:
        return jsonify({
            "message": "Mail ID is required"
        }), 400

    filename = make_upload_filename(file.filename)
    upload_folder = app.config["UPLOAD_FOLDER"]

    os.makedirs(upload_folder, exist_ok=True)
    file.save(os.path.join(upload_folder, filename))

    result = db.users.update_one(
        {"mailid": mailid},
        {"$set": {"profilePic": filename}}
    )

    if result.matched_count > 0:
        return jsonify({
            "message": "File uploaded",
            "filename": filename
        }), 200

    return jsonify({
        "message": "User not found"
    }), 404


@app.route("/uploads/<filename>", methods=["GET"])
def uploaded_file(filename):
    upload_folder = app.config["UPLOAD_FOLDER"]
    file_path = os.path.join(upload_folder, filename)

    if not os.path.isfile(file_path):
        return jsonify({
            "message": "File not found"
        }), 404

    return send_from_directory(upload_folder, filename)


# --------------------------------------------------
# DOCTORS
# --------------------------------------------------

@app.route("/doctors", methods=["GET"])
def get_doctors():
    doctors = db.users.find({"role": "Doctor"})

    doctors_list = [
        serialize_document(doctor)
        for doctor in doctors
    ]

    return jsonify({
        "message": "Doctors fetched",
        "doctors": doctors_list
    }), 200


# --------------------------------------------------
# CREATE APPOINTMENT
# --------------------------------------------------

@app.route("/create-appointment", methods=["POST"])
def create_appointment():
    data = request.get_json(silent=True) or {}

    mailid = data.get("mailid")
    appointment_date = data.get("appointmentDate")
    appointment_time = data.get("appointmentTime")
    duration = data.get("duration")

    if not all([
        mailid,
        appointment_date,
        appointment_time,
        duration
    ]):
        return jsonify({
            "message": "Please provide all required fields"
        }), 400

    try:
        datetime.strptime(appointment_date, "%Y-%m-%d")
        datetime.strptime(appointment_time, "%H:%M")
    except ValueError:
        return jsonify({
            "message": "Invalid date or time format"
        }), 400

    appointment = {
        "mailid": mailid,
        "appointmentDate": appointment_date,
        "appointmentTime": appointment_time,
        "duration": duration,
        "booked": False
    }

    result = db.appointments.insert_one(appointment)

    if result.inserted_id:
        return jsonify({
            "message": "Appointment created successfully",
            "appointmentId": str(result.inserted_id)
        }), 201

    return jsonify({
        "message": "Failed to create appointment"
    }), 500


# --------------------------------------------------
# DOCTOR APPOINTMENTS
# --------------------------------------------------

@app.route("/appointments/<mailid>", methods=["GET"])
def get_appointments_for_doctor(mailid):
    if not mailid:
        return jsonify({
            "message": "Mail ID is required"
        }), 400

    user = db.users.find_one({"mailid": mailid})

    if not user:
        return jsonify({
            "message": "User not found"
        }), 404

    user = serialize_document(user)

    appointments = db.appointments.find({
        "mailid": mailid
    })

    appointments_list = [
        serialize_document(item)
        for item in appointments
    ]

    if appointments_list:
        return jsonify({
            "message": "Appointments fetched successfully",
            "user": user,
            "appointments": appointments_list
        }), 200

    return jsonify({
        "message": "No appointments found for the given mail ID",
        "appointments": []
    }), 200


# --------------------------------------------------
# PATIENT APPOINTMENTS
# --------------------------------------------------

@app.route("/patient-appointments/<mailid>", methods=["GET"])
def get_appointments_for_patients(mailid):
    if not mailid:
        return jsonify({
            "message": "Mail ID is required"
        }), 400

    appointments = db.appointments.find({
        "userMailid": mailid
    })

    appointments_list = [
        serialize_document(item)
        for item in appointments
    ]

    return jsonify({
        "message": (
            "Appointments fetched successfully"
            if appointments_list
            else "No appointments found"
        ),
        "appointments": appointments_list
    }), 200


# --------------------------------------------------
# BOOK APPOINTMENT
# --------------------------------------------------

@app.route("/appointments/book/<appointment_id>", methods=["POST"])
def book_appointment(appointment_id):
    data = request.get_json(silent=True) or {}
    mailid = data.get("mailid")

    if not mailid:
        return jsonify({
            "message": "Mail ID is required"
        }), 400

    try:
        appointment_object_id = ObjectId(appointment_id)
    except Exception:
        return jsonify({
            "message": "Invalid appointment ID"
        }), 400

    appointment = db.appointments.find_one({
        "_id": appointment_object_id
    })

    if not appointment:
        return jsonify({
            "message": "Appointment not found"
        }), 404

    if appointment.get("booked"):
        return jsonify({
            "message": "Appointment already booked"
        }), 400

    result = db.appointments.update_one(
        {
            "_id": appointment_object_id,
            "booked": False
        },
        {
            "$set": {
                "booked": True,
                "userMailid": mailid,
                "approved": False
            }
        }
    )

    if result.modified_count > 0:
        return jsonify({
            "message": "Appointment booked successfully"
        }), 200

    return jsonify({
        "message": (
            "Appointment could not be booked. "
            "Please refresh and try again."
        )
    }), 409


# --------------------------------------------------
# UPDATE APPOINTMENT APPROVAL
# --------------------------------------------------

@app.route(
    "/appointments/not-approved/<appointment_id>",
    methods=["POST"]
)
def not_approved_appointment(appointment_id):
    data = request.get_json(silent=True) or {}
    approved = data.get("approved")

    if not isinstance(approved, bool):
        return jsonify({
            "message": "approved must be true or false"
        }), 400

    try:
        appointment_object_id = ObjectId(appointment_id)
    except Exception:
        return jsonify({
            "message": "Invalid appointment ID"
        }), 400

    appointment = db.appointments.find_one({
        "_id": appointment_object_id
    })

    if not appointment:
        return jsonify({
            "message": "Appointment not found"
        }), 404

    result = db.appointments.update_one(
        {"_id": appointment_object_id},
        {"$set": {"approved": approved}}
    )

    if result.matched_count > 0:
        return jsonify({
            "message": "Appointment status updated successfully"
        }), 200

    return jsonify({
        "message": "Failed to update appointment status"
    }), 500


# --------------------------------------------------
# REPORT SUMMARY
# --------------------------------------------------

@app.route("/report-summary", methods=["POST"])
def report_summary():
    if "file" not in request.files:
        return jsonify({
            "status": "error",
            "message": (
                "No file provided. Please upload a health report."
            )
        }), 400

    uploaded_file = request.files["file"]

    if not uploaded_file.filename:
        return jsonify({
            "status": "error",
            "message": "Please select a file."
        }), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({
            "status": "error",
            "message": "Please upload a PDF report."
        }), 400

    try:
        response = get_summary(uploaded_file)

        status_code = (
            200
            if response.get("status") == "success"
            else 500
        )

        return jsonify(response), status_code

    except Exception:
        app.logger.exception("Report summary failed")

        return jsonify({
            "status": "error",
            "message": "Unable to summarize the uploaded report."
        }), 500


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "message": "HAI backend is running"
    }), 200


# --------------------------------------------------
# START SERVER
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=False
    )
