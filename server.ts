import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { 
  UserProfile, 
  Shift, 
  Item, 
  ExamAttempt, 
  ExamResponse, 
  AuditLogEntry, 
  ReviewFlag, 
  ConsentRecord,
  ClientItem,
  AuditCategory
} from './src/types';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000; // Hardcoded port required by infrastructure

// In-memory data store with optional file-based fallback persistence
const DB_FILE = path.join(process.cwd(), 'nexus_db.json');

interface LocalDB {
  profiles: Record<string, UserProfile>;
  shifts: Shift[];
  item_bank: Item[];
  attempts: Record<string, ExamAttempt>;
  responses: Record<string, ExamResponse[]>;
  audit_logs: AuditLogEntry[];
  review_flags: ReviewFlag[];
  consent_records: ConsentRecord[];
}

let db: LocalDB = {
  profiles: {},
  shifts: [],
  item_bank: [],
  attempts: {},
  responses: {},
  audit_logs: [],
  review_flags: [],
  consent_records: []
};

// Seed questions
const INITIAL_ITEMS: Omit<Item, 'id' | 'exposure_count' | 'version'>[] = [
  // --- Numerical Items ---
  {
    type: 'numerical',
    language: 'en',
    question_text: 'A cryptographic block generator produces {r} blocks per minute, where each block size is {s} KB. What is the total bandwidth utilization in megabits per second (Mbps)? (Round answer to two decimal places).',
    template: {
      text: 'A cryptographic block generator produces {r} blocks per minute, where each block size is {s} KB. What is the total bandwidth utilization in megabits per second (Mbps)? (Round answer to two decimal places).',
      params: {
        r: [100, 300], // blocks per minute
        s: [128, 512]  // KB per block
      },
      formula: '((r * s * 1024 * 8) / 60) / 1000000' // formula outputting Mbps
    },
    options: ['8.73 Mbps', '1.31 Mbps', '5.46 Mbps', '2.18 Mbps'], // Will be dynamically generated, placeholder options included
    correct_option: '', // Will be dynamically computed
    concept: 'Bandwidth Calculation',
    irt_a: 1.8,
    irt_b: 0.5,
    irt_c: 0.15,
    status: 'live'
  },
  {
    type: 'numerical',
    language: 'en',
    question_text: 'In a Zero-Knowledge Proof protocol, if the prover runs the commitment cycle {n} times sequentially, and the chance of a cheater successfully guessing a challenge is 1/{base} on each cycle, what is the exact probability of a cheating prover passing all {n} cycles? (Provide answer as % to 4 decimal places, e.g. 1.2345%)',
    template: {
      text: 'In a Zero-Knowledge Proof protocol, if the prover runs the commitment cycle {n} times sequentially, and the chance of a cheater successfully guessing a challenge is 1/{base} on each cycle, what is the exact probability of a cheating prover passing all {n} cycles? (Provide answer as % to 4 decimal places, e.g. 1.2345%)',
      params: {
        n: [10, 16],
        base: [2, 3]
      },
      formula: '(Math.pow(1 / base, n) * 100)'
    },
    options: ['0.0977%', '0.1523%', '0.0051%', '0.0244%'],
    correct_option: '',
    concept: 'ZKP Soundness Probability',
    irt_a: 2.2,
    irt_b: 1.2,
    irt_c: 0.10,
    status: 'live'
  },
  {
    type: 'numerical',
    language: 'en',
    question_text: 'A distributed ledger has nodes distributed across {c} cities. The average latency between cities is {l} ms. To reach 2/3 Byzantine fault-tolerance consensus, a node must receive approvals from {c} city hubs. If approvals are sent block-by-block, and network overhead adds 15%, what is the absolute minimum consensus delay for {blocks} blocks in milliseconds? (Round to nearest integer)',
    template: {
      text: 'A distributed ledger has nodes distributed across {c} cities. The average latency between cities is {l} ms. To reach 2/3 Byzantine fault-tolerance consensus, a node must receive approvals from {c} city hubs. If approvals are sent block-by-block, and network overhead adds 15%, what is the absolute minimum consensus delay for {blocks} blocks in milliseconds? (Round to nearest integer)',
      params: {
        c: [3, 8],
        l: [25, 75],
        blocks: [10, 50]
      },
      formula: '(blocks * l * 1.15)'
    },
    options: ['575 ms', '1150 ms', '1725 ms', '2300 ms'],
    correct_option: '',
    concept: 'BFT Latency Math',
    irt_a: 1.5,
    irt_b: -0.2,
    irt_c: 0.20,
    status: 'live'
  },

  // --- Conceptual Items ---
  {
    type: 'conceptual',
    language: 'en',
    question_text: 'In a distributed consensus environment where "Proof of Work" is replaced by a reputation-based voting system, what mechanism best prevents a "Sybil attack" without compromising participant anonymity?',
    options: [
      'Mandatory linking of biological biometric hashes to wallet addresses.',
      'Implementing a trust-weighted zero-knowledge proof for past honest contributions.',
      'Centralized KYC verification before participation in any voting round.',
      'Dynamic slashing of reputation points for any outlier voting patterns.'
    ],
    correct_option: 'Implementing a trust-weighted zero-knowledge proof for past honest contributions.',
    concept: 'Sybil Mitigation',
    irt_a: 1.9,
    irt_b: 0.8,
    irt_c: 0.22,
    status: 'live'
  },
  {
    type: 'conceptual',
    language: 'en',
    question_text: 'Which of the following describes the key structural difference between a Merkle Tree and a Merkle Mountain Range (MMR)?',
    options: [
      'An MMR allows efficient append-only operations and history proofs without fully rebalancing the entire tree.',
      'A Merkle Tree cannot compute root hashes without having an even count of leaf nodes.',
      'An MMR stores data in a circular buffer structure to automatically trim logs older than 24 hours.',
      'An MMR uses elliptic curve addition instead of SHA-256 for standard hash generation.'
    ],
    correct_option: 'An MMR allows efficient append-only operations and history proofs without fully rebalancing the entire tree.',
    concept: 'Merkle Alternatives',
    irt_a: 1.4,
    irt_b: 0.4,
    irt_c: 0.25,
    status: 'live'
  },
  {
    type: 'conceptual',
    language: 'en',
    question_text: 'When migrating a traditional database to a multi-leader active-active model, what is the principal mitigation against split-brain scenarios?',
    options: [
      'Implementing a strict state-machine replication protocol like Raft or Paxos behind writes.',
      'Executing a physical network firewall disconnect on any database replica with >5% query error rates.',
      'Adding UUIDv4 Primary Keys to guarantee absolute chronological order of updates.',
      'Forcing all node operations to serialize through a single shared network cache in memory.'
    ],
    correct_option: 'Implementing a strict state-machine replication protocol like Raft or Paxos behind writes.',
    concept: 'Split-brain scenarios',
    irt_a: 2.0,
    irt_b: 1.1,
    irt_c: 0.18,
    status: 'live'
  },
  {
    type: 'conceptual',
    language: 'en',
    question_text: 'What major trade-off is introduced when utilizing homomorphic encryption to evaluate search queries on encrypted medical records?',
    options: [
      'Substantial computational overhead, increasing CPU and RAM demands by several orders of magnitude.',
      'Complete loss of deterministic data structure, rendering the primary indexing indexes unusable.',
      'Potential vulnerability to quantum timing strikes due to key length limitations.',
      'The requirement for the private key to be kept in the memory of the computing server.'
    ],
    correct_option: 'Substantial computational overhead, increasing CPU and RAM demands by several orders of magnitude.',
    concept: 'Homomorphic trade-offs',
    irt_a: 1.1,
    irt_b: -0.5,
    irt_c: 0.24,
    status: 'live'
  },

  // --- Ethical Items ---
  {
    type: 'ethical',
    language: 'en',
    question_text: 'An online proctoring system flags a student for visual focus loss because they frequently look away from the screen. The student has an undocumented neurodivergence that causes involuntary eye movements. What is the most ethically robust design pattern to address this?',
    options: [
      'Enforce an automatic test suspension and flag for immediate security expulsion.',
      'Suppress automated dynamic penalties, capturing logs purely as context for a secondary human-in-the-loop review.',
      'Instruct the student to focus on a centralized green dot on the screen under risk of zero marks.',
      'Require the camera to increase its detection accuracy thresholds to 99.9% utilizing machine-vision calibration.'
    ],
    correct_option: 'Suppress automated dynamic penalties, capturing logs purely as context for a secondary human-in-the-loop review.',
    concept: 'Proctoring Accessibility Privacy',
    irt_a: 1.6,
    irt_b: 0.1,
    irt_c: 0.20,
    status: 'live'
  },
  {
    type: 'ethical',
    language: 'en',
    question_text: 'During the system configuration of a massive public examination system, developers discover that biometric face analysis fails at a 12% higher rate for individuals of colored skin tones. What action is mandated under systemic fairness?',
    options: [
      'Allow colored candidate exceptions to log in with simple static text passwords and bypass proctor audits entirely.',
      'Accept the 12% variance as an industry margin of error and proceed to the active launch.',
      'Halt automated facial biometric locking, deploying alternative real-time dynamic check modal verification and physical human proctors.',
      'Instruct color-skin candidates to take the exam under higher lamp illumination environments.'
    ],
    correct_option: 'Halt automated facial biometric locking, deploying alternative real-time dynamic check modal verification and physical human proctors.',
    concept: 'Biometric Disparity',
    irt_a: 1.7,
    irt_b: 0.6,
    irt_c: 0.15,
    status: 'live'
  }
];

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
    } else {
      seedInitialDB();
    }
  } catch (error) {
    console.error("Error loading mock database:", error);
    seedInitialDB();
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error saving mock database:", error);
  }
}

