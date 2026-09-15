import express from 'express';

import * as healthController from './health.controller.js';

const router = express.Router();

// GET /api/health
router.get('/health', healthController.getHealth);

// GET /api/db-check
router.get('/db-check', healthController.getDatabaseStatus);

export default router;
