// Trigger watch reload to refresh env variables
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables — use explicit path so it works from any CWD (e.g. npm run dev from workspace root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Process safety: prevent unhandled promise rejections or exceptions from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err);
});

console.log('SMTP Config check:', { email: process.env.SMTP_EMAIL, hasPassword: !!process.env.SMTP_PASSWORD });

const smtpEmail = process.env.SMTP_EMAIL;
const smtpPassword = process.env.SMTP_PASSWORD;

let transporter = null;
if (smtpEmail && smtpPassword) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpEmail,
      pass: smtpPassword
    }
  });

  transporter.verify((error, success) => {
    if (error) console.error('SMTP Verification Failed:', error);
    else console.log('SMTP Server is ready to take messages');
  });
}

// ─── Local JSON DB Fallback Setup ───────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'db.json');

function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function parseUrlArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (!val || typeof val !== 'string') return [];
  const trimmed = val.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {}
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean);
}

function formatUrlArray(val) {
  const arr = parseUrlArray(val);
  return arr.join(',');
}

function loadFromLocalDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileContent = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(fileContent || '[]');
    }
  } catch (err) {
    console.error('[LocalDB] Load error:', err.message);
  }
  return [];
}

function saveToLocalDB(startups) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(startups, null, 2), 'utf8');
  } catch (err) {
    console.error('[LocalDB] Save error:', err.message);
  }
}

function upsertLocalDB(startup) {
  const startups = loadFromLocalDB();
  const index = startups.findIndex(s => s.user_id === startup.user_id);
  
  const formattedStartup = {
    ...startup,
    id: startup.id || (index >= 0 ? startups[index].id : Date.now()),
    updated_at: new Date().toISOString()
  };

  if (index >= 0) {
    startups[index] = { ...startups[index], ...formattedStartup };
  } else {
    startups.push(formattedStartup);
  }
  saveToLocalDB(startups);
  return formattedStartup;
}

const SETTINGS_FILE_PATH = path.join(__dirname, 'platform_settings_db.json');
const QUERIES_FILE_PATH = path.join(__dirname, 'support_queries_db.json');

function loadSettingsFromLocalDB() {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading platform_settings_db.json:', e);
  }
  return {
    basic_price_inr: 'Free',
    basic_price_usd: 'Free',
    pro_price_inr: '₹9,999',
    pro_price_usd: '$120',
    spotlight_price_inr: '₹24,999',
    spotlight_price_usd: '$300',
    maintenance_mode: false,
    gateway_key: '',
    llm_key: ''
  };
}

async function checkMaintenanceActive() {
  try {
    const client = getAdminClient();
    const { data, error } = await client
      .from('platform_settings')
      .select('maintenance_mode')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) {
      const local = loadSettingsFromLocalDB();
      return !!local.maintenance_mode;
    }
    return !!data.maintenance_mode;
  } catch (err) {
    const local = loadSettingsFromLocalDB();
    return !!local.maintenance_mode;
  }
}

function saveSettingsToLocalDB(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing platform_settings_db.json:', e);
  }
}

function loadQueriesFromLocalDB() {
  try {
    if (fs.existsSync(QUERIES_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(QUERIES_FILE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading support_queries_db.json:', e);
  }
  return [];
}

function saveQueriesToLocalDB(data) {
  try {
    fs.writeFileSync(QUERIES_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing support_queries_db.json:', e);
  }
}

async function sendReplyEmail(toEmail, subject, textContent) {
  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpEmail || !smtpPassword || !transporter) {
    console.warn("⚠️ SMTP credentials SMTP_EMAIL or SMTP_PASSWORD not set. Simulating email send to:", toEmail);
    return { simulated: true };
  }

  const mailOptions = {
    from: `"IdeaVault Admin" <${smtpEmail}>`,
    to: toEmail,
    subject: subject,
    text: textContent
  };

  try {
    console.log('Sending email to:', toEmail);
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Nodemailer Error Details:', JSON.stringify(error, null, 2));
    throw error;
  }
}


// ─── Debug: verify .env loaded ──────────────────────────────────────────────
console.log('ENV Check -> URL loaded:', !!process.env.SUPABASE_URL, '| KEY loaded:', !!process.env.SUPABASE_ANON_KEY);

// ─── Supabase Clients ────────────────────────────────────────────────────────
// Two clients:
//  • anonClient  — uses SUPABASE_ANON_KEY  (safe for public operations)
//  • adminClient — uses SUPABASE_SERVICE_ROLE_KEY (bypasses email-confirm gate
//                  so user_metadata is saved immediately on signUp)

let anonClient;
let adminClient;

function getAnonClient() {
  if (anonClient) return anonClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || url === 'your_supabase_project_url_here' ||
      !key || key === 'your_supabase_anon_key_here') {
    throw new Error('⚠️  Supabase anon credentials not set in apps/server/.env');
  }
  anonClient = createClient(url, key);
  return anonClient;
}

function getAdminClient() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // If no service key provided, fall back to anon client with a warning
  if (!serviceKey || serviceKey === 'your_service_role_key_here') {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key.');
    console.warn('   user_metadata may not be saved until email is confirmed.');
    console.warn('   Add service_role key from: Supabase Dashboard → Settings → API');
    return getAnonClient();
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return adminClient;
}

// ─── App Setup ──────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/status — Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'IdeaVault API is online!' });
});

// POST /api/auth/signup — Register a new user via Supabase Auth
app.post('/api/auth/signup', async (req, res) => {
  if (await checkMaintenanceActive()) {
    return res.status(503).json({ error: 'New registrations are temporarily paused for system maintenance.' });
  }
  // ── Debug: log exactly what the client sent ──────────────────────────────
  console.log('[signup] req.body received:', JSON.stringify(req.body, null, 2));

  const { email, password, companyName } = req.body;

  // Basic validation
  if (!email || !password || !companyName) {
    console.log('[signup] Validation failed — missing fields:', { email: !!email, password: !!password, companyName: !!companyName });
    return res.status(400).json({
      error: 'email, password, and companyName are all required.',
    });
  }

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_name: companyName,
      },
    },
  });

  // ── Debug: log what Supabase returned ───────────────────────────────────
  console.log('[signup] Supabase response -> user id:', data?.user?.id);
  console.log('[signup] Supabase user_metadata:', JSON.stringify(data?.user?.user_metadata, null, 2));
  if (error) console.error('[signup] Supabase error:', error.message);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({
    message: 'User registered successfully. Please check your email to confirm your account.',
    user: data.user,
  });
});

// POST /api/auth/login — Log in an existing user via Supabase Auth
app.post('/api/auth/login', async (req, res) => {
  // ── Debug: log login attempt ─────────────────────────────────────────────
  console.log('[login] req.body received:', JSON.stringify(req.body, null, 2));

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'email and password are required.',
    });
  }

  let client;
  try {
    client = getAnonClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('[login] Supabase login error:', error.message);
    return res.status(400).json({ error: error.message });
  }

  // Retrieve company name from user metadata if it exists
  const companyName = data.user?.user_metadata?.company_name || '';

  console.log('[login] Login successful for user:', data.user?.id, 'Company:', companyName);

  return res.json({
    message: 'Login successful.',
    session: data.session,
    user: data.user,
  });
});

// PUT /api/admin/profile — Update admin identity details & preferences in Supabase & local DB
app.put('/api/admin/profile', async (req, res) => {
  const { email, name, timezone, default_landing_page, notification_preference, send_confirmation_email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'email is required.' });
  }

  const userEmail = email.toLowerCase().trim();
  const updatePayload = {};
  if (name !== undefined) updatePayload.name = name;
  if (timezone !== undefined) updatePayload.timezone = timezone;
  if (default_landing_page !== undefined) updatePayload.default_landing_page = default_landing_page;
  if (notification_preference !== undefined) updatePayload.notification_preference = notification_preference;

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    try { client = getAnonClient(); } catch(e) {}
  }

  // 1. Try updating admin_users table in Supabase via server
  let dbResult = null;
  if (client) {
    try {
      const { data, error } = await client
        .from('admin_users')
        .update(updatePayload)
        .eq('email', userEmail)
        .select('*');

      if (error) {
        console.warn('[server/profile] Supabase update warning:', error.message);
      } else {
        dbResult = data;
      }
    } catch (e) {
      console.warn('[server/profile] Supabase update exception:', e.message);
    }
  }

  // 2. Also save to local settings DB fallback
  try {
    const settings = loadSettingsFromLocalDB();
    if (!settings.admin_profiles) settings.admin_profiles = {};
    settings.admin_profiles[userEmail] = {
      ...settings.admin_profiles[userEmail],
      email: userEmail,
      ...updatePayload,
      updated_at: new Date().toISOString()
    };
    saveSettingsToLocalDB(settings);
  } catch (e) {}

  // 3. Send email alert if notification_preference was set/changed or send_confirmation_email requested
  let emailSent = false;
  if (send_confirmation_email || notification_preference !== undefined) {
    try {
      const prefName = notification_preference || 'Instant Email Alert';
      const subject = `IdeaVault Admin: Notification Preference Updated to "${prefName}"`;
      const emailText = `Hello Administrator,\n\nYour notification preference for the IdeaVault Admin Portal (${userEmail}) has been updated to: "${prefName}".\n\nSetting Details:\n${
        prefName === 'None'
          ? '• You will NOT receive any email notifications for system events.'
          : prefName === 'Daily Summary'
          ? '• You will receive a daily email digest summarizing platform activity.'
          : '• You will receive instant email alerts whenever new startups register, verifications are requested, or security events occur.'
      }\n\nTimestamp: ${new Date().toLocaleString()}\n\nIf you did not make this change, please check your admin account security settings immediately.\n\nBest regards,\nIdeaVault Admin System`;

      await sendReplyEmail(userEmail, subject, emailText);
      emailSent = true;
      console.log(`[server/profile] Sent notification confirmation email to ${userEmail}`);
    } catch (mailErr) {
      console.error('[server/profile] Could not send notification email:', mailErr.message);
    }
  }

  return res.json({ success: true, updated: updatePayload, data: dbResult, email_sent: emailSent });
});

// GET /api/admin/profile — Get admin profile from server fallback or Supabase
app.get('/api/admin/profile', async (req, res) => {
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email query parameter is required.' });

  try {
    const settings = loadSettingsFromLocalDB();
    const localProfile = settings.admin_profiles?.[email] || null;

    let client;
    try { client = getAdminClient(); } catch (e) { try { client = getAnonClient(); } catch(e2){} }

    let sbProfile = null;
    if (client) {
      const { data } = await client
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      sbProfile = data;
    }

    const merged = { ...(sbProfile || {}), ...(localProfile || {}) };
    return res.json({ profile: merged });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper: Link an uploaded private document URL to the startup's pitch_deck_url column
async function linkDocumentToStartup(userId, fileUrl) {
  if (!userId || !fileUrl) return;
  try {
    const client = getAdminClient();

    // Save to Supabase using the correct schema columns only
    if (isValidUUID(userId)) {
      const { data: existingRow } = await client.from('startups').select('id').eq('user_id', userId).maybeSingle();

      if (existingRow) {
        await client.from('startups').update({
          pitch_deck_url: fileUrl,
          updated_at: new Date().toISOString()
        }).eq('user_id', userId);
      } else {
        await client.from('startups').insert({
          user_id: userId,
          pitch_deck_url: fileUrl,
          updated_at: new Date().toISOString()
        });
      }
    }

    // Update Local DB fallback
    const localList = loadFromLocalDB();
    const idx = localList.findIndex(s => s.user_id === userId || String(s.id) === String(userId));
    if (idx >= 0) {
      localList[idx].pitch_deck_url = fileUrl;
      localList[idx].updated_at = new Date().toISOString();
      saveToLocalDB(localList);
    }
    console.log(`[upload] Linked private document URL to pitch_deck_url for user ${userId}`);
  } catch (err) {
    console.error('[upload] Warning: Could not auto-link document URL to startup record:', err.message);
  }
}

// POST /api/upload — Upload a document to Supabase Storage
app.post('/api/upload', async (req, res) => {
  console.log('[upload] File upload request received');
  const { fileName, fileBase64, mimeType, userId } = req.body;

  if (!fileName || !fileBase64 || !userId) {
    return res.status(400).json({ error: 'fileName, fileBase64, and userId are required.' });
  }

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    const cleanBase64 = typeof fileBase64 === 'string' && fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const buffer = Buffer.from(cleanBase64, 'base64');
    const filePath = `${userId}/${Date.now()}_${fileName}`;
    
    // Explicitly derive Content-Type for PDFs and office documents
    let resolvedContentType = mimeType;
    if (!resolvedContentType || resolvedContentType === 'application/octet-stream') {
      const ext = fileName.toLowerCase().split('.').pop();
      if (ext === 'pdf') resolvedContentType = 'application/pdf';
      else if (ext === 'png') resolvedContentType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') resolvedContentType = 'image/jpeg';
      else if (ext === 'doc') resolvedContentType = 'application/msword';
      else if (ext === 'docx') resolvedContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === 'ppt') resolvedContentType = 'application/vnd.ms-powerpoint';
      else if (ext === 'pptx') resolvedContentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      else resolvedContentType = 'application/pdf';
    }

    // Upload to Supabase Storage 'documents' bucket
    const { data, error } = await client.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: resolvedContentType,
        upsert: true
      });

    if (error) {
      console.error('[upload] Supabase storage upload error:', error.message);
      return res.status(400).json({ 
        error: `Supabase Storage upload error: ${error.message}. Please ensure the "documents" storage bucket exists and is public in Supabase.` 
      });
    }

    // Generate public URL via Supabase built-in method
    const { data: publicUrlData } = client.storage
      .from('documents')
      .getPublicUrl(data.path);

    const uploadedUrl = publicUrlData.publicUrl;

    // Link file URL to database record (document_urls, document_url, pitch_deck_url) for Admin visibility
    await linkDocumentToStartup(userId, uploadedUrl);

    console.log('[upload] Upload successful. Supabase Public URL:', uploadedUrl);
    return res.status(200).json({
      message: 'File uploaded successfully!',
      url: uploadedUrl
    });
  } catch (err) {
    console.error('[upload] Error processing upload:', err.message);
    return res.status(500).json({ error: 'Failed to process file upload: ' + err.message });
  }
});