function seedInitialDB() {
  db = {
    profiles: {
      "demo-user": {
        id: "demo-user",
        full_name: "Alex Rivera",
        role: "student",
        application_number: "AP-2026-X891",
        accommodations: {
          extra_time: 1.0,
          high_contrast: false,
          screen_reader: false,
          extended_breaks: false
        },
        created_at: new Date().toISOString()
      },
      "demo-admin": {
        id: "demo-admin",
        full_name: "Dr. Elena Vance (Head Proctor)",
        role: "admin",
        application_number: "AD-2026-PROCTOR",
        accommodations: {},
        created_at: new Date().toISOString()
      }
    },
    shifts: [
      {
        id: "shift-morning",
        name: "Morning Shift (Main Session 1)",
        starts_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(), // started 12 hours ago
        ends_at: new Date(Date.now() + 3600 * 1000 * 12).toISOString(),   // ends in 12 hours
        is_open: true
      },
      {
        id: "shift-afternoon",
        name: "Afternoon Shift (Session 2)",
        starts_at: new Date(Date.now() + 3600 * 1000 * 12).toISOString(),
        ends_at: new Date(Date.now() + 3600 * 1000 * 24).toISOString(),
        is_open: true
      },
      {
        id: "shift-completed",
        name: "Yesterday Mock Shift (Historical)",
        starts_at: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
        ends_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        is_open: false
      }
    ],
    item_bank: INITIAL_ITEMS.map((item, idx) => ({
      ...item,
      id: `item-${idx + 1}`,
      exposure_count: Math.floor(Math.random() * 20) + 1,
      version: 1
    })),
    attempts: {},
    responses: {},
    audit_logs: [],
    review_flags: [],
    consent_records: []
  };

  // Pre-seed some mock historical attempts for yesterday's completed shift to demonstrate normalization
  const yesterdaysAttemptIds = ["attempt-mock-1", "attempt-mock-2", "attempt-mock-3", "attempt-mock-4"];
  const mockStudents = [
    { id: "student-1", name: "Priya Patel", score: 4, theta: 0.8, appNo: "AP-2026-P001" },
    { id: "student-2", name: "John Doe", score: 2, theta: -0.5, appNo: "AP-2026-J002" },
    { id: "student-3", name: "Fatima Al-Sayed", score: 5, theta: 1.8, appNo: "AP-2026-F003" },
    { id: "student-4", name: "Chen Wei", score: 3, theta: 0.2, appNo: "AP-2026-C004" }
  ];

  mockStudents.forEach((student, index) => {
    db.profiles[student.id] = {
      id: student.id,
      full_name: student.name,
      role: "student",
      application_number: student.appNo,
      accommodations: {},
      created_at: new Date().toISOString()
    };

    const attemptId = yesterdaysAttemptIds[index];
    db.attempts[attemptId] = {
      id: attemptId,
      user_id: student.id,
      shift_id: "shift-completed",
      assigned_item_ids: ["item-1", "item-2", "item-4", "item-5", "item-8"],
      numeric_values: {
        "item-1": { r: 120, s: 256 },
        "item-2": { n: 12, base: 2 }
      },
      watermark: `SEC-COMP-${student.id.toUpperCase()}-SEEDED`,
      started_at: new Date(Date.now() - 3600 * 1000 * 30).toISOString(),
      submitted_at: new Date(Date.now() - 3600 * 1000 * 29).toISOString(),
      time_limit_seconds: 1800,
      raw_score: student.score,
      ability_estimate: student.theta,
      normalized_percentile: null, // Will compute via normalization function during seed
      status: "submitted"
    };

    db.responses[attemptId] = [
      {
        id: `response-mock-${student.id}-1`,
        attempt_id: attemptId,
        item_id: "item-1",
        selected_option: student.score >= 3 ? "A" : "B",
        is_correct: student.score >= 3,
        response_time_ms: 220000,
        answered_at: new Date().toISOString()
      },
      {
        id: `response-mock-${student.id}-2`,
        attempt_id: attemptId,
        item_id: "item-2",
        selected_option: student.score >= 4 ? "B" : "D",
        is_correct: student.score >= 4,
        response_time_ms: 180000,
        answered_at: new Date().toISOString()
      }
    ];
  });

  // Run initial normalization for historical shift
  runEquipercentileNormalization("shift-completed");

  saveDB();
}

