
import dataSource from './data-source.js';

async function runMigrations() {
  try {
    await dataSource.initialize();

    console.log('Database connected successfully.');

    const migrations = await dataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('No pending migrations.');
    } else {
      console.log('Migrations completed:');

      migrations.forEach((migration) => {
        console.log(migration.name);
      });
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

await runMigrations();
