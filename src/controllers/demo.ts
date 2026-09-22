import { Router } from "express";
import { config } from "../config.js";
import { z } from "zod";
import { runTravelAssistant } from "../services/travel/index.js";

export const demo = Router();
demo.get("/config", (_req, res) =>
  res.json({ demoMode: config.DEMO_MODE, appName: config.APP_NAME }),
);
demo.use((_req, res, next) => {
  if (!config.DEMO_MODE) {
    res.sendStatus(404);
    return;
  }
  next();
});
demo.post("/chat", async (req, res) => {
  const parsed = z
    .object({
      userId: z.string().regex(/^demo-[a-zA-Z0-9-]{3,80}$/),
      message: z.string().trim().min(1).max(4000),
      messageId: z.string().uuid(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: "A demo userId, message and UUID messageId are required.",
      });
    return;
  }
  const x = parsed.data;
  res.json({
    reply: await runTravelAssistant(x.userId, x.message, x.messageId),
  });
});