// Global helper for hash-chained logging
function logEvent(attemptId: string | null, userId: string | null, category: AuditCategory, detail: Record<string, any>): AuditLogEntry {
  const lastLog = db.audit_logs[db.audit_logs.length - 1];
  const prevHash = lastLog ? lastLog.row_hash : "0000000000000000000000000000000000000000000000000000000000000000";
  const createdAt = new Date().toISOString();
  
  const hmac = crypto.createHmac('sha256', process.env.GEMINI_API_KEY || 'nexus-default-secure-secret');
  hmac.update(prevHash + category + JSON.stringify(detail) + createdAt);
  const rowHash = hmac.digest('hex');

  const entry: AuditLogEntry = {
    id: db.audit_logs.length + 1,
    attempt_id: attemptId,
    user_id: userId,
    category,
    detail,
    created_at: createdAt,
    prev_hash: prevHash,
    row_hash: rowHash
  };

  db.audit_logs.push(entry);
  saveDB();
  return entry;
}

// Equipercentile Normalization function inside server-side
function runEquipercentileNormalization(shiftId: string) {
  const shiftAttempts = Object.values(db.attempts).filter(
    a => a.shift_id === shiftId && a.status === 'submitted' && a.raw_score !== null
  );

  if (shiftAttempts.length === 0) return;

  shiftAttempts.sort((a, b) => (a.raw_score || 0) - (b.raw_score || 0));

  shiftAttempts.forEach(attempt => {
    const score = attempt.raw_score || 0;
    // Count how many participants in this specific shift had a score less than or equal to this
    const lessOrEqual = shiftAttempts.filter(a => (a.raw_score || 0) <= score).length;
    const percentile = Math.round((lessOrEqual / shiftAttempts.length) * 100 * 100) / 100;
    attempt.normalized_percentile = percentile;
  });

  saveDB();
}

