import { app } from './app.js';
import { config } from './config.js';
app.listen(config.PORT,()=>console.log(`${config.APP_NAME} listening at http://localhost:${config.PORT} (${config.DEMO_MODE?'demo':'connected sandbox'})`));
