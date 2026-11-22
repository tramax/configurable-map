/**
 * The configuration schema, shared by the frontend and the backend.
 * Keep this file free of browser and ArcGIS imports so the server can import it.
 */

export type SizeStop = { value: number; size: number };
export type ColorStop = { value: number; color: string };

export type Configuration = {
  symbolConfig: {
    size?: { field: string; stops: SizeStop[] };
    color?: { field: string; stops: ColorStop[] };
  };
  tableConfig: {
    columns: string[];
  };
};
