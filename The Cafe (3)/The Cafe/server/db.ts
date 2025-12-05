import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the SQLite database file
export const dbPath = path.join(__dirname, '..', 'thecafe.sqlite');

// Create a new SQLite database connection
let sqlite = new Database(dbPath);

// Enable foreign key constraints
sqlite.pragma('foreign_keys = ON');

// Create a Drizzle instance with the SQLite database connection
let db = drizzle(sqlite);

/**
 * Recreate the database connection
 * This is needed after deleting the database file
 */
export function recreateConnection(): void {
  try {
    // Close existing connection if open
    try {
      sqlite.close();
    } catch (e) {
      // Ignore if already closed
    }

    // Create new connection
    sqlite = new Database(dbPath);
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);

    console.log('🔄 Database connection recreated');
  } catch (error) {
    console.error('❌ Error recreating database connection:', error);
    throw error;
  }
}

// Export the instances
export { db, sqlite as sql };
