import 'dotenv/config';
import mongoose from 'mongoose';
import Meeting from '../models/Meeting.js';
import Summary from '../models/Summary.js';
import { indexMeetingTranscript, isSemanticSearchEnabled } from '../services/embeddingService.js';

/**
 * One-off backfill for meetings that existed before search was added.
 *
 * Summaries written by the old pipeline have no `searchBlob`, so keyword search
 * cannot find them, and no transcript embeddings, so they are invisible to
 * "Ask AI". This walks existing summaries and fills both in.
 *
 * Safe to re-run: it skips anything already processed unless --force is passed.
 *
 *   node scripts/backfillSearch.js              # keyword blobs + embeddings
 *   node scripts/backfillSearch.js --keyword    # keyword blobs only (no API cost)
 *   node scripts/backfillSearch.js --force      # redo everything
 */

const args = process.argv.slice(2);
const KEYWORD_ONLY = args.includes('--keyword');
const FORCE = args.includes('--force');

const HEAD_TAIL_LINES = 200;

const buildSearchBlob = ({ meeting, summary }) => {
  const transcript = summary.transcript || [];
  const slice =
    transcript.length <= HEAD_TAIL_LINES * 2
      ? transcript
      : [...transcript.slice(0, HEAD_TAIL_LINES), ...transcript.slice(-HEAD_TAIL_LINES)];

  return [
    summary.title || meeting?.title || '',
    meeting?.description || '',
    summary.summary || '',
    summary.conclusions || '',
    (summary.actionItems || []).map((i) => i.task).join('\n'),
    slice.join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 20000);
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Copy .env.example to .env first.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const query = FORCE ? {} : { $or: [{ searchBlob: '' }, { searchBlob: { $exists: false } }] };
  const summaries = await Summary.find(query).sort({ createdAt: -1 }).lean();

  console.log(`Found ${summaries.length} summaries to process.\n`);

  let keywordDone = 0;
  let embeddedDone = 0;
  let skipped = 0;

  for (const summary of summaries) {
    const meeting = await Meeting.findById(summary.meetingId).select('title description').lean();

    // ─── Keyword blob ───
    const blob = buildSearchBlob({ meeting, summary });
    if (blob.trim()) {
      await Summary.updateOne({ _id: summary._id }, { $set: { searchBlob: blob } });
      keywordDone += 1;
    } else {
      skipped += 1;
    }

    // ─── Embeddings ───
    if (!KEYWORD_ONLY && isSemanticSearchEnabled()) {
      try {
        const result = await indexMeetingTranscript(summary.meetingId, { force: FORCE });
        if (result.chunks) {
          embeddedDone += 1;
          // Gentle pacing so a large backfill doesn't trip the API rate limit.
          await new Promise((r) => setTimeout(r, 400));
        }
      } catch (error) {
        console.warn(`  ! embedding failed for ${summary.meetingId}: ${error.message}`);
      }
    }

    if ((keywordDone + skipped) % 10 === 0) {
      console.log(`  ...${keywordDone + skipped}/${summaries.length}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Keyword blobs written: ${keywordDone}`);
  console.log(`  Meetings embedded:     ${embeddedDone}`);
  console.log(`  Skipped (no content):  ${skipped}`);

  if (KEYWORD_ONLY) {
    console.log('\n  (--keyword passed: embeddings skipped, "Ask AI" will not cover these yet)');
  } else if (!isSemanticSearchEnabled()) {
    console.log('\n  (GEMINI_API_KEY not set: embeddings skipped)');
  }

  await mongoose.connection.close();
};

// Only run when invoked directly. Without this guard, merely importing the
// module (a syntax or load check, a test) would execute the backfill against
// whatever database .env points at.
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isDirectRun) {
  run().catch(async (error) => {
    console.error('Backfill failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  });
}

export { run, buildSearchBlob };
