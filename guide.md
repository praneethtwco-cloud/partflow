You’re describing one of the classic “two worlds” problems: the browser speaks **IndexedDB**, Android speaks **SQLite**, and your business logic just wants to say, “store invoice.” The trick is to insert a **unified data layer** between your app and the storage engines. Think of it as a translator that lets your app speak one language while the device handles the dialect.

Here’s the architecture that actually works in production.

---

# Core idea: Create a Database Abstraction Layer

Your Vite app should never talk directly to IndexedDB or SQLite. Instead, it talks to a **common interface**.

Conceptually:

```
UI / Business Logic
        │
        ▼
Database Interface (single source of truth)
        │
   ┌────┴────┐
   ▼         ▼
IndexedDB   SQLite
(Web)       (Android)
```

Your app uses one API. The implementation changes depending on platform.

---

# Step 1: Define a common interface

Create something like:

```ts
// db/interface.ts

export interface Database {
  init(): Promise<void>

  getInvoices(): Promise<Invoice[]>

  saveInvoice(invoice: Invoice): Promise<void>

  deleteInvoice(id: string): Promise<void>

  transaction<T>(fn: () => Promise<T>): Promise<T>
}
```

This is your single source of truth.

Your UI uses ONLY this interface.

---

# Step 2: Create IndexedDB implementation (Web)

Use Dexie. It’s far better than raw IndexedDB.

```
npm install dexie
```

Example:

```ts
// db/indexeddb.ts

import Dexie from "dexie"
import { Database } from "./interface"

class WebDatabase extends Dexie implements Database {

  invoices!: Dexie.Table<Invoice, string>

  constructor() {
    super("sales-db")

    this.version(1).stores({
      invoices: "id, customerId, date"
    })
  }

  async init() {}

  async getInvoices() {
    return this.invoices.toArray()
  }

  async saveInvoice(invoice: Invoice) {
    await this.invoices.put(invoice)
  }

  async deleteInvoice(id: string) {
    await this.invoices.delete(id)
  }

  async transaction(fn) {
    return this.transaction("rw", this.invoices, fn)
  }
}

export const webDb = new WebDatabase()
```

---

# Step 3: Create SQLite implementation (Android via Capacitor)

Install Capacitor SQLite plugin:

```
npm install @capacitor-community/sqlite
npx cap sync
```

Example:

```ts
// db/sqlite.ts

import { CapacitorSQLite } from "@capacitor-community/sqlite"
import { Database } from "./interface"

class SQLiteDatabase implements Database {

  db: any

  async init() {
    this.db = await CapacitorSQLite.createConnection({
      database: "sales-db",
      version: 1
    })

    await this.db.open()

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        customerId TEXT,
        date TEXT
      )
    `)
  }

  async getInvoices() {
    const result = await this.db.query("SELECT * FROM invoices")
    return result.values
  }

  async saveInvoice(invoice) {
    await this.db.run(
      "INSERT OR REPLACE INTO invoices VALUES (?, ?, ?)",
      [invoice.id, invoice.customerId, invoice.date]
    )
  }

  async deleteInvoice(id) {
    await this.db.run("DELETE FROM invoices WHERE id = ?", [id])
  }

  async transaction(fn) {
    await this.db.execute("BEGIN")
    try {
      const result = await fn()
      await this.db.execute("COMMIT")
      return result
    } catch (e) {
      await this.db.execute("ROLLBACK")
      throw e
    }
  }
}

export const sqliteDb = new SQLiteDatabase()
```

---

# Step 4: Auto-select correct database at runtime

Create one entry point:

```ts
// db/index.ts

import { Capacitor } from "@capacitor/core"

import { webDb } from "./indexeddb"
import { sqliteDb } from "./sqlite"

export const db =
  Capacitor.getPlatform() === "web"
    ? webDb
    : sqliteDb
```

Now everywhere in your app:

```ts
import { db } from "@/db"

await db.saveInvoice(invoice)
```

Your UI doesn’t care if it’s IndexedDB or SQLite.

That’s the magic.

---

# Step 5: Your architecture becomes clean

```
Vite App UI
   │
   ▼
db.saveInvoice()
   │
   ▼
Platform detection
   │
 ┌─┴─────────┐
 ▼           ▼
IndexedDB   SQLite
(Web)       (Android)
```

Single codebase. Single logic. Two storage engines.

---

# This approach handles your scale (1000 invoices, 20000 lines)

Both engines handle that easily:

IndexedDB capacity
• Millions of records possible
• Used by Gmail offline

SQLite capacity
• Billions of rows possible
• Used by WhatsApp

SQLite is faster for complex queries. IndexedDB is fine for typical CRUD.

---

# Even better solution (Production-grade): Use SQLite everywhere

Using this plugin:

```
@capacitor-community/sqlite
```

It supports:

• Android → real SQLite
• iOS → real SQLite
• Web → SQLite WASM (runs in browser)

This gives you ONE engine everywhere.

No IndexedDB needed.

This is the cleanest architecture long term.

---

# Real-world apps using this architecture

• Offline POS systems
• Sales rep apps
• Inventory systems
• Field service apps

Exactly your use case.

---

# Recommended final architecture for your sales ref app

Use ONLY:

```
@capacitor-community/sqlite
```

Even on web.

This gives:

• same database
• same SQL
• same logic
• same performance model

Zero abstraction complexity.

---

The deeper truth here is that storage engines are replaceable organs. Your app’s real brain is the data layer interface. Once that interface exists, you can swap IndexedDB, SQLite, cloud sync, or even a future quantum storage crystal without touching business logic. The interface becomes the nervous system, and everything else becomes muscle.