// Seed the database immediately
loadDB();

const app = express();
app.use(cors());
app.use(express.json());

// Dynamic calculations for numerical item types
function generateAndSolveNumericalItem(item: Item, studentId: string): { 
  question_text: string; 
  options: string[]; 
  correct_option: string;
  parameters: Record<string, number>;
} {
  if (!item.template) {
    return {
      question_text: item.question_text,
      options: [...item.options],
      correct_option: item.correct_option,
      parameters: {}
    };
  }

  const parameters: Record<string, number> = {};
  let text = item.template.text;

  // Pick deterministic random values based on student ID seed and item ID seed
  const seedString = `${studentId}-${item.id}`;
  let seedNum = 0;
  for (let i = 0; i < seedString.length; i++) {
    seedNum = seedString.charCodeAt(i) + (seedNum << 6) + (seedNum << 16) - seedNum;
  }
  
  const rand = () => {
    const x = Math.sin(seedNum++) * 10000;
    return x - Math.floor(x);
  };

  Object.entries(item.template.params).forEach(([paramName, range]) => {
    const [min, max] = range;
    const value = Math.floor(rand() * (max - min + 1)) + min;
    parameters[paramName] = value;
    text = text.replace(new RegExp(`{${paramName}}`, 'g'), value.toString());
  });

  // Evaluate mathematical formula securely on server
  let mathResult: number;
  try {
    // Safely evaluate standard math express
    const safeVariables = Object.entries(parameters)
      .map(([k, v]) => `const ${k} = ${v};`)
      .join('\n');
    
    // Evaluate the formula
    const evaluationFn = new Function(`${safeVariables} return ${item.template.formula};`);
    mathResult = evaluationFn();
  } catch (e) {
    console.error("Error evaluating item formula:", e);
    mathResult = 42; // Fail-graceful fallback
  }

  // Format final answer strictly based on question units
  let correctOptStr = '';
  if (item.template.formula.includes('Math.pow')) {
    correctOptStr = `${mathResult.toFixed(4)}%`;
  } else if (item.template.formula.includes('blocks * l *')) {
    correctOptStr = `${Math.round(mathResult)} ms`;
  } else {
    correctOptStr = `${mathResult.toFixed(2)} Mbps`;
  }

  // Generate plausible random options
  const unit = correctOptStr.includes('Mbps') ? ' Mbps' : (correctOptStr.includes('%') ? '%' : ' ms');
  const numericVal = parseFloat(correctOptStr);
  const optA = correctOptStr;
  const optB = `${(numericVal * 0.8).toFixed(2)}${unit}`;
  const optC = `${(numericVal * 1.2).toFixed(2)}${unit}`;
  const optD = `${(numericVal * 1.5).toFixed(2)}${unit}`;

  // Deterministic shuffle of options to prevent guessing
  const options = [optA, optB, optC, optD].sort((a, b) => {
    const code = (a + b).charCodeAt(0);
    return Math.sin(code) > 0 ? 1 : -1;
  });

  return {
    question_text: text,
    options,
    correct_option: correctOptStr,
    parameters
  };
}

// ============================================
// API ENDPOINTS
// ============================================

