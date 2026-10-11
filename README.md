# HealthcareAI: LangChain, FAISS, Ollama, Grok, React.js & Flask

## Live Demo

**Frontend:** https://health-ai-psi-eight.vercel.app

> Note: The live frontend may require deployment protection settings to be disabled for public access. Backend integration must also be configured for all features to work correctly.

---

## About the Project

HealthcareAI is an AI-powered healthcare platform designed to bridge the gap between patients and doctors. Developed during the **Hack the Mountain Hackathon**, the project combines modern web technologies with AI-powered features to make healthcare information more accessible.

The platform provides medical report explanations, chatbot support, healthcare video recommendations, medical news updates, and appointment management.

## Features

### For Patients

- **Medical Report Explanation:** Upload medical reports and receive easy-to-understand summaries.
- **AI Medical Chatbot:** Ask healthcare-related questions and receive AI-generated responses.
- **YouTube Health Video Finder:** Find relevant health-related videos.
- **Medical News Updates:** Access medical news and healthcare developments.
- **Appointment Booking:** Book appointments with doctors listed on the platform.
- **User Authentication:** Register and log in to access available platform features.

### For Doctors

- **Appointment Management:** View and manage patient appointment requests.
- **Appointment Approval:** Accept or reject appointment requests.
- **Doctor Dashboard:** Access a dedicated interface for managing appointments and patient interactions.

## Tech Stack

### Frontend
- React.js
- JavaScript
- HTML5
- CSS3

### Backend
- Python
- Flask
- Flask-CORS

### Database and Services
- MongoDB
- PyMongo
- Firebase Authentication and related Firebase services, where configured

### AI and NLP
- LangChain
- Large Language Models (LLMs)
- Ollama and Grok integrations, where configured
- AI-based medical report summarization

### APIs and Integrations
- YouTube Data API
- Medical news API
- Other configured healthcare and authentication services

## How the System Works

1. Users register or log in to the platform.
2. Patients can access healthcare information, search for relevant videos, and explore medical news.
3. Patients can upload medical reports for AI-generated explanations.
4. The chatbot processes healthcare-related questions and generates responses using the configured AI service.
5. Patients can request appointments with available doctors.
6. Doctors can review appointment requests and accept or reject them.
7. MongoDB stores application data such as user and appointment information, according to the backend configuration.

## Project Architecture

```text
HealthcareAI
|
|-- frontend/
|   |-- React.js application
|   |-- User interface
|   |-- Patient and doctor dashboards
|
|-- backend/
|   |-- app.py
|   |-- Flask API routes
|   |-- chatbot/
|   |-- report/
|   |-- resource/
|   |-- requirements.txt
|   |-- vercel.json
|
|-- README.md
```

## Local Setup

### Prerequisites

- Python
- Node.js and npm
- MongoDB Atlas account or a local MongoDB instance
- Required API credentials for the enabled services

### 1. Clone the Repository

```bash
git clone https://github.com/sumyaopratar123/HealthAI.git
cd HealthAI
```

### 2. Configure the Backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` directory and configure the required environment variables.

Example:

```env
MONGO_URI=your_mongodb_connection_string
YOUTUBE_API_KEY=your_youtube_api_key
```

Add other API keys and credentials required by your project's AI and Firebase integrations. Use the exact variable names expected by the corresponding modules.

Start the backend:

```bash
python app.py
```

### 3. Configure the Frontend

Open a separate terminal:

```bash
cd frontend
npm install
npm start
```

The React development server typically runs at:

http://localhost:3000

## Deployment

- **Frontend:** Vercel
- **Backend:** Deployment configuration is provided in `backend/vercel.json`; successful deployment depends on runtime compatibility and the project's dependencies.
- **Database:** MongoDB Atlas

Configure environment variables securely in the relevant deployment platform. Do not commit `.env` files, Firebase service-account JSON files, or API secrets to GitHub.

## Security and Responsible Use

- Protect API keys, database credentials, and Firebase service-account credentials.
- Use appropriate authentication and authorization for patient and doctor accounts.
- Restrict database network access wherever practical.
- Medical report explanations and chatbot responses are informational and should not replace advice from qualified healthcare professionals.
- Avoid uploading real patient information to untrusted services.

## Future Enhancements

- Improved multilingual healthcare support.
- More comprehensive doctor discovery and appointment workflows.
- Enhanced report analysis and document processing.
- Better monitoring, validation, and security controls.
- Improved deployment reliability and automated testing.

## Project Information

**Developer:** Sumit Ganesh Ade  
**Department:** Computer Science & Engineering  
**College:** D. Y. Patil College of Engineering & Technology, Kolhapur  
**GitHub Repository:** https://github.com/sumyaopratar123/HealthAI

---

*Built to make healthcare information more accessible through AI and modern web technologies.*