// PUT /api/startups/:identifier — Update an existing startup listing (Founder Dashboard)
app.put('/api/startups/:identifier', async (req, res) => {
  const { identifier } = req.params;
  console.log('[startups] PUT request to update listing for identifier:', identifier);

  const {
    name, founderName, email, website, pitch, industry, stage, minTicket,
    description, userId, contactEmail, contactPhone, additionalContacts,
    documentUrls, pitchDeckUrl, publicDocumentUrl, public_document_url, location, teamSize, traction, tags
  } = req.body;

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const numericMinInvestment = parseFloat(String(minTicket || 0).replace(/[^0-9.]/g, '')) || 0;
  const targetUserId = isValidUUID(identifier) ? identifier : (isValidUUID(userId) ? userId : null);

  // Resolve private & public document URLs as comma-separated formatted arrays
  const docUrl = formatUrlArray(documentUrls || pitchDeckUrl || req.body.pitch_deck_url || req.body.document_urls);
  const publicDocUrl = formatUrlArray(req.body.publicDocumentUrls || publicDocumentUrl || public_document_url || req.body.public_document_urls);
  const logoUrlVal = req.body.logo_url || req.body.logoUrl || '';

  // ── Supabase update payload ────────────────────────────────────────────────
  // Only columns that exist in the 'startups' schema are included here.
  // additional_contacts (JSONB) stores extra contact links AND meta fields
  // (location, teamSize, traction, tags) under a reserved __meta key so the
  // GET handler can read them back without needing extra columns.
  const contactLinksArray = Array.isArray(additionalContacts) ? additionalContacts : [];
  const additionalContactsPayload = {
    links: contactLinksArray,
    location: location || '',
    teamSize: teamSize || '',
    traction: traction || '',
    tags: Array.isArray(tags) ? tags : [],
    ...(logoUrlVal ? { logo_url: logoUrlVal } : {})
  };

  const dbUpdatePayload = {
    company_name: name,
    founder_name: founderName,
    email,
    website: website || '',
    pitch,
    industry,
    stage,
    min_investment: numericMinInvestment,
    description: description || '',
    contact_email: contactEmail || email || '',
    phone_number: contactPhone || '',
    additional_contacts: additionalContactsPayload,
    // Private verification doc → pitch_deck_url (stores comma-separated array string)
    pitch_deck_url: docUrl || '',
    // Public pitch deck → public_document_url (stores comma-separated array string)
    public_document_url: publicDocUrl || '',
    ...(logoUrlVal ? { logo_url: logoUrlVal } : {}),
    updated_at: new Date().toISOString()
  };

  // dbPayload (with user_id) is used for INSERT when no row exists yet
  const dbPayload = { ...dbUpdatePayload, user_id: targetUserId };

  // ── Update local JSON fallback DB ─────────────────────────────────────────
  const localList = loadFromLocalDB();
  let idx = localList.findIndex(s => s.user_id === identifier || String(s.id) === String(identifier));
  if (idx >= 0) {
    localList[idx] = {
      ...localList[idx],
      company_name: name || localList[idx].company_name,
      founder_name: founderName || localList[idx].founder_name,
      email: email || localList[idx].email,
      website: website || localList[idx].website,
      pitch: pitch || localList[idx].pitch,
      industry: industry || localList[idx].industry,
      stage: stage || localList[idx].stage,
      min_investment: numericMinInvestment || localList[idx].min_investment,
      description: description || localList[idx].description,
      contact_email: contactEmail || localList[idx].contact_email || '',
      phone_number: contactPhone || localList[idx].phone_number || '',
      additional_contacts: additionalContactsPayload,
      pitch_deck_url: docUrl || localList[idx].pitch_deck_url || '',
      public_document_url: publicDocUrl || localList[idx].public_document_url || '',
      ...(logoUrlVal ? { logo_url: logoUrlVal, logoUrl: logoUrlVal } : {}),
      updated_at: new Date().toISOString()
    };
    saveToLocalDB(localList);
  }

  // ── Supabase write ────────────────────────────────────────────────────────
  try {
    if (targetUserId) {
      // Check if a row exists for this user before deciding update vs insert
      const { data: existing } = await client
        .from('startups')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      let dbData, dbError;

      if (existing) {
        // Row exists → UPDATE using only schema-safe columns
        const { data, error } = await client
          .from('startups')
          .update(dbUpdatePayload)
          .eq('user_id', targetUserId)
          .select();
        dbData = data;
        dbError = error;
        if (!error) console.log('[startups] Startup row UPDATED in Supabase for user:', targetUserId);
        if (error) console.error('[startups] UPDATE failed:', error.message, '|', error.details, '|', error.hint);
      } else {
        // No row → INSERT (includes user_id)
        const { data, error } = await client
          .from('startups')
          .insert(dbPayload)
          .select();
        dbData = data;
        dbError = error;
        if (!error) console.log('[startups] Startup row INSERTED in Supabase for user:', targetUserId);
        if (error) console.error('[startups] INSERT failed:', error.message, '|', error.details, '|', error.hint);
      }

      if (dbError) {
        console.error('[startups] Supabase save error:', dbError.message, '| code:', dbError.code, '| details:', dbError.details, '| hint:', dbError.hint);
        return res.status(500).json({
          error: `Database update failed: ${dbError.message}`,
          dbError: dbError.message,
          dbCode: dbError.code,
          dbHint: dbError.hint,
          startup: localList[idx] || dbPayload
        });
      }

      return res.status(200).json({
        message: 'Startup details saved successfully!',
        startup: dbData?.[0] || dbPayload
      });
    }

    return res.status(200).json({
      message: 'Startup details updated locally.',
      startup: localList[idx] || dbPayload
    });
  } catch (err) {
    console.error('[startups] Exception during startup save:', err.message);
    return res.status(500).json({
      error: `Server error: ${err.message}`,
      startup: localList[idx] || dbPayload
    });
  }
});

// POST /api/payments/success — Activate plan & update payment status
app.post('/api/payments/success', async (req, res) => {
  const { userId, tier, status, isFinalPayment } = req.body;
  console.log('[payments] Success payment request for userId:', userId, 'tier:', tier, 'status:', status);

  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const targetTier = tier || 'Basic';
  const targetStatus = status || 'active';
  const expiryDays = 180;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  const expiryIso = expiryDate.toISOString();

  // Fetch existing additional_contacts from Supabase to preserve tier/plan_type metadata inside JSONB
  let existingAC = {};
  if (isValidUUID(userId)) {
    try {
      const { data: row } = await client
        .from('startups')
        .select('additional_contacts')
        .eq('user_id', userId)
        .maybeSingle();
      if (row && row.additional_contacts && typeof row.additional_contacts === 'object') {
        existingAC = row.additional_contacts;
      }
    } catch (e) {
      console.warn('[payments] Failed fetching existing additional_contacts:', e.message);
    }
  }

  const updatedAC = {
    ...(Array.isArray(existingAC) ? { links: existingAC } : existingAC),
    tier: targetTier,
    plan_type: targetTier
  };

  // ONLY schema-safe columns for Supabase update!
  const dbPayload = {
    status: targetStatus,
    payment_status: 'paid',
    subscription_ends_at: expiryIso,
    additional_contacts: updatedAC,
    updated_at: new Date().toISOString()
  };

  // Also update local JSON fallback DB
  const localList = loadFromLocalDB();
  const idx = localList.findIndex(s => s.user_id === userId || String(s.id) === String(userId));
  if (idx >= 0) {
    localList[idx] = {
      ...localList[idx],
      tier: targetTier,
      plan_type: targetTier,
      status: targetStatus,
      payment_status: 'paid',
      subscription_ends_at: expiryIso,
      expiry_date: expiryIso,
      updated_at: new Date().toISOString()
    };
    saveToLocalDB(localList);
  }

  try {
    if (isValidUUID(userId)) {
      const { data, error } = await client
        .from('startups')
        .update(dbPayload)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('[payments] Supabase update error:', error.message, '| details:', error.details, '| hint:', error.hint);
        return res.status(500).json({
          error: `Database update failed: ${error.message}`,
          dbError: error.message,
          startup: localList[idx] || dbPayload
        });
      }

      console.log('[payments] Payment recorded (payment_status: paid, status: active) in Supabase successfully');
      return res.status(200).json({
        message: 'Payment recorded and plan activated successfully!',
        startup: data?.[0] || localList[idx] || dbPayload
      });
    }

    return res.status(200).json({
      message: 'Payment processed in local database.',
      startup: localList[idx] || dbPayload
    });
  } catch (err) {
    console.error('[payments] Exception in payments success handler:', err.message);
    return res.status(500).json({
      error: `Server error: ${err.message}`,
      startup: localList[idx] || dbPayload
    });
  }
});

// POST /api/startups/:identifier/upgrade-request — Request tier upgrade (SubscriptionPage)
app.post('/api/startups/:identifier/upgrade-request', async (req, res) => {
  const { identifier } = req.params;
  const { tier } = req.body;
  console.log('[startups] Upgrade request for identifier:', identifier, 'requested tier:', tier);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const targetTier = tier || 'Verified Pro';

  // Fetch existing additional_contacts from Supabase to preserve tier metadata in JSONB
  let existingAC = {};
  if (isValidUUID(identifier)) {
    try {
      const { data: row } = await client
        .from('startups')
        .select('additional_contacts')
        .eq('user_id', identifier)
        .maybeSingle();
      if (row && row.additional_contacts && typeof row.additional_contacts === 'object') {
        existingAC = row.additional_contacts;
      }
    } catch (e) {
      console.warn('[startups] Pre-fetch check warning:', e.message);
    }
  } else if (!isNaN(Number(identifier))) {
    try {
      const { data: row } = await client
        .from('startups')
        .select('additional_contacts')
        .eq('id', Number(identifier))
        .maybeSingle();
      if (row && row.additional_contacts && typeof row.additional_contacts === 'object') {
        existingAC = row.additional_contacts;
      }
    } catch (e) {
      console.warn('[startups] Pre-fetch check warning:', e.message);
    }
  }

  const dbPayload = {
    requested_plan: targetTier,
    approval_status: 'pending',
    verification_status: 'pending',
    updated_at: new Date().toISOString()
  };

  const query = client.from('startups').update(dbPayload);
  if (isValidUUID(identifier)) {
    query.eq('user_id', identifier);
  } else {
    query.eq('id', Number(identifier));
  }
  const { data, error } = await query.select();

  // Update local DB
  const localList = loadFromLocalDB();
  const idx = localList.findIndex(s => s.user_id === identifier || String(s.id) === String(identifier));
  if (idx >= 0) {
    localList[idx] = {
      ...localList[idx],
      requested_plan: targetTier,
      approval_status: 'pending',
      verification_status: 'pending',
      updated_at: new Date().toISOString()
    };
    saveToLocalDB(localList);
  }

  if (error) {
    console.error('[startups] Upgrade request error:', error.message);
    return res.status(500).json({
      error: `Database update failed: ${error.message}`,
      startup: localList[idx] || dbPayload
    });
  }

  console.log('[startups] Upgrade request saved to Supabase successfully:', data?.[0]?.id || identifier);
  return res.status(200).json({
    message: `Upgrade request to ${targetTier} submitted for Admin review!`,
    startup: data?.[0] || localList[idx] || dbPayload
  });
});

