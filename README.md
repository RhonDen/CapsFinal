# CAPSPROJ

Plain JavaScript rewrite of the appointment system using React on the client and Express/MongoDB on the server.

## Structure

- `client/` contains the Vite + React frontend written in `.jsx`.
- `server/` contains the Express backend written in `.js`.

## Run The Client

```bash
cd client
npm install
npm run dev
```

## Run The Server

```bash
cd server
npm install
npm run seed
npm run dev
```

## Default Admin

- Username: `admin`
- Password: `admin123`

## Important

- Update `server/.env` before using the project outside local development.
- Replace the placeholder SMS credentials with your live provider values.
- Change the seeded admin password before deployment.
