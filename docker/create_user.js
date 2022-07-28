(
  async () => {
    try {
      const adminUserName = process.env.MYSQL_ADMIN_USRE ?? "cds_admin";
      const mysqlPort = parseInt(process.env.MYSQL_PORT ?? "3306");
      const mysqlHost = process.env.MYSQL_HOST ?? "127.0.0.1";
      const mysqlPass = process.env.MYSQL_PASSWORD;
      const mysql = require("mysql2/promise");
      const conn = await mysql.createConnection({
        user: "root",
        host: mysqlHost,
        port: mysqlPort,
        password: mysqlPass,
      });

      await conn.query(`CREATE DATABASE ${adminUserName};`);
      await conn.query(`CREATE USER '${adminUserName}'@'%' IDENTIFIED BY '${adminUserName}';`);
      await conn.query(`GRANT ALL PRIVILEGES ON *.* TO '${adminUserName}'@'%' WITH GRANT OPTION;`);

      conn.destroy();
      console.log(`user '${adminUserName}'@'%' created at '127.0.0.1:${mysqlPort}'`);
      process.exit(0);
    } catch (error) {
      console.error("create user failed: ", error);
      process.exit(1);
    }

  }
)();