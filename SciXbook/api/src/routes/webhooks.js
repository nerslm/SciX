/**
 * Webhook Routes
 * /api/v1/webhooks/*
 */

const crypto = require('crypto');
const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { success } = require('../utils/response');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');
const config = require('../config');
const SkillRepoStatusService = require('../services/SkillRepoStatusService');

const router = Router();

// Best-effort in-memory idempotency for GitHub webhook deliveries (avoids double +1 on retries).
// For production-grade reliability, persist this in DB keyed by X-GitHub-Delivery.
const seenDeliveries = new Map(); // deliveryId -> timestamp(ms)
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 6 * 60 * 60 * 1000; // 6h
  for (const [id, ts] of seenDeliveries.entries()) {
    if (ts < cutoff) seenDeliveries.delete(id);
  }
}, 30 * 60 * 1000);

function verifyGitHubSignature({ secret, rawBody, signatureHeader }) {
  if (!secret) return false;
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;
  if (!signatureHeader.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

/**
 * POST /webhooks/sciland
 * Protected by X-Sciland-Token
 */
router.post('/sciland', asyncHandler(async (req, res) => {
  const token = req.header('X-Sciland-Token');

  if (!config.sciland.webhookToken) {
    // Misconfiguration: fail closed.
    throw new UnauthorizedError('Webhook not configured');
  }

  if (!token || token !== config.sciland.webhookToken) {
    throw new UnauthorizedError('Invalid webhook token');
  }

  const updated = await SkillRepoStatusService.applyScilandWebhook(req.body);

  success(res, {
    updated: Boolean(updated),
    status: updated || null
  });
}));

/**
 * POST /webhooks/github
 * GitHub → API webhook endpoint (recommended for merged PR count updates).
 *
 * We ONLY update metrics when a PR is actually merged:
 * - event = pull_request
 * - action = closed
 * - pull_request.merged = true
 */
router.post('/github', asyncHandler(async (req, res) => {
  // Fail-closed if secret is missing.
  if (!config.github.webhookSecret) {
    throw new UnauthorizedError('GitHub webhook not configured');
  }

  const event = req.header('X-GitHub-Event') || '';
  const delivery = req.header('X-GitHub-Delivery') || '';
  const signature = req.header('X-Hub-Signature-256') || '';

  const rawBody = req.rawBody;
  if (!rawBody || !(rawBody instanceof Buffer)) {
    throw new BadRequestError('Missing raw body for signature verification');
  }

  if (!verifyGitHubSignature({
    secret: config.github.webhookSecret,
    rawBody,
    signatureHeader: signature
  })) {
    throw new UnauthorizedError('Invalid GitHub signature');
  }

  if (delivery) {
    if (seenDeliveries.has(delivery)) {
      return success(res, { ok: true, deduped: true });
    }
    seenDeliveries.set(delivery, Date.now());
  }

  // Only handle pull_request merged events.
  if (event !== 'pull_request') {
    return success(res, { ok: true, ignored: true, reason: 'unsupported_event' });
  }

  const action = req.body?.action;
  const merged = Boolean(req.body?.pull_request?.merged);
  const repoFullName = req.body?.repository?.full_name;

  if (action !== 'closed' || !merged) {
    return success(res, { ok: true, ignored: true, reason: 'not_merged' });
  }

  if (!repoFullName || typeof repoFullName !== 'string') {
    throw new BadRequestError('repository.full_name is required');
  }

  const updated = await SkillRepoStatusService.applyScilandWebhook({
    repo_full_name: repoFullName,
    merged: true
  });

  success(res, {
    ok: true,
    updated: Boolean(updated),
    status: updated || null
  });
}));

module.exports = router;

