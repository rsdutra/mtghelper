import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL não está definida.");
}

export const sql = postgres(url, { max: 10 });
