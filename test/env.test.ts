import path from "path/posix";
import { parseEnv } from "../src/env";

describe("Env Parser Test Suite", () => {

  it("should support parse deep env", () => {
    const env = parseEnv({
      CDS_ENV_PROFILE: "dev",
      CDS_MYSQL_USER: "tes",
      CDS_MYSQL_PASS: "pass",
      CDS_MYSQL_SSL_CA: "PEM 1",
      CDS_MYSQL_SSL_KEY: "PEM 2",
      SPRING_ACTIVE_PROFILES: "false"
    }, "cds");
    expect(env.cds.env.profile).toBe("dev");
    expect(env.cds.mysql.user).toBe("tes");
    expect(env.cds.mysql.pass).toBe("pass");
    expect(env.cds.mysql.ssl.ca).toBe("PEM 1");
    expect(env.cds.mysql.ssl.key).toBe("PEM 2");
    expect(env.spring).toBeUndefined();
  });

  it("should support parse with advanced values", () => {
    const env = parseEnv({
      CDS_MYSQL_SSL_CA: path.join(__filename),
      CDS_CONFIG: JSON.stringify({ test: { value: 1 } }),
    });
    expect(typeof env.cds.mysql.ssl.ca).toBe("string");
    expect(env.cds.mysql.ssl.ca.length).toBeGreaterThan(1);
    expect(env.cds.config.test.value).toBe(1);
  });
  
});

