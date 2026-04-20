import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`LUMENTIX HRFLOW backend running on http://localhost:${env.port}`);
});
