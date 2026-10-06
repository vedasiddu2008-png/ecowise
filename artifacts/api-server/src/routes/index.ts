import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ecoWiseRouter from "./ecowise";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ecoWiseRouter);

export default router;
