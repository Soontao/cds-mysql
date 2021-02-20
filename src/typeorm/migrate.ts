import { ConnectionOptions } from "typeorm";
import { CDSMySQLConnection } from "./mysql";

export async function migrate(connectionOptions: ConnectionOptions) {
  const conn = new CDSMySQLConnection(connectionOptions);
  try {
    await conn.connect();
    const builder = conn.driver.createSchemaBuilder();
    await builder.build(); // execute build
  } finally {
    if (conn.isConnected) {
      await conn.close();
    }
  }
}