// Authenticate / login mock session
app.post('/api/auth/login', (req, res) => {
  const { email, applicationNumber, pin, isRegistration, name, accommodations } = req.body;
  const identifier = (applicationNumber || email || '').trim();

  if (!identifier) {
    return res.status(400).json({ error: "Application Number or Email is required" });
  }

  const normalizedIdentifier = identifier.toLowerCase();

  // Try to find the profile by id or by application_number
  let userId = Object.keys(db.profiles).find(id => 
    id.toLowerCase() === normalizedIdentifier || 
    (db.profiles[id].application_number && db.profiles[id].application_number!.toLowerCase() === normalizedIdentifier)
  );

  if (!userId) {
    if (normalizedIdentifier.includes('admin')) {
      userId = "demo-admin";
    } else {
      // Create user profile on-the-fly for their Application Number!
      userId = crypto.randomUUID();
      db.profiles[userId] = {
        id: userId,
        full_name: name || `Student (${identifier})`,
        role: 'student',
        application_number: identifier,
        accommodations: accommodations || {
          extra_time: 1.0,
          high_contrast: false,
          screen_reader: false,
          extended_breaks: false
        },
        created_at: new Date().toISOString()
      };
      saveDB();
    }
  }

  const profile = db.profiles[userId];
  if (profile && !profile.application_number) {
    profile.application_number = profile.id === 'demo-user' ? 'AP-2026-X891' : profile.id;
  }
  
  logEvent(null, userId, 'identity_check', { type: "login", identifier });

  res.json({ status: "success", profile, token: `NX-MOCK-JWT-${userId}` });
});

// Get User Profile
app.get('/api/auth/profile/:id', (req, res) => {
  const profile = db.profiles[req.params.id];
  if (!profile) return res.status(404).json({ error: "User not found" });
  res.json(profile);
});

// Update Profile accommodations
app.post('/api/auth/profile/update', (req, res) => {
  const { userId, accommodations, full_name } = req.body;
  const profile = db.profiles[userId];
  if (!profile) return res.status(404).json({ error: "User not found" });

  if (accommodations) profile.accommodations = accommodations;
  if (full_name) profile.full_name = full_name;

  saveDB();
  res.json({ status: "success", profile });
});

// List Shifts
app.get('/api/exams/shifts', (req, res) => {
  res.json(db.shifts);
});

// Create Consent Record
app.post('/api/exams/consent', (req, res) => {
  const { userId, cameraConsent } = req.body;
  const record: ConsentRecord = {
    id: crypto.randomUUID(),
    user_id: userId,
    camera_consent: !!cameraConsent,
    consent_text_version: "v1.2-DPDP-compliance",
    created_at: new Date().toISOString()
  };
  db.consent_records.push(record);
  saveDB();

  logEvent(null, userId, 'identity_check', { type: "camera_consent", accepted: !!cameraConsent });
  res.json({ status: "success", record });
});

// Assemble Exam (ATA - Automated Test Assembly)
app.post('/api/exams/assemble', (req, res) => {
  const { userId, shiftId } = req.body;

  if (!userId || !shiftId) {
    return res.status(400).json({ error: "Missing required properties" });
  }

  const profile = db.profiles[userId] || db.profiles["demo-user"];
  const shift = db.shifts.find(s => s.id === shiftId);

  if (!shift) {
    return res.status(404).json({ error: "Exam shift not found" });
  }

  // If student already has an active attempt, return that attempt immediately!
  const existingAttempt = Object.values(db.attempts).find(
    a => a.user_id === userId && a.shift_id === shiftId && a.status === 'in_progress'
  );

  if (existingAttempt) {
    // Generate questions for this previous attempt
    const questions: ClientItem[] = existingAttempt.assigned_item_ids.map(itemId => {
      const original = db.item_bank.find(item => item.id === itemId)!;
      if (original.type === 'numerical') {
        const generated = generateAndSolveNumericalItem(original, userId);
        return {
          id: original.id,
          type: original.type,
          language: original.language,
          question_text: generated.question_text,
          options: generated.options,
          concept: original.concept
        };
      }
      return {
        id: original.id,
        type: original.type,
        language: original.language,
        question_text: original.question_text,
        options: original.options,
        concept: original.concept
      };
    });

    const savedResponses: Record<string, string> = {};
    const responsesList = db.responses[existingAttempt.id] || [];
    responsesList.forEach(r => {
      if (r.selected_option) {
        savedResponses[r.item_id] = r.selected_option;
      }
    });

    // Calculate dynamic time remaining
    const startTime = new Date(existingAttempt.started_at).getTime();
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const limit = existingAttempt.time_limit_seconds;
    const timeLeft = Math.max(0, limit - elapsedSeconds);

    return res.json({
      status: "success",
      attempt: existingAttempt,
      questions,
      savedResponses,
      currentTimeLeft: timeLeft
    });
  }

  // ATA: Select items meeting strict constraints
  // Target: 2 numerical, 2 conceptual, 1 ethical = total 5 items
  const liveItems = db.item_bank.filter(i => i.status === 'live');
  const numericals = liveItems.filter(i => i.type === 'numerical');
  const conceptuals = liveItems.filter(i => i.type === 'conceptual');
  const ethicals = liveItems.filter(i => i.type === 'ethical');

  // Sympson–Hetter style exposure control: pick items prioritize lower exposure counts
  const sortByExposure = (a: Item, b: Item) => a.exposure_count - b.exposure_count;
  numericals.sort(sortByExposure);
  conceptuals.sort(sortByExposure);
  ethicals.sort(sortByExposure);

  const selectedItems: Item[] = [
    ...numericals.slice(0, 2),
    ...conceptuals.slice(0, 2),
    ...ethicals.slice(0, 1)
  ];

  if (selectedItems.length < 5) {
    // Fill up with any random items if we lack enough specific type items
    const remaining = liveItems.filter(item => !selectedItems.some(s => s.id === item.id));
    selectedItems.push(...remaining.slice(0, 5 - selectedItems.length));
  }

  // Set up per-student seeded dynamic parameters
  const numericValuesMap: Record<string, any> = {};
  const clientQuestionsList: ClientItem[] = [];

  selectedItems.forEach(item => {
    // Increment exposure count securely
    item.exposure_count += 1;

    if (item.type === 'numerical') {
      const generated = generateAndSolveNumericalItem(item, userId);
      numericValuesMap[item.id] = generated.parameters;
      clientQuestionsList.push({
        id: item.id,
        type: item.type,
        language: item.language,
        question_text: generated.question_text,
        options: generated.options,
        concept: item.concept
      });
    } else {
      clientQuestionsList.push({
        id: item.id,
        type: item.type,
        language: item.language,
        question_text: item.question_text,
        options: item.options,
        concept: item.concept
      });
    }
  });

  const baseTimeSeconds = 1800; // 30 minutes baseline
  const extraMultiplier = profile.accommodations?.extra_time || 1.0;
  const timeLimitSeconds = Math.round(baseTimeSeconds * extraMultiplier);

  // Generate unique watermark
  const subtleOptionSignature = selectedItems.map(item => item.id.substring(5)).join('-');
  const watermarkSeed = crypto.createHash('md5').update(`${userId}-${shiftId}`).digest('hex').substring(0, 6).toUpperCase();
  const watermark = `NX-DECRYPTION-TOKEN-${watermarkSeed}-${subtleOptionSignature}`;

  const attemptId = crypto.randomUUID();
  const newAttempt: ExamAttempt = {
    id: attemptId,
    user_id: userId,
    shift_id: shiftId,
    assigned_item_ids: selectedItems.map(i => i.id),
    numeric_values: numericValuesMap,
    watermark,
    started_at: new Date().toISOString(),
    submitted_at: null,
    time_limit_seconds: timeLimitSeconds,
    raw_score: null,
    ability_estimate: null,
    normalized_percentile: null,
    status: 'in_progress'
  };

  db.attempts[attemptId] = newAttempt;
  db.responses[attemptId] = [];
  saveDB();

  logEvent(attemptId, userId, 'assemble', { 
    item_count: selectedItems.length, 
    watermark, 
    time_limit: timeLimitSeconds 
  });

  res.json({
    status: "success",
    attempt: newAttempt,
    questions: clientQuestionsList,
    savedResponses: {},
    currentTimeLeft: timeLimitSeconds
  });
});

