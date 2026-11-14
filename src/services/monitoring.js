import {checkDatabase} from './api';
export const monitoringService={check:checkDatabase, scheduleDescription:s=>s?.enabled?`Every ${s.interval} minutes`:'Paused'};
