# BiteBox

BiteBox is a responsive food delivery starter app. The frontend is HTML, CSS, Bootstrap and JavaScript; the backend is a Node.js API backed by PostgreSQL. The six menu entries are temporary sample data and can be replaced with your menu.

## Run locally

1. Install Node.js 18+ and PostgreSQL.
2. Create a PostgreSQL database, for example `bitebox` (using `createdb bitebox` or pgAdmin).
3. In PowerShell, set the environment variables for the current terminal:

   ```powershell
   $env:DATABASE_URL = "postgres://postgres:your-password@localhost:5432/bitebox"
   $env:JWT_SECRET = "replace-with-a-random-secret-of-at-least-32-characters"
   $env:PORT = "3000"
   ```

   For hosted PostgreSQL that requires TLS, set `PGSSL=true`.
4. Run `npm install`, then `npm start` in that same terminal.
5. Open `http://localhost:3000`.

On startup, the backend creates the tables and inserts the temporary menu only if the menu table is empty. Update `backend/schema.sql` with your menu, or manage menu entries directly in PostgreSQL.

## What works

- Browse, search and filter menu items; add/remove items in a persistent cart.
- Open a separate detail page for each menu item and add a chosen quantity to the shared cart.
- Register and log in with email/password. Passwords are hashed; authenticated sessions use a signed token.
- Check out with a delivery address. Order totals are calculated from current database prices, not client-provided prices.
- See order status and look up an order using its order number through `GET /api/orders/:id`.
- When the API is not reachable, menu browsing uses the sample menu; account creation and checkout require the API and PostgreSQL.

Order status is stored in PostgreSQL and starts at `Confirmed`. Update an order's `status` field from an operations/admin workflow to advance tracking.