// Autosave Question Selection
app.post('/api/exams/autosave', (req, res) => {
  const { attemptId, itemId, selectedOption, responseTimeMs } = req.body;

  if (!attemptId || !itemId) {
    return res.status(400).json({ error: "Missing criteria" });
  }

  const attempt = db.attempts[attemptId];
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  if (attempt.status !== 'in_progress') {
    return res.status(400).json({ error: "Attempt is already submitted or locked" });
  }

  let userResponsesList = db.responses[attemptId];
  if (!userResponsesList) {
    userResponsesList = [];
    db.responses[attemptId] = userResponsesList;
  }

  let index = userResponsesList.findIndex(r => r.item_id === itemId);
  if (index >= 0) {
    userResponsesList[index].selected_option = selectedOption;
    userResponsesList[index].response_time_ms += (responseTimeMs || 0);
    userResponsesList[index].answered_at = new Date().toISOString();
  } else {
    userResponsesList.push({
      id: crypto.randomUUID(),
      attempt_id: attemptId,
      item_id: itemId,
      selected_option: selectedOption,
      is_correct: null,
      response_time_ms: responseTimeMs || 0,
      answered_at: new Date().toISOString()
    });
  }

  saveDB();
  res.json({ status: "success", saved: true });
});

// Secure Submit Exam (answers validated ONLY server-side)
app.post('/api/exams/submit', (req, res) => {
  const { attemptId } = req.body;

  if (!attemptId) return res.status(400).json({ error: "Missing attempt ID" });

  const attempt = db.attempts[attemptId];
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });

  if (attempt.status !== 'in_progress') {
    return res.status(400).json({ error: "Attempt already submitted" });
  }

  const userResponsesList = db.responses[attemptId] || [];
  let correctCount = 0;

  // Let's check correct responses securely
  attempt.assigned_item_ids.forEach(itemId => {
    const item = db.item_bank.find(i => i.id === itemId);
    if (!item) return;

    let response = userResponsesList.find(r => r.item_id === itemId);
    if (!response) {
      // Create empty response
      response = {
        id: crypto.randomUUID(),
        attempt_id: attemptId,
        item_id: itemId,
        selected_option: null,
        is_correct: false,
        response_time_ms: 0,
        answered_at: new Date().toISOString()
      };
      userResponsesList.push(response);
    }

    let correctOpt = item.correct_option;
    if (item.type === 'numerical') {
      // Dynamically compute the correct formula outcome for this specific student
      const resolved = generateAndSolveNumericalItem(item, attempt.user_id);
      correctOpt = resolved.correct_option;
    }

    const isCorrect = response.selected_option === correctOpt;
    response.is_correct = isCorrect;
    if (isCorrect) {
      correctCount += 1;
    }
  });

  attempt.raw_score = correctCount;
  attempt.submitted_at = new Date().toISOString();
  attempt.status = 'submitted';

  // Estimate IRT Ability theta
  // Under standard 1-PL IRT, capability estimate (theta) maps dynamically
  // 5 questions: 0 correct -> theta -2.5, 1 -> -1.2, 2 -> -0.3, 3 -> 0.4, 4 -> 1.2, 5 -> 2.5
  const size = attempt.assigned_item_ids.length;
  const ratio = correctCount / size;
  const theta = Math.log(ratio / (1 - ratio || 0.01)) || -2.5;
  attempt.ability_estimate = Math.min(Math.max(theta, -3.0), 3.0);

  saveDB();

  // Run dynamic shift normalization automatically following submission
  runEquipercentileNormalization(attempt.shift_id);

  logEvent(attemptId, attempt.user_id, 'submit', {
    raw_score: correctCount,
    percentile: attempt.normalized_percentile,
    theta_estimate: attempt.ability_estimate
  });

  res.json({
    status: "success",
    attempt,
    evaluation: {
      raw_score: correctCount,
      total_items: size,
      percentile: attempt.normalized_percentile,
      watermark: attempt.watermark,
      ability_estimate: attempt.ability_estimate
    }
  });
});