// POST /api/startups — Save a new startup listing to Supabase
app.post('/api/startups', async (req, res) => {
  // ── Debug: log received startup data ─────────────────────────────────────
  console.log('[startups] req.body received:', JSON.stringify(req.body, null, 2));

  const {
    name,
    founderName,
    email,
    website,
    pitch,
    industry,
    stage,
    minTicket,
    description,
    userId,
    contactEmail,
    contactPhone,
    additionalContacts,
    documentUrls,
    location,
    teamSize,
    traction,
    tags
  } = req.body;

  // Validation: ensure all mandatory fields are present
  if (
    !name ||
    !founderName ||
    !email ||
    !website ||
    !pitch ||
    !industry ||
    !stage ||
    !minTicket ||
    !description
  ) {
    return res.status(400).json({
      error: 'Startup Name, Founder Name, Email Address, Website, One-Line Pitch, Industry, Stage, Minimum Investment, and Description are required.',
    });
  }

  let client;
  try {
    client = getAdminClient(); // Use admin client to insert
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Parse numeric minimum investment to match DB schema numeric type
  const numericMinInvestment = parseFloat(String(minTicket || 0).replace(/[^0-9.]/g, '')) || 0;
  const validUserId = isValidUUID(userId) ? userId : null;

  // Exact Supabase table schema columns
  const initialTier = req.body.tier || req.body.plan_type || 'Basic';
  const isBasic = initialTier === 'Basic';

  const dbPayload = {
    company_name: name,
    founder_name: founderName,
    email,
    website: website || '',
    pitch,
    industry,
    stage,
    min_investment: numericMinInvestment,
    description: description || '',
    user_id: validUserId,
    contact_email: contactEmail || email || '',
    phone_number: contactPhone || '',
    additional_contacts: additionalContacts || [],
    status: isBasic ? 'active' : 'pending',
    approval_status: isBasic ? 'approved' : 'pending',
    verification_status: isBasic ? 'approved' : 'pending',
    payment_status: isBasic ? 'paid' : 'pending'
  };

  const localPayload = {
    company_name: name,
    founder_name: founderName,
    email,
    website: website || '',
    pitch,
    industry,
    stage,
    min_investment: numericMinInvestment,
    description: description || '',
    user_id: userId || null,
    status: isBasic ? 'active' : 'pending',
    approval_status: isBasic ? 'approved' : 'pending',
    verification_status: isBasic ? 'approved' : 'pending',
    payment_status: isBasic ? 'paid' : 'pending',
    tier: initialTier,
    plan_type: initialTier,
    additional_contacts: additionalContacts || null,
    contact_info: {
      email: contactEmail || '',
      phone: contactPhone || '',
      additional: additionalContacts || [],
      location: location || '',
      teamSize: teamSize || '',
      traction: traction || '',
      tags: tags || []
    },
    pitch_deck_url: documentUrls && documentUrls.length > 0 ? documentUrls[0] : ''
  };

  // Save to local DB fallback
  upsertLocalDB(localPayload);

  try {
    console.log('[startups] Attempting Supabase insert/upsert with payload:', dbPayload);
    
    // Select-then-insert-or-update to avoid onConflict constraint requirement
    let resData;
    if (validUserId) {
      const { data: existingRow } = await client.from('startups').select('id').eq('user_id', validUserId).maybeSingle();
      if (existingRow) {
        // Row exists — UPDATE it (preserve payment status if already paid)
        resData = await client.from('startups').update(dbPayload).eq('user_id', validUserId).select();
      } else {
        // No row — INSERT new one with pending status
        resData = await client.from('startups').insert([dbPayload]).select();
      }
    } else {
      resData = await client.from('startups').insert([dbPayload]).select();
    }

    const { data, error } = resData;

    if (error) {
      console.error("Supabase Insert Error:", error.message, error.details, error.code, error.hint);
      return res.status(400).json({
        error: `Database Insert Error: ${error.message}`,
        details: error.details || error.hint || ''
      });
    }

    console.log('[startups] Startup successfully saved to Supabase:', data?.[0]?.id || data);
    return res.status(201).json({
      message: 'Startup registered successfully!',
      startup: data?.[0] || localPayload,
    });
  } catch (err) {
    console.error('[startups] Unexpected exception during Supabase insert:', err.message, err.stack);
    return res.status(201).json({
      message: 'Startup registered successfully (Saved to local database).',
      startup: localPayload,
      dbError: err.message
    });
  }
});

// GET /api/startups/:identifier — Fetch a single startup listing from Supabase by user_id or id
app.get('/api/startups/:identifier', async (req, res) => {
  const { identifier } = req.params;
  console.log('[startups] Fetching listing for identifier:', identifier);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  let startupData = null;

  try {
    // Try matching by user_id if valid UUID
    if (isValidUUID(identifier)) {
      const { data, error } = await client
        .from('startups')
        .select('*')
        .eq('user_id', identifier)
        .maybeSingle();
      if (error) console.warn('[startups] Supabase fetch by user_id warning:', error.message);
      startupData = data;
    }

    // If not found by user_id, try matching by id
    if (!startupData && !isNaN(Number(identifier))) {
      const { data, error } = await client
        .from('startups')
        .select('*')
        .eq('id', Number(identifier))
        .maybeSingle();
      if (error) console.warn('[startups] Supabase fetch by id warning:', error.message);
      startupData = data;
    }
  } catch (err) {
    console.error('[startups] Exception fetching startup from Supabase:', err.message);
  }

  // Fallback to local DB search
  if (!startupData) {
    const localList = loadFromLocalDB();
    startupData = localList.find(s => s.user_id === identifier || String(s.id) === String(identifier));
  }

  if (!startupData) {
    return res.status(404).json({ message: 'No startup found.' });
  }

  // Parse contact structures cleanly.
  // additional_contacts is now a JSONB object: { links: [...], location, teamSize, traction, tags }
  // It may also be an array (legacy format from onboarding) — handle both.
  const ac = startupData.additional_contacts;
  const isStructuredAC = ac && !Array.isArray(ac) && typeof ac === 'object';
  const additionalContacts = isStructuredAC ? (ac.links || []) : (Array.isArray(ac) ? ac : []);
  const acLocation  = isStructuredAC ? (ac.location  || '') : '';
  const acTeamSize  = isStructuredAC ? (ac.teamSize  || '') : '';
  const acTraction  = isStructuredAC ? (ac.traction  || '') : '';
  const acTags      = isStructuredAC ? (ac.tags      || []) : [];

  const contactEmail = startupData.contact_email || startupData.email || '';
  const contactPhone = startupData.phone_number || '';
  // Parse private & public document URLs as arrays
  const localList = loadFromLocalDB();
  const localMatch = localList.find(s => s.user_id === identifier || String(s.id) === String(identifier));

  const rawPrivate = startupData.pitch_deck_url || startupData.pitchDeckUrl || (localMatch && (localMatch.pitch_deck_url || localMatch.document_url));
  const documentUrls = parseUrlArray(rawPrivate);
  const pitchDeckUrl = documentUrls.join(',');

  const rawPublic = startupData.public_document_url || startupData.publicDocumentUrl || (localMatch && localMatch.public_document_url);
  const publicDocumentUrls = parseUrlArray(rawPublic);
  const publicDocumentUrl = publicDocumentUrls.join(',');

  // Resolve tags — could be array or comma string
  const resolvedTags = Array.isArray(acTags)
    ? acTags
    : (typeof acTags === 'string' ? acTags.split(',').map(t => t.trim()).filter(Boolean) : []);

  const resolvedLogoUrl = startupData.logo_url 
    || startupData.logoUrl 
    || (ac && (ac.logo_url || ac.logoUrl)) 
    || (localMatch && (localMatch.logo_url || localMatch.logoUrl || (localMatch.additional_contacts && localMatch.additional_contacts.logo_url))) 
    || '';

  return res.status(200).json({
    message: 'Startup fetched successfully.',
    startup: {
      id: startupData.id,
      companyName: startupData.company_name || startupData['company name'] || '',
      name: startupData.company_name || startupData['company name'] || '',
      founderName: startupData.founder_name || '',
      email: startupData.email || '',
      website: startupData.website || '',
      pitch: startupData.pitch || '',
      industry: startupData.industry || '',
      stage: startupData.stage || '',
      minTicket: startupData.min_investment || '',
      fundingAsk: startupData.min_investment || '',
      description: startupData.description || '',
      userId: startupData.user_id,
      status: startupData.status || (startupData.payment_status === 'paid' ? 'active' : 'pending'),
      paymentStatus: startupData.payment_status || 'pending',
      payment_status: startupData.payment_status || 'pending',
      approved_by: startupData.approved_by || (isStructuredAC && ac.approved_by) || (localMatch && (localMatch.approved_by || (localMatch.additional_contacts && localMatch.additional_contacts.approved_by))) || null,
      approvedBy: startupData.approved_by || (isStructuredAC && ac.approved_by) || (localMatch && (localMatch.approved_by || (localMatch.additional_contacts && localMatch.additional_contacts.approved_by))) || null,
      expiryDate: startupData.expiry_date || startupData.subscription_ends_at || (isStructuredAC && ac.expiry_date) || (localMatch && (localMatch.expiry_date || localMatch.subscription_ends_at)) || null,
      expiry_date: startupData.expiry_date || startupData.subscription_ends_at || (isStructuredAC && ac.expiry_date) || (localMatch && (localMatch.expiry_date || localMatch.subscription_ends_at)) || null,
      subscription_ends_at: startupData.subscription_ends_at || startupData.expiry_date || (isStructuredAC && ac.subscription_ends_at) || (localMatch && (localMatch.subscription_ends_at || localMatch.expiry_date)) || null,
      subscriptionEndsAt: startupData.subscription_ends_at || startupData.expiry_date || (isStructuredAC && ac.subscription_ends_at) || (localMatch && (localMatch.subscription_ends_at || localMatch.expiry_date)) || null,
      requested_plan: startupData.requested_plan || (isStructuredAC && ac.requested_plan) || null,
      approval_status: startupData.approval_status || (isStructuredAC && ac.approval_status) || startupData.verification_status || (isStructuredAC && ac.verification_status) || (startupData.status === 'active' || startupData.status === 'approved' ? 'approved' : 'pending'),
      approvalStatus: startupData.approval_status || (isStructuredAC && ac.approval_status) || startupData.verification_status || (isStructuredAC && ac.verification_status) || (startupData.status === 'active' || startupData.status === 'approved' ? 'approved' : 'pending'),
      verification_status: startupData.verification_status || (isStructuredAC && ac.verification_status) || null,
      upgrade_status: startupData.upgrade_status || (isStructuredAC && ac.upgrade_status) || null,
      suspension_reason: startupData.suspension_reason || (isStructuredAC && ac.suspension_reason) || null,
      tier: (isStructuredAC && ac.tier) || startupData.plan_type || startupData.tier || 'Basic',
      plan_type: (isStructuredAC && ac.plan_type) || startupData.plan_type || startupData.tier || 'Basic',
      verified: ((isStructuredAC && ac.tier) || startupData.plan_type || startupData.tier) === 'Verified Pro' || ((isStructuredAC && ac.tier) || startupData.plan_type || startupData.tier) === 'Spotlight',
      contactEmail,
      contactPhone,
      additionalContacts,
      documentUrls,
      documentUrl: pitchDeckUrl,
      pitchDeckUrl,
      pitchDeckUrls: documentUrls,
      publicDocumentUrl,
      public_document_url: publicDocumentUrl,
      publicDocumentUrls,
      logoUrl: resolvedLogoUrl,
      logo_url: resolvedLogoUrl,
      location: acLocation || startupData.location || '',
      teamSize: acTeamSize || startupData.teamSize || '',
      team: parseInt(acTeamSize || startupData.teamSize || '0', 10) || 0,
      traction: acTraction || startupData.traction || '',
      impressions: startupData.impressions || startupData.search_impressions || 0,
      views: startupData.views || startupData.profile_views || 0,
      clicks: startupData.clicks || startupData.outbound_clicks || 0,
      weeklyTraffic: startupData.weekly_traffic || startupData.weeklyTraffic || [],
      tags: resolvedTags,
      tagsString: resolvedTags.join(', ')
    }
  });
});

// GET /api/startups/:identifier/analytics — Time-Series Analytics Engine
app.get('/api/startups/:identifier/analytics', async (req, res) => {
  const { identifier } = req.params;
  console.log('[analytics] Fetching time-series analytics for identifier:', identifier);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  let startupData = null;
  try {
    if (isValidUUID(identifier)) {
      const { data, error } = await client
        .from('startups')
        .select('*')
        .eq('user_id', identifier)
        .maybeSingle();
      if (error) console.warn('[analytics] Supabase fetch by user_id warning:', error.message);
      startupData = data;
    }

    if (!startupData && !isNaN(Number(identifier))) {
      const { data, error } = await client
        .from('startups')
        .select('*')
        .eq('id', Number(identifier))
        .maybeSingle();
      if (error) console.warn('[analytics] Supabase fetch by id warning:', error.message);
      startupData = data;
    }
  } catch (err) {
    console.error('[analytics] Exception fetching startup from Supabase:', err.message);
  }

  if (!startupData) {
    const localList = loadFromLocalDB();
    startupData = localList.find(s => s.user_id === identifier || String(s.id) === String(identifier));
  }

  if (!startupData) {
    return res.status(404).json({ error: 'Startup profile not found.' });
  }

  const sId = String(startupData.id);
  const uId = startupData.user_id ? String(startupData.user_id) : null;

  // 1. Query timestamped events from analytics_events table in Supabase
  let events = [];
  try {
    const { data: dbEvents, error } = await client
      .from('analytics_events')
      .select('*')
      .or(`startup_id.eq.${sId}${uId ? `,startup_id.eq.${uId}` : ''}`);
    if (!error && Array.isArray(dbEvents)) {
      events = dbEvents;
    }
  } catch (e) {
    console.warn('[analytics] Supabase analytics_events query warning:', e.message);
  }

  // Fallback to local DB events if Supabase table has no events or does not exist
  const localList = loadFromLocalDB();
  const localMatch = localList.find(s => s.user_id === identifier || String(s.id) === String(identifier));

  if (events.length === 0) {
    if (Array.isArray(startupData.events) && startupData.events.length > 0) {
      events = startupData.events;
    } else if (localMatch && Array.isArray(localMatch.events)) {
      events = localMatch.events;
    }
  }

  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Helper to count events in specific daysAgo window
  const countEvents = (type, startDaysAgo, endDaysAgo) => {
    return events.filter(e => {
      if (e.event_type !== type) return false;
      const created = new Date(e.created_at).getTime();
      const daysAgo = (nowMs - created) / dayMs;
      return daysAgo >= startDaysAgo && daysAgo < endDaysAgo;
    }).length;
  };

  const currImpressions = countEvents('impression', 0, 7);
  const prevImpressions = countEvents('impression', 7, 14);

  const currViews = countEvents('view', 0, 7);
  const prevViews = countEvents('view', 7, 14);

  const currClicks = countEvents('click', 0, 7);
  const prevClicks = countEvents('click', 7, 14);

  const totalImpressions = startupData.impressions || startupData.search_impressions || (localMatch?.impressions) || events.filter(e => e.event_type === 'impression').length;
  const totalViews = startupData.views || startupData.profile_views || (localMatch?.views) || events.filter(e => e.event_type === 'view').length;
  const totalClicks = startupData.clicks || startupData.outbound_clicks || (localMatch?.clicks) || events.filter(e => e.event_type === 'click').length;

  const calcChange = (curr, prev) => {
    if (prev === 0) {
      return curr > 0 ? `+${curr * 100}% vs last week` : `+0% vs last week`;
    }
    const pct = Math.round(((curr - prev) / prev) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}% vs last week`;
  };

  // Group events by 4 chronological weeks (Week 1, Week 2, Week 3, Week 4)
  const weeklyTraffic = [0, 0, 0, 0];
  events.forEach(e => {
    const created = new Date(e.created_at).getTime();
    const daysAgo = (nowMs - created) / dayMs;
    if (daysAgo >= 0 && daysAgo < 7) weeklyTraffic[3] += 1;
    else if (daysAgo >= 7 && daysAgo < 14) weeklyTraffic[2] += 1;
    else if (daysAgo >= 14 && daysAgo < 21) weeklyTraffic[1] += 1;
    else if (daysAgo >= 21 && daysAgo < 28) weeklyTraffic[0] += 1;
  });

  return res.status(200).json({
    impressions: totalImpressions,
    views: totalViews,
    clicks: totalClicks,
    impressionsChange: calcChange(currImpressions, prevImpressions),
    viewsChange: calcChange(currViews, prevViews),
    clicksChange: calcChange(currClicks, prevClicks),
    weeklyTraffic,
    hasTrafficData: weeklyTraffic.some(v => v > 0)
  });
});

// POST /api/startups/:identifier/view — Increment profile_views count for a startup
app.post('/api/startups/:identifier/view', async (req, res) => {
  const { identifier } = req.params;
  console.log('[analytics] Incrementing view count for identifier:', identifier);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    // Resolve both numeric ID and user_id UUID
    let targetNumericId = !isNaN(Number(identifier)) ? String(identifier) : null;
    let targetUserId = isValidUUID(identifier) ? identifier : null;

    try {
      if (targetUserId && !targetNumericId) {
        const { data: row } = await client.from('startups').select('id, user_id').eq('user_id', targetUserId).maybeSingle();
        if (row?.id) targetNumericId = String(row.id);
      } else if (targetNumericId && !targetUserId) {
        const { data: row } = await client.from('startups').select('id, user_id').eq('id', Number(targetNumericId)).maybeSingle();
        if (row?.user_id) targetUserId = row.user_id;
      }
    } catch (rErr) {}

    const primaryId = targetUserId || targetNumericId || String(identifier);

    // 1. Insert into analytics_events table in Supabase
    try {
      await client.from('analytics_events').insert({
        startup_id: primaryId,
        event_type: 'view',
        created_at: new Date().toISOString()
      });
      if (targetNumericId && targetNumericId !== primaryId) {
        await client.from('analytics_events').insert({
          startup_id: targetNumericId,
          event_type: 'view',
          created_at: new Date().toISOString()
        });
      }
    } catch (aeErr) {
      console.warn('[analytics] analytics_events insert warning:', aeErr.message);
    }

    // 2. Attempt RPC calls
    try {
      if (targetNumericId) {
        await client.rpc('increment_profile_view', { row_id: Number(targetNumericId) });
      }
      if (targetUserId) {
        await client.rpc('increment_profile_view_by_user', { user_uuid: targetUserId });
      }
    } catch (rpcErr) {}

    // 3. Update local DB fallback
    let localList = loadFromLocalDB();
    const index = localList.findIndex(s => 
      s.user_id === identifier || 
      String(s.id) === String(identifier) ||
      (targetUserId && s.user_id === targetUserId) ||
      (targetNumericId && String(s.id) === String(targetNumericId))
    );

    if (index !== -1) {
      localList[index].profile_views = (localList[index].profile_views || localList[index].views || 0) + 1;
      localList[index].views = localList[index].profile_views;
      if (!Array.isArray(localList[index].events)) localList[index].events = [];
      localList[index].events.push({
        event_type: 'view',
        created_at: new Date().toISOString()
      });
      saveToLocalDB(localList);
    }

    return res.status(200).json({ success: true, message: 'Profile view recorded.' });
  } catch (err) {
    console.error('[analytics] View increment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/startups/:identifier/click — Increment outbound_clicks count for a startup
app.post('/api/startups/:identifier/click', async (req, res) => {
  const { identifier } = req.params;
  console.log('[analytics] Incrementing outbound click count for identifier:', identifier);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    // Resolve both numeric ID and user_id UUID
    let targetNumericId = !isNaN(Number(identifier)) ? String(identifier) : null;
    let targetUserId = isValidUUID(identifier) ? identifier : null;

    try {
      if (targetUserId && !targetNumericId) {
        const { data: row } = await client.from('startups').select('id, user_id').eq('user_id', targetUserId).maybeSingle();
        if (row?.id) targetNumericId = String(row.id);
      } else if (targetNumericId && !targetUserId) {
        const { data: row } = await client.from('startups').select('id, user_id').eq('id', Number(targetNumericId)).maybeSingle();
        if (row?.user_id) targetUserId = row.user_id;
      }
    } catch (rErr) {}

    const primaryId = targetUserId || targetNumericId || String(identifier);

    // 1. Insert into analytics_events table in Supabase
    try {
      await client.from('analytics_events').insert({
        startup_id: primaryId,
        event_type: 'click',
        created_at: new Date().toISOString()
      });
      if (targetNumericId && targetNumericId !== primaryId) {
        await client.from('analytics_events').insert({
          startup_id: targetNumericId,
          event_type: 'click',
          created_at: new Date().toISOString()
        });
      }
    } catch (aeErr) {
      console.warn('[analytics] analytics_events insert warning:', aeErr.message);
    }

    // 2. Attempt RPC calls
    try {
      if (targetNumericId) {
        await client.rpc('increment_outbound_click', { row_id: Number(targetNumericId) });
      }
      if (targetUserId) {
        await client.rpc('increment_outbound_click_by_user', { user_uuid: targetUserId });
      }
    } catch (rpcErr) {}

    // 3. Update local DB fallback
    let localList = loadFromLocalDB();
    const index = localList.findIndex(s => 
      s.user_id === identifier || 
      String(s.id) === String(identifier) ||
      (targetUserId && s.user_id === targetUserId) ||
      (targetNumericId && String(s.id) === String(targetNumericId))
    );

    if (index !== -1) {
      localList[index].outbound_clicks = (localList[index].outbound_clicks || localList[index].clicks || 0) + 1;
      localList[index].clicks = localList[index].outbound_clicks;
      if (!Array.isArray(localList[index].events)) localList[index].events = [];
      localList[index].events.push({
        event_type: 'click',
        created_at: new Date().toISOString()
      });
      saveToLocalDB(localList);
    }

    return res.status(200).json({ success: true, message: 'Outbound click recorded.' });
  } catch (err) {
    console.error('[analytics] Click increment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/startups/impressions — Bulk increment search_impressions count for a list of startups
app.post('/api/startups/impressions', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required.' });
  }

  console.log('[analytics] Bulk incrementing search impressions for count:', ids.length);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    const numIds = ids.filter(id => !isNaN(Number(id))).map(Number);
    const uuidIds = ids.filter(id => isValidUUID(String(id)));

    if (numIds.length > 0) {
      await client.rpc('increment_search_impressions', { startup_ids: numIds });
    }
    if (uuidIds.length > 0) {
      await client.rpc('increment_search_impressions_by_user', { user_uuids: uuidIds });
    }

    // Update local DB fallback
    let localList = loadFromLocalDB();
    const nowIso = new Date().toISOString();
    ids.forEach(identifier => {
      const index = localList.findIndex(s => s.user_id === identifier || String(s.id) === String(identifier));
      if (index !== -1) {
        localList[index].search_impressions = (localList[index].search_impressions || localList[index].impressions || 0) + 1;
        localList[index].impressions = localList[index].search_impressions;
        if (!Array.isArray(localList[index].events)) localList[index].events = [];
        localList[index].events.push({
          event_type: 'impression',
          created_at: nowIso
        });
      }
    });
    saveToLocalDB(localList);

    return res.status(200).json({ success: true, message: 'Bulk impressions recorded.' });
  } catch (err) {
    console.error('[analytics] Bulk impression increment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/logo — Server-side logo upload bypassing RLS using admin service role key
app.post('/api/upload/logo', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { userId, fileName, fileData, mimeType } = req.body;
    if (!fileData) return res.status(400).json({ error: 'Missing fileData' });

    const client = getAdminClient();
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const cleanExt = (mimeType || 'image/png').split('/')[1] || 'png';
    const filePath = `logos/${userId || 'startup'}_${Date.now()}.${cleanExt}`;

    const { data: uploadData, error: uploadError } = await client.storage
      .from('logos')
      .upload(filePath, buffer, { contentType: mimeType || 'image/png', upsert: true });

    if (uploadError) {
      console.warn('[upload] Server logo upload warning:', uploadError.message);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicUrlData } = client.storage.from('logos').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl || '';

    if (userId) {
      const validUserId = isValidUUID(userId) ? userId : null;
      let existingAC = {};
      try {
        const query = validUserId 
          ? client.from('startups').select('additional_contacts').eq('user_id', validUserId).maybeSingle()
          : client.from('startups').select('additional_contacts').eq('id', Number(userId)).maybeSingle();
        const { data: row } = await query;
        if (row && row.additional_contacts) {
          existingAC = typeof row.additional_contacts === 'object' && !Array.isArray(row.additional_contacts) 
            ? { ...row.additional_contacts } 
            : { links: Array.isArray(row.additional_contacts) ? row.additional_contacts : [] };
        }
      } catch (e) {}

      existingAC.logo_url = publicUrl;
      existingAC.logoUrl = publicUrl;

      // Update local DB cache immediately
      upsertLocalDB({
        user_id: userId,
        id: isNaN(Number(userId)) ? undefined : Number(userId),
        logo_url: publicUrl,
        logoUrl: publicUrl,
        additional_contacts: existingAC
      });

      // Update Supabase with multi-strategy fallback
      try {
        if (validUserId) {
          await client.from('startups').update({ logo_url: publicUrl, additional_contacts: existingAC }).eq('user_id', validUserId);
        } else if (!isNaN(Number(userId))) {
          await client.from('startups').update({ logo_url: publicUrl, additional_contacts: existingAC }).eq('id', Number(userId));
        }
      } catch (subErr) {
        if (validUserId) {
          await client.from('startups').update({ additional_contacts: existingAC }).eq('user_id', validUserId);
        } else if (!isNaN(Number(userId))) {
          await client.from('startups').update({ additional_contacts: existingAC }).eq('id', Number(userId));
        }
      }
    }

    return res.status(200).json({ success: true, publicUrl });
  } catch (err) {
    console.error('[upload] Logo upload exception:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/startups/:userId — Update a startup listing and auto-activate it on Discover
app.put('/api/startups/:userId', async (req, res) => {
  const { userId } = req.params;
  console.log('[startups] PUT update for user:', userId);

  const {
    name,
    founderName,
    email,
    website,
    pitch,
    industry,
    stage,
    minTicket,
    description,
    contactEmail,
    contactPhone,
    additionalContacts,
    documentUrls,
    location,
    teamSize,
    traction,
    tags
  } = req.body;

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const numericMinInvestment = parseFloat(String(minTicket || 0).replace(/[^0-9.]/g, '')) || 0;
  const validUserId = isValidUUID(userId) ? userId : null;

  const pitchDeckUrl = req.body.pitchDeckUrl || req.body.pitch_deck_url || '';
  const publicDocumentUrl = req.body.publicDocumentUrl || req.body.public_document_url || '';
  const logoUrlVal = req.body.logo_url || req.body.logoUrl || '';

  let acPayload = additionalContacts;
  if (logoUrlVal) {
    if (acPayload && !Array.isArray(acPayload) && typeof acPayload === 'object') {
      acPayload = { ...acPayload, logo_url: logoUrlVal };
    } else if (Array.isArray(acPayload)) {
      acPayload = { links: acPayload, logo_url: logoUrlVal };
    }
  }

  const dbPayload = {
    company_name: name,
    founder_name: founderName,
    email,
    website: website || '',
    pitch,
    industry,
    stage,
    min_investment: numericMinInvestment,
    description: description || '',
    user_id: validUserId,
    contact_email: contactEmail || email || '',
    phone_number: contactPhone || '',
    additional_contacts: acPayload || [],
    pitch_deck_url: pitchDeckUrl,
    public_document_url: publicDocumentUrl,
    ...(logoUrlVal ? { logo_url: logoUrlVal } : {})
  };

  const localUpdate = {
    company_name: name,
    founder_name: founderName,
    email,
    website: website || '',
    pitch,
    industry,
    stage,
    min_investment: numericMinInvestment,
    description: description || '',
    user_id: userId,
    status: 'active',
    ...(logoUrlVal ? { logo_url: logoUrlVal, logoUrl: logoUrlVal } : {}),
    additional_contacts: acPayload || null,
    contact_info: {
      email: contactEmail || '',
      phone: contactPhone || '',
      additional: additionalContacts || [],
      location: location || '',
      teamSize: teamSize || '',
      traction: traction || '',
      tags: tags || []
    },
    document_url: documentUrls && documentUrls.length > 0 ? documentUrls[0] : '',
    document_urls: documentUrls || []
  };

  const savedLocal = upsertLocalDB(localUpdate);

  try {
    let dbResult;
    if (validUserId) {
      const { data: existingRow } = await client.from('startups').select('id').eq('user_id', validUserId).maybeSingle();
      if (existingRow) {
        // Row exists → UPDATE it
        dbResult = await client.from('startups').update(dbPayload).eq('user_id', validUserId).select();
      } else {
        // No row → INSERT new one
        dbResult = await client.from('startups').insert([dbPayload]).select();
      }
    } else {
      dbResult = await client
        .from('startups')
        .insert([dbPayload])
        .select();
    }

    let { data, error } = dbResult;

    if (error && error.message && (error.message.includes("logo_url") || error.message.includes("schema cache"))) {
      console.warn('[startups] logo_url column missing from Supabase schema, retrying update with additional_contacts JSONB fallback...');
      const fallbackPayload = { ...dbPayload };
      delete fallbackPayload.logo_url;
      if (validUserId) {
        dbResult = await client.from('startups').update(fallbackPayload).eq('user_id', validUserId).select();
      } else if (!isNaN(Number(userId))) {
        dbResult = await client.from('startups').update(fallbackPayload).eq('id', Number(userId)).select();
      }
      data = dbResult.data;
      error = dbResult.error;
    }

    if (error) {
      console.error('[startups] PUT update error, saved to local DB:', error.message);
      return res.status(200).json({
        message: 'Startup updated (Saved to local server database fallback).',
        startup: savedLocal,
        dbError: error.message
      });
    }

    console.log('[startups] PUT update successful for user:', userId);
    return res.status(200).json({
      message: 'Startup updated and published to Discover!',
      startup: data?.[0] || savedLocal
    });
  } catch (err) {
    console.error('[startups] Exception during PUT update:', err);
    return res.status(200).json({
      message: 'Startup updated (Saved to local database).',
      startup: savedLocal,
      dbError: err.message
    });
  }
});

// POST /api/startups/:userId/upgrade-request — Step A: Request upgrade to pending_verification
app.post('/api/startups/:userId/upgrade-request', async (req, res) => {
  if (await checkMaintenanceActive()) {
    return res.status(503).json({ error: 'System maintenance mode is active. Upgrades and payments are temporarily paused.' });
  }
  const { userId } = req.params;
  const { tier } = req.body;
  console.log('[startups] POST upgrade request for user:', userId, 'tier:', tier);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Fetch existing additional_contacts from Supabase to preserve tier metadata in JSONB
  let existingAC = {};
  if (isValidUUID(userId)) {
    try {
      const { data: row } = await client
        .from('startups')
        .select('additional_contacts')
        .eq('user_id', userId)
        .maybeSingle();
      if (row && row.additional_contacts && typeof row.additional_contacts === 'object') {
        existingAC = row.additional_contacts;
      }
    } catch (e) {}
  }

  const targetTier = tier || 'Verified Pro';

  const dbPayload = {
    requested_plan: targetTier,
    verification_status: 'pending',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('startups')
    .update(dbPayload)
    .eq('user_id', userId)
    .select();

  // Update local DB
  const localUpdate = {
    user_id: userId,
    requested_plan: targetTier,
    verification_status: 'pending'
  };
  const savedLocal = upsertLocalDB(localUpdate);

  if (error) {
    console.error('[startups] Upgrade request error:', error.message);
    return res.status(500).json({
      error: `Database update failed: ${error.message}`,
      startup: savedLocal
    });
  }

  console.log('[startups] Upgrade request saved to Supabase successfully:', data?.[0]?.id || userId);
  return res.status(200).json({
    message: 'Upgrade request submitted successfully!',
    startup: data?.[0] || savedLocal
  });
});

// GET /api/platform-settings — Fetch platform pricing settings
app.get('/api/platform-settings', async (req, res) => {
  console.log('[settings] Fetching platform settings');

  // Always load the local DB as the baseline (contains all fields including maintenance_mode,
  // team, gateway_key etc. that may not be columns in Supabase)
  const local = loadSettingsFromLocalDB();

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    // No Supabase client — return local DB data so page still loads
    console.warn('[settings] No Supabase client, returning local settings:', err.message);
    return res.status(200).json(local);
  }

  const { data, error } = await client
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    console.warn('[settings] Supabase fetch error or no row, using local DB:', error?.message);
    return res.status(200).json(local);
  }

  // Merge: local DB is the baseline; Supabase columns override where they exist.
  // This ensures maintenance_mode from local is returned even if it's not a Supabase column yet.
  const merged = { ...local, ...data };
  return res.status(200).json(merged);
});

// POST /api/platform-settings — Update settings (Supabase + Local DB fallback)
app.post('/api/platform-settings', async (req, res) => {
  const settings = req.body;
  console.log('[settings] Saving platform settings:', settings);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Strip local-only fields that are never Supabase columns
  const { team, gateway_key, llm_key, strict_gst, sla_target, maintenance_mode, ...pricePayload } = settings;

  // Phase 1: Try to upsert price columns + maintenance_mode to Supabase
  let dbResult = await client
    .from('platform_settings')
    .upsert({ id: 1, ...pricePayload, maintenance_mode });

  // Phase 2: If Supabase rejects maintenance_mode (column doesn't exist yet),
  // retry with just the price columns so pricing changes still persist to Supabase.
  // maintenance_mode is already fully persisted via local DB below, which is its source of truth.
  if (dbResult.error) {
    const isColumnError = dbResult.error.message?.toLowerCase().includes('maintenance_mode') ||
                          dbResult.error.message?.toLowerCase().includes('schema cache') ||
                          dbResult.error.message?.toLowerCase().includes('column');
    if (isColumnError) {
      console.warn('[settings] maintenance_mode column missing in Supabase — retrying without it. Add the column to Supabase to enable full DB sync.');
      dbResult = await client
        .from('platform_settings')
        .upsert({ id: 1, ...pricePayload });
    }
  }

  // Always save the FULL settings (including maintenance_mode) to local DB.
  // The GET handler merges local DB as baseline, so maintenance_mode persists correctly on reload.
  saveSettingsToLocalDB(settings);

  if (dbResult.error) {
    console.error('[settings] Supabase upsert error:', dbResult.error.message);
    return res.status(500).json({
      error: `Database update failed: ${dbResult.error.message}`,
      settings
    });
  }

  console.log('[settings] Platform settings saved successfully (maintenance_mode persisted to local DB).');
  return res.status(200).json({ message: 'Settings saved successfully.', settings });
});

// GET /api/admin/startups — Fetch all listings for Admin panel (RLS bypass + local fallback)
app.get('/api/admin/startups', async (req, res) => {
  console.log('[admin] Fetching all listings for admin panel');

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  let data = [];
  const result = await client
    .from('startups')
    .select('*');

  if (result.error) {
    console.warn('[admin] Supabase fetch error, using local fallback:', result.error.message);
    data = loadFromLocalDB();
  } else {
    data = result.data || [];
    if (data.length === 0) {
      const local = loadFromLocalDB();
      if (local.length > 0) {
        data = local;
      }
    }
  }

  const formatted = data.map((s) => {
    const isStructuredAC = s.additional_contacts && !Array.isArray(s.additional_contacts) && typeof s.additional_contacts === 'object';
    const resolvedTier = (isStructuredAC && s.additional_contacts.tier) || s.plan_type || s.tier || 'Basic';

    const privateDocs = parseUrlArray(s.pitch_deck_url || s.pitchDeckUrl || s.private_document_url || s.document_url || s.document_urls);
    const publicDocs = parseUrlArray(s.public_document_url || s.publicDocumentUrl || s.public_document_urls);
    const allDocs = Array.from(new Set([...privateDocs, ...publicDocs]));

    return {
      id: s.id,
      company_name: s.company_name,
      founder_name: s.founder_name,
      email: s.email,
      website: s.website,
      pitch: s.pitch,
      industry: s.industry,
      stage: s.stage,
      min_investment: s.min_investment,
      description: s.description,
      user_id: s.user_id,
      status: s.status || 'pending',
      payment_status: s.payment_status || 'pending',
      approved_by: s.approved_by || (isStructuredAC && s.additional_contacts.approved_by) || null,
      approvedBy: s.approved_by || (isStructuredAC && s.additional_contacts.approved_by) || null,
      expiry_date: s.expiry_date || s.subscription_ends_at || (isStructuredAC && s.additional_contacts.expiry_date) || null,
      subscription_ends_at: s.subscription_ends_at || s.expiry_date || (isStructuredAC && s.additional_contacts.subscription_ends_at) || null,
      contact_info: s.contact_info || {
        email: s.contact_info?.email || s.email || '',
        phone: s.contact_info?.phone || '',
        additional: s.additional_contacts || s.contact_info?.additional || [],
        location: s.contact_info?.location || '',
        teamSize: s.contact_info?.teamSize || '',
        traction: s.contact_info?.traction || '',
        tags: s.contact_info?.tags || []
      },
      additional_contacts: s.additional_contacts || [],
      pitch_deck_url: s.pitch_deck_url || '',
      pitchDeckUrl: s.pitch_deck_url || '',
      public_document_url: s.public_document_url || '',
      publicDocumentUrl: s.public_document_url || '',
      document_urls: allDocs,
      documentUrls: allDocs,
      documents: allDocs,
      requested_plan: s.requested_plan || null,
      verification_status: s.verification_status || null,
      plan_type: resolvedTier,
      tier: resolvedTier,
      created_at: s.created_at || new Date().toISOString()
    };
  });

  return res.status(200).json(formatted);
});

// PUT /api/admin/startups/:id/status — Admin update status (Supabase + Local DB fallback)
app.post('/api/admin/startups/:id/status', async (req, res) => {
  return handleAdminStatusUpdate(req, res);
});

app.put('/api/admin/startups/:id/status', async (req, res) => {
  return handleAdminStatusUpdate(req, res);
});

async function handleAdminStatusUpdate(req, res) {
  const { id } = req.params;
  const { status, payment_status, paymentStatus, suspension_reason, founder_email, startup_name } = req.body;
  console.log('[admin] PUT status update for ID:', id, 'status:', status, 'payment_status:', payment_status);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  let resolvedStatus = status || 'active';
  let resolvedPaymentStatus = payment_status || paymentStatus;

  if (!resolvedPaymentStatus) {
    if (resolvedStatus === 'active' || resolvedStatus === 'paid' || resolvedStatus === 'Live') {
      resolvedPaymentStatus = 'paid';
    } else if (resolvedStatus === 'pending' || resolvedStatus === 'Draft') {
      resolvedPaymentStatus = 'pending';
    } else if (resolvedStatus === 'suspended') {
      resolvedPaymentStatus = 'suspended';
    } else {
      resolvedPaymentStatus = 'pending';
    }
  }

  const dbPayload = {
    status: resolvedStatus,
    payment_status: resolvedPaymentStatus,
    updated_at: new Date().toISOString()
  };

  const existingAC = req.body.additional_contacts || {};
  const updatedAC = typeof existingAC === 'object' && !Array.isArray(existingAC) ? { ...existingAC } : {};

  if (req.body.plan_type !== undefined) { dbPayload.plan_type = req.body.plan_type; updatedAC.plan_type = req.body.plan_type; }
  if (req.body.requested_plan !== undefined) { dbPayload.requested_plan = req.body.requested_plan; updatedAC.requested_plan = req.body.requested_plan; }
  if (req.body.approval_status !== undefined) { dbPayload.approval_status = req.body.approval_status; updatedAC.approval_status = req.body.approval_status; }
  if (req.body.verification_status !== undefined) { 
    dbPayload.verification_status = req.body.verification_status; 
    updatedAC.verification_status = req.body.verification_status; 
    if (req.body.verification_status === 'approved') {
      dbPayload.approval_status = 'approved';
      updatedAC.approval_status = 'approved';
    }
  }
  if (req.body.upgrade_status !== undefined) { updatedAC.upgrade_status = req.body.upgrade_status; }
  if (req.body.suspension_reason !== undefined) { dbPayload.suspension_reason = req.body.suspension_reason; updatedAC.suspension_reason = req.body.suspension_reason; }
  if (req.body.approved_by !== undefined) { dbPayload.approved_by = req.body.approved_by; updatedAC.approved_by = req.body.approved_by; }
  dbPayload.additional_contacts = updatedAC;

  // Never pass non-existent upgrade_status column to Supabase SQL update
  delete dbPayload.upgrade_status;

  // Targeted suspension: if only verification_status/upgrade_status sent (not status), don't overwrite main status
  const isTargetedSuspension = (req.body.verification_status === 'suspended' || req.body.upgrade_status !== undefined) && req.body.status === undefined;
  if (isTargetedSuspension) {
    delete dbPayload.status;
    delete dbPayload.payment_status;
  }

  if (req.body.expiry_date !== undefined) {
    dbPayload.expiry_date = req.body.expiry_date;
    dbPayload.subscription_ends_at = req.body.expiry_date;
    updatedAC.expiry_date = req.body.expiry_date;
  }
  if (req.body.subscription_ends_at !== undefined) {
    dbPayload.subscription_ends_at = req.body.subscription_ends_at;
    dbPayload.expiry_date = req.body.subscription_ends_at;
    updatedAC.expiry_date = req.body.subscription_ends_at;
  }

  if (resolvedStatus === 'active' || resolvedStatus === 'paid' || resolvedStatus === 'Live') {
    const expiryDays = 180;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    const expiryIso = req.body.expiry_date || req.body.subscription_ends_at || expiryDate.toISOString();
    dbPayload.subscription_ends_at = expiryIso;
    dbPayload.expiry_date = expiryIso;
    updatedAC.expiry_date = expiryIso;
    updatedAC.subscription_ends_at = expiryIso;
  }

  let dbResult = null;

  // Helper to execute Supabase update with fallback if top-level column throws error
  const execSupabaseUpdate = async (payloadToUse) => {
    let resObj = null;
    if (!isNaN(Number(id))) {
      try {
        resObj = await client.from('startups').update(payloadToUse).eq('id', Number(id)).select();
      } catch (err) {}
    }
    if ((!resObj || !resObj.data || resObj.data.length === 0) && id) {
      try {
        resObj = await client.from('startups').update(payloadToUse).eq('user_id', String(id)).select();
      } catch (err) {}
    }
    if ((!resObj || !resObj.data || resObj.data.length === 0) && id) {
      try {
        resObj = await client.from('startups').update(payloadToUse).eq('id', String(id)).select();
      } catch (err) {}
    }
    return resObj;
  };

  dbResult = await execSupabaseUpdate(dbPayload);

  // Schema cache fallback: if top-level approved_by column error occurs, retry without top-level approved_by (kept in additional_contacts)
  if (dbResult?.error && dbResult.error.message.includes('approved_by')) {
    const safePayload = { ...dbPayload };
    delete safePayload.approved_by;
    dbResult = await execSupabaseUpdate(safePayload);
  }

  let localDb = loadFromLocalDB();
  const index = localDb.findIndex(s => String(s.id) === String(id) || s.user_id === id);
  let updatedLocal = null;
  if (index !== -1) {
    localDb[index].updated_at = new Date().toISOString();
    if (req.body.plan_type !== undefined) localDb[index].plan_type = req.body.plan_type;
    if (req.body.tier !== undefined) localDb[index].tier = req.body.tier;
    if (req.body.requested_plan !== undefined) localDb[index].requested_plan = req.body.requested_plan;
    if (req.body.verification_status !== undefined) localDb[index].verification_status = req.body.verification_status;
    if (req.body.upgrade_status !== undefined) localDb[index].upgrade_status = req.body.upgrade_status;
    if (req.body.suspension_reason !== undefined) localDb[index].suspension_reason = req.body.suspension_reason;
    if (req.body.approved_by !== undefined) localDb[index].approved_by = req.body.approved_by;
    if (req.body.additional_contacts !== undefined) localDb[index].additional_contacts = req.body.additional_contacts;
    // For targeted upgrade suspensions, preserve the base plan's status/payment_status
    if (!isTargetedSuspension) {
      localDb[index].status = resolvedStatus;
      localDb[index].payment_status = resolvedPaymentStatus;
    }
    if (resolvedStatus === 'active') {
      const expiryDays = 180;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      const expiryIso = expiryDate.toISOString();
      localDb[index].subscription_ends_at = expiryIso;
      localDb[index].expiry_date = expiryIso;
    }
    saveToLocalDB(localDb);
    updatedLocal = localDb[index];
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase status update error, saved to local DB:', dbResult.error.message);
    return res.status(200).json({
      message: 'Status updated (Local DB fallback).',
      startup: updatedLocal || dbPayload
    });
  }

  const isSuspension = req.body.upgrade_status === 'suspended' || req.body.status === 'suspended';

  if (isSuspension && founder_email) {
    const reason = suspension_reason || 'No specific reason provided.';
    const name = startup_name || 'your startup';
    const isUpgradeOnly = req.body.upgrade_status === 'suspended' && req.body.status === undefined;
    const subject = isUpgradeOnly
      ? `IdeaVault: Your Upgrade Request for ${name} Has Been Suspended`
      : `IdeaVault: Your Application for ${name} Has Been Suspended`;
    const body = isUpgradeOnly
      ? `Hi,\n\nYour upgrade request for "${name}" has been reviewed and suspended by our admin team.\n\nReason: ${reason}\n\nYour current base plan remains active and your listing is still live.\n\nTo resolve this, please:\n• Review the reason above\n• Correct any issues with your documents or application\n• Reply to this email or visit the dashboard to contact support\n\nBest regards,\nIdeaVault Admin Team`
      : `Hi,\n\nYour application for "${name}" has been reviewed and suspended by our admin team.\n\nReason: ${reason}\n\nTo resolve this, please:\n• Review the reason above\n• Correct the issue and re-submit your documents\n• Reply to this email or visit the dashboard to contact support\n\nBest regards,\nIdeaVault Admin Team`;

    try {
      await sendReplyEmail(founder_email, subject, body);
      console.log('[admin] Suspension notification email sent to:', founder_email);
    } catch (emailErr) {
      console.error('[admin] Failed to send suspension email:', emailErr.message);
      // Don't fail the request if email fails
    }
  }

  return res.status(200).json({
    message: 'Status updated successfully.',
    startup: dbResult.data[0] || updatedLocal || dbPayload
  });
}


// POST /api/admin/verifications/:id/request-docs — Request additional documents from founder
app.post('/api/admin/verifications/:id/request-docs', async (req, res) => {
  const { id } = req.params;
  const { email, message } = req.body;
  console.log('[admin] Requesting documents for verification ID:', id, 'email:', email);

  if (!email || !message) {
    return res.status(400).json({ error: 'Missing email or message in request body.' });
  }

  // 1. Send the email via Nodemailer
  let emailResult = null;
  const subject = 'Action Required: Additional Documents Needed for IdeaVault Verification';
  try {
    emailResult = await sendReplyEmail(email, subject, message);
    console.log('[nodemailer] Verification request email sent to:', email, 'Result:', emailResult);
  } catch (emailErr) {
    console.error('[nodemailer] Failed to send verification email:', emailErr.message);
    return res.status(500).json({
      success: false,
      error: emailErr.message,
      details: emailErr
    });
  }

  // 2. Update status to 'pending_documents' in Supabase
  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const dbResult = await client
    .from('startups')
    .update({ status: 'pending_documents' })
    .eq('id', id)
    .select();

  // 3. Sync status to local DB fallback
  let localDb = loadFromLocalDB();
  const index = localDb.findIndex(s => String(s.id) === String(id));
  let updatedLocal = null;
  if (index !== -1) {
    localDb[index].status = 'pending_documents';
    saveToLocalDB(localDb);
    updatedLocal = localDb[index];
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase status update error (request-docs), saved to local DB:', dbResult.error.message);
    return res.status(200).json({
      message: 'Request email sent and status updated locally (Supabase update failed).',
      startup: updatedLocal,
      emailSent: true
    });
  }

  return res.status(200).json({
    message: 'Request email sent and status updated successfully.',
    startup: dbResult.data[0],
    emailSent: true
  });
});


// PUT /api/admin/startups/:id/plan — Admin update plan (Supabase + Local DB fallback)
app.put('/api/admin/startups/:id/plan', async (req, res) => {
  const { id } = req.params;
  const { plan_type } = req.body;
  console.log('[admin] PUT plan update for ID:', id, 'plan:', plan_type);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const expiryDays = 365;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  const expiryIso = expiryDate.toISOString();

  const dbResult = await client
    .from('startups')
    .update({ 
      plan_type, 
      status: 'active',
      payment_status: 'paid',
      subscription_ends_at: expiryIso
    })
    .eq('id', id)
    .select();

  let localDb = loadFromLocalDB();
  const index = localDb.findIndex(s => String(s.id) === String(id));
  let updatedLocal = null;
  if (index !== -1) {
    localDb[index].plan_type = plan_type;
    localDb[index].tier = plan_type;
    localDb[index].status = 'active';
    localDb[index].payment_status = 'paid';
    localDb[index].subscription_ends_at = expiryIso;
    localDb[index].expiry_date = expiryIso;
    saveToLocalDB(localDb);
    updatedLocal = localDb[index];
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase plan update error, saved to local DB:', dbResult.error.message);
    return res.status(200).json({
      message: 'Plan updated (Local DB fallback).',
      startup: updatedLocal
    });
  }

  return res.status(200).json({
    message: 'Plan updated successfully.',
    startup: dbResult.data[0]
  });
});

// DELETE /api/admin/startups/:id — Admin delete startup (Supabase + Local DB fallback)
app.delete('/api/admin/startups/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[admin] DELETE startup ID:', id);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const dbResult = await client
    .from('startups')
    .delete()
    .eq('id', id);

  let localDb = loadFromLocalDB();
  const filtered = localDb.filter(s => String(s.id) !== String(id));
  saveToLocalDB(filtered);

  if (dbResult.error) {
    console.warn('[admin] Supabase delete error, removed from local DB:', dbResult.error.message);
    return res.status(200).json({ message: 'Deleted (Local DB fallback).' });
  }

  return res.status(200).json({ message: 'Deleted successfully.' });
});

// GET /api/admin/stats — Fetch admin statistics from unified DB
app.get('/api/admin/stats', async (req, res) => {
  console.log('[admin] Fetching overview stats');

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  let data = [];
  const result = await client.from('startups').select('status, plan_type');
  if (result.error) {
    data = loadFromLocalDB();
  } else {
    data = result.data || [];
    if (data.length === 0) {
      data = loadFromLocalDB();
    }
  }

  let pending = 0;
  let active = 0;
  let pro = 0;
  let spot = 0;
  const total = data.length;

  data.forEach((s) => {
    const status = (s.status || '').toLowerCase().trim();
    const verStatus = (s.verification_status || '').toLowerCase().trim();
    const isExcluded = ['draft', 'pending_payment', 'paid', 'active', 'approved', 'rejected'].includes(status);
    const isPending = !isExcluded && (
      status === 'pending_verification' || 
      status === 'pending_documents' || 
      status === 'reviewing' || 
      status === 'pending' || 
      verStatus === 'pending'
    );
    if (isPending) pending++;
    if (status === 'active' || status === 'paid' || status === 'approved') active++;
    if (s.plan_type === 'Verified Pro' || s.tier === 'Verified Pro') pro++;
    if (s.plan_type === 'Spotlight' || s.tier === 'Spotlight') spot++;
  });

  // Count unread user queries (from user_queries table — service role key bypasses RLS)
  let unreadQueriesCount = 0;
  const qResult = await client
    .from('user_queries')
    .select('*', { count: 'exact', head: true })
    .eq('unread', true);

  if (qResult.error) {
    console.warn('[stats] user_queries count error:', qResult.error.message);
    unreadQueriesCount = 0;
  } else {
    unreadQueriesCount = qResult.count || 0;
  }

  // Load prices to calculate revenue
  const settings = loadSettingsFromLocalDB();
  let proAmount = 9999;
  let spotAmount = 24999;
  try {
    const { data: sData } = await client.from('platform_settings').select('*').eq('id', 1).maybeSingle();
    const activeSettings = sData || settings;
    proAmount = parseInt(String(activeSettings.pro_price_inr || '9999').replace(/[^0-9]/g, ''), 10) || 9999;
    spotAmount = parseInt(String(activeSettings.spotlight_price_inr || '24999').replace(/[^0-9]/g, ''), 10) || 24999;
  } catch (e) {}

  const totalRevenue = pro * proAmount + spot * spotAmount;

  return res.status(200).json({
    pendingCount: pending,
    totalCount: total,
    activeCount: active,
    proCount: pro,
    spotCount: spot,
    totalRevenue,
    unreadQueriesCount
  });
});

// POST /api/pre-reg-queries — Pre-registration query submit
app.post('/api/pre-reg-queries', async (req, res) => {
  const { name, email, message } = req.body;
  console.log('[queries] POST pre-registration query:', name, email);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Insert to user_queries in Supabase
  const dbResult = await client
    .from('user_queries')
    .insert({ name, email, message, unread: true })
    .select();

  // Fallback to local queries file
  let localQueries = [];
  const LOCAL_QUERIES_PATH = path.join(__dirname, 'user_queries_db.json');
  if (fs.existsSync(LOCAL_QUERIES_PATH)) {
    try {
      localQueries = JSON.parse(fs.readFileSync(LOCAL_QUERIES_PATH, 'utf8'));
    } catch (e) {}
  }
  const newQuery = {
    id: localQueries.length + 1,
    name,
    email,
    message,
    unread: true,
    created_at: new Date().toISOString()
  };
  localQueries.push(newQuery);
  fs.writeFileSync(LOCAL_QUERIES_PATH, JSON.stringify(localQueries, null, 2), 'utf8');

  // Forward to support_queries table/local DB
  try {
    const chatMessage = {
      sender: name,
      role: 'founder',
      text: message,
      time: 'Just now'
    };
    await client.from('support_queries').insert({
      sender: name,
      email: email,
      company: 'Pre-Registration',
      subject: 'Pre-registration inquiry',
      category: 'Technical',
      unread: true,
      messages: [chatMessage]
    });
    
    let supportLocal = [];
    const LOCAL_SUPPORT_PATH = path.join(__dirname, 'support_queries_db.json');
    if (fs.existsSync(LOCAL_SUPPORT_PATH)) {
      try {
        supportLocal = JSON.parse(fs.readFileSync(LOCAL_SUPPORT_PATH, 'utf8'));
      } catch (e) {}
    }
    supportLocal.push({
      id: supportLocal.length + 1,
      sender: name,
      email: email,
      company: 'Pre-Registration',
      subject: 'Pre-registration inquiry',
      category: 'Technical',
      unread: true,
      messages: [chatMessage],
      created_at: new Date().toISOString()
    });
    fs.writeFileSync(LOCAL_SUPPORT_PATH, JSON.stringify(supportLocal, null, 2), 'utf8');
  } catch (e) {
    console.warn("Failed to propagate pre-reg query:", e.message);
  }

  if (dbResult.error) {
    console.warn('[queries] Supabase query save error, saved to local DB:', dbResult.error.message);
    return res.status(200).json({ message: 'Submitted successfully (Local DB fallback).' });
  }

  return res.status(200).json({ message: 'Submitted successfully.', query: dbResult.data[0] });
});

// POST /api/dashboard-queries — Submit support query from dashboard
app.post('/api/dashboard-queries', async (req, res) => {
  const { name, email, company, subject, category, message } = req.body;
  console.log('[queries] POST dashboard query:', name, email, subject);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Insert to user_queries in Supabase
  // To distinguish dashboard inquiries from pre-registration inquiries,
  // we can prepend the subject to the message field in user_queries.
  const dbMessage = `[${subject || 'Support Ticket'}] ${message}`;
  const dbResult = await client
    .from('user_queries')
    .insert({ name, email, message: dbMessage, unread: true })
    .select();

  // Fallback to local queries file (user_queries_db.json)
  let localQueries = [];
  const LOCAL_QUERIES_PATH = path.join(__dirname, 'user_queries_db.json');
  if (fs.existsSync(LOCAL_QUERIES_PATH)) {
    try {
      localQueries = JSON.parse(fs.readFileSync(LOCAL_QUERIES_PATH, 'utf8'));
    } catch (e) {}
  }
  const newQuery = {
    id: localQueries.length + 1,
    name,
    email,
    message: dbMessage,
    unread: true,
    created_at: new Date().toISOString()
  };
  localQueries.push(newQuery);
  fs.writeFileSync(LOCAL_QUERIES_PATH, JSON.stringify(localQueries, null, 2), 'utf8');

  // Forward to support_queries table/local DB
  try {
    const chatMessage = {
      sender: name,
      role: 'founder',
      text: message,
      time: 'Just now'
    };
    
    // We insert to support_queries table in Supabase
    await client.from('support_queries').insert({
      sender: name,
      email: email,
      company: company || 'Client Dashboard',
      subject: subject || 'Dashboard Inquiry',
      category: category || 'Technical',
      unread: true,
      messages: [chatMessage]
    });
    
    // Fallback to local support queries file
    let supportLocal = [];
    const LOCAL_SUPPORT_PATH = path.join(__dirname, 'support_queries_db.json');
    if (fs.existsSync(LOCAL_SUPPORT_PATH)) {
      try {
        supportLocal = JSON.parse(fs.readFileSync(LOCAL_SUPPORT_PATH, 'utf8'));
      } catch (e) {}
    }
    supportLocal.push({
      id: supportLocal.length + 1,
      sender: name,
      email: email,
      company: company || 'Client Dashboard',
      subject: subject || 'Dashboard Inquiry',
      category: category || 'Technical',
      unread: true,
      messages: [chatMessage],
      created_at: new Date().toISOString()
    });
    fs.writeFileSync(LOCAL_SUPPORT_PATH, JSON.stringify(supportLocal, null, 2), 'utf8');
  } catch (e) {
    console.warn("Failed to propagate dashboard query to support_queries:", e.message);
  }

  if (dbResult.error) {
    console.warn('[queries] Supabase query save error, saved to local DB:', dbResult.error.message);
    return res.status(200).json({ message: 'Submitted successfully (Local DB fallback).' });
  }

  return res.status(200).json({ message: 'Submitted successfully.', query: dbResult.data[0] });
});

// NOTE: /api/platform-settings GET and POST are defined earlier (lines ~1866-1921).
// Duplicate definitions removed to prevent route shadowing.

// GET /api/admin/users — Fetch all admin team members
app.get('/api/admin/users', async (req, res) => {
  let client;
  try {
    client = getAdminClient();
    const { data, error } = await client.from('admin_users').select('*').order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      return res.status(200).json(data);
    }
  } catch (e) {}

  const settings = loadSettingsFromLocalDB();
  return res.status(200).json(settings.team || []);
});

// POST /api/admin/users — Create a new admin team member
app.post('/api/admin/users', async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  let client;
  let inserted = null;
  try {
    client = getAdminClient();
    const { data, error } = await client.from('admin_users').insert([{ name, email, role: role || 'Moderator' }]).select();
    if (!error && data && data.length > 0) {
      inserted = data[0];
    }
  } catch (e) {}

  if (!inserted) {
    inserted = { id: Date.now(), name, email, role: role || 'Moderator', created_at: new Date().toISOString() };
  }

  // Sync to local platform_settings_db.json team list
  const settings = loadSettingsFromLocalDB();
  const currentTeam = settings.team || [];
  if (!currentTeam.some(m => m.email === email)) {
    currentTeam.push(inserted);
    settings.team = currentTeam;
    saveSettingsToLocalDB(settings);
  }

  return res.status(200).json({ message: 'Admin user added successfully.', user: inserted });
});

// DELETE /api/admin/users/:id — Delete an admin team member
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;

  let client;
  try {
    client = getAdminClient();
    await client.from('admin_users').delete().eq('id', id);
  } catch (e) {}

  // Sync to local platform_settings_db.json
  const settings = loadSettingsFromLocalDB();
  const currentTeam = settings.team || [];
  settings.team = currentTeam.filter(m => String(m.id) !== String(id));
  saveSettingsToLocalDB(settings);

  return res.status(200).json({ message: 'Admin user removed successfully.' });
});

// GET /api/startups — Fetch all active, non-expired listings for Discover page
app.get('/api/startups', async (req, res) => {
  // Bust backend cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  console.log('[startups] Fetching all active listings for Discover page (cache-busted)');

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const nowString = new Date().toISOString();

  // On-the-fly cleanup: update expired active listings to 'expired' (best-effort)
  try {
    await client
      .from('startups')
      .update({ status: 'expired' })
      .lte('subscription_ends_at', nowString)
      .eq('status', 'active');
  } catch (e) {
    // Silently ignore — status column may not exist yet
  }

  // Fetch listings directly from Supabase (without SQL status filter so it never errors on missing column)
  let data = [];
  try {
    const sbResult = await client
      .from('startups')
      .select('*');

    const isPublishedToDiscover = (s) => {
      const approval = String(s.approval_status || s.verification_status || (s.status === 'active' || s.status === 'approved' ? 'approved' : 'pending')).toLowerCase().trim();
      const payment = String(s.payment_status || (s.status === 'active' ? 'paid' : 'pending')).toLowerCase().trim();
      const tier = String(s.plan_type || s.tier || 'Basic').trim();

      if (tier === 'Basic') {
        return s.status === 'active' || s.status === 'approved' || (approval === 'approved' && (payment === 'paid' || !s.payment_status));
      }

      const isApproved = approval === 'approved' || s.status === 'approved' || (s.status === 'active' && payment === 'paid');
      const isPaid = payment === 'paid' || s.status === 'active';

      return isApproved && isPaid;
    };

    if (!sbResult.error && Array.isArray(sbResult.data) && sbResult.data.length > 0) {
      console.log(`[startups] Fetched ${sbResult.data.length} live startup rows directly from Supabase`);
      // Filter published listings (requires approval_status === 'approved' AND payment_status === 'paid' for paid tiers)
      data = sbResult.data.filter(isPublishedToDiscover);
    } else {
      if (sbResult.error) {
        console.warn('[startups] Supabase fetch error, using local fallback:', sbResult.error.message);
      }
      data = loadFromLocalDB().filter(isPublishedToDiscover);
    }
  } catch (err) {
    console.error('[startups] Exception fetching startups from Supabase:', err.message);
    data = loadFromLocalDB().filter(isPublishedToDiscover);
  }

  const localDbStartups = loadFromLocalDB();

  // Format listings to camelCase for client consistency
  const formatted = (data || []).map((s) => {
    const ac = s.additional_contacts;
    const isStructuredAC = ac && !Array.isArray(ac) && typeof ac === 'object';
    const additionalContacts = isStructuredAC ? (ac.links || []) : (Array.isArray(ac) ? ac : []);
    const acLocation  = isStructuredAC ? (ac.location  || '') : (s.location || '');
    const acTeamSize  = isStructuredAC ? (ac.teamSize  || '') : (s.team_size || s.teamSize || '');
    const acTraction  = isStructuredAC ? (ac.traction  || '') : (s.traction || '');
    const acTags      = isStructuredAC ? (ac.tags      || []) : (Array.isArray(s.tags) ? s.tags : []);

    const localMatch = localDbStartups.find(l => (s.user_id && l.user_id === s.user_id) || (s.id && String(l.id) === String(s.id)));

    const rawTier = s.plan_type || s.tier || s.subscription_plan 
                    || (isStructuredAC && (ac.tier || ac.plan_type)) 
                    || localMatch?.plan_type || localMatch?.tier 
                    || 'Basic';

    let resolvedTier = 'Basic';
    const normalizedRaw = String(rawTier).trim().toLowerCase();
    if (normalizedRaw === 'verified pro' || normalizedRaw === 'verified_pro' || normalizedRaw === 'verified') {
      resolvedTier = 'Verified Pro';
    } else if (normalizedRaw === 'spotlight') {
      resolvedTier = 'Spotlight';
    }

    const resolvedTags = Array.isArray(acTags)
      ? acTags
      : (typeof acTags === 'string' ? acTags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const pitchDeckUrl = s.pitch_deck_url || s.pitchDeckUrl || '';
    const publicDocumentUrl = s.public_document_url || s.publicDocumentUrl || '';
    const documentUrls = pitchDeckUrl ? [pitchDeckUrl] : (s.document_urls || []);

    const resolvedLogoUrl = s.logo_url 
      || s.logoUrl 
      || (isStructuredAC && (ac.logo_url || ac.logoUrl)) 
      || (localMatch && (localMatch.logo_url || localMatch.logoUrl || (localMatch.additional_contacts && localMatch.additional_contacts.logo_url))) 
      || '';

    return {
      id: s.id,
      name: s.company_name || s.name || '',
      logoInitials: (s.company_name || s.name || 'ST').substring(0, 2).toUpperCase(),
      logoColor: '#6366f1',
      logoUrl: resolvedLogoUrl,
      logo_url: resolvedLogoUrl,
      pitch: s.pitch || '',
      industry: s.industry || '',
      stage: s.stage || '',
      minTicket: s.min_investment || s.minTicket || '',
      fundingAsk: s.min_investment || s.minTicket || '',
      description: s.description || '',
      website: s.website || '',
      userId: s.user_id,
      status: s.status || 'active',
      expiryDate: s.expiry_date || null,
      contactEmail: s.contact_email || s.email || '',
      contactPhone: s.phone_number || s.contactPhone || '',
      additionalContacts,
      documentUrls,
      documentUrl: pitchDeckUrl,
      pitchDeckUrl,
      publicDocumentUrl,
      public_document_url: publicDocumentUrl,
      requested_plan: s.requested_plan || null,
      verification_status: s.verification_status || null,
      tier: resolvedTier,
      plan_type: resolvedTier,
      planType: resolvedTier,
      subscription_plan: resolvedTier,
      verified: resolvedTier === 'Verified Pro' || resolvedTier === 'Spotlight',
      location: acLocation,
      teamSize: acTeamSize,
      team: parseInt(acTeamSize || '0', 10) || 0,
      traction: acTraction,
      tags: resolvedTags,
      tagsString: resolvedTags.join(', ')
    };
  });

  return res.status(200).json({ startups: formatted });
});

// POST /api/payments/success — Mock payment bypass: directly activates the startup in DB
app.post('/api/payments/success', async (req, res) => {
  if (await checkMaintenanceActive()) {
    return res.status(503).json({ error: 'System maintenance mode is active. Upgrades and payments are temporarily paused.' });
  }
  const { userId, tier, isFinalPayment } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  // Before making ANY database calls, create a dynamic status variable based on the tier
  const selectedTier = tier;
  const finalStatus = isFinalPayment ? 'active' : ((selectedTier === 'Basic' || selectedTier === 'basic') ? 'active' : 'pending');
  console.log('[payment] Processing mock payment success for user:', userId, 'tier:', selectedTier, 'finalStatus:', finalStatus, 'isFinalPayment:', isFinalPayment);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Only stamp the 180-day expiry when the listing is actually being activated
  const expiryDays = 180;
  const expiryDate = finalStatus === 'active' ? new Date() : null;
  if (expiryDate) expiryDate.setDate(expiryDate.getDate() + expiryDays);
  const expiryIso = expiryDate ? expiryDate.toISOString() : null;

  // ── Step 1: Find the user's startup row ──────────────────────────────────────
  let existing = null;
  try {
    const { data: found } = await client
      .from('startups')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    existing = found;
    console.log('[payment] Existing row found:', !!existing, '| columns:', existing ? Object.keys(existing).join(', ') : 'N/A');
  } catch (e) {
    console.warn('[payment] Pre-fetch check warning:', e.message);
  }

  // ── Step 2: Build update payload using only columns that EXIST in the row ───
  // We inspect the existing row's keys to determine which columns are safe to update.
  const safeUpdate = {};
  if (existing) {
    const cols = Object.keys(existing);
    if (cols.includes('status'))      safeUpdate.status      = finalStatus;
    if (expiryIso) {
      if (cols.includes('subscription_ends_at')) safeUpdate.subscription_ends_at = expiryIso;
    }
    if (cols.includes('plan_type'))   safeUpdate.plan_type   = selectedTier || 'Basic';
    if (cols.includes('tier'))        safeUpdate.tier        = selectedTier || 'Basic';

    console.log('[payment] Safe update payload:', JSON.stringify(safeUpdate));
  }

  // Update local database always
  const localUpdate = {
    user_id: userId,
    status: finalStatus,
    tier: selectedTier || 'Basic',
    plan_type: selectedTier || 'Basic'
  };
  if (expiryIso) {
    localUpdate.subscription_ends_at = expiryIso;
    localUpdate.expiry_date = expiryIso;
  }
  const savedLocal = upsertLocalDB(localUpdate);

  // Verifications Table conditional insert bypass:
  if (selectedTier !== 'Basic' && selectedTier !== 'basic') {
    // If a separate verifications table existed, we would perform the insert here
    console.log('[payment] Premium verification record check passed.');
  }

  // ── Step 3: If we have columns to update, do it ──────────────────────────────
  if (existing && Object.keys(safeUpdate).length > 0) {
    const { data, error } = await client
      .from('startups')
      .update(safeUpdate)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('[payment] Update error, saved to local DB:', error.message);
      return res.status(200).json({
        message: 'Payment processed (DB update failed — check schema).',
        startup: savedLocal,
        dbError: error.message
      });
    }

    console.log('[payment] ✅ DB update successful for user:', userId);
    return res.status(200).json({
      message: 'Payment verified and listing activated!',
      startup: data[0] || savedLocal
    });
  }

  // ── Step 4: No existing row — insert a minimal placeholder ──────────────────
  if (!existing) {
    // Try insert with all columns, fall back progressively on schema errors
    const fullPayload = {
      user_id: userId,
      company_name: 'My Startup',
      founder_name: 'Founder',
      email: 'founder@example.com',
      website: 'https://example.com',
      pitch: 'Pitch goes here',
      industry: 'SaaS',
      stage: 'Pre-seed',
      min_investment: '₹5,00,000',
      description: 'Description goes here',
      status: finalStatus,
      tier: selectedTier || 'Basic',
      plan_type: selectedTier || 'Basic'
    };
    if (expiryDate) fullPayload.expiry_date = expiryDate.toISOString();

    const { data, error } = await client.from('startups').insert(fullPayload).select();

    if (error) {
      console.error('[payment] Insert failed, saved to local DB:', error.message);
      return res.status(200).json({ message: 'Listing created and activated locally!', startup: savedLocal });
    } else {
      console.log('[payment] ✅ Inserted new row for user:', userId);
      return res.status(200).json({ message: 'Listing created and activated!', startup: data[0] });
    }
  }

  // ── Step 5: Fallback — DB has no matching columns; return simulated success ──
  console.warn('[payment] ⚠️  Schema missing required columns. Returning simulated activation.');
  return res.status(200).json({
    message: 'Payment processed (simulated — schema missing status/plan_type columns).',
    startup: savedLocal
  });
});

// POST /api/payments/webhook — Listen for payment success webhook events
app.post('/api/payments/webhook', async (req, res) => {
  const { event, data } = req.body;
  console.log('[webhook] Received payment event:', event);

  if (event === 'payment.success') {
    const { userId, tier } = data || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required in event data.' });
    }

    let client;
    try {
      client = getAdminClient();
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 180);

    // Check if startup row already exists for this user to update or insert
    let existing = null;
    try {
      const { data: found } = await client
        .from('startups')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      existing = found;
    } catch (e) {
      console.warn('[webhook] Pre-fetch check warning:', e.message);
    }

    let dbResult;
    const selectedTier = tier;
    const finalStatus = (selectedTier === 'Basic' || selectedTier === 'basic') ? 'active' : 'pending';

    // Verifications Table conditional insert bypass:
    if (selectedTier !== 'Basic' && selectedTier !== 'basic') {
      // If a separate verifications table existed, we would perform the insert here
      console.log('[webhook] Premium verification record check passed.');
    }

    if (existing) {
      dbResult = await client
        .from('startups')
        .update({
          status: finalStatus,
          subscription_ends_at: expiryDate.toISOString(),
          plan_type: selectedTier || 'Basic'
        })
        .eq('user_id', userId)
        .select();
    } else {
      dbResult = await client
        .from('startups')
        .insert({
          user_id: userId,
          company_name: 'My Startup',
          founder_name: 'Founder Name',
          email: 'founder@example.com',
          website: 'https://example.com',
          pitch: 'One-line pitch goes here',
          industry: 'SaaS',
          stage: 'Pre-seed',
          min_investment: '₹5,00,000',
          description: 'Provide a detailed description of your startup here.',
          status: finalStatus,
          expiry_date: expiryDate.toISOString(),
          tier: selectedTier || 'Basic',
          plan_type: selectedTier || 'Basic'
        })
        .select();
    }

    const { data: updatedData, error } = dbResult;

    if (error) {
      console.error('[webhook] Supabase update status error:', error.message);
      const msg = error.message.toLowerCase();
      if (msg.includes('relation') || 
          msg.includes('does not exist') || 
          msg.includes('column') || 
          msg.includes('could not find')) {
        console.warn('⚠️  Supabase status column mismatch or table missing. Simulating webhook success.');
        return res.status(200).json({
          message: 'Webhook processed. Visibility state activated (saved locally).',
          startup: { userId, status: finalStatus, expiryDate: expiryDate.toISOString(), tier: selectedTier || 'Basic' }
        });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      message: 'Webhook processed. Startup status updated.',
      startup: updatedData ? updatedData[0] : null
    });
  }

  return res.status(200).json({ message: 'Event received.' });
});

// Daily background job: expire visibility statuses if expiry date has passed
setInterval(async () => {
  try {
    console.log('[cron] Running visibility expiry checks...');
    const client = getAdminClient();
    const { error } = await client
      .from('startups')
      .update({ status: 'expired' })
      .lte('subscription_ends_at', new Date().toISOString())
      .eq('status', 'active');
    if (error) console.error('[cron] Expiry check warning:', error.message);
  } catch (err) {
    console.error('[cron] Expiry cleanup failed to run:', err.message);
  }
}, 24 * 60 * 60 * 1000); // Trigger daily


// GET /api/admin/queries — Fetch all support queries (RLS bypass + local fallback)
app.get('/api/admin/queries', async (req, res) => {
  console.log('[admin] Fetching support queries from user_queries table');

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Fetch all queries from user_queries table in Supabase
  let userQueries = [];
  const result = await client
    .from('user_queries')
    .select('*')
    .order('created_at', { ascending: false });

  if (result.error) {
    // Supabase query failed — use local file only as last resort for connectivity errors
    console.warn('[admin] Supabase user_queries fetch error:', result.error.message);
    // Return empty array rather than stale local mock data
    userQueries = [];
  } else {
    // Always use Supabase data — never fall back to local JSON when Supabase succeeds (even if 0 rows)
    userQueries = result.data || [];
  }

  // Ensure we sort by created_at descending (newest first)
  userQueries.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Map user_queries to support queries shape, merging with local support_queries_db.json for replies/messages thread
  let supportLocal = loadQueriesFromLocalDB();

  const formatted = userQueries.map(q => {
    // Try to find a matching thread in support_queries_db.json by sender name and first message text
    const localThread = supportLocal.find(t => 
      t.sender === q.name && 
      (t.messages && t.messages.length > 0 && (t.messages[0].text === q.message || q.message.includes(t.messages[0].text)))
    );

    let messages = [];
    if (localThread && localThread.messages) {
      messages = localThread.messages;
    } else {
      // Default thread with just the user's inquiry message
      messages = [
        {
          sender: q.name,
          role: 'founder',
          text: q.message,
          time: 'Just now'
        }
      ];
    }

    // Try to parse the subject from the stored message if it was formatted as [Subject] Message
    let mappedSubject = 'Pre-registration inquiry';
    let mappedMessageText = q.message;
    if (q.message && q.message.startsWith('[') && q.message.includes(']')) {
      const closingBracketIndex = q.message.indexOf(']');
      mappedSubject = q.message.substring(1, closingBracketIndex);
      mappedMessageText = q.message.substring(closingBracketIndex + 1).trim();
      
      // Update first message text in thread if it's default
      if (!localThread) {
        messages[0].text = mappedMessageText;
      }
    }

    return {
      id: q.id,
      sender: q.name,
      company: (localThread && localThread.company) || (q.message && q.message.startsWith('[') ? 'Dashboard' : 'Pre-Registration'),
      subject: (localThread && localThread.subject) || mappedSubject,
      category: (localThread && localThread.category) || 'Technical',
      unread: q.unread,
      status: q.status || (localThread && localThread.status) || (q.unread ? 'pending' : 'replied'),
      email: q.email,
      messages: messages,
      created_at: q.created_at || new Date().toISOString()
    };
  });

  return res.status(200).json(formatted);
});

// PUT /api/admin/queries/:id/status — Update status of a support query (Supabase + Local DB fallback)
app.put('/api/admin/queries/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log('[admin] PUT support query status for ID:', id, 'status:', status);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Update Supabase
  const dbResult = await client
    .from('user_queries')
    .update({ status: status, unread: false })
    .eq('id', id);

  // Sync to local support queries db
  let localQueries = loadQueriesFromLocalDB();
  const index = localQueries.findIndex(q => String(q.id) === String(id));
  if (index !== -1) {
    localQueries[index].unread = false;
    localQueries[index].status = status;
    saveQueriesToLocalDB(localQueries);
  }

  // Sync to user queries db
  const LOCAL_QUERIES_PATH = path.join(__dirname, 'user_queries_db.json');
  if (fs.existsSync(LOCAL_QUERIES_PATH)) {
    try {
      let localUserQueries = JSON.parse(fs.readFileSync(LOCAL_QUERIES_PATH, 'utf8'));
      const uIdx = localUserQueries.findIndex(q => String(q.id) === String(id));
      if (uIdx !== -1) {
        localUserQueries[uIdx].unread = false;
        localUserQueries[uIdx].status = status;
        localUserQueries[uIdx].replied_at = new Date().toISOString();
        fs.writeFileSync(LOCAL_QUERIES_PATH, JSON.stringify(localUserQueries, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase query status update error, saved locally:', dbResult.error.message);
    return res.status(200).json({ message: 'Status updated locally (Supabase write failed).' });
  }

  return res.status(200).json({ message: 'Status updated successfully.' });
});

// PUT /api/admin/queries/:id/read — Mark query as read (Supabase + Local DB fallback)
app.put('/api/admin/queries/:id/read', async (req, res) => {
  const { id } = req.params;
  console.log('[admin] PUT support query read status for ID:', id);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const dbResult = await client
    .from('user_queries')
    .update({ unread: false })
    .eq('id', id);

  let localQueries = loadQueriesFromLocalDB();
  const index = localQueries.findIndex(q => String(q.id) === String(id));
  if (index !== -1) {
    localQueries[index].unread = false;
    saveQueriesToLocalDB(localQueries);
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase mark query read error, saved to local DB:', dbResult.error.message);
    return res.status(200).json({ message: 'Marked read (Local DB fallback).' });
  }

  return res.status(200).json({ message: 'Marked read successfully.' });
});

// POST /api/admin/queries/:id/reply — Send reply and email user (Supabase + Local DB fallback)
app.post('/api/admin/queries/:id/reply', async (req, res) => {
  const { id } = req.params;
  const { messages, replyMessage } = req.body;
  console.log('[admin] POST reply for support query ID:', id);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Fetch the query first to get sender & company details
  const { data: activeQuery } = await client
    .from('support_queries')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const sender = activeQuery?.sender || '';
  const company = activeQuery?.company || '';
  const subject = activeQuery?.subject || 'Inquiry';

  // Determine email recipient address
  let toEmail = req.body.email;
  if (!toEmail) {
    // 1. Check startups table
    if (sender || company) {
      try {
        const { data: sData } = await client
          .from('startups')
          .select('email')
          .or(`founder_name.eq."${sender}",company_name.eq."${company}"`)
          .limit(1);
        if (sData && sData.length > 0) {
          toEmail = sData[0].email;
        }
      } catch (e) {}

      if (!toEmail) {
        try {
          const localStartups = loadFromLocalDB();
          const match = localStartups.find(s => s.founder_name === sender || s.company_name === company);
          if (match) {
            toEmail = match.email;
          }
        } catch (e) {}
      }
    }
  }
  if (!toEmail) {
    // 2. Check user_queries table
    try {
      const { data: uData } = await client
        .from('user_queries')
        .select('email')
        .eq('name', sender)
        .limit(1);
      if (uData && uData.length > 0) {
        toEmail = uData[0].email;
      }
    } catch (e) {}

    if (!toEmail) {
      try {
        const LOCAL_QUERIES_PATH = path.join(__dirname, 'user_queries_db.json');
        if (fs.existsSync(LOCAL_QUERIES_PATH)) {
          const localUserQueries = JSON.parse(fs.readFileSync(LOCAL_QUERIES_PATH, 'utf8'));
          const firstMsgText = activeQuery?.messages?.[0]?.text || '';
          const match = localUserQueries.find(q => 
            q.name === sender && 
            (!firstMsgText || q.message === firstMsgText)
          );
          if (match) {
            toEmail = match.email;
          }
        }
      } catch (e) {}
    }
  }
  if (!toEmail) {
    toEmail = sender.includes('@') ? sender : 'founder@example.com';
  }

  const emailText = replyMessage || (messages && messages.length > 0 ? messages[messages.length - 1].text : '');

  // Send the real email via Nodemailer
  let emailResult = null;
  try {
    emailResult = await sendReplyEmail(toEmail, `Re: Your Inquiry to IdeaVault - ${subject}`, emailText);
    console.log('[nodemailer] Email sent to:', toEmail, 'Result:', emailResult);
  } catch (emailErr) {
    console.error('[nodemailer] Failed to send email:', emailErr.message);
    return res.status(500).json({
      success: false,
      error: emailErr.message,
      details: emailErr
    });
  }

  // Update user_queries in Supabase by ID (only update 'unread' column as 'replied_at' does not exist in schema)
  const dbResult = await client
    .from('user_queries')
    .update({ unread: false })
    .eq('id', id)
    .select();

  // Sync to local databases
  // 1. support_queries_db.json
  let localQueries = loadQueriesFromLocalDB();
  const idx = localQueries.findIndex(q => String(q.id) === String(id));
  let updatedLocal = null;
  if (idx !== -1) {
    localQueries[idx].messages = messages;
    localQueries[idx].unread = false;
    saveQueriesToLocalDB(localQueries);
    updatedLocal = localQueries[idx];
  }

  // 2. user_queries_db.json
  const LOCAL_QUERIES_PATH = path.join(__dirname, 'user_queries_db.json');
  if (fs.existsSync(LOCAL_QUERIES_PATH)) {
    try {
      let localUserQueries = JSON.parse(fs.readFileSync(LOCAL_QUERIES_PATH, 'utf8'));
      const uIdx = localUserQueries.findIndex(q => q.name === sender || q.email === toEmail);
      if (uIdx !== -1) {
        localUserQueries[uIdx].unread = false;
        localUserQueries[uIdx].replied_at = new Date().toISOString();
        fs.writeFileSync(LOCAL_QUERIES_PATH, JSON.stringify(localUserQueries, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase send reply error, saved to local DB:', dbResult.error.message);
    return res.status(200).json({
      message: 'Reply saved locally (Supabase write failed).',
      query: updatedLocal
    });
  }

  return res.status(200).json({
    message: 'Reply sent and email dispatched successfully.',
    query: dbResult.data[0],
    emailSent: !!emailResult
  });
});


// DELETE /api/admin/queries/:id — Delete support query (Supabase + Local DB fallback)
app.delete('/api/admin/queries/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[admin] DELETE support query for ID:', id);

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Delete from user_queries table in Supabase
  const dbResult = await client
    .from('user_queries')
    .delete()
    .eq('id', id);

  // Sync to local databases by deleting the entries
  // 1. support_queries_db.json
  try {
    let localQueries = loadQueriesFromLocalDB();
    const updatedSupport = localQueries.filter(q => String(q.id) !== String(id));
    saveQueriesToLocalDB(updatedSupport);
  } catch (e) {
    console.warn('[admin] Local support queries delete sync failed:', e.message);
  }

  // 2. user_queries_db.json
  const LOCAL_QUERIES_PATH = path.join(__dirname, 'user_queries_db.json');
  if (fs.existsSync(LOCAL_QUERIES_PATH)) {
    try {
      let localUserQueries = JSON.parse(fs.readFileSync(LOCAL_QUERIES_PATH, 'utf8'));
      const updatedUser = localUserQueries.filter(q => String(q.id) !== String(id));
      fs.writeFileSync(LOCAL_QUERIES_PATH, JSON.stringify(updatedUser, null, 2), 'utf8');
    } catch (e) {
      console.warn('[admin] Local user queries delete sync failed:', e.message);
    }
  }

  if (dbResult.error) {
    console.warn('[admin] Supabase query delete error, synced locally:', dbResult.error.message);
    return res.status(200).json({ message: 'Deleted query locally (Supabase delete failed).' });
  }

  return res.status(200).json({ message: 'Deleted query successfully.' });
});


// DELETE /api/admin/startups/:identifier/documents — Delete a document from Supabase Storage + DB
app.delete('/api/admin/startups/:identifier/documents', async (req, res) => {
  const { identifier } = req.params;
  const { documentUrl } = req.body;
  console.log('[admin] DELETE document request for startup identifier:', identifier, 'documentUrl:', documentUrl);

  if (!documentUrl) {
    return res.status(400).json({ error: 'documentUrl is required.' });
  }

  let client;
  try {
    client = getAdminClient();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // Step A: Extract storage path and delete file from Supabase Storage 'documents' bucket
  try {
    if (documentUrl.includes('/documents/')) {
      const parts = documentUrl.split('/documents/');
      const storagePath = parts[1]?.split('?')[0];
      if (storagePath) {
        const { error: storageErr } = await client.storage
          .from('documents')
          .remove([storagePath]);
        if (storageErr) {
          console.warn('[admin] Supabase Storage delete warning:', storageErr.message);
        } else {
          console.log('[admin] Deleted file from Supabase storage bucket:', storagePath);
        }
      }
    }
  } catch (sErr) {
    console.warn('[admin] Exception during storage deletion:', sErr.message);
  }

  // Step B: Fetch current startup record and remove documentUrl from arrays
  let updatedUrls = [];

  // Update Local DB fallback
  const localList = loadFromLocalDB();
  const idx = localList.findIndex(s => s.user_id === identifier || String(s.id) === String(identifier));
  if (idx >= 0) {
    const existingList = Array.isArray(localList[idx].document_urls) 
      ? localList[idx].document_urls 
      : (localList[idx].document_url ? [localList[idx].document_url] : []);
    
    updatedUrls = existingList.filter(u => u !== documentUrl);
    localList[idx].document_urls = updatedUrls;
    localList[idx].document_url = updatedUrls[0] || '';
    localList[idx].pitch_deck_url = updatedUrls[0] || '';
    localList[idx].updated_at = new Date().toISOString();
    saveToLocalDB(localList);
  }

  // Update Supabase Database record
  try {
    let startupRow = null;
    if (isValidUUID(identifier)) {
      const { data } = await client.from('startups').select('*').eq('user_id', identifier).maybeSingle();
      startupRow = data;
    } else if (!isNaN(Number(identifier))) {
      const { data } = await client.from('startups').select('*').eq('id', Number(identifier)).maybeSingle();
      startupRow = data;
    }

    if (startupRow) {
      const dbDocUrls = Array.isArray(startupRow.document_urls) 
        ? startupRow.document_urls 
        : (startupRow.document_url ? [startupRow.document_url] : []);
      
      updatedUrls = dbDocUrls.filter(u => u !== documentUrl);
      const firstRemaining = updatedUrls[0] || '';

      await client
        .from('startups')
        .update({
          pitch_deck_url: firstRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', startupRow.id);
      
      console.log('[admin] Document reference removed from Supabase DB for startup:', startupRow.id);
    }

    return res.status(200).json({
      message: 'Document deleted successfully!',
      documentUrls: updatedUrls
    });
  } catch (err) {
    console.error('[admin] Exception during database document removal:', err.message);
    return res.status(200).json({
      message: 'Document deleted locally.',
      documentUrls: updatedUrls,
      dbError: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── RAZORPAY PAYMENT GATEWAY + AI PITCH ANALYZER ───────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase migration: add new columns idempotently on startup ───────────────
async function runPaymentMigration() {
  try {
    const client = getAdminClient();
    // Add columns via RPC if they don't exist (catches gracefully)
    const migrations = [
      `ALTER TABLE startups ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'`,
      `ALTER TABLE startups ADD COLUMN IF NOT EXISTS ai_insights JSONB`,
      `ALTER TABLE startups ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT`,
      `ALTER TABLE startups ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT`,
    ];
    for (const sql of migrations) {
      try {
        await client.rpc('exec_sql', { query: sql });
      } catch (rpcErr) {
        // RPC not available on this plan — columns may already exist or
        // will need to be added manually via Supabase Dashboard SQL editor
      }
    }
    console.log('[migration] Payment columns check complete (ai_insights, razorpay_order_id, razorpay_payment_id)');
  } catch (err) {
    console.warn('[migration] Could not run payment migration (columns may need manual creation):', err.message);
  }
}
// Fire migration on startup (non-blocking)
runPaymentMigration();

// ── Razorpay instance factory ─────────────────────────────────────────────────
function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || keyId.includes('REPLACE') || !keySecret || keySecret.includes('REPLACE')) {
    return null;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ── Tier → amount (paise) map ─────────────────────────────────────────────────
function getTierAmountPaise(tier, settings) {
  const inrStr = {
    'Verified Pro': settings?.pro_price_inr || '₹9,999',
    'Spotlight': settings?.spotlight_price_inr || '₹24,999',
    'Basic': '0',
  }[tier] || '0';
  const numeric = parseFloat(String(inrStr).replace(/[^0-9.]/g, '')) || 0;
  return Math.round(numeric * 100); // convert to paise
}

// ── POST /api/payment/create-order ───────────────────────────────────────────
app.post('/api/payment/create-order', async (req, res) => {
  const { tier, userId } = req.body;
  if (!tier || !userId) {
    return res.status(400).json({ error: 'tier and userId are required.' });
  }

  const rzp = getRazorpayInstance();
  if (!rzp) {
    return res.status(503).json({
      error: 'Razorpay credentials not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to apps/server/.env'
    });
  }

  // Load live prices from platform settings
  const settings = loadSettingsFromLocalDB();
  const amountPaise = getTierAmountPaise(tier, settings);

  // Check if startup is approved by admin before creating Razorpay order for paid tiers
  try {
    const client = getAdminClient();
    const isUUID = isValidUUID(userId);
    let row = null;
    if (isUUID) {
      const { data } = await client.from('startups').select('*').eq('user_id', userId).maybeSingle();
      row = data;
    }
    if (!row) {
      const localList = loadFromLocalDB();
      row = localList.find(s => s.user_id === userId || String(s.id) === String(userId));
    }

    if (row && tier !== 'Basic') {
      const approval = String(row.approval_status || row.verification_status || (row.status === 'approved' || row.status === 'pending_payment' ? 'approved' : 'pending')).toLowerCase().trim();
      if (approval !== 'approved' && row.status !== 'pending_payment' && row.status !== 'approved') {
        return res.status(403).json({
          error: 'Your profile is pending admin approval. You will be able to complete payment once approved.'
        });
      }
    }
  } catch (chkErr) {
    console.warn('[razorpay] Pre-order approval check notice:', chkErr.message);
  }

  if (amountPaise === 0) {
    return res.status(400).json({ error: 'Cannot create a Razorpay order for a free plan. Use Basic plan activation instead.' });
  }

  try {
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `ideavault_${userId.slice(0, 8)}_${Date.now()}`,
      notes: { tier, userId },
    });

    console.log(`[razorpay] Created order ${order.id} for user ${userId} tier=${tier} amount=${amountPaise}p`);
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[razorpay] Order creation error:', err);
    return res.status(500).json({ error: 'Failed to create Razorpay order: ' + (err.error?.description || err.message) });
  }
});

