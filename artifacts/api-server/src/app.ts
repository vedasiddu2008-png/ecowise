import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  req.log.error({ err: error }, "API request failed");
  const message = error instanceof Error ? error.message : "";
  if (
    /could not find the table .* in the schema cache|relation .* does not exist/i.test(
      message,
    )
  ) {
    res.status(503).json({
      error:
        "EcoWise’s Supabase tables are not set up yet. The project owner needs to run the schema.sql script from the EcoWise project in the Supabase SQL Editor.",
    });
    return;
  }
  res.status(500).json({
    error: "Something went wrong while loading your EcoWise data. Please try again.",
  });
};
app.use(errorHandler);

export default app;
