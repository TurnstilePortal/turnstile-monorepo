import { destroyDatabase } from './db.js';
import { loadTurnstileContracts } from './loader.js';

export { destroyDatabase, getDatabase, setDatabase } from './db.js';
export { loadTurnstileContracts } from './loader.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  loadTurnstileContracts()
    .then((result) => {
      console.log('Successfully loaded contract data:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to load contract data:', error);
      process.exit(1);
    })
    .finally(() => {
      destroyDatabase().catch(console.error);
    });
}
