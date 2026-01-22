# College Mini Canteen

A Progressive Web App (PWA) for ordering food from a college canteen with real-time updates.

## Features

- User login: Direct access to menu and ordering.
- Admin login: Password-protected access to add/remove items and view orders in real-time.
- Real-time order updates across devices using Socket.io.
- PWA: Installable, works offline.

## Setup

1. Install dependencies: `npm install`
2. Start the server: `npm start`
3. Open `http://localhost:3000` in a browser.

## How to Use

1. Select "Login as User" for ordering, or "Login as Admin" for management.
2. For admin, enter password "canteen123".
3. Users can select items and place orders.
4. Admins can add items and see order counts updating in real-time from any device.

## Files

- `index.html`: Main page.
- `script.js`: JavaScript logic with Socket.io.
- `style.css`: Styles.
- `manifest.json`: PWA manifest.
- `service-worker.js`: Service worker for offline.
- `server.js`: Node.js server with Socket.io.
- `package.json`: Dependencies.

## Deployment

Host the server on a platform like Heroku or Vercel. Update the Socket.io URL if needed.