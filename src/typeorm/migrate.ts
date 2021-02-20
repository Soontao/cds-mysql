import { ConnectionOptions } from "typeorm";
import { CDSMySQLConnection, CDSMySQLSchemaBuilder } from "./mysql";

export async function migrate(connectionOptions: ConnectionOptions) {
  const conn = new CDSMySQLConnection(connectionOptions);
  try {
    await conn.connect();
    const builder = new CDSMySQLSchemaBuilder(conn);
    await builder.build(); // execute build
  } finally {
    if (conn.isConnected) {
      await conn.close();
    }
  }
}