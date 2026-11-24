import { describe, expect, it } from "vitest";
// helpers first: it loads the app, and with it @hono/zod-openapi, which has to extend zod before
// the API's schemas are built. The server always loads it in that order; a test must too.
import { VALID_CONFIG } from "./helpers";
import { configurationSchema } from "@contract/configuration.schema";

const withColumns = (columns: string[]) => ({ ...VALID_CONFIG, tableConfig: { columns } });

describe("configurationSchema", () => {
  it("accepts a full configuration", () => {
    expect(configurationSchema.safeParse(VALID_CONFIG).success).toBe(true);
  });

  it("accepts symbology with only one channel", () => {
    const config = { ...VALID_CONFIG, symbolConfig: { size: VALID_CONFIG.symbolConfig.size } };
    expect(configurationSchema.safeParse(config).success).toBe(true);
  });

  it("rejects duplicate or empty table columns", () => {
    expect(configurationSchema.safeParse(withColumns(["A", "A"])).success).toBe(false);
    expect(configurationSchema.safeParse(withColumns([])).success).toBe(false);
  });

  it("rejects a colour that is not #rrggbb", () => {
    const config = {
      ...VALID_CONFIG,
      symbolConfig: { color: { field: "F", stops: [{ value: 0, color: "red" }, { value: 1, color: "#00ff00" }] } },
    };
    expect(configurationSchema.safeParse(config).success).toBe(false);
  });

  it("rejects a channel with fewer than two stops or a non-positive size", () => {
    const oneStop = { ...VALID_CONFIG, symbolConfig: { size: { field: "F", stops: [{ value: 0, size: 5 }] } } };
    const zeroSize = {
      ...VALID_CONFIG,
      symbolConfig: { size: { field: "F", stops: [{ value: 0, size: 0 }, { value: 1, size: 5 }] } },
    };
    expect(configurationSchema.safeParse(oneStop).success).toBe(false);
    expect(configurationSchema.safeParse(zeroSize).success).toBe(false);
  });
});
