# Backend Setup

1. Copy `.env.example` to `.env`.
2. Fill in your PostgreSQL credentials for the existing `smart_home_security` database.
   To enable Gmail password reset OTP delivery, set the SMTP values below:

   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your.gmail@gmail.com
   SMTP_PASS=your_16_character_google_app_password
   SMTP_FROM=Sentinel AI <your.gmail@gmail.com>
   ```

   `SMTP_PASS` must be a Google App Password, not your normal Gmail password. Enable
   2-Step Verification on the Gmail account, then create an App Password under
   Google Account > Security > App passwords. Never commit `.env` or send the App
   Password through chat.
3. Install dependencies:

```bash
npm install
```

4. Seed the required accounts:

```bash
npm run seed:admin
```

5. Start the API:

```bash
npm run dev
```

The ESP32 must call the REST API. It should never connect directly to PostgreSQL.
