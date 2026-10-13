# KrishiMitra 🌱

### Your Farming Friend \| AI-Powered Farming Assistant for Indian Farmers

KrishiMitra (कृषिमित्र) is a web application concept designed to help
Indian farmers---particularly farming communities in rural
Maharashtra---access useful agricultural information and make more
informed decisions.

The project brings together market-price information, crop-planning
support, AI-assisted crop disease identification, weather insights, and
farmer-community features in one place. Its goal is to make relevant
farming information easier to access and understand.

> **Project status:** This repository contains the application source
> code. Feature availability and integrations may depend on local
> configuration, API credentials, data sources, and the current state of
> development. This README does not imply that the application is
> deployed or that every integration is live.

------------------------------------------------------------------------

## Contents

-   [Highlights](#highlights)
-   [Features](#features)
-   [Technology Stack](#technology-stack)
-   [Architecture Overview](#architecture-overview)
-   [Repository Structure](#repository-structure)
-   [Prerequisites](#prerequisites)
-   [Getting Started](#getting-started)
-   [Environment Variables](#environment-variables)
-   [Running Locally](#running-locally)
-   [Security Notes](#security-notes)
-   [Contributing](#contributing)
-   [Future Improvements](#future-improvements)
-   [Disclaimer](#disclaimer)
-   [License](#license)

## Highlights

-   Designed around the information needs of Indian farmers.
-   Combines agricultural information and AI-assisted tools in a single
    web application.
-   Built with a React frontend and Node.js backend, with Firebase used
    for application services.
-   Developed with a focus on usability and relevance for rural
    Maharashtra.

## Features

The project is intended to support the following areas. Individual
features may require configuration or further development before they
are usable in a given environment.

### 📊 Mandi and Market Prices

-   Present agricultural market-price information.
-   Support comparisons that can help farmers explore available market
    information.
-   The project has included work related to market-price data and
    caching; confirm the configured source and freshness before relying
    on displayed values.

### 🌾 Crop Planning

-   Provide crop-planning assistance informed by relevant farming
    conditions, such as soil, weather, and local context.
-   Help organize information that farmers can consider when planning a
    crop.

### 🩺 AI-Assisted Disease Detection

-   Support a workflow for submitting crop images for disease-related
    analysis.
-   Present AI-generated information intended to help users investigate
    possible crop-health issues.
-   Results should be treated as guidance, not as a confirmed diagnosis.

### 🌦️ Weather Insights

-   Provide weather-related information and context for farming
    decisions, subject to the configured weather data provider and its
    availability.

### 👨‍🌾 Farmer Community

-   Provide a place for farmers to share information, questions, and
    experiences.
-   Community functionality may depend on Firebase configuration and the
    features currently implemented in the codebase.

### 🎙️ Voice Assistance

-   Includes frontend/backend work related to a voice-assistant
    experience.
-   Actual behavior depends on the browser, supported languages,
    configured services, and implementation state.

## Technology Stack

  -----------------------------------------------------------------------
  Area                                Technologies
  ----------------------------------- -----------------------------------
  Frontend                            React, Vite, JavaScript, CSS

  Backend                             Node.js, Express-style routing

  Authentication and application      Firebase
  services                            

  AI integrations                     AI/API integrations configured by
                                      the developer

  Data and integrations               External agricultural, weather, or
                                      other APIs as configured

  Version control                     Git and GitHub
  -----------------------------------------------------------------------

> This list describes the project's stated stack and known
> implementation choices. Check the package manifests and source code
> for exact package versions and enabled integrations.

## Architecture Overview

At a high level, the application follows a client--server structure:

1.  **React frontend** --- renders the user interface and collects user
    input.
2.  **Node.js backend** --- handles server-side routes and integrations
    where implemented.
3.  **Firebase services** --- support configured application
    functionality, such as authentication or data storage.
4.  **External APIs and AI services** --- provide data or analysis when
    credentials, network access, and provider availability permit.

``` text
Farmer / User
     |
     v
React + Vite Frontend
     |
     v
Node.js Backend Routes
     |
     +------> Firebase services (configured features)
     |
     +------> External data / AI APIs (configured integrations)
     |
     v
Response shown in the frontend
```

This is a conceptual overview, not a guarantee that every feature uses
every component or that all integrations are currently active.

## Repository Structure

The main directories and files include:

``` text
Krishimitra/
├── .github/
│   └── agents/
├── backend/
│   ├── data/
│   ├── routes/
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   └── pages/
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── .gitignore
├── SETUP_GUIDE.txt
├── guidelines.md
├── product.md
├── structure.md
├── tech.md
└── README.md
```

The exact contents may change as development continues.

## Prerequisites

Install the following before running the project:

-   [Node.js](https://nodejs.org/) --- use a version compatible with the
    dependencies in the project.
-   npm --- normally included with Node.js.
-   Git.
-   A Firebase project and its required configuration, if you want to
    use Firebase-backed functionality.
-   Credentials for any external API integrations you intend to enable.

## Getting Started

### 1. Clone the repository

``` bash
git clone https://github.com/pranavunde-28/Krishimitra.git
cd Krishimitra
```

### 2. Install backend dependencies

``` bash
cd backend
npm install
```

### 3. Install frontend dependencies

Open another terminal from the repository root, or return to the root
and run:

``` bash
cd frontend
npm install
```

### 4. Configure environment variables

Create local environment files based on the examples below. Use the
actual variable names expected by the source code and your providers. Do
not commit real credentials.

### 5. Start the application

Check the `scripts` section in each `package.json` for the supported
commands. Common Vite and Node.js development commands are shown below,
but use the scripts defined in this repository if they differ.

Backend terminal:

``` bash
cd backend
npm run
```

Frontend terminal:

``` bash
cd frontend
npm run
```

The `npm run` command lists the scripts available in that package. Start
the backend and frontend using the appropriate development scripts shown
there.

## Environment Variables

Environment variable names are provider- and implementation-specific.
The following are **safe placeholders**, not a claim that these exact
names are all currently consumed by the code. Verify the names in the
source and package documentation before use.

### Backend --- `backend/.env`

``` dotenv
# Example placeholders — replace with the names your backend actually reads.
PORT=5000

# AI provider credential (keep server-side)
GROQ_API_KEY=your_groq_api_key_here

# Add other server-side API credentials only if required by your implementation.
# WEATHER_API_KEY=your_weather_api_key_here
# AGRICULTURE_DATA_API_KEY=your_data_api_key_here
```

### Frontend --- `frontend/.env`

Vite exposes variables prefixed with `VITE_` to browser code. **Never
put private API secrets in `VITE_` variables.**

``` dotenv
# Example placeholder; confirm the expected variable name in the frontend source.
VITE_BACKEND_URL=http://localhost:5000

# Firebase web-app configuration placeholders.
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

Firebase web configuration values are used by client applications, but
access must still be protected with appropriate Firebase Authentication,
Security Rules, and provider restrictions. Keep privileged
service-account keys and server secrets out of the frontend.

If the code uses a different configuration mechanism, follow the
implementation in the repository and the relevant provider's
documentation.

## Running Locally

A typical local workflow is:

1.  Install dependencies in `backend/` and `frontend/`.
2.  Create and populate the required local environment files.
3.  Confirm Firebase settings and external API credentials for the
    features you want to test.
4.  Start the backend using its available npm script.
5.  Start the Vite frontend using its available npm script.
6.  Open the local address printed by the frontend development server.
7.  Test features with sample inputs and verify API responses and logs.

If a feature does not work, check the browser console, backend terminal,
environment variable names, API quotas, Firebase configuration, and
network requests.

## Security Notes

-   Never commit `.env`, `.env.local`, service-account files, private
    keys, access tokens, or passwords.
-   Keep backend-only credentials on the server. Do not expose them
    through frontend variables or client bundles.
-   Review Firebase Authentication settings and Firestore/Storage
    Security Rules before using real user data.
-   Validate and sanitize user-provided input on the backend.
-   Avoid logging secrets, authentication tokens, or sensitive user
    information.
-   If a credential was accidentally committed, revoke or rotate it.
    Deleting it in a later commit does not remove it from Git history.
-   Treat AI-generated crop-health and farming information as advisory
    and verify it with qualified local agricultural experts when needed.

## Contributing

Contributions, suggestions, and bug reports are welcome.

1.  Fork the repository.

2.  Create a feature branch:

    ``` bash
    git checkout -b feature/your-feature-name
    ```

3.  Make focused changes that follow the existing project structure and
    coding style.

4.  Test the affected frontend or backend functionality.

5.  Review your changes for secrets, generated files, and unrelated
    modifications.

6.  Commit your changes with a clear message:

    ``` bash
    git add .
    git commit -m "Describe your change"
    ```

7.  Push your branch and open a Pull Request describing:

    -   The problem being addressed.
    -   What changed and why.
    -   How the change was tested.
    -   Any configuration or screenshots relevant to review.

For bugs, include reproducible steps and relevant error messages, but
remove API keys, tokens, personal data, and other secrets.

## Future Improvements

Potential areas for continued development include:

-   Improve regional-language support and accessibility for farmers.
-   Expand and validate agricultural market-data coverage and clearly
    show source and update time.
-   Improve crop-planning recommendations with locally relevant
    agronomic information.
-   Evaluate disease-detection quality across crops, image conditions,
    and regional disease patterns.
-   Add clearer uncertainty and expert-referral guidance to AI-generated
    recommendations.
-   Strengthen community moderation, reporting, and farmer-safety
    features.
-   Improve automated testing, error handling, monitoring, and
    documentation.
-   Add deployment automation and environment-specific configuration
    once hosting choices are finalized.

These are possible improvements, not commitments or claims that the
features already exist.

## Disclaimer

KrishiMitra is a software project intended to make agricultural
information and tools more accessible. Market data, weather information,
and AI-generated outputs may be incomplete, delayed, or inaccurate. Do
not make financial, pesticide, treatment, or other consequential farming
decisions solely on the basis of this application. Verify important
information with official sources and qualified agricultural
professionals.

## License

No license is specified in this README. Unless a license is added to the
repository, the code should not be assumed to be available for reuse,
modification, or redistribution. Add a license file if you intend to
grant those permissions.