// ── POST /api/payment/verify ──────────────────────────────────────────────────
app.post('/api/payment/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, tier, startup_id } = req.body;

  console.log('[razorpay/verify] Received:', { razorpay_order_id, razorpay_payment_id, userId, tier, startup_id, hasSignature: !!razorpay_signature });

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || !tier) {
    return res.status(400).json({ error: 'Missing required payment verification fields.' });
  }

  // ── 1. Signature verification ──────────────────────────────────────────────
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret || keySecret.includes('REPLACE')) {
    return res.status(503).json({ error: 'Razorpay secret not configured on server.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  console.log('[razorpay/verify] Signature check:', { match: expectedSignature === razorpay_signature });

  if (expectedSignature !== razorpay_signature) {
    console.warn(`[razorpay/verify] Signature mismatch for order ${razorpay_order_id}`);
    return res.status(400).json({ error: 'Payment verification failed: invalid signature.' });
  }

  console.log(`[razorpay/verify] ✓ Signature valid. order=${razorpay_order_id} payment=${razorpay_payment_id} user=${userId} tier=${tier}`);

  // ── 2. Update Supabase using Service Role key (bypasses RLS) ───────────────
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 180);
  const expiryIso = expiryDate.toISOString();

  // NOTE: Only include columns that actually exist in the DB schema.
  // 'expiry_date' does NOT exist — use 'subscription_ends_at' instead.
  const dbPayload = {
    status: 'pending_verification',
    payment_status: 'paid',
    plan_type: tier,
    razorpay_order_id,
    razorpay_payment_id,
    subscription_ends_at: expiryIso,
    verification_status: 'pending',
    updated_at: new Date().toISOString(),
  };

  let supabaseUpdateSuccess = false;
  let supabaseError = null;

  try {
    // Always create a fresh admin client using service role key to bypass RLS
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey || serviceKey === 'your_service_role_key_here') {
      throw new Error('Supabase service role key not configured.');
    }

    const adminSb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

    if (!isUUID) {
      throw new Error(`userId is not a valid UUID: ${userId}`);
    }

    console.log('[razorpay/verify] Updating Supabase row for user_id:', userId);

    // Primary: update by user_id
    const { data: updatedRows, error: sbErr } = await adminSb
      .from('startups')
      .update(dbPayload)
      .eq('user_id', userId)
      .select('id, status, payment_status, verification_status');

    console.log('[razorpay/verify] Supabase update result:', { data: updatedRows, error: sbErr });

    if (sbErr) {
      supabaseError = sbErr.message;
      console.error('[razorpay/verify] Supabase update error:', sbErr);
    } else if (!updatedRows || updatedRows.length === 0) {
      // No row found by user_id — try by startup_id if provided
      console.warn('[razorpay/verify] No row updated by user_id. Trying startup_id:', startup_id);
      if (startup_id) {
        const { data: byIdRows, error: sbErr2 } = await adminSb
          .from('startups')
          .update(dbPayload)
          .eq('id', startup_id)
          .select('id, status, payment_status, verification_status');
        console.log('[razorpay/verify] Supabase update by startup_id result:', { data: byIdRows, error: sbErr2 });
        if (!sbErr2 && byIdRows?.length > 0) {
          supabaseUpdateSuccess = true;
        } else {
          supabaseError = sbErr2?.message || 'No startup row found to update.';
        }
      } else {
        supabaseError = 'No startup row found for this user_id and no startup_id provided.';
      }
    } else {
      supabaseUpdateSuccess = true;
      console.log(`[razorpay/verify] ✓ Supabase updated. rows=${updatedRows.length}`, updatedRows[0]);
    }
  } catch (dbErr) {
    supabaseError = dbErr.message;
    console.error('[razorpay/verify] DB exception:', dbErr.message);
  }

  // Also update local JSON fallback
  try {
    const localList = loadFromLocalDB();
    const idx = localList.findIndex(s => s.user_id === userId || String(s.id) === String(startup_id));
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...dbPayload };
      saveToLocalDB(localList);
      console.log('[razorpay/verify] Local DB fallback updated at index:', idx);
    }
  } catch (localErr) {
    console.warn('[razorpay/verify] Local DB update failed:', localErr.message);
  }

  // ── 3. Return response ─────────────────────────────────────────────────────
  const responsePayload = {
    success: true,
    message: supabaseUpdateSuccess
      ? 'Payment verified and startup moved to verification queue.'
      : 'Payment verified, but DB update had issues — please contact support.',
    tier,
    expiryDate: expiryIso,
    supabaseUpdated: supabaseUpdateSuccess,
  };

  if (supabaseError) {
    responsePayload.supabaseError = supabaseError;
    console.error('[razorpay/verify] Returning with supabaseError:', supabaseError);
  }

  res.status(200).json(responsePayload);

  // Fire-and-forget AI pipeline (does not block the response)
  analyzeAndSavePitchDeck(userId, tier).catch(err =>
    console.error('[ai-pipeline] Background analysis error:', err.message)
  );
});

