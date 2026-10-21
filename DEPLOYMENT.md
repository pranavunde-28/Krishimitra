# Hosting KrishiMitra

This repository is configured for a simple split deployment:

- **Frontend:** Netlify (React/Vite static site)
- **Backend:** Render (Node/Express web service)

Deploy both from the same GitHub repository. Keep backend credentials in Render, never in frontend variables.

## 1. Deploy the backend to Render

1. Push the repository to GitHub.
2. In Render, choose **New + → Blueprint**, connect the repository, and let Render read `render.yaml` from the repository root.
3. Create the service. The health check is available at `/health`; copy the service's public URL, for example `https://krishimitra-api.onrender.com`.
4. In the Render service's **Environment** settings, add `FRONTEND_URL` with the exact Netlify site origin after deploying the frontend (next section). For multiple allowed production origins, separate origins with commas. Save and redeploy.
5. Add optional server-side credentials in Render's environment settings when needed: `GROQ_API_KEY`, `DATA_GOV_IN_API_KEY`, and `CROP_HEALTH_API_KEY`.

The Render free service may sleep when idle and its local filesystem is temporary. The app can use sample price data without an API key; do not rely on local cache files for persistent storage.

## 2. Deploy the frontend to Netlify

1. In Netlify, choose **Add new site → Import an existing project** and connect the same GitHub repository.
2. Netlify reads the root `netlify.toml`. It builds from `frontend/` and publishes the Vite `dist/` output; leave the configured build and publish settings as-is.
3. Before the first production build, add these under **Site configuration → Environment variables**:
   - `VITE_BACKEND_URL` = the Render public URL from step 1, with no trailing slash.
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Trigger a deploy. Copy the Netlify site origin (for example `https://your-site.netlify.app`) into Render's `FRONTEND_URL`, then redeploy the backend.

Vite variables are embedded in the browser build. Only Firebase web-app configuration belongs in `VITE_*`; never place Groq keys, service-account credentials, or other private secrets there.

## 3. Finish Firebase setup (if using Firebase features)

In Firebase Console, add the deployed Netlify domain to **Authentication → Settings → Authorized domains**. Confirm Authentication and Firestore are configured for the same project as the frontend variables. Deploy the repository's Firestore rules from the project root with the Firebase CLI:

```sh
firebase deploy --only firestore:rules
```

If the backend's optional Firebase Admin report persistence is required, add the service-account JSON as a Render **Secret File** and set `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` to its mounted path (typically `/etc/secrets/<filename>`). Do not commit the key.

## 4. Verify the deployment

- Open the Render `/health` URL and confirm it returns `{"status":"ok", ...}`.
- Open the Netlify site and check browser developer tools for failed API requests or Firebase configuration errors.
- If API requests are blocked, verify `VITE_BACKEND_URL`, the Render `FRONTEND_URL` origin, then redeploy both services after changing build-time frontend variables.

## Local environment examples

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in the values needed locally. `.env` files and Firebase service-account credentials are ignored by Git.