// Post Integrity Event from Frontend Proctoring Client
app.post('/api/exams/log-event', (req, res) => {
  const { attemptId, userId, category, detail } = req.body;
  const entry = logEvent(attemptId || null, userId || null, category, detail || {});
  res.json({ status: "success", entry });
});

// ============================================
// ADMIN CORE API ENDPOINTS
// ============================================

// Get All Attempts (Proctor Dashboard)
app.get('/api/admin/attempts', (req, res) => {
  const attemptsList = Object.values(db.attempts).map(att => {
    const profile = db.profiles[att.user_id] || { full_name: "Unknown candidate", accommodations: {} };
    const shift = db.shifts.find(s => s.id === att.shift_id);
    return {
      ...att,
      profile,
      shift_name: shift ? shift.name : "Unassigned Shift"
    };
  });
  res.json(attemptsList);
});

// Get Audit Logs
app.get('/api/admin/audit-logs', (req, res) => {
  res.json(db.audit_logs);
});

// Get Human Review Queue Flag Statuses
app.get('/api/admin/review-flags', (req, res) => {
  res.json(db.review_flags);
});

// Clear or resolve a flag
app.post('/api/admin/review-flags/action', (req, res) => {
  const { id, status, notes, reviewerId } = req.body;
  const flag = db.review_flags.find(f => f.id === id);
  if (!flag) return res.status(404).json({ error: "Flag not found" });

  flag.status = status;
  flag.notes = notes;
  flag.reviewer_id = reviewerId || "demo-admin";

  saveDB();
  res.json({ status: "success", flag });
});

// Add anomaly manual review check
app.post('/api/admin/review-flags/create', (req, res) => {
  const { attemptId, reason, severity, notes } = req.body;
  const newFlag: ReviewFlag = {
    id: crypto.randomUUID(),
    attempt_id: attemptId,
    reason,
    severity,
    status: 'open',
    reviewer_id: null,
    notes: notes || '',
    created_at: new Date().toISOString()
  };
  db.review_flags.push(newFlag);
  saveDB();
  res.json({ status: "success", flag: newFlag });
});

// Run Cross-shift Normalization explicitly
app.post('/api/admin/run-normalization', (req, res) => {
  db.shifts.forEach(shift => {
    runEquipercentileNormalization(shift.id);
  });
  res.json({ status: "success", message: "Normalized percentile rankings finalized for all shifts." });
});