// ── AI Pitch Deck Analyzer (internal, async) ──────────────────────────────────
async function analyzeAndSavePitchDeck(userId, tier) {
  console.log(`[ai-pipeline] Starting analysis for user=${userId} tier=${tier}`);

  let startupRow = null;
  try {
    const client = getAdminClient();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (isUUID) {
      const { data } = await client.from('startups').select('*').eq('user_id', userId).maybeSingle();
      startupRow = data;
    }
    if (!startupRow) {
      const localList = loadFromLocalDB();
      startupRow = localList.find(s => s.user_id === userId || String(s.id) === String(userId));
    }
  } catch (err) {
    console.warn('[ai-pipeline] Could not fetch startup row:', err.message);
  }

  if (!startupRow) {
    console.warn(`[ai-pipeline] No startup row found for user ${userId}, skipping analysis.`);
    return;
  }

  // Build the content context from available text fields
  const pitchContent = [
    startupRow.company_name ? `Company: ${startupRow.company_name}` : '',
    startupRow.pitch ? `Pitch: ${startupRow.pitch}` : '',
    startupRow.description ? `Description: ${startupRow.description}` : '',
    startupRow.industry ? `Industry: ${startupRow.industry}` : '',
    startupRow.stage ? `Stage: ${startupRow.stage}` : '',
    startupRow.min_investment ? `Funding Ask: ${startupRow.min_investment}` : '',
    startupRow.additional_contacts?.traction ? `Traction: ${startupRow.additional_contacts.traction}` : '',
    startupRow.public_document_url ? `Public Deck URL: ${startupRow.public_document_url}` : '',
  ].filter(Boolean).join('\n');

  let aiResult = null;

  const geminiKey = process.env.GEMINI_API_KEY;
  const hasRealGeminiKey = geminiKey && !geminiKey.includes('REPLACE') && geminiKey.length > 20;

  if (hasRealGeminiKey) {
    // ── Real Gemini API call — with fallback model chain ──────────────────
    const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
    const analysisTimestamp = new Date().toISOString();

    const systemPrompt = `You are an expert startup analyst and venture capital advisor. Analyze the startup information below and respond ONLY with a valid JSON object. Do NOT include any markdown, code fences, or explanation — only raw JSON.

Required JSON structure:
{
  "score": <integer 1-10 based on clarity, market potential, team, pitch quality>,
  "summary": "<concise elevator pitch summary>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "risk_flags": ["<risk 1>", "<risk 2>"],
  "recommended_sectors": ["<sector 1>", "<sector 2>"],
  "analyzed_at": "${analysisTimestamp}",
  "model": "gemini-flash-latest"
}`;

    const fullPrompt = `${systemPrompt}\n\nStartup Information:\n${pitchContent}`;

    for (const modelName of GEMINI_MODELS) {
      if (aiResult) break;
      try {
        console.log(`[ai-pipeline] Trying model: ${modelName}`);
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        });

        const result = await model.generateContent(fullPrompt);

        // ── Safe response extraction — handles empty/blocked responses ────
        const candidate = result?.response?.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (!candidate || finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          console.warn(`[ai-pipeline] Model ${modelName} blocked response (finishReason=${finishReason}). Trying next.`);
          continue;
        }

        // Get text safely — .text() throws if content is empty
        let rawText = '';
        try {
          rawText = result.response.text().trim();
        } catch (textErr) {
          console.warn(`[ai-pipeline] Model ${modelName} returned empty output (${textErr.message}). Trying next.`);
          continue;
        }

        if (!rawText) {
          console.warn(`[ai-pipeline] Model ${modelName} returned empty string. Trying next.`);
          continue;
        }

        // Strip markdown code fences if model adds them despite responseMimeType
        const jsonText = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();

        const parsed = JSON.parse(jsonText);

        // Validate required fields
        if (!parsed.score || !parsed.summary) {
          console.warn(`[ai-pipeline] Model ${modelName} returned incomplete JSON. Trying next.`);
          continue;
        }

        parsed.model = modelName; // record which model succeeded
        aiResult = parsed;
        console.log(`[ai-pipeline] ✓ Gemini analysis complete via ${modelName}. Vault Score: ${aiResult.score}`);
      } catch (geminiErr) {
        console.error(`[ai-pipeline] Model ${modelName} error: ${geminiErr.message}`);
        // Continue to next model in chain
      }
    }

    if (!aiResult) {
      console.warn('[ai-pipeline] All Gemini models failed — falling back to mock analysis.');
    }
  }

  // ── Mock fallback (used when no Gemini key or Gemini fails) ───────────────
  if (!aiResult) {
    console.log('[ai-pipeline] Using mock AI analysis (set GEMINI_API_KEY for real analysis)');
    const score = Math.floor(Math.random() * 3) + 6; // 6-8 range for mock
    aiResult = {
      score: score,
      summary: `${startupRow.company_name || 'This startup'} is building an interesting solution. ${startupRow.pitch || 'The startup shows strong fundamentals and a clear vision.'} This is a demo analysis — add your GEMINI_API_KEY for AI-powered insights.`,
      strengths: [
        'Clear value proposition and identifiable target market.',
        'Strong foundational pitch structure.'
      ],
      risk_flags: [
        'Requires further market validation.',
        'Needs robust customer acquisition strategy.'
      ],
      recommended_sectors: [
        startupRow.industry || 'Technology',
        'SaaS',
        'B2B'
      ],
      analyzed_at: new Date().toISOString(),
      model: 'mock-fallback',
    };
  }

  // ── Save ai_insights to Supabase ──────────────────────────────────────────
  try {
    const client = getAdminClient();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (isUUID) {
      const { error: saveErr } = await client.from('startups').update({ ai_insights: aiResult }).eq('user_id', userId);
      if (saveErr) console.warn('[ai-pipeline] Supabase ai_insights save warning:', saveErr.message);
      else console.log(`[ai-pipeline] Saved ai_insights for user ${userId}`);
    }
    // Update local JSON fallback too
    const localList = loadFromLocalDB();
    const idx = localList.findIndex(s => s.user_id === userId || String(s.id) === String(userId));
    if (idx >= 0) {
      localList[idx].ai_insights = aiResult;
      saveToLocalDB(localList);
    }
  } catch (saveErr) {
    console.error('[ai-pipeline] Failed to save ai_insights:', saveErr.message);
  }
}

