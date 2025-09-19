import { destroyDatabase } from './db.js';
import { loadTurnstileContracts } from './loader.js';
import { logger } from './utils/logger.js';

export { destroyDatabase, getDatabase, setDatabase } from './db.js';
export { loadTurnstileContracts } from './loader.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  loadTurnstileContracts()
    .then((result) => {
      logger.info(result, 'Successfully loaded contract data');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(error, 'Failed to load contract data');
      process.exit(1);
    })
    .finally(() => {
      destroyDatabase().catch((destroyError) => logger.error(destroyError, 'Failed to destroy database connection'));
    });
}
