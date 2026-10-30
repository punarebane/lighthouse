// Worker bootstrap: register tsx's loader, then run the TypeScript harness in worker mode.
import { register } from 'tsx/esm/api';
register();
await import('./sim.ts');