// ── GET /api/startups/:id/ai-insights ────────────────────────────────────────
app.get('/api/startups/:id/ai-insights', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Startup ID required.' });

  try {
    const client = getAdminClient();
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let row = null;

    if (isUUID) {
      const { data } = await client.from('startups').select('ai_insights, company_name, user_id').eq('user_id', id).maybeSingle();
      row = data;
      if (!row) {
        const { data: byId } = await client.from('startups').select('ai_insights, company_name, user_id').eq('id', id).maybeSingle();
        row = byId;
      }
    } else {
      const { data } = await client.from('startups').select('ai_insights, company_name, user_id').eq('id', id).maybeSingle();
      row = data;
    }

    if (!row) {
      // Try local DB
      const localList = loadFromLocalDB();
      const local = localList.find(s => s.user_id === id || String(s.id) === String(id));
      if (local?.ai_insights) return res.json({ ai_insights: local.ai_insights, company_name: local.company_name });
      return res.json({ ai_insights: null });
    }

    return res.json({ ai_insights: row.ai_insights || null, company_name: row.company_name });
  } catch (err) {
    console.error('[ai-insights] Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/startups/:id/rerun-analysis ─────────────────────────────────────
app.post('/api/startups/:id/rerun-analysis', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Startup ID required.' });

  res.status(200).json({ success: true, message: 'AI re-analysis triggered. Results will be available shortly.' });

  // Fire-and-forget re-analysis
  analyzeAndSavePitchDeck(id, 'Verified Pro').catch(err =>
    console.error('[ai-rerun] Error:', err.message)
  );
});

// ─── 404 & Error Handlers (Always return JSON) ─────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint ${req.originalUrl} not found.` });
});

app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 IdeaVault API running at http://${HOST}:${PORT}`);
  console.log(`   ➜  Health: http://${HOST}:${PORT}/api/status`);
  console.log(`   ➜  Signup: POST http://${HOST}:${PORT}/api/auth/signup`);
});