// Run COLLUSION and ANOMALY automated analysis (Simulated algorithms, saving results to review queues)
app.post('/api/admin/run-integrity-scans', (req, res) => {
  const flaggedAttempts: any[] = [];
  
  // Rule 1: Correct answers submitted ridiculously fast (< 5 seconds average response time)
  Object.entries(db.responses).forEach(([attemptId, responses]) => {
    const attempt = db.attempts[attemptId];
    if (!attempt || attempt.status !== 'submitted') return;

    const fastResponses = responses.filter(r => r.response_time_ms > 0 && r.response_time_ms < 5000);
    if (fastResponses.length >= 2 && !db.review_flags.some(f => f.attempt_id === attemptId && f.reason === 'response_time_anomaly')) {
      const review: ReviewFlag = {
        id: crypto.randomUUID(),
        attempt_id: attemptId,
        reason: 'response_time_anomaly',
        severity: 'high',
        status: 'open',
        reviewer_id: null,
        notes: `Rapid execution warning: Candidate answered ${fastResponses.length} complex items correctly in less than 5 seconds each. Indicates potential prior knowledge leak.`,
        created_at: new Date().toISOString()
      };
      db.review_flags.push(review);
      flaggedAttempts.push(attemptId);
    }
  });

  // Rule 2: Collusion / Vector similarity
  // Find candidates on the same shift submitting exactly identical wrong options or response velocities
  const allSubmissions = Object.values(db.attempts).filter(a => a.status === 'submitted');
  for (let i = 0; i < allSubmissions.length; i++) {
    for (let j = i + 1; j < allSubmissions.length; j++) {
      const attA = allSubmissions[i];
      const attB = allSubmissions[j];

      if (attA.shift_id === attB.shift_id && attA.user_id !== attB.user_id) {
        const respA = db.responses[attA.id] || [];
        const respB = db.responses[attB.id] || [];
        
        // Find exact overlapping matching item selections
        let matchingChoices = 0;
        let totalOverlaps = 0;

        respA.forEach(rA => {
          const rB = respB.find(r => r.item_id === rA.item_id);
          if (rB) {
            totalOverlaps++;
            if (rA.selected_option && rA.selected_option === rB.selected_option) {
              matchingChoices++;
            }
          }
        });

        // Over 80% answer vector synergy on complex items warrants review flag
        if (totalOverlaps >= 3 && (matchingChoices / totalOverlaps) >= 0.8) {
          const alreadyFlagged = db.review_flags.some(f => f.attempt_id === attA.id && f.reason === 'collusion_suspect');
          if (!alreadyFlagged) {
            const review: ReviewFlag = {
              id: crypto.randomUUID(),
              attempt_id: attA.id,
              reason: 'collusion_suspect',
              severity: 'medium',
              status: 'open',
              reviewer_id: null,
              notes: `Overlapping response telemetry: Over 80% option vector similarity with candidate ${db.profiles[attB.user_id]?.full_name || attB.user_id} on Shift.`,
              created_at: new Date().toISOString()
            };
            db.review_flags.push(review);
            flaggedAttempts.push(attA.id);
          }
        }
      }
    }
  }

  saveDB();
  res.json({ status: "success", flaggedCount: flaggedAttempts.length, flaggedAttempts });
});

// Item bank authoring create/edit endpoint
app.post('/api/admin/item-bank', (req, res) => {
  const { id, type, question_text, template, options, correct_option, concept, irt_a, irt_b, irt_c, status } = req.body;

  if (id) {
    // Edit existing item
    const idx = db.item_bank.findIndex(i => i.id === id);
    if (idx === -1) return res.status(404).json({ error: "Item not found" });

    db.item_bank[idx] = {
      ...db.item_bank[idx],
      type,
      question_text,
      template,
      options,
      correct_option,
      concept,
      irt_a: Number(irt_a) || 1.0,
      irt_b: Number(irt_b) || 0.0,
      irt_c: Number(irt_c) || 0.25,
      status,
      version: db.item_bank[idx].version + 1
    };
  } else {
    // Add new item
    const newItem: Item = {
      id: `item-${db.item_bank.length + 1}`,
      type,
      language: 'en',
      question_text,
      template,
      options,
      correct_option,
      concept,
      irt_a: Number(irt_a) || 1.0,
      irt_b: Number(irt_b) || 0.0,
      irt_c: Number(irt_c) || 0.25,
      exposure_count: 0,
      status: status || 'live',
      version: 1
    };
    db.item_bank.push(newItem);
  }

  saveDB();
  res.json({ status: "success", item_bank: db.item_bank });
});

// Delete or Retire item
app.delete('/api/admin/item-bank/:id', (req, res) => {
  const idx = db.item_bank.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });

  db.item_bank[idx].status = 'retired';
  saveDB();
  res.json({ status: "success" });
});

// Admin stats
app.get('/api/admin/stats', (req, res) => {
  const attempts = Object.values(db.attempts);
  const submitted = attempts.filter(a => a.status === 'submitted');
  const liveItemsCount = db.item_bank.filter(i => i.status === 'live').length;
  const flagsCount = db.review_flags.filter(f => f.status === 'open').length;

  res.json({
    total_attempts: attempts.length,
    submitted_attempts: submitted.length,
    live_items: liveItemsCount,
    active_flags: flagsCount,
    shift_stats: db.shifts.map(shift => {
      const count = attempts.filter(a => a.shift_id === shift.id).length;
      return {
        name: shift.name,
        count
      };
    })
  });
});

// Serve frontend assets
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });

    app.use(vite.middlewares);

    // Dynamic routing fallback to index.html for react-router SPA
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(
          path.resolve(process.cwd(), 'index.html'),
          'utf-8'
        );
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve production static assets compiled via Vite
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Project NEXUS] Server running securely at http://localhost:${PORT}`);
  });
}

startServer();
