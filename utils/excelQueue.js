const fs = require('fs');
const path = require('path');

// In-memory per-exam queue map: examKey -> Array of tasks
const examQueues = new Map();
// In-memory per-exam processing status: examKey -> Boolean
const examProcessing = new Map();

/**
 * Enqueues an Excel synchronization task for a student result document.
 * Runs asynchronously in background without blocking main API response thread.
 */
function enqueueExcelSync(resultDoc, appendFn) {
  if (!resultDoc) return;

  const examKey = (resultDoc.examId || resultDoc.subject || 'GENERAL').toUpperCase();

  if (!examQueues.has(examKey)) {
    examQueues.set(examKey, []);
  }

  const queue = examQueues.get(examKey);
  queue.push({ resultDoc, appendFn });

  // Trigger queue processing if not already active for this exam
  if (!examProcessing.get(examKey)) {
    processExamQueue(examKey);
  }
}

/**
 * Sequentially processes tasks in the queue for a specific exam file.
 * Prevents concurrent file write conflicts (EBUSY / corruption).
 */
async function processExamQueue(examKey) {
  examProcessing.set(examKey, true);
  const queue = examQueues.get(examKey);

  while (queue && queue.length > 0) {
    const task = queue.shift();
    const { resultDoc, appendFn } = task;

    let attempts = 0;
    const maxAttempts = 3;
    let success = false;

    while (attempts < maxAttempts && !success) {
      attempts++;
      try {
        success = await appendFn(resultDoc);
        if (!success && attempts < maxAttempts) {
          // Backoff delay before retry
          await new Promise(res => setTimeout(res, attempts * 250));
        }
      } catch (err) {
        console.error(`⚠️ Queue sync error (Attempt ${attempts}/${maxAttempts}) for ${resultDoc.regNo}:`, err.message);
        if (attempts < maxAttempts) {
          await new Promise(res => setTimeout(res, attempts * 250));
        }
      }
    }

    // Update MongoDB status if sync failed after retries
    if (!success && resultDoc._id) {
      try {
        const ExamResult = require('../models/ExamResult');
        await ExamResult.findByIdAndUpdate(resultDoc._id, {
          excelSynced: false,
          excelSyncError: `Excel sync failed after ${maxAttempts} attempts.`
        });
      } catch (dbErr) {
        console.error(`Failed to update excelSynced status in DB:`, dbErr.message);
      }
    }
  }

  examProcessing.set(examKey, false);
}

/**
 * Returns active queue metrics
 */
function getQueueMetrics() {
  const metrics = {};
  for (const [key, queue] of examQueues.entries()) {
    metrics[key] = {
      queueLength: queue.length,
      isProcessing: Boolean(examProcessing.get(key))
    };
  }
  return metrics;
}

module.exports = {
  enqueueExcelSync,
  getQueueMetrics
};
