# DocVault Enterprise

Enterprise Document Vault and User Management System with Superadmin Portal, multi-user document repositories, and Expo mobile integration.

---

## 🏛 Features

- **Document Vault**: Upload any document type (PDF, Word, Excel, images, archives) up to 100MB per file with safe storage.
- **Folder Management**: Shared folder categorization; Superadmin exclusive folder deletion.
- **Renewal & Expiry Tracking**: Optional renewal dates with status badges (Valid, Renewal Due Soon, Expired).
- **Superadmin Administration**:
  - Register new users with Name, Mobile, Email, and Password.
  - User Directory with active/suspended status controls.
  - Real-time audit logs automatically saved in `.agent/audit.log`.
- **Clean White Corporate Theme**: Responsive desktop and mobile layout with high contrast styling.
- **Expo Mobile App**: Full client in `mobileapp/` running on Expo SDK 58.

---

## 🚀 Dokploy & Docker Deployment

DocVault includes a ready-to-deploy multi-container setup with `docker-compose.yml`.

### Deployment Steps on Dokploy:
1. In Dokploy, create a new **Compose Application**.
2. Connect your repository: `https://github.com/dekakoushik/docvault`.
3. Set the Compose file path to: `docker-compose.yml`.
4. Deploy! Dokploy will build both backend and frontend images, spin up SQLite storage volumes, and route port 3000 (mapped to Nginx port 80).

### Manual Docker Compose:
```bash
docker compose up -d --build
```

---

## 🔑 Default Superadmin Credentials
- **Email:** `ithelpdesk@plystory.com`
- **Password:** `Admin@2026`

---

## 📱 Mobile App (Expo SDK 58)
```bash
cd mobileapp
npm install
npx expo start
```
Scan the QR code with the Expo Go app on your